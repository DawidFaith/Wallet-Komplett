/**
 * GET /api/shop/inventory?wallet=XXX
 * Gibt alle gekauften Items zurück die der User wirklich noch besitzt:
 * - nicht aktiv auf dem Marktplatz gelistet
 * - on-chain noch in seiner Solana-Wallet (Helius DAS getAssetsByOwner)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

/**
 * Gibt alle Mint-/Asset-Adressen zurück die aktuell on-chain in diesem Wallet liegen.
 * Song Print Editions und Collectibles sind mpl-core Assets (keine SPL-Token-Konten) —
 * daher über die Helius DAS API abgefragt statt getTokenAccountsByOwner.
 */
async function getOwnedMints(solanaAddress: string): Promise<Set<string>> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      'get-owned-mints',
        method:  'getAssetsByOwner',
        params: {
          ownerAddress: solanaAddress,
          page:         1,
          limit:        1000,
          options:      { showFungible: false, showNativeBalance: false },
        },
      }),
    });
    if (!res.ok) return new Set();
    const json = await res.json() as { result?: { items?: Array<{ id: string; burnt?: boolean }> } };
    const mints = new Set<string>();
    for (const item of json.result?.items ?? []) {
      if (!item.burnt) mints.add(item.id);
    }
    return mints;
  } catch {
    return new Set();
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });
  }

  const sql = getDb();
  await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS audio_download_url TEXT`;

  // Solana-Adresse des Users holen für on-chain Prüfung
  const solanaRows = await sql`
    SELECT solana_address FROM solana_accounts WHERE wallet_address = ${wallet} LIMIT 1
  `;
  const solanaAddress = (solanaRows[0]?.solana_address as string | undefined) ?? null;

  // On-chain gehaltene Mints (ein RPC-Call für alle auf einmal)
  const ownedMints = solanaAddress ? await getOwnedMints(solanaAddress) : new Set<string>();

  const rows = await sql`
    SELECT
      si.id,
      si.artist_wallet,
      si.title,
      si.description,
      si.type,
      si.price_credits,
      si.price_tokens,
      si.content_url,
      si.image_url,
      si.is_active,
      si.created_at,
      si.nft_max_supply,
      si.master_edition_mint,
      si.audio_download_url,
      sp.purchased_at,
      sp.nft_mint_address AS print_mint,
      sp.edition_number,
      COALESCE(
        p.display_name,
        CASE WHEN p.display_platform = 'youtube'   THEN yb.channel_name      ELSE NULL END,
        CASE WHEN p.display_platform = 'instagram' THEN p.instagram_name     ELSE NULL END,
        CASE WHEN p.display_platform = 'tiktok'    THEN p.tiktok_name        ELSE NULL END,
        CASE WHEN p.display_platform = 'facebook'  THEN p.facebook_name      ELSE NULL END,
        yb.channel_name,
        p.instagram_name,
        p.tiktok_name,
        p.facebook_name
      ) AS artist_name,
      COALESCE(
        CASE WHEN p.display_platform = 'clerk'      THEN p.clerk_image_url     ELSE NULL END,
        CASE WHEN p.display_platform = 'youtube'    THEN yb.channel_thumbnail  ELSE NULL END,
        CASE WHEN p.display_platform = 'instagram'  THEN p.instagram_picture   ELSE NULL END,
        CASE WHEN p.display_platform = 'tiktok'     THEN p.tiktok_picture      ELSE NULL END,
        CASE WHEN p.display_platform = 'facebook'   THEN p.facebook_picture    ELSE NULL END,
        p.clerk_image_url,
        yb.channel_thumbnail,
        p.instagram_picture,
        p.tiktok_picture,
        p.facebook_picture
      ) AS artist_picture
    FROM shop_purchases sp
    JOIN shop_items si ON si.id = sp.item_id
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = LOWER(si.artist_wallet)
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
    WHERE sp.buyer_wallet = ${wallet}
      AND (sp.nft_mint_address IS NOT NULL OR si.type = 'video')
      AND (
        sp.nft_mint_address IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM nft_listings nl
          WHERE nl.mint_address = sp.nft_mint_address
            AND nl.status = 'active'
        )
      )
    ORDER BY sp.purchased_at DESC
  `;

  // On-chain filtern: nur NFTs anzeigen die der User wirklich noch hält.
  // Pre-Release-Videos haben keinen Mint (print_mint = null) — die sind reine
  // DB-Zugriffskäufe ohne On-Chain-Gegenstück und daher immer enthalten.
  const filtered = rows.filter(r => {
    const printMint = r.print_mint as string | null;
    if (!printMint) return true;
    if (!solanaAddress) return true;
    return ownedMints.has(printMint);
  });

  return NextResponse.json(filtered, { headers: { 'Cache-Control': 'no-store' } });
}
