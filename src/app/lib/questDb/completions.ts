import { getDb } from '../db';
import { rowToWalletEntry, incrementQuestCompletions } from './quests';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── Completions ──────────────────────────────────────────────────────────────

export async function loadCompletionsByWallet(walletAddress: string): Promise<QuestsByWalletEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      qc.quest_id,
      qc.platform,
      q.video_id,
      qc.reward_amount,
      qc.reward_paid,
      qc.completed_at
    FROM quest_completions qc
    JOIN quests q ON q.id = qc.quest_id
    WHERE qc.wallet_address = ${walletAddress.toLowerCase()}
    ORDER BY qc.completed_at DESC
  `;
  return rows.map(rowToWalletEntry);
}

export async function hasWalletCompletedQuest(
  walletAddress: string,
  questId: string
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT 1 FROM quest_completions
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND quest_id = ${questId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Prüft ob ein YouTube-Kanal einen Quest bereits abgeschlossen hat (unabhängig von der Wallet) */
export async function hasChannelCompletedQuest(
  channelId: string,
  questId: string
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT 1 FROM quest_completions
    WHERE channel_id = ${channelId} AND quest_id = ${questId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Completion speichern + Zähler atomar erhöhen.
 * UNIQUE(quest_id, wallet_address) auf DB-Ebene verhindert Doppelabschlüsse auch bei Race Conditions.
 */
export async function saveCompletion(completion: QuestCompletion): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO quest_completions (
      quest_id, wallet_address, channel_id, channel_name,
      platform, comment_id, comment_text, reward_amount, reward_paid, completed_at
    ) VALUES (
      ${completion.questId}, ${completion.walletAddress.toLowerCase()},
      ${completion.channelId}, ${completion.channelName},
      ${completion.platform}, ${completion.commentId}, ${completion.commentText},
      ${completion.rewardAmount}, ${completion.rewardPaid}, ${completion.completedAt}
    )
    ON CONFLICT (quest_id, wallet_address) DO NOTHING
  `;
  await incrementQuestCompletions(completion.questId);
}
