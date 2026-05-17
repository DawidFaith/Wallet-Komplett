import { NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getDb();
  try {
    const all = await sql`
      SELECT wallet_address, display_name, is_artist, display_platform,
             instagram_handle, tiktok_handle, facebook_handle
      FROM user_profiles
      WHERE is_artist = TRUE
    `;
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_profiles'
      ORDER BY column_name
    `;
    const shopItems = await sql`SELECT artist_wallet, is_active, title FROM shop_items`;
    return NextResponse.json({
      artists_in_user_profiles: all,
      user_profiles_columns: cols.map(c => c.column_name),
      shop_items: shopItems,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
