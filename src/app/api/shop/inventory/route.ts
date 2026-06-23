/**
 * GET /api/shop/inventory?wallet=XXX
 * Gibt alle gekauften Items eines Nutzers zurück, inkl. vollständiger contentUrl.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });
  }

  const sql = getDb();

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
        CASE WHEN p.display_platform = 'youtube'    THEN yb.channel_thumbnail  ELSE NULL END,
        CASE WHEN p.display_platform = 'instagram'  THEN p.instagram_picture   ELSE NULL END,
        CASE WHEN p.display_platform = 'tiktok'     THEN p.tiktok_picture      ELSE NULL END,
        CASE WHEN p.display_platform = 'facebook'   THEN p.facebook_picture    ELSE NULL END,
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
    ORDER BY sp.purchased_at DESC
  `;

  return NextResponse.json(rows);
}
