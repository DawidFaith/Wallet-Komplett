/**
 * GET /api/shop/artists
 * Gibt alle Artists zurück, die mindestens ein aktives Shop-Item haben.
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getDb();

  const rows = await sql`
    SELECT
      si.artist_wallet,
      up.display_name,
      up.instagram_name,   up.instagram_picture,
      up.tiktok_name,      up.tiktok_picture,
      up.facebook_name,    up.facebook_picture,
      yb.channel_name      AS youtube_channel_name,
      yb.channel_thumbnail AS youtube_channel_thumbnail,
      COUNT(si.id)::int    AS item_count
    FROM shop_items si
    LEFT JOIN user_profiles up ON up.wallet_address = si.artist_wallet
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = si.artist_wallet
    WHERE si.is_active = TRUE
    GROUP BY
      si.artist_wallet, up.display_name,
      up.instagram_name, up.instagram_picture,
      up.tiktok_name, up.tiktok_picture,
      up.facebook_name, up.facebook_picture,
      yb.channel_name, yb.channel_thumbnail
    ORDER BY item_count DESC, up.display_name ASC
  `;

  const result = rows.map((r) => {
    // Bestes verfügbares Bild ermitteln (gleiche Prio wie ReputationTab)
    let pictureUrl: string | null = null;
    let displayName: string | null = (r.display_name as string | null) ?? null;
    if (r.youtube_channel_thumbnail) {
      pictureUrl = r.youtube_channel_thumbnail as string;
      displayName ??= r.youtube_channel_name as string ?? null;
    } else if (r.instagram_picture) {
      pictureUrl = r.instagram_picture as string;
      displayName ??= r.instagram_name as string ?? null;
    } else if (r.tiktok_picture) {
      pictureUrl = r.tiktok_picture as string;
      displayName ??= r.tiktok_name as string ?? null;
    } else if (r.facebook_picture) {
      pictureUrl = r.facebook_picture as string;
      displayName ??= r.facebook_name as string ?? null;
    }
    return {
      artist_wallet: r.artist_wallet,
      display_name:  displayName,
      picture_url:   pictureUrl,
      item_count:    r.item_count,
    };
  });

  return NextResponse.json(result);
}
