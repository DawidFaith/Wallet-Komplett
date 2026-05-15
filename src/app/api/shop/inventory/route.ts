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
      sp.purchased_at,
      p.display_name AS artist_name,
      p.picture_url  AS artist_picture
    FROM shop_purchases sp
    JOIN shop_items si ON si.id = sp.item_id
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = LOWER(si.artist_wallet)
    WHERE sp.buyer_wallet = ${wallet}
    ORDER BY sp.purchased_at DESC
  `;

  return NextResponse.json(rows);
}
