/**
 * GET /api/admin/debug-shop-nft?solanaAddress=... — TEMPORÄR (2026-07-14)
 * Header: x-admin-secret
 *
 * Read-only Diagnose: löst solanaAddress -> wallet_address auf und zeigt
 * exakt die Rohdaten, die /api/nfts und /api/shop/inventory für dieses
 * Konto verwenden würden, um den Wallet/Inventory-Anzeigefehler einzugrenzen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

async function getOwnedMints(solanaAddress: string): Promise<string[]> {
  const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id:      'debug-owned-mints',
      method:  'getAssetsByOwner',
      params: {
        ownerAddress: solanaAddress,
        page:         1,
        limit:        1000,
        options:      { showFungible: false, showNativeBalance: false },
      },
    }),
  });
  const json = await res.json() as { result?: { items?: Array<{ id: string; burnt?: boolean }> } };
  return (json.result?.items ?? []).filter(i => !i.burnt).map(i => i.id);
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const solanaAddress = new URL(req.url).searchParams.get('solanaAddress');
  if (!solanaAddress) {
    return NextResponse.json({ error: 'solanaAddress erforderlich' }, { status: 400 });
  }

  const sql = getDb();

  const accountRows = await sql`
    SELECT wallet_address FROM solana_accounts WHERE solana_address = ${solanaAddress} LIMIT 1
  `;
  if (!accountRows.length) {
    return NextResponse.json({ error: 'Kein Account mit dieser solanaAddress' }, { status: 404 });
  }
  const walletAddress = accountRows[0].wallet_address as string;

  const purchases = await sql`
    SELECT sp.id, sp.item_id, sp.nft_mint_address, sp.edition_number, sp.purchased_at,
           si.title, si.type, si.content_url, si.is_active
    FROM shop_purchases sp
    JOIN shop_items si ON si.id = sp.item_id
    WHERE sp.buyer_wallet = ${walletAddress}
    ORDER BY sp.purchased_at DESC
  `;

  const activeListings = await sql`
    SELECT mint_address FROM nft_listings WHERE status = 'active'
  `;
  const listedMints = new Set(activeListings.map(r => r.mint_address as string));

  let ownedMints: string[] = [];
  let ownedMintsError: string | null = null;
  try {
    ownedMints = await getOwnedMints(solanaAddress);
  } catch (e) {
    ownedMintsError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    walletAddress,
    solanaAddress,
    ownedMints,
    ownedMintsError,
    purchases: purchases.map(p => ({
      purchaseId:     p.id,
      itemId:         p.item_id,
      nftMintAddress: p.nft_mint_address,
      editionNumber:  p.edition_number,
      purchasedAt:    p.purchased_at,
      title:          p.title,
      type:           p.type,
      contentUrl:     p.content_url,
      itemIsActive:   p.is_active,
      isListedActive: listedMints.has(p.nft_mint_address as string),
      wouldShowInInventory:
        !!p.nft_mint_address
        && !listedMints.has(p.nft_mint_address as string)
        && ownedMints.includes(p.nft_mint_address as string),
    })),
  });
}
