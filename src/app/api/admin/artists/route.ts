import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT
        p.wallet_address,
        p.display_name,
        p.instagram_handle,
        p.instagram_verified,
        p.instagram_name,
        p.instagram_picture,
        p.tiktok_handle,
        p.tiktok_verified,
        p.tiktok_name,
        p.tiktok_picture,
        p.facebook_handle,
        p.facebook_verified,
        p.facebook_name,
        p.facebook_picture,
        yb.channel_id        AS youtube_channel_id,
        yb.channel_name      AS youtube_channel_name,
        yb.channel_thumbnail AS youtube_channel_thumbnail
      FROM user_profiles p
      LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
      WHERE p.is_artist = TRUE
      ORDER BY p.updated_at DESC
    `;

    const artists = rows.map((r) => {
      // Beste verfügbare Profilbild + Name bestimmen
      let name: string | null = r.display_name ?? null;
      let picture: string | null = null;

      if (r.youtube_channel_id) {
        name ??= r.youtube_channel_name ?? null;
        picture = r.youtube_channel_thumbnail ?? null;
      } else if (r.instagram_verified && r.instagram_handle) {
        name ??= r.instagram_name ?? `@${r.instagram_handle}`;
        picture = r.instagram_picture ?? null;
      } else if (r.tiktok_verified && r.tiktok_handle) {
        name ??= r.tiktok_name ?? `@${r.tiktok_handle}`;
        picture = r.tiktok_picture ?? null;
      } else if (r.facebook_verified && r.facebook_handle) {
        name ??= r.facebook_name ?? `@${r.facebook_handle}`;
        picture = r.facebook_picture ?? null;
      }

      return {
        walletAddress: r.wallet_address,
        name: name ?? r.wallet_address.slice(0, 6) + '…' + r.wallet_address.slice(-4),
        picture,
      };
    });

    return NextResponse.json({ artists });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
