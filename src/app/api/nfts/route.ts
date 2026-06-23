/**
 * GET /api/nfts?wallet=0x...
 * Gibt alle Print-Edition NFTs zurück die der User im Shop gekauft hat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const sql = getDb();

  const rows = await sql`
    SELECT
      sp.id           AS purchase_id,
      sp.item_id,
      sp.print_mint,
      sp.edition_number,
      sp.purchased_at,
      si.title,
      si.image_url,
      si.description,
      si.nft_max_supply,
      si.master_edition_mint,
      p.display_name  AS artist_name
    FROM shop_purchases sp
    JOIN shop_items si ON si.id = sp.item_id
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = si.artist_wallet
    WHERE sp.buyer_wallet = ${wallet.toLowerCase()}
    ORDER BY sp.purchased_at DESC
  `;

  return NextResponse.json(rows.map(r => ({
    purchaseId:        r.purchase_id   as string,
    itemId:            r.item_id       as string,
    printMint:         r.print_mint    as string | null,
    editionNumber:     r.edition_number != null ? Number(r.edition_number) : null,
    purchasedAt:       r.purchased_at  as string,
    title:             r.title         as string,
    imageUrl:          r.image_url     as string,
    description:       r.description   as string,
    nftMaxSupply:      r.nft_max_supply != null ? Number(r.nft_max_supply) : null,
    masterEditionMint: r.master_edition_mint as string | null,
    artistName:        r.artist_name   as string | null,
  })));
}
