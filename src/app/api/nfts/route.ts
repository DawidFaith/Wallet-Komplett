/**
 * GET /api/nfts?wallet=0x...
 * Gibt alle Print-Edition NFTs zurück die der User im Shop gekauft hat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic     = 'force-dynamic';
export const fetchCache  = 'force-no-store';
export const revalidate  = 0;
export const runtime     = 'nodejs';

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const sql = getDb();

  const rows = await sql`
    SELECT
      sp.id           AS purchase_id,
      sp.item_id,
      sp.nft_mint_address AS print_mint,
      sp.edition_number,
      sp.purchased_at,
      si.title,
      si.image_url,
      si.description,
      si.content_url,
      si.type,
      si.nft_max_supply,
      si.master_edition_mint,
      COALESCE(p.display_name, yb.channel_name, p.instagram_name, p.tiktok_name) AS artist_name,
      COALESCE(
        CASE WHEN p.display_platform = 'clerk'     THEN p.clerk_image_url        ELSE NULL END,
        CASE WHEN p.display_platform = 'youtube'   THEN yb.channel_thumbnail     ELSE NULL END,
        CASE WHEN p.display_platform = 'instagram' THEN p.instagram_picture      ELSE NULL END,
        CASE WHEN p.display_platform = 'tiktok'    THEN p.tiktok_picture         ELSE NULL END,
        CASE WHEN p.display_platform = 'facebook'  THEN p.facebook_picture       ELSE NULL END,
        p.clerk_image_url,
        yb.channel_thumbnail,
        p.instagram_picture,
        p.tiktok_picture
      ) AS artist_picture
    FROM shop_purchases sp
    JOIN shop_items si ON si.id = sp.item_id
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = si.artist_wallet
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
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
    contentUrl:        r.content_url   as string | null,
    type:              r.type          as string,
    nftMaxSupply:      r.nft_max_supply != null ? Number(r.nft_max_supply) : null,
    masterEditionMint: r.master_edition_mint as string | null,
    artistName:        r.artist_name   as string | null,
    artistPicture:     r.artist_picture as string | null,
  })), { headers: { 'Cache-Control': 'no-store' } });
}
