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

    // EXAKT die Shop-Query
    const shopRows = await sql`
      SELECT
        p.wallet_address     AS artist_wallet,
        p.display_name,
        p.display_platform,
        p.reward_token,
        p.token_mint_address,
        p.instagram_handle,  p.instagram_name,    p.instagram_picture,
        p.tiktok_handle,     p.tiktok_name,       p.tiktok_picture,
        p.facebook_handle,   p.facebook_name,     p.facebook_picture,
        yb.channel_id        AS youtube_channel_id,
        yb.channel_name      AS youtube_channel_name,
        yb.channel_thumbnail AS youtube_channel_thumbnail,
        COUNT(si.id)::int    AS item_count
      FROM user_profiles p
      LEFT JOIN shop_items si
        ON LOWER(si.artist_wallet) = LOWER(p.wallet_address) AND si.is_active = TRUE
      LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
      WHERE p.is_artist = TRUE
      GROUP BY
        p.wallet_address, p.display_name, p.display_platform,
        p.reward_token, p.token_mint_address,
        p.instagram_handle, p.instagram_name, p.instagram_picture,
        p.tiktok_handle, p.tiktok_name, p.tiktok_picture,
        p.facebook_handle, p.facebook_name, p.facebook_picture,
        yb.channel_id, yb.channel_name, yb.channel_thumbnail
      ORDER BY item_count DESC, p.display_name ASC
    `;

    return NextResponse.json({
      artists_in_user_profiles: all,
      user_profiles_columns: cols.map(c => c.column_name),
      shop_items: shopItems,
      shop_query_result: shopRows,
      shop_query_count: shopRows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
