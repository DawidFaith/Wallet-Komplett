import { getDb } from '../db';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── Row-Mapper ───────────────────────────────────────────────────────────────

export function rowToQuestDetail(row: any): QuestDetail {
  return {
    id: row.id,
    platform: row.platform as Platform,
    type: row.quest_type as QuestType,
    creatorWallet: row.creator_wallet,
    videoId: row.video_id,
    videoTitle: row.video_title,
    videoThumbnail: row.video_thumbnail,
    videoUrl: row.video_url,
    description: row.description,
    rewardAmount: Number(row.reward_amount),
    reputationReward: Number(row.reputation_reward ?? 50),
    maxCompletions: Number(row.max_completions),
    completions: Number(row.completions),
    isActive: row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    expiresAt: row.expires_at
      ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at)
      : null,
    creditsLocked: Number(row.credits_locked ?? 0),
    creditsRefunded: Boolean(row.credits_refunded ?? false),
    bonusBudget: Number(row.bonus_budget ?? 0),
    storyToken: row.story_token ?? null,
    bundleId: row.bundle_id ?? null,
  };
}

export function rowToBinding(row: any): YouTubeBinding {
  return {
    walletAddress: row.wallet_address,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelThumbnail: row.channel_thumbnail,
    verificationCode: row.verification_code,
    verifiedAt: row.verified_at instanceof Date ? row.verified_at.toISOString() : row.verified_at,
  };
}

export function rowToWalletEntry(row: any): QuestsByWalletEntry {
  return {
    questId: row.quest_id,
    platform: row.platform as Platform,
    videoId: row.video_id ?? '',
    rewardAmount: Number(row.reward_amount),
    rewardPaid: row.reward_paid,
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
  };
}

// ─── Quest Operationen ────────────────────────────────────────────────────────

/** Alle aktiven, nicht-abgelaufenen Quests laden (leichter Index) */
export async function loadQuestIndex(): Promise<QuestIndexEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM quests
    WHERE is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `;
  return rows.map(rowToQuestDetail);
}

/** Einzelnen Quest laden */
export async function loadQuestDetail(questId: string): Promise<QuestDetail | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM quests WHERE id = ${questId} LIMIT 1`;
  return rows.length > 0 ? rowToQuestDetail(rows[0]) : null;
}

/** Neuen Quest anlegen (INSERT) */
export async function saveQuestDetail(quest: QuestDetail): Promise<void> {
  const sql = getDb();
  const expiresAt = quest.expiresAt ?? null;
  const creditsLocked = quest.creditsLocked ?? 0;
  const bonusBudget = quest.bonusBudget ?? 0;
  const secretCode = quest.secretCode?.trim().toUpperCase() ?? null;
  const reputationReward = quest.reputationReward ?? 50;
  const storyToken = quest.storyToken ?? null;
  await sql`
    INSERT INTO quests (
      id, platform, quest_type, creator_wallet,
      video_id, video_title, video_thumbnail, video_url,
      description, reward_amount, reputation_reward, max_completions,
      completions, is_active, expires_at, credits_locked, credits_refunded,
      bonus_budget, secret_code, story_token, created_at, updated_at
    ) VALUES (
      ${quest.id}, ${quest.platform}, ${quest.type}, ${quest.creatorWallet},
      ${quest.videoId}, ${quest.videoTitle}, ${quest.videoThumbnail}, ${quest.videoUrl},
      ${quest.description}, ${quest.rewardAmount}, ${reputationReward}, ${quest.maxCompletions},
      ${quest.completions}, ${quest.isActive}, ${expiresAt}, ${creditsLocked}, false,
      ${bonusBudget}, ${secretCode}, ${storyToken}, ${quest.createdAt}, ${quest.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      video_title        = EXCLUDED.video_title,
      video_thumbnail    = EXCLUDED.video_thumbnail,
      description        = EXCLUDED.description,
      reward_amount      = EXCLUDED.reward_amount,
      reputation_reward  = EXCLUDED.reputation_reward,
      max_completions    = EXCLUDED.max_completions,
      is_active          = EXCLUDED.is_active,
      expires_at         = EXCLUDED.expires_at,
      secret_code        = EXCLUDED.secret_code,
      story_token        = EXCLUDED.story_token,
      updated_at         = NOW()
  `;
}

/** Geheimen Code eines Quests laden (nur serverseitig verwenden – niemals an Fans senden!) */
export async function getQuestSecretCode(questId: string): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`SELECT secret_code FROM quests WHERE id = ${questId} LIMIT 1`;
  return rows.length > 0 ? (rows[0].secret_code ?? null) : null;
}

/** Quest anhand des Story-Tokens laden */
export async function getQuestByStoryToken(token: string): Promise<QuestDetail | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM quests WHERE story_token = ${token} LIMIT 1`;
  return rows.length > 0 ? rowToQuestDetail(rows[0]) : null;
}

/**
 * Budget für einen Quest sperren: rewardAmount * maxCompletions werden beim Erstellen
 * von creator_balances UND dfaith_credits abgezogen (Escrow).
 * Gibt false zurück wenn nicht genügend Guthaben vorhanden.
 */
export async function lockQuestBudget(
  creatorWallet: string,
  totalBudget: number,
): Promise<boolean> {
  const sql = getDb();
  // Atomisch prüfen + abziehen
  const rows = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${totalBudget}, updated_at = NOW()
    WHERE wallet_address = ${creatorWallet.toLowerCase()} AND balance >= ${totalBudget}
    RETURNING balance
  `;
  if (rows.length === 0) return false;
  // Auch creator_balances synchron halten
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${totalBudget}), updated_at = NOW()
    WHERE wallet_address = ${creatorWallet.toLowerCase()}
  `;
  return true;
}

/**
 * Abgelaufene Quests eines Creators finden und ungenutzte Credits zurückgeben.
 * Gibt die Liste der erstatteten Quests zurück.
 */
export async function refundExpiredQuests(
  creatorWallet: string,
): Promise<{ questId: string; refundAmount: number }[]> {
  const sql = getDb();
  // Quests die abgelaufen oder ausgeschöpft sind, aber noch nicht erstattet wurden
  const rows = await sql`
    SELECT id, completions, max_completions, reward_amount, credits_locked, bonus_budget
    FROM quests
    WHERE creator_wallet = ${creatorWallet.toLowerCase()}
      AND credits_locked > 0
      AND credits_refunded = false
      AND (
        (expires_at IS NOT NULL AND expires_at < NOW())
        OR (completions >= max_completions)
      )
  `;
  if (rows.length === 0) return [];

  const refunds: { questId: string; refundAmount: number }[] = [];

  for (const row of rows) {
    // Tatsächlich ausbezahlte Rewards summieren (wichtig bei Partial-Rewards wie Engagement-Quests)
    const [sumRow] = await sql`
      SELECT COALESCE(SUM(reward_amount), 0) AS total_paid
      FROM quest_completions
      WHERE quest_id = ${row.id}
    `;
    const used = Number(sumRow?.total_paid ?? 0);
    const locked = Number(row.credits_locked);
    const bonusBudgetRemaining = Number(row.bonus_budget ?? 0);
    const refundAmount = Math.max(0, locked - used) + bonusBudgetRemaining;

    if (refundAmount > 0) {
      // Credits dem Creator zurückgeben
      await sql`
        INSERT INTO dfaith_credits (wallet_address, balance, updated_at)
        VALUES (${creatorWallet.toLowerCase()}, ${refundAmount}, NOW())
        ON CONFLICT (wallet_address) DO UPDATE SET
          balance    = dfaith_credits.balance + ${refundAmount},
          updated_at = NOW()
      `;
      await sql`
        INSERT INTO creator_balances (wallet_address, balance, updated_at)
        VALUES (${creatorWallet.toLowerCase()}, ${refundAmount}, NOW())
        ON CONFLICT (wallet_address) DO UPDATE SET
          balance    = creator_balances.balance + ${refundAmount},
          updated_at = NOW()
      `;
    }

    // Quest als erstattet markieren und deaktivieren
    await sql`
      UPDATE quests
      SET credits_refunded = true, is_active = false, updated_at = NOW()
      WHERE id = ${row.id}
    `;

    refunds.push({ questId: row.id, refundAmount });
  }

  return refunds;
}

/**
 * Quest stornieren: Quest deaktivieren und nicht genutztes Budget zurückgeben.
 * Gibt den erstatteten Betrag zurück, oder -1 wenn Quest nicht gefunden / keine Berechtigung.
 */
export async function cancelQuest(
  questId: string,
  creatorWallet: string,
): Promise<number> {
  const sql = getDb();

  const rows = await sql`
    SELECT creator_wallet, completions, reward_amount, credits_locked, bonus_budget, credits_refunded, is_active
    FROM quests
    WHERE id = ${questId}
    LIMIT 1
  `;
  if (rows.length === 0) return -1;
  const row = rows[0];

  if (row.creator_wallet !== creatorWallet.toLowerCase()) return -1;

  // Bereits storniert / abgelaufen → nichts tun
  if (!row.is_active && row.credits_refunded) return 0;

  const used = Number(row.completions) * Number(row.reward_amount);
  const locked = Number(row.credits_locked);
  const bonusBudgetRemaining = Number(row.bonus_budget ?? 0);
  const refundAmount = Math.max(0, locked - used) + bonusBudgetRemaining;

  if (refundAmount > 0) {
    await sql`
      INSERT INTO dfaith_credits (wallet_address, balance, updated_at)
      VALUES (${creatorWallet.toLowerCase()}, ${refundAmount}, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        balance    = dfaith_credits.balance + ${refundAmount},
        updated_at = NOW()
    `;
    await sql`
      INSERT INTO creator_balances (wallet_address, balance, updated_at)
      VALUES (${creatorWallet.toLowerCase()}, ${refundAmount}, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        balance    = creator_balances.balance + ${refundAmount},
        updated_at = NOW()
    `;
  }

  await sql`
    UPDATE quests
    SET is_active = false, credits_refunded = true, updated_at = NOW()
    WHERE id = ${questId}
  `;

  return refundAmount;
}

/** Kein-Op für Abwärtskompatibilität – Index wird durch saveQuestDetail verwaltet */
export async function saveQuestIndex(_quests: QuestIndexEntry[]): Promise<void> {
  // Mit Postgres nicht benötigt – saveQuestDetail macht den INSERT
}

/** Completion-Zähler atomar erhöhen (kein Race Condition) */
export async function incrementQuestCompletions(questId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE quests SET completions = completions + 1, updated_at = NOW()
    WHERE id = ${questId}
  `;
}
