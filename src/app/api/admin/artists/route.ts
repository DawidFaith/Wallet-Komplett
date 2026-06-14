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
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_platform TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clerk_image_url TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clerk_name TEXT`;
    // Streaming-Quests-Tabelle sicherstellen (falls noch nicht angelegt)
    await sql`
      CREATE TABLE IF NOT EXISTS streaming_quests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_wallet TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        platform TEXT NOT NULL DEFAULT 'spotify',
        target_streams INT NOT NULL DEFAULT 1000,
        current_streams INT NOT NULL DEFAULT 0,
        reward_per_participant DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_participants INT NOT NULL DEFAULT 100,
        reputation_reward INT NOT NULL DEFAULT 0,
        enrollment_ends_at TIMESTAMPTZ NOT NULL,
        deadline TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'enrollment',
        confirmed_at TIMESTAMPTZ,
        proof_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT
        p.wallet_address,
        p.display_name,
        p.artist_type,
        p.artist_bio,
        p.reward_token,
        p.display_platform,
        p.clerk_image_url,
        p.clerk_name,
        COALESCE(p.is_platform_user, FALSE) AS is_platform_user,
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
          WHERE LOWER(q.creator_wallet) = LOWER(p.wallet_address)
            AND q.is_active = TRUE
            AND (q.expires_at IS NULL OR q.expires_at > NOW())
        ), 0) AS quest_count,
        COALESCE((
          SELECT COUNT(*) FROM streaming_quests sq
          WHERE LOWER(sq.creator_wallet) = LOWER(p.wallet_address)
            AND sq.status IN ('enrollment', 'active')
            AND sq.deadline > NOW()
        ), 0) AS streaming_quest_count,
        COALESCE((
          SELECT COUNT(*) FROM shop_items si
          WHERE LOWER(si.artist_wallet) = LOWER(p.wallet_address)
            AND si.is_active = TRUE
        ), 0) AS shop_item_count
      FROM user_profiles p
      LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
      WHERE p.is_artist = TRUE
      ORDER BY COALESCE(p.is_platform_user, FALSE) DESC, p.updated_at DESC
    `;

    // Bereits abgeschlossene Quests des Supporters nachladen (mit creator_wallet)
    let completedByCreator: Record<string, number> = {};
    if (viewerWallet) {
      const done = await sql`
        SELECT LOWER(q.creator_wallet) AS creator_wallet, COUNT(*) AS cnt
        FROM quest_completions qc
        JOIN quests q ON q.id = qc.quest_id
        WHERE qc.wallet_address = ${viewerWallet}
          AND q.is_active = TRUE
          AND (q.expires_at IS NULL OR q.expires_at > NOW())
        GROUP BY LOWER(q.creator_wallet)
      `;
      for (const row of done) {
        completedByCreator[row.creator_wallet as string] = Number(row.cnt);
      }
    }

    const artists = rows.map((r) => {
      let name: string | null = r.display_name ?? null;
      let picture: string | null = null;
      const dp = r.display_platform as string | null;

      // Vom Artist gewählte Plattform hat Priorität
      if (dp === 'youtube' && r.youtube_channel_id) {
        name ??= r.youtube_channel_name ?? null;
        picture = r.youtube_channel_thumbnail ?? null;
      } else if (dp === 'clerk') {
        const clerkName = (r.clerk_name as string | null);
        picture = (r.clerk_image_url as string | null) ?? null;
        if (clerkName) {
          name = clerkName;
        } else {
          // clerk_name noch nicht gespeichert – Social-Namen als Fallback
          if (r.instagram_verified && r.instagram_name) name = r.instagram_name as string;
          else if (r.facebook_verified && r.facebook_name) name = r.facebook_name as string;
          else if (r.tiktok_verified && r.tiktok_name) name = r.tiktok_name as string;
          else if (r.youtube_channel_name) name = r.youtube_channel_name as string;
        }
      } else if (dp === 'instagram' && r.instagram_handle) {
        name ??= r.instagram_name ?? `@${r.instagram_handle}`;
        picture = r.instagram_picture ?? null;
      } else if (dp === 'tiktok' && r.tiktok_handle) {
        name ??= r.tiktok_name ?? `@${r.tiktok_handle}`;
        picture = r.tiktok_picture ?? null;
      } else if (dp === 'facebook' && r.facebook_handle) {
        name ??= r.facebook_name ?? `@${r.facebook_handle}`;
        picture = r.facebook_picture ?? null;
      } else {
        // Fallback: erste verfügbare Plattform
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
      }

      return {
        walletAddress: r.wallet_address,
        name: name ?? r.wallet_address.slice(0, 6) + '…' + r.wallet_address.slice(-4),
        picture,
        artistType: r.artist_type ?? null,
        artistBio: r.artist_bio ?? null,
        rewardToken: r.reward_token ?? 'D.FAITH',
        questCount: Math.max(0, Number(r.quest_count) + Number(r.streaming_quest_count ?? 0) - (completedByCreator[(r.wallet_address as string).toLowerCase()] ?? 0)),
        shopItemCount: Number(r.shop_item_count),
        isPlatformUser: Boolean(r.is_platform_user),
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

    // Ecosystem-Statistiken: offene Quests + verbleibender Reward-Pool
    const statsRow = await sql`
      SELECT
        COUNT(*)::int AS open_quests,
        COALESCE(SUM(
          GREATEST(0, (max_completions - completions)) * reward_amount
        ), 0)::numeric AS open_rewards
      FROM quests
      WHERE is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const stats = {
      artistCount: artists.length,
      openQuests: Number(statsRow[0]?.open_quests ?? 0),
      openRewards: Number(statsRow[0]?.open_rewards ?? 0),
    };

    return NextResponse.json({ artists, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
