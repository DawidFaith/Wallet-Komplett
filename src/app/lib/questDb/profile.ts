import { getDb } from '../db';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface SocialProfile {
  displayName: string | null;
  instagramHandle: string | null;
  instagramVerified: boolean;
  instagramName: string | null;
  instagramPicture: string | null;
  tiktokHandle: string | null;
  tiktokVerified: boolean;
  tiktokName: string | null;
  tiktokPicture: string | null;
  facebookHandle: string | null;
  facebookVerified: boolean;
  facebookName: string | null;
  facebookPicture: string | null;
  facebookPageId: string | null;
  metaFbPartnerVerified: boolean;
  youtubeChannelId: string | null;
  isArtist: boolean;
  artistType: string | null;
  artistBio: string | null;
  rewardToken: string | null;
  tokenMintAddress: string | null;
  displayPlatform: string | null;
  clerkImageUrl: string | null;
  clerkName: string | null;
}

export interface AdminUserRow {
  walletAddress: string;
  displayName: string | null;
  isArtist: boolean;
  instagramHandle: string | null;
  instagramVerified: boolean;
  tiktokHandle: string | null;
  tiktokVerified: boolean;
  facebookHandle: string | null;
  facebookVerified: boolean;
  youtubeChannelId: string | null;
  youtubeChannelName: string | null;
  youtubeVerified: boolean;
  credits: number;
  xp: number;
  level: number;
  updatedAt: string;
  solanaAddress: string | null;
  rewardToken: string | null;
  tokenMintAddress: string | null;
}

export async function getUserProfile(walletAddress: string): Promise<SocialProfile> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM user_profiles WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  if (rows.length === 0) {
    return {
      displayName: null,
      instagramHandle: null, instagramVerified: false, instagramName: null, instagramPicture: null,
      tiktokHandle: null, tiktokVerified: false, tiktokName: null, tiktokPicture: null,
      facebookHandle: null, facebookVerified: false, facebookName: null, facebookPicture: null, facebookPageId: null,
      metaFbPartnerVerified: false,
      youtubeChannelId: null,
      isArtist: false,
      artistType: null,
      artistBio: null,
      rewardToken: null,
      tokenMintAddress: null,
      displayPlatform: null,
      clerkImageUrl: null,
      clerkName: null,
    };
  }
  const r = rows[0];
  return {
    displayName: r.display_name ?? null,
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
    facebookPageId: r.facebook_page_id ?? null,
    metaFbPartnerVerified: Boolean(r.meta_fb_partner_verified),
    youtubeChannelId: r.youtube_channel_id ?? null,
    isArtist: Boolean(r.is_artist),
    artistType: r.artist_type ?? null,
    artistBio: r.artist_bio ?? null,
    rewardToken: r.reward_token ?? null,
    tokenMintAddress: r.token_mint_address ?? null,
    displayPlatform: r.display_platform ?? null,
    clerkImageUrl: r.clerk_image_url ?? null,
    clerkName: r.clerk_name ?? null,
  };
}

export async function upsertUserProfile(
  walletAddress: string,
  data: Partial<Omit<SocialProfile, 'youtubeChannelId'>>,
): Promise<void> {
  // Handle displayName separately
  if (data.displayName !== undefined) {
    const sql = getDb();
    await sql`
      INSERT INTO user_profiles (wallet_address, display_name, updated_at)
      VALUES (${walletAddress.toLowerCase()}, ${data.displayName}, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET display_name = ${data.displayName}, updated_at = NOW()
    `;
    // Remove so it doesn't double-process below
    const { displayName: _dn, ...rest } = data;
    data = rest;
    if (Object.keys(data).length === 0) return;
  }
  const sql = getDb();
  await sql`
    INSERT INTO user_profiles (wallet_address, updated_at)
    VALUES (${walletAddress.toLowerCase()}, NOW())
    ON CONFLICT (wallet_address) DO NOTHING
  `;
  if (data.instagramHandle !== undefined) {
    await sql`
      UPDATE user_profiles SET instagram_handle = ${data.instagramHandle}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.instagramVerified !== undefined) {
    await sql`
      UPDATE user_profiles SET instagram_verified = ${data.instagramVerified}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.instagramName !== undefined) {
    await sql`
      UPDATE user_profiles SET instagram_name = ${data.instagramName}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.instagramPicture !== undefined) {
    await sql`
      UPDATE user_profiles SET instagram_picture = ${data.instagramPicture}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.tiktokHandle !== undefined) {
    await sql`
      UPDATE user_profiles SET tiktok_handle = ${data.tiktokHandle}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.tiktokVerified !== undefined) {
    await sql`
      UPDATE user_profiles SET tiktok_verified = ${data.tiktokVerified}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.tiktokName !== undefined) {
    await sql`
      UPDATE user_profiles SET tiktok_name = ${data.tiktokName}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.tiktokPicture !== undefined) {
    await sql`
      UPDATE user_profiles SET tiktok_picture = ${data.tiktokPicture}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.facebookHandle !== undefined) {
    await sql`
      UPDATE user_profiles SET facebook_handle = ${data.facebookHandle}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.facebookVerified !== undefined) {
    await sql`
      UPDATE user_profiles SET facebook_verified = ${data.facebookVerified}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.facebookName !== undefined) {
    await sql`
      UPDATE user_profiles SET facebook_name = ${data.facebookName}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.facebookPicture !== undefined) {
    await sql`
      UPDATE user_profiles SET facebook_picture = ${data.facebookPicture}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.facebookPageId !== undefined) {
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS facebook_page_id TEXT`;
    await sql`
      UPDATE user_profiles SET facebook_page_id = ${data.facebookPageId}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.artistType !== undefined) {
    await sql`
      UPDATE user_profiles SET artist_type = ${data.artistType}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.artistBio !== undefined) {
    await sql`
      UPDATE user_profiles SET artist_bio = ${data.artistBio}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.rewardToken !== undefined) {
    await sql`
      UPDATE user_profiles SET reward_token = ${data.rewardToken}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.tokenMintAddress !== undefined) {
    await sql`
      UPDATE user_profiles SET token_mint_address = ${data.tokenMintAddress}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.displayPlatform !== undefined) {
    const sql = getDb();
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_platform TEXT`;
    await sql`
      UPDATE user_profiles SET display_platform = ${data.displayPlatform}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.clerkImageUrl !== undefined) {
    const sql = getDb();
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clerk_image_url TEXT`;
    await sql`
      UPDATE user_profiles SET clerk_image_url = ${data.clerkImageUrl}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
  if (data.clerkName !== undefined) {
    const sql = getDb();
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clerk_name TEXT`;
    await sql`
      UPDATE user_profiles SET clerk_name = ${data.clerkName}, updated_at = NOW()
      WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
  }
}

// ─── XP / Level ──────────────────────────────────────────────────────────────

/** XP-Schwellen pro Level (Level 1 = 0 XP, Level 2 = 100, Level 3 = 250, ...) */
export function xpToLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
  // Formel: Level n braucht n*(n-1)/2 * 100 XP
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const currentXp = xp - xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1) - xpForLevel(level);
  return { level, currentXp, nextLevelXp, progress: Math.floor((currentXp / nextLevelXp) * 100) };
}

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return ((level - 1) * level) / 2 * 100;
}

export async function getUserXp(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT xp FROM user_xp WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].xp) : 0;
}

export async function addUserXp(walletAddress: string, xp: number): Promise<void> {
  const sql = getDb();
  const rounded = Math.max(0, Math.round(xp));
  if (rounded === 0) return;
  await sql`
    INSERT INTO user_xp (wallet_address, xp, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${rounded}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      xp         = user_xp.xp + ${rounded},
      updated_at = NOW()
  `;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAllUserProfiles(): Promise<AdminUserRow[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.wallet_address,
      p.display_name,
      p.is_artist,
      p.instagram_handle,
      p.instagram_verified,
      p.tiktok_handle,
      p.tiktok_verified,
      p.facebook_handle,
      p.facebook_verified,
      p.youtube_channel_id,
      p.updated_at,
      p.reward_token,
      p.token_mint_address,
      yb.channel_name  AS youtube_channel_name,
      yb.channel_id IS NOT NULL AS youtube_verified,
      COALESCE(dc.balance, 0) AS credits,
      COALESCE(ux.xp, 0)     AS xp,
      sa.solana_address
    FROM user_profiles p
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
    LEFT JOIN dfaith_credits   dc ON dc.wallet_address = p.wallet_address
    LEFT JOIN user_xp          ux ON ux.wallet_address = p.wallet_address
    LEFT JOIN solana_accounts  sa ON sa.wallet_address = p.wallet_address
    ORDER BY p.updated_at DESC
  `;
  return rows.map((r) => {
    const xp = Number(r.xp);
    const { level } = xpToLevel(xp);
    return {
      walletAddress: r.wallet_address,
      displayName: r.display_name ?? null,
      isArtist: Boolean(r.is_artist),
      instagramHandle: r.instagram_handle ?? null,
      instagramVerified: Boolean(r.instagram_verified),
      tiktokHandle: r.tiktok_handle ?? null,
      tiktokVerified: Boolean(r.tiktok_verified),
      facebookHandle: r.facebook_handle ?? null,
      facebookVerified: Boolean(r.facebook_verified),
      youtubeChannelId: r.youtube_channel_id ?? null,
      youtubeChannelName: r.youtube_channel_name ?? null,
      youtubeVerified: Boolean(r.youtube_verified),
      credits: Number(r.credits),
      xp,
      level,
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      solanaAddress: r.solana_address ?? null,
      rewardToken: r.reward_token ?? null,
      tokenMintAddress: r.token_mint_address ?? null,
    };
  });
}

export async function setArtistStatus(walletAddress: string, isArtist: boolean): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO user_profiles (wallet_address, is_artist, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${isArtist}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      is_artist  = ${isArtist},
      updated_at = NOW()
  `;
}
