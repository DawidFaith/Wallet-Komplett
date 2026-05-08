import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerWallet = searchParams.get('wallet')?.toLowerCase() ?? null;
    const sql = getDb();

    // Spalten artist_type / artist_bio ggf. noch nicht vorhanden → sicher nachrüsten
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS artist_type TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS artist_bio TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS reward_token TEXT DEFAULT 'D.FAITH'`;

    const rows = await sql`
      SELECT
        p.wallet_address,
        p.display_name,
        p.artist_type,
        p.artist_bio,
        p.reward_token,
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
        yb.channel_thumbnail AS youtube_channel_thumbnail,
        COALESCE((
          SELECT COUNT(*) FROM quests q
          WHERE q.creator_wallet = p.wallet_address
            AND q.is_active = TRUE
            AND (q.expires_at IS NULL OR q.expires_at > NOW())
            AND (
              ${viewerWallet}
                IS NULL
              OR q.id NOT IN (
                SELECT qc.quest_id FROM quest_completions qc
                WHERE qc.wallet_address = ${viewerWallet}
              )
            )
        ), 0) AS quest_count
      FROM user_profiles p
      LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
      WHERE p.is_artist = TRUE
      ORDER BY p.updated_at DESC
    `;

    const artists = rows.map((r) => {
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
        artistType: r.artist_type ?? null,
        artistBio: r.artist_bio ?? null,
        rewardToken: r.reward_token ?? 'D.FAITH',
        questCount: Number(r.quest_count),
        socials: {
          youtubeChannelId: r.youtube_channel_id ?? null,
          youtubeChannelName: r.youtube_channel_name ?? null,
          youtubeChannelThumbnail: r.youtube_channel_thumbnail ?? null,
          instagramHandle: r.instagram_handle ?? null,
          instagramVerified: Boolean(r.instagram_verified),
          instagramName: r.instagram_name ?? null,
          instagramPicture: r.instagram_picture ?? null,
          tiktokHandle: r.tiktok_handle ?? null,
          tiktokVerified: Boolean(r.tiktok_verified),
          tiktokName: r.tiktok_name ?? null,
          tiktokPicture: r.tiktok_picture ?? null,
          facebookHandle: r.facebook_handle ?? null,
          facebookVerified: Boolean(r.facebook_verified),
          facebookName: r.facebook_name ?? null,
          facebookPicture: r.facebook_picture ?? null,
        },
      };
    });

    return NextResponse.json({ artists });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
