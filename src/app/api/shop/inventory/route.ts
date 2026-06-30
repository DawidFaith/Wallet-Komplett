/**
 * GET /api/shop/inventory?wallet=XXX
 * Gibt alle gekauften Items zurück die der User wirklich noch besitzt:
 * - nicht aktiv auf dem Marktplatz gelistet
 * - on-chain noch in seiner Solana-Wallet (getTokenAccountsByOwner)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

/** Gibt alle Mint-Adressen zurück die aktuell on-chain in diesem Wallet liegen (amount > 0). */
async function getOwnedMints(solanaAddress: string): Promise<Set<string>> {
  try {
    const conn     = new Connection(RPC_URL, 'confirmed');
    const ownerPk  = new PublicKey(solanaAddress);
    const accounts = await conn.getTokenAccountsByOwner(ownerPk, { programId: TOKEN_PROGRAM_ID });
    const mints    = new Set<string>();
    for (const { account } of accounts.value) {
      const data   = account.data;
      // SPL Token account layout: mint is bytes 0–31
      const mint   = new PublicKey(data.slice(0, 32)).toBase58();
      const amount = data.readBigUInt64LE(64);
      if (amount > 0n) mints.add(mint);
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
      AND sp.nft_mint_address IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM nft_listings nl
        WHERE nl.mint_address = sp.nft_mint_address
          AND nl.status = 'active'
      )
    ORDER BY sp.purchased_at DESC
  `;

  // On-chain filtern: nur NFTs anzeigen die der User wirklich noch hält
  // Falls kein Solana-Wallet verknüpft ist, fällt das on-chain-Filter weg (rows wie gehabt)
  const filtered = solanaAddress
    ? rows.filter(r => ownedMints.has(r.print_mint as string))
    : rows;

  return NextResponse.json(filtered);
}
