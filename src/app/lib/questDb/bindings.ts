import { getDb } from '../db';
import { rowToBinding } from './quests';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── YouTube Bindings ─────────────────────────────────────────────────────────

export async function loadBindingByWallet(walletAddress: string): Promise<YouTubeBinding | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM youtube_bindings WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  return rows.length > 0 ? rowToBinding(rows[0]) : null;
}

export async function loadBindingByChannel(channelId: string): Promise<YouTubeBinding | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM youtube_bindings WHERE channel_id = ${channelId} LIMIT 1
  `;
  return rows.length > 0 ? rowToBinding(rows[0]) : null;
}

export async function saveYouTubeBinding(binding: YouTubeBinding): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO youtube_bindings (
      wallet_address, channel_id, channel_name, channel_thumbnail, verification_code, verified_at
    ) VALUES (
      ${binding.walletAddress.toLowerCase()}, ${binding.channelId}, ${binding.channelName},
      ${binding.channelThumbnail}, ${binding.verificationCode}, ${binding.verifiedAt}
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      channel_id        = EXCLUDED.channel_id,
      channel_name      = EXCLUDED.channel_name,
      channel_thumbnail = EXCLUDED.channel_thumbnail,
      verification_code = EXCLUDED.verification_code,
      verified_at       = EXCLUDED.verified_at
  `;
}

export async function deleteYouTubeBinding(walletAddress: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM youtube_bindings WHERE wallet_address = ${walletAddress.toLowerCase()}`;
}
