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

  const result = rows.map((r) => {
    let pictureUrl: string | null = null;
    let displayName: string | null = (r.display_name as string | null) ?? null;
    const dp = r.display_platform as string | null;
    if (dp === 'youtube' && r.youtube_channel_id) {
      pictureUrl = (r.youtube_channel_thumbnail as string | null) ?? null;
      displayName ??= (r.youtube_channel_name as string | null) ?? null;
    } else if (dp === 'instagram' && r.instagram_handle) {
      pictureUrl = (r.instagram_picture as string | null) ?? null;
      displayName ??= (r.instagram_name as string | null) ?? `@${r.instagram_handle}`;
    } else if (dp === 'tiktok' && r.tiktok_handle) {
      pictureUrl = (r.tiktok_picture as string | null) ?? null;
      displayName ??= (r.tiktok_name as string | null) ?? `@${r.tiktok_handle}`;
    } else if (dp === 'facebook' && r.facebook_handle) {
      pictureUrl = (r.facebook_picture as string | null) ?? null;
      displayName ??= (r.facebook_name as string | null) ?? `@${r.facebook_handle}`;
    } else {
      // Fallback: erste verfügbare Plattform
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
    }
    return {
      artist_wallet:      r.artist_wallet,
      display_name:       displayName,
      picture_url:        pictureUrl,
      item_count:         r.item_count,
      reward_token:       (r.reward_token as string | null) ?? null,
      token_mint_address: (r.token_mint_address as string | null) ?? null,
    };
  });

  return NextResponse.json(result);
}
