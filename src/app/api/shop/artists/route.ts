/**
 * GET /api/shop/artists
 * Gibt alle Artists zurück, die mindestens ein aktives Shop-Item haben.
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  const sql = getDb();

  const rows = await sql`
    SELECT DISTINCT
      si.artist_wallet,
      up.display_name,
      up.picture_url,
      COUNT(si.id)::int AS item_count
    FROM shop_items si
    LEFT JOIN user_profiles up ON up.wallet_address = si.artist_wallet
    WHERE si.is_active = TRUE
    GROUP BY si.artist_wallet, up.display_name, up.picture_url
    ORDER BY item_count DESC, up.display_name ASC
  `;

  return NextResponse.json(rows);
}
