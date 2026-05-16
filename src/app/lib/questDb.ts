/**
 * Quest Board – PostgreSQL Datenbank-Helfer (Neon Serverless)
 *
 * Tabellen-Schema (idempotente Migration in src/app/lib/db.ts):
 *
 *   youtube_bindings  – Wallet ↔ YouTube-Kanal Verknüpfung
 *   quests            – Quest-Definitionen (beliebig viele, alle Plattformen)
 *   quest_completions – Abschlüsse (UNIQUE quest_id + wallet → race-condition-safe)
 *
 * Erweiterung für neue Plattformen: Platform-Typ ergänzen + eigene Binding-Tabelle anlegen.
 */

import { getDb } from './db';

// ─── Typen ───────────────────────────────────────────────────────────────────

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';
export type QuestType = 'comment' | 'like' | 'save' | 'secret' | 'engagement' | 'repost' | 'dm_share'; // erweiterbar: | 'subscribe'

export interface QuestIndexEntry {
  id: string;
  platform: Platform;
  type: QuestType;
  creatorWallet: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  videoUrl: string;
  rewardAmount: number;
  reputationReward: number;  // Reputation-Punkte pro Abschluss
  maxCompletions: number;
  completions: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
  creditsLocked: number;
  creditsRefunded: boolean;
}

// ─── Reputation-Typen ─────────────────────────────────────────────────────────

export interface ReputationLevel {
  levelNumber: number;
  levelName: string;
  minReputation: number;
  prizeDescription: string;
  creditReward: number;   // D.FAITH Credits die beim Level-Up ausgezahlt werden
  maxRecipients: number; // Wie viele Fans diesen Reward erhalten können (0 = kein Reward)
}

export interface ReputationContest {
  id: string;
  artistWallet: string;
  endDate: string;
  distributed: boolean;
  createdAt: string;
  prizes: { rank: number; creditReward: number }[];
}

export interface UserArtistReputation {
  artistWallet: string;
  reputation: number;
  level: number;
  levelName: string;
  nextLevelRep: number | null;   // null = höchstes Level erreicht
  progress: number;              // 0–100 %
  artistName?: string | null;
  artistPicture?: string | null;
}

export interface ReputationLeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName: string | null;
  reputation: number;
  level: number;
  levelName: string;
}

export interface QuestDetail extends QuestIndexEntry {
  description: string;
  updatedAt: string;
  secretCode?: string | null;
  storyToken?: string | null;
}

export interface YouTubeBinding {
  walletAddress: string;
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  verificationCode: string;
  verifiedAt: string;
}

export interface QuestCompletion {
  walletAddress: string;
  channelId: string;
  channelName: string;
  questId: string;
  platform: Platform;
  commentId: string;
  commentText: string;
  rewardAmount: number;
  rewardPaid: boolean;
  completedAt: string;
}

export interface QuestsByWalletEntry {
  questId: string;
  platform: Platform;
  videoId: string;
  rewardAmount: number;
  rewardPaid: boolean;
  completedAt: string;
}

export interface PendingReward {
  id: string;
  walletAddress: string;
  amount: number;
  reason: string;
  questId: string | null;
  status: 'pending' | 'paid';
  createdAt: string;
  paidAt: string | null;
}

// ─── Row-Mapper ───────────────────────────────────────────────────────────────

function rowToQuestDetail(row: any): QuestDetail {
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
    storyToken: row.story_token ?? null,
  };
}

function rowToBinding(row: any): YouTubeBinding {
  return {
    walletAddress: row.wallet_address,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelThumbnail: row.channel_thumbnail,
    verificationCode: row.verification_code,
    verifiedAt: row.verified_at instanceof Date ? row.verified_at.toISOString() : row.verified_at,
  };
}

function rowToWalletEntry(row: any): QuestsByWalletEntry {
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
  const secretCode = quest.secretCode?.trim().toUpperCase() ?? null;
  const reputationReward = quest.reputationReward ?? 50;
  const storyToken = quest.storyToken ?? null;
  await sql`
    INSERT INTO quests (
      id, platform, quest_type, creator_wallet,
      video_id, video_title, video_thumbnail, video_url,
      description, reward_amount, reputation_reward, max_completions,
      completions, is_active, expires_at, credits_locked, credits_refunded,
      secret_code, story_token, created_at, updated_at
    ) VALUES (
      ${quest.id}, ${quest.platform}, ${quest.type}, ${quest.creatorWallet},
      ${quest.videoId}, ${quest.videoTitle}, ${quest.videoThumbnail}, ${quest.videoUrl},
      ${quest.description}, ${quest.rewardAmount}, ${reputationReward}, ${quest.maxCompletions},
      ${quest.completions}, ${quest.isActive}, ${expiresAt}, ${creditsLocked}, false,
      ${secretCode}, ${storyToken}, ${quest.createdAt}, ${quest.updatedAt}
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
    SELECT id, completions, max_completions, reward_amount, credits_locked
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
    const refundAmount = Math.max(0, locked - used);

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
    SELECT creator_wallet, completions, reward_amount, credits_locked, credits_refunded, is_active
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
  const refundAmount = Math.max(0, locked - used);

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

// ─── YouTube Shorts Helpers ───────────────────────────────────────────────────

/** Extrahiert die Video-ID aus einem YouTube Shorts Link */
export function extractShortsVideoId(input: string): string | null {
  const trimmed = input.trim();
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

/** Baut den öffentlichen Shorts-URL aus einer Video-ID */
export function buildShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

/** Deterministischer Verifikationscode aus Wallet-Adresse */
export function getVerificationCode(walletAddress: string): string {
  return `DFAITH-${walletAddress.slice(2, 10).toUpperCase()}`;
}

// ─── Device Fingerprint Schutz ────────────────────────────────────────────────

/**
 * Speichert einen Gerät-Fingerprint + Wallet-Kombination.
 * Gibt die Anzahl der verschiedenen Wallets zurück die von diesem Fingerprint verifiziert haben.
 */
export async function recordFingerprintVerification(
  fingerprint: string,
  walletAddress: string
): Promise<number> {
  const sql = getDb();
  await sql`
    INSERT INTO device_fingerprints (fingerprint, wallet_address)
    VALUES (${fingerprint}, ${walletAddress.toLowerCase()})
    ON CONFLICT (fingerprint, wallet_address) DO NOTHING
  `;
  const rows = await sql`
    SELECT COUNT(DISTINCT wallet_address) AS cnt
    FROM device_fingerprints
    WHERE fingerprint = ${fingerprint}
  `;
  return Number(rows[0]?.cnt ?? 0);
}

/** Gibt die Anzahl verschiedener Wallets zurück die von diesem Fingerprint stammen. */
export async function getFingerprintWalletCount(fingerprint: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT COUNT(DISTINCT wallet_address) AS cnt
    FROM device_fingerprints
    WHERE fingerprint = ${fingerprint}
  `;
  return Number(rows[0]?.cnt ?? 0);
}

// ─── Pending Rewards ──────────────────────────────────────────────────────────

function rowToPendingReward(row: any): PendingReward {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    amount: Number(row.amount),
    reason: row.reason,
    questId: row.quest_id ?? null,
    status: row.status as 'pending' | 'paid',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    paidAt: row.paid_at ? (row.paid_at instanceof Date ? row.paid_at.toISOString() : row.paid_at) : null,
  };
}

/** Neuen ausstehenden Reward speichern */
export async function savePendingReward(reward: Omit<PendingReward, 'id' | 'status' | 'paidAt'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO pending_rewards (wallet_address, amount, reason, quest_id, created_at)
    VALUES (
      ${reward.walletAddress.toLowerCase()},
      ${reward.amount},
      ${reward.reason},
      ${reward.questId},
      ${reward.createdAt}
    )
  `;
}

/** Alle ausstehenden Rewards einer Wallet laden */
export async function loadPendingRewardsByWallet(walletAddress: string): Promise<PendingReward[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM pending_rewards
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND status = 'pending'
    ORDER BY created_at DESC
  `;
  return rows.map(rowToPendingReward);
}

/** Gesamtsumme aller ausstehenden Rewards einer Wallet */
export async function getPendingRewardTotal(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM pending_rewards
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND status = 'pending'
  `;
  return Number(rows[0]?.total ?? 0);
}

// ─── Creator Balance ──────────────────────────────────────────────────────────

/** Aktuelles Guthaben eines Creators laden */
export async function getCreatorBalance(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT balance FROM creator_balances WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

/**
 * DFAITH-Einzahlung eines Creators gutschreiben.
 * tx_hash ist UNIQUE – verhindert Doppel-Gutschriften.
 * Gleichzeitig werden die Dfaith Credits des Creators erhöht.
 */
export async function creditCreatorBalance(
  walletAddress: string,
  amount: number,
  txHash: string,
): Promise<void> {
  const sql = getDb();
  // Deposit-Record anlegen (UNIQUE tx_hash wirft bei Duplikat)
  await sql`
    INSERT INTO creator_deposits (wallet_address, tx_hash, amount)
    VALUES (${walletAddress.toLowerCase()}, ${txHash.toLowerCase()}, ${amount})
  `;
  // creator_balances aufstocken
  await sql`
    INSERT INTO creator_balances (wallet_address, balance, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      balance    = creator_balances.balance + EXCLUDED.balance,
      updated_at = NOW()
  `;
  // Dfaith Credits aufstocken
  await addDfaithCredits(walletAddress, amount);
}

/** Guthaben eines Creators reduzieren (z.B. nach Quest-Abschluss) */
export async function debitCreatorBalance(walletAddress: string, amount: number): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  // Dfaith Credits des Creators ebenfalls reduzieren (hält beide Werte synchron)
  await sql`
    UPDATE dfaith_credits
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── Dfaith Credits (Unified Balance) ────────────────────────────────────────

/** Aktuelles Dfaith-Credits-Guthaben laden */
export async function getDfaithCredits(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT balance FROM dfaith_credits WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

/** Dfaith Credits hinzufügen (Fan-Reward oder Creator-Deposit) */
export async function addDfaithCredits(walletAddress: string, amount: number): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO dfaith_credits (wallet_address, balance, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      balance    = dfaith_credits.balance + EXCLUDED.balance,
      updated_at = NOW()
  `;
}

/**
 * Dfaith Credits einlösen: Guthaben reduzieren.
 * Gibt neues Guthaben zurück. Wirft wenn nicht genug Credits vorhanden.
 */
export async function redeemDfaithCredits(walletAddress: string, amount: number): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND balance >= ${amount}
    RETURNING balance
  `;
  if (rows.length === 0) {
    throw new Error('Nicht genug Dfaith Credits');
  }
  // Auch creator_balances reduzieren damit beide Tabellen synchron bleiben
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  return Number(rows[0].balance);
}

// ── Reputation Reward Pool ────────────────────────────────────────────────────

/** Aktuellen Pool-Stand eines Artists laden */
export async function getReputationPool(artistWallet: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT balance FROM reputation_reward_pool
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

/**
 * Budget in den Reward-Pool einzahlen:
 * Sofortiger Abzug vom Künstler-Guthaben + Gutschrift auf den Pool.
 * Gibt false zurück wenn nicht genug Guthaben vorhanden.
 */
export async function depositReputationPool(artistWallet: string, amount: number): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE wallet_address = ${artistWallet.toLowerCase()} AND balance >= ${amount}
    RETURNING balance
  `;
  if (rows.length === 0) return false;
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${artistWallet.toLowerCase()}
  `;
  await sql`
    INSERT INTO reputation_reward_pool (artist_wallet, balance, updated_at)
    VALUES (${artistWallet.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (artist_wallet) DO UPDATE SET
      balance    = reputation_reward_pool.balance + ${amount},
      updated_at = NOW()
  `;
  return true;
}

/**
 * Claim-Sperre setzen: verhindert gleichzeitige Einlösungen für dieselbe Wallet.
 * Gibt true zurück wenn die Sperre erfolgreich gesetzt wurde, false wenn bereits gesperrt.
 */
export async function startClaimLock(walletAddress: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dfaith_credits
    SET is_claiming = true
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND is_claiming = false
    RETURNING wallet_address
  `;
  return rows.length > 0;
}

/**
 * Claim-Sperre aufheben. Immer aufrufen nach Abschluss (Erfolg oder Fehler).
 */
export async function endClaimLock(walletAddress: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE dfaith_credits
    SET is_claiming = false
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── Like Verifications ───────────────────────────────────────────────────────

export interface LikeVerification {
  questId: string;
  walletAddress: string;
  videoId: string;
  baselineLikes: number;
  removedLikes: number | null;
  step: 'baseline' | 'await_like';
  removalAt: string | null;
  expiresAt: string | null;
  startedAt: string;
}

function rowToLikeVerification(row: any): LikeVerification {
  return {
    questId: row.quest_id,
    walletAddress: row.wallet_address,
    videoId: row.video_id,
    baselineLikes: Number(row.baseline_likes),
    removedLikes: row.removed_likes !== null ? Number(row.removed_likes) : null,
    step: row.step as 'baseline' | 'await_like',
    removalAt: row.removal_at
      ? (row.removal_at instanceof Date ? row.removal_at.toISOString() : row.removal_at)
      : null,
    expiresAt: row.expires_at
      ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at)
      : null,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
  };
}

/** Like-Verification starten oder zurücksetzen (Neustart) */
export async function upsertLikeVerification(
  questId: string,
  walletAddress: string,
  videoId: string,
  baselineLikes: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO like_verifications
      (quest_id, wallet_address, video_id, baseline_likes, step, started_at)
    VALUES
      (${questId}, ${walletAddress.toLowerCase()}, ${videoId}, ${baselineLikes}, 'baseline', NOW())
    ON CONFLICT (quest_id, wallet_address) DO UPDATE SET
      baseline_likes = EXCLUDED.baseline_likes,
      removed_likes  = NULL,
      step           = 'baseline',
      removal_at     = NULL,
      expires_at     = NULL,
      started_at     = NOW()
  `;
}

/** Laufende Like-Verification laden */
export async function getLikeVerification(
  questId: string,
  walletAddress: string,
): Promise<LikeVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM like_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? rowToLikeVerification(rows[0]) : null;
}

/** Schritt 2: Likes-Entfernung bestätigt – 5-Minuten-Fenster öffnen */
export async function advanceLikeVerificationToAwaitLike(
  questId: string,
  walletAddress: string,
  removedLikes: number,
  expiresAt: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE like_verifications
    SET step = 'await_like', removed_likes = ${removedLikes},
        removal_at = NOW(), expires_at = ${expiresAt}
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

/** Verification-Eintrag löschen (nach Abschluss oder Ablauf) */
export async function deleteLikeVerification(
  questId: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM like_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── TikTok Engagement Verification ──────────────────────────────────────────

export interface TikTokEngagementVerification {
  questId: string;
  walletAddress: string;
  videoId: string;
  baselineLikes: number;
  baselineShares: number;
  baselineSaves: number;
  expiresAt: string;
  startedAt: string;
}

function rowToTikTokEngagementVerification(row: any): TikTokEngagementVerification {
  return {
    questId: row.quest_id,
    walletAddress: row.wallet_address,
    videoId: row.video_id,
    baselineLikes: Number(row.baseline_likes),
    baselineShares: Number(row.baseline_shares),
    baselineSaves: Number(row.baseline_saves),
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
  };
}

export async function upsertTikTokEngagementVerification(
  questId: string,
  walletAddress: string,
  videoId: string,
  baselineLikes: number,
  baselineShares: number,
  baselineSaves: number,
  expiresAt: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO tiktok_engagement_verifications
      (quest_id, wallet_address, video_id, baseline_likes, baseline_shares, baseline_saves, expires_at, started_at)
    VALUES
      (${questId}, ${walletAddress.toLowerCase()}, ${videoId}, ${baselineLikes}, ${baselineShares}, ${baselineSaves}, ${expiresAt}, NOW())
    ON CONFLICT (quest_id, wallet_address) DO UPDATE SET
      baseline_likes  = EXCLUDED.baseline_likes,
      baseline_shares = EXCLUDED.baseline_shares,
      baseline_saves  = EXCLUDED.baseline_saves,
      expires_at      = EXCLUDED.expires_at,
      started_at      = NOW()
  `;
}

export async function getTikTokEngagementVerification(
  questId: string,
  walletAddress: string,
): Promise<TikTokEngagementVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM tiktok_engagement_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? rowToTikTokEngagementVerification(rows[0]) : null;
}

export async function deleteTikTokEngagementVerification(
  questId: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM tiktok_engagement_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── Instagram Like/Save Verification ────────────────────────────────────────

export interface InstagramLikeVerification {
  questId: string;
  walletAddress: string;
  mediaId: string;
  questType: 'like' | 'save';
  baselineLikes: number;
  baselineSaves: number;
  expiresAt: string;
  startedAt: string;
}

export async function upsertInstagramLikeVerification(
  questId: string,
  walletAddress: string,
  mediaId: string,
  questType: 'like' | 'save' | 'engagement' | 'repost',
  baselineLikes: number,
  baselineSaves: number,
  expiresAt: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO instagram_like_verifications
      (quest_id, wallet_address, media_id, quest_type, baseline_likes, baseline_saves, expires_at, started_at)
    VALUES
      (${questId}, ${walletAddress.toLowerCase()}, ${mediaId}, ${questType}, ${baselineLikes}, ${baselineSaves}, ${expiresAt}, NOW())
    ON CONFLICT (quest_id, wallet_address) DO UPDATE SET
      baseline_likes  = EXCLUDED.baseline_likes,
      baseline_saves  = EXCLUDED.baseline_saves,
      expires_at      = EXCLUDED.expires_at,
      started_at      = NOW()
  `;
}

export async function getInstagramLikeVerification(
  questId: string,
  walletAddress: string,
): Promise<InstagramLikeVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM instagram_like_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    questId: r.quest_id,
    walletAddress: r.wallet_address,
    mediaId: r.media_id,
    questType: r.quest_type,
    baselineLikes: Number(r.baseline_likes),
    baselineSaves: Number(r.baseline_saves),
    expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : r.expires_at,
    startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : r.started_at,
  };
}

export async function deleteInstagramLikeVerification(
  questId: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM instagram_like_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── Facebook Like Verifikationen ────────────────────────────────────────────

export interface FacebookLikeVerification {
  questId: string;
  walletAddress: string;
  postId: string;
  baselineLikes: number;
  expiresAt: string;
  startedAt: string;
}

export async function upsertFacebookLikeVerification(
  questId: string,
  walletAddress: string,
  postId: string,
  baselineLikes: number,
  expiresAt: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO facebook_like_verifications
      (quest_id, wallet_address, post_id, baseline_likes, expires_at, started_at)
    VALUES
      (${questId}, ${walletAddress.toLowerCase()}, ${postId}, ${baselineLikes}, ${expiresAt}, NOW())
    ON CONFLICT (quest_id, wallet_address) DO UPDATE SET
      baseline_likes = EXCLUDED.baseline_likes,
      expires_at     = EXCLUDED.expires_at,
      started_at     = NOW()
  `;
}

export async function getFacebookLikeVerification(
  questId: string,
  walletAddress: string,
): Promise<FacebookLikeVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM facebook_like_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    questId: r.quest_id,
    walletAddress: r.wallet_address,
    postId: r.post_id,
    baselineLikes: Number(r.baseline_likes),
    expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : r.expires_at,
    startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : r.started_at,
  };
}

export async function deleteFacebookLikeVerification(
  questId: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM facebook_like_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── Instagram DM Share Verifikationen ────────────────────────────────────────

export interface InstagramDmVerification {
  questId: string;
  walletAddress: string;
  instagramHandle: string;
  clickToken: string;
  clickVerified: boolean;
  clickedAt: string | null;
  baselineShares: number;
  storyVerified: boolean;
  storyReceivedAt: string | null;
  expiresAt: string;
  startedAt: string;
}

export async function upsertInstagramDmVerification(
  questId: string,
  walletAddress: string,
  instagramHandle: string,
  clickToken: string,
  expiresAt: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO instagram_dm_verifications
      (quest_id, wallet_address, instagram_handle, click_token, expires_at, started_at)
    VALUES
      (${questId}, ${walletAddress.toLowerCase()}, ${instagramHandle}, ${clickToken}, ${expiresAt}, NOW())
    ON CONFLICT (quest_id, wallet_address) DO UPDATE SET
      click_token     = EXCLUDED.click_token,
      instagram_handle = EXCLUDED.instagram_handle,
      click_verified  = FALSE,
      clicked_at      = NULL,
      story_verified  = FALSE,
      story_received_at = NULL,
      baseline_shares = 0,
      expires_at      = EXCLUDED.expires_at,
      started_at      = NOW()
  `;
}

export async function getInstagramDmVerification(
  questId: string,
  walletAddress: string,
): Promise<InstagramDmVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM instagram_dm_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return rowToDmVerification(rows[0]);
}

export async function getInstagramDmVerificationByToken(
  clickToken: string,
): Promise<InstagramDmVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM instagram_dm_verifications
    WHERE click_token = ${clickToken}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return rowToDmVerification(rows[0]);
}

/** Findet die neueste aktive DM-Verifikation für einen Instagram-Handle (universeller Link) */
export async function getInstagramDmVerificationByHandle(
  instagramHandle: string,
): Promise<InstagramDmVerification | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM instagram_dm_verifications
    WHERE instagram_handle = ${instagramHandle.toLowerCase()}
    ORDER BY started_at DESC
    LIMIT 1
  `;
  if (!rows.length) return null;
  return rowToDmVerification(rows[0]);
}

export async function markInstagramDmClicked(
  clickToken: string,
  baselineShares: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE instagram_dm_verifications
    SET click_verified = TRUE, clicked_at = NOW(), baseline_shares = ${baselineShares}
    WHERE click_token = ${clickToken}
  `;
}

export async function markInstagramDmClickedByHandle(
  instagramHandle: string,
  baselineShares: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE instagram_dm_verifications
    SET click_verified = TRUE, clicked_at = NOW(), baseline_shares = ${baselineShares}
    WHERE instagram_handle = ${instagramHandle.toLowerCase()}
  `;
}

export async function markInstagramDmStoryVerified(
  questId: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE instagram_dm_verifications
    SET story_verified = TRUE, story_received_at = NOW()
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

export async function markInstagramDmStoryVerifiedByToken(
  clickToken: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE instagram_dm_verifications
    SET story_verified = TRUE, story_received_at = NOW()
    WHERE click_token = ${clickToken}
  `;
}

export async function markInstagramDmStoryVerifiedByHandle(
  instagramHandle: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE instagram_dm_verifications
    SET story_verified = TRUE, story_received_at = NOW()
    WHERE instagram_handle = ${instagramHandle.toLowerCase()}
  `;
}

export async function deleteInstagramDmVerification(
  questId: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM instagram_dm_verifications
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
}

function rowToDmVerification(r: any): InstagramDmVerification {
  return {
    questId: r.quest_id,
    walletAddress: r.wallet_address,
    instagramHandle: r.instagram_handle,
    clickToken: r.click_token,
    clickVerified: Boolean(r.click_verified),
    clickedAt: r.clicked_at ? (r.clicked_at instanceof Date ? r.clicked_at.toISOString() : r.clicked_at) : null,
    baselineShares: Number(r.baseline_shares ?? 0),
    storyVerified: Boolean(r.story_verified),
    storyReceivedAt: r.story_received_at ? (r.story_received_at instanceof Date ? r.story_received_at.toISOString() : r.story_received_at) : null,
    expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : r.expires_at,
    startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : r.started_at,
  };
}

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
  youtubeChannelId: string | null;
  isArtist: boolean;
  artistType: string | null;
  artistBio: string | null;
  rewardToken: string | null;
  tokenMintAddress: string | null;
  displayPlatform: string | null;
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
      facebookHandle: null, facebookVerified: false, facebookName: null, facebookPicture: null,
      youtubeChannelId: null,
      isArtist: false,
      artistType: null,
      artistBio: null,
      rewardToken: null,
      tokenMintAddress: null,
      displayPlatform: null,
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
    youtubeChannelId: r.youtube_channel_id ?? null,
    isArtist: Boolean(r.is_artist),
    artistType: r.artist_type ?? null,
    artistBio: r.artist_bio ?? null,
    rewardToken: r.reward_token ?? null,
    tokenMintAddress: r.token_mint_address ?? null,
    displayPlatform: r.display_platform ?? null,
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
  await sql`
    INSERT INTO user_xp (wallet_address, xp, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${xp}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      xp         = user_xp.xp + ${xp},
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

// ─── Reputation ───────────────────────────────────────────────────────────────

const DEFAULT_REPUTATION_LEVELS: ReputationLevel[] = [
  { levelNumber:  1, levelName: 'Newcomer',       minReputation: 0,     prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  2, levelName: 'Follower',        minReputation: 50,    prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  3, levelName: 'Fan',             minReputation: 150,   prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  4, levelName: 'Supporter',       minReputation: 350,   prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  5, levelName: 'Loyalist',        minReputation: 700,   prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  6, levelName: 'True Fan',        minReputation: 1200,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  7, levelName: 'Advocate',        minReputation: 2000,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  8, levelName: 'VIP',             minReputation: 3500,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  9, levelName: 'Elite',           minReputation: 6000,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber: 10, levelName: 'Legend',          minReputation: 10000, prizeDescription: '', creditReward: 0, maxRecipients: 0 },
];

/** Reputation eines Users für einen Artist erhöhen + Level-Up Credits auszahlen */
export async function addUserReputation(
  walletAddress: string,
  artistWallet: string,
  amount: number,
): Promise<void> {
  const sql = getDb();
  // Alte Reputation + Level-Config laden
  const [repRows, levels] = await Promise.all([
    sql`SELECT reputation FROM user_reputation WHERE wallet_address = ${walletAddress.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()} LIMIT 1`,
    getReputationLevels(artistWallet),
  ]);
  const oldRep = repRows.length > 0 ? Number(repRows[0].reputation) : 0;
  const newRep = oldRep + amount;
  const oldLevel = reputationToLevel(oldRep, levels).level;
  const newLevel = reputationToLevel(newRep, levels).level;

  // Reputation updaten
  await sql`
    INSERT INTO user_reputation (wallet_address, artist_wallet, reputation, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${artistWallet.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (wallet_address, artist_wallet) DO UPDATE SET
      reputation = user_reputation.reputation + ${amount},
      updated_at = NOW()
  `;

  // Level-Up: Credits für alle überschrittenen Level auszahlen
  if (newLevel > oldLevel) {
    for (const lvl of levels) {
      if (lvl.levelNumber > oldLevel && lvl.levelNumber <= newLevel && lvl.creditReward > 0 && lvl.maxRecipients > 0) {
        try {
          // Freien Platz prüfen + Zähler atomar erhöhen
          const updated = await sql`
            UPDATE reputation_levels
            SET recipients_count = recipients_count + 1, updated_at = NOW()
            WHERE artist_wallet = ${artistWallet.toLowerCase()}
              AND level_number = ${lvl.levelNumber}
              AND recipients_count < max_recipients
            RETURNING recipients_count
          `;
          if (updated.length > 0) {
            // Level-Up Reward zum manuellen Abholen speichern (User claimed selbst)
            await savePendingReward({
              walletAddress,
              amount: lvl.creditReward,
              reason: `level_reward:${artistWallet.toLowerCase()}:${lvl.levelNumber}:${lvl.levelName}`,
              questId: null,
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // Fehler überspringen
        }
      }
    }
  }
}

/** Reputation-Level-Konfiguration eines Artists laden (Fallback: Standardlevel) */
export async function getReputationLevels(artistWallet: string): Promise<ReputationLevel[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT level_number, level_name, min_reputation, prize_description, credit_reward, max_recipients
    FROM reputation_levels
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY level_number ASC
  `;
  if (rows.length === 0) return DEFAULT_REPUTATION_LEVELS;
  return rows.map((r) => ({
    levelNumber: Number(r.level_number),
    levelName: String(r.level_name),
    minReputation: Number(r.min_reputation),
    prizeDescription: String(r.prize_description ?? ''),
    creditReward: Number(r.credit_reward ?? 0),
    maxRecipients: Number(r.max_recipients ?? 0),
  }));
}

/** Level-Konfiguration eines Artists speichern – Credits für Rewards sofort reservieren */
export async function saveReputationLevels(
  artistWallet: string,
  levels: ReputationLevel[],
): Promise<void> {
  const sql = getDb();
  const wallet = artistWallet.toLowerCase();

  // Alte Level laden (inkl. recipients_count zum Berechnen des noch verfügbaren Budgets)
  const oldRows = await sql`
    SELECT level_number, credit_reward, max_recipients, recipients_count
    FROM reputation_levels
    WHERE artist_wallet = ${wallet}
  `;

  type OldRow = { level_number: unknown; credit_reward: unknown; max_recipients: unknown; recipients_count: unknown };
  const oldByLevel = new Map<number, OldRow>(
    (oldRows as OldRow[]).map((r) => [Number(r.level_number), r])
  );
  const newLevelNums = new Set(levels.map((l) => l.levelNumber));

  // Netto-Kosten berechnen (positiv = abziehen, negativ = rückerstatten)
  let netCost = 0;

  // Gelöschte Level rückerstatten
  for (const [lvlNum, r] of oldByLevel) {
    if (!newLevelNums.has(lvlNum)) {
      const remaining = Math.max(
        0,
        (Number(r.max_recipients) - Number(r.recipients_count)) * Number(r.credit_reward),
      );
      netCost -= remaining;
    }
  }

  // Neue / geänderte Level
  for (const lvl of levels) {
    const creditReward   = Math.max(0, Math.round(Number(lvl.creditReward)   || 0));
    const maxRecipients  = Math.max(0, Math.round(Number(lvl.maxRecipients)  || 0));
    const newTotal = creditReward * maxRecipients;

    if (oldByLevel.has(lvl.levelNumber)) {
      const old = oldByLevel.get(lvl.levelNumber)!;
      const oldRemaining = Math.max(
        0,
        (Number(old.max_recipients) - Number(old.recipients_count)) * Number(old.credit_reward),
      );
      netCost += newTotal - oldRemaining;
    } else {
      netCost += newTotal;
    }
  }

  if (netCost > 0) {
    await redeemDfaithCredits(wallet, netCost); // wirft selbst wenn nicht genug Guthaben
  } else if (netCost < 0) {
    await addDfaithCredits(wallet, -netCost);
  }

  // Gelöschte Level entfernen
  for (const [lvlNum] of oldByLevel) {
    if (!newLevelNums.has(lvlNum)) {
      await sql`DELETE FROM reputation_levels WHERE artist_wallet = ${wallet} AND level_number = ${lvlNum}`;
    }
  }

  // Neue / geänderte Level per UPSERT einfügen (recipients_count beibehalten)
  for (const lvl of levels) {
    const creditReward  = Math.max(0, Math.round(Number(lvl.creditReward)  || 0));
    const maxRecipients = Math.max(0, Math.round(Number(lvl.maxRecipients) || 0));
    await sql`
      INSERT INTO reputation_levels
        (artist_wallet, level_number, level_name, min_reputation, prize_description, credit_reward, max_recipients, recipients_count, updated_at)
      VALUES
        (${wallet}, ${lvl.levelNumber}, ${lvl.levelName}, ${lvl.minReputation}, ${lvl.prizeDescription}, ${creditReward}, ${maxRecipients}, 0, NOW())
      ON CONFLICT (artist_wallet, level_number) DO UPDATE SET
        level_name        = EXCLUDED.level_name,
        min_reputation    = EXCLUDED.min_reputation,
        prize_description = EXCLUDED.prize_description,
        credit_reward     = EXCLUDED.credit_reward,
        max_recipients    = EXCLUDED.max_recipients,
        updated_at        = EXCLUDED.updated_at
    `;
  }
}

// ─── Reputation Contest ────────────────────────────────────────────────────────

/** Aktiven Contest eines Artists laden */
export async function getActiveReputationContest(artistWallet: string): Promise<ReputationContest | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, artist_wallet, end_date, distributed, created_at
    FROM reputation_contests
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  const prizes = await sql`
    SELECT rank, credit_reward FROM reputation_contest_prizes
    WHERE contest_id = ${row.id}
    ORDER BY rank ASC
  `;
  return {
    id: row.id as string,
    artistWallet: row.artist_wallet as string,
    endDate: row.end_date instanceof Date ? row.end_date.toISOString() : String(row.end_date),
    distributed: Boolean(row.distributed),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    prizes: prizes.map(p => ({ rank: Number(p.rank), creditReward: Number(p.credit_reward) })),
  };
}

/** Contest erstellen / ersetzen */
export async function upsertReputationContest(
  artistWallet: string,
  endDate: Date,
  prizes: { rank: number; creditReward: number }[],
): Promise<string> {
  const sql = getDb();
  const wallet = artistWallet.toLowerCase();

  // Alten Contest laden – falls nicht verteilt, gesperrte Credits zurückbuchen
  const oldContests = await sql`
    SELECT id, credits_locked, distributed FROM reputation_contests
    WHERE artist_wallet = ${wallet}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (oldContests.length > 0 && !oldContests[0].distributed) {
    const refund = Number(oldContests[0].credits_locked ?? 0);
    if (refund > 0) {
      await addDfaithCredits(wallet, refund);
    }
  }
  // Alten Contest löschen
  await sql`DELETE FROM reputation_contests WHERE artist_wallet = ${wallet}`;

  // Gesamtkosten berechnen und sofort abziehen
  const validPrizes = prizes.filter(p => p.creditReward > 0);
  const totalCost = validPrizes.reduce((sum, p) => sum + p.creditReward, 0);
  if (totalCost > 0) {
    const ok = await redeemDfaithCredits(wallet, totalCost);
    if (!ok) throw new Error(`Nicht genügend Guthaben. Benötigt: ${totalCost} DFC`);
  }

  const rows = await sql`
    INSERT INTO reputation_contests (artist_wallet, end_date, credits_locked)
    VALUES (${wallet}, ${endDate}, ${totalCost})
    RETURNING id
  `;
  const contestId = rows[0].id as string;
  for (const p of validPrizes) {
    await sql`
      INSERT INTO reputation_contest_prizes (contest_id, rank, credit_reward)
      VALUES (${contestId}, ${p.rank}, ${p.creditReward})
    `;
  }

  // Aktuellen Ruf aller User dieses Artists als Startwert snapshoten
  await sql`
    INSERT INTO reputation_contest_snapshots (contest_id, wallet_address, reputation_at_start)
    SELECT ${contestId}, wallet_address, reputation
    FROM user_reputation
    WHERE artist_wallet = ${wallet}
    ON CONFLICT (contest_id, wallet_address) DO NOTHING
  `;

  return contestId;
}

/** Contest-Rewards verteilen: Credits vom Artist an Top-Fans */
export async function distributeReputationContest(
  contestId: string,
  artistWallet: string,
  force = false,
): Promise<{ rank: number; walletAddress: string; credited: number }[]> {
  const sql = getDb();
  // Prüfen ob Contest existiert, undistributed und abgelaufen
  const contestRows = await sql`
    SELECT end_date, distributed FROM reputation_contests
    WHERE id = ${contestId} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  if (contestRows.length === 0) throw new Error('Contest nicht gefunden');
  if (contestRows[0].distributed) throw new Error('Bereits verteilt');
  const endDate = contestRows[0].end_date instanceof Date ? contestRows[0].end_date : new Date(contestRows[0].end_date as string);
  if (!force && endDate > new Date()) throw new Error('Contest läuft noch');

  const prizes = await sql`
    SELECT rank, credit_reward FROM reputation_contest_prizes
    WHERE contest_id = ${contestId}
    ORDER BY rank ASC
  `;
  if (prizes.length === 0) throw new Error('Keine Preise definiert');

  const maxRank = Math.max(...prizes.map(p => Number(p.rank)));
  const leaderboard = await getContestLeaderboard(contestId, artistWallet, maxRank);

  const results: { rank: number; walletAddress: string; credited: number }[] = [];
  for (const prize of prizes) {
    const rank = Number(prize.rank);
    const creditReward = Number(prize.credit_reward);
    const winner = leaderboard.find(e => e.rank === rank);
    if (!winner || creditReward <= 0) continue;
    try {
      // Reward als einlösbar speichern (wie Level-Up Rewards)
      await savePendingReward({
        walletAddress: winner.walletAddress,
        amount: creditReward,
        reason: `contest_reward:${artistWallet.toLowerCase()}:${contestId}:${rank}`,
        questId: null,
        createdAt: new Date().toISOString(),
      });
      results.push({ rank, walletAddress: winner.walletAddress, credited: creditReward });
    } catch {
      // Fehler beim Speichern – überspringen
    }
  }

  // Nicht vergebene Preise an Artist zurücküberweisen
  const totalAwarded = results.reduce((sum, r) => sum + r.credited, 0);
  const lockedRows = await sql`SELECT credits_locked FROM reputation_contests WHERE id = ${contestId}`;
  const locked = Number(lockedRows[0]?.credits_locked ?? 0);
  const refund = locked - totalAwarded;
  if (refund > 0) {
    await addDfaithCredits(artistWallet.toLowerCase(), refund);
  }

  await sql`UPDATE reputation_contests SET distributed = TRUE WHERE id = ${contestId}`;
  return results;
}

/**
 * Verteilt Leaderboard-Rewards sofort an die aktuellen Top-Fans.
 * Zieht Credits vom Artist ab und fügt sie den Gewinnern hinzu.
 */
export async function distributeLeaderboardRewards(
  artistWallet: string,
  prizes: { rank: number; creditReward: number }[],
): Promise<{ rank: number; walletAddress: string; credited: number }[]> {
  const wallet = artistWallet.toLowerCase();
  const total = prizes.reduce((sum, p) => sum + (p.creditReward || 0), 0);
  if (total <= 0) throw new Error('Keine Credits definiert');

  // Guthaben prüfen
  const sql = getDb();
  const balRows = await sql`SELECT balance FROM dfaith_credits WHERE wallet_address = ${wallet}`;
  const balance = Number(balRows[0]?.balance ?? 0);
  if (balance < total) throw new Error(`Nicht genug Credits (Guthaben: ${balance}, benötigt: ${total})`);

  const maxRank = Math.max(...prizes.map(p => p.rank));
  const leaderboard = await getReputationLeaderboard(artistWallet, maxRank);

  // Credits vom Artist abziehen
  await addDfaithCredits(wallet, -total);

  const results: { rank: number; walletAddress: string; credited: number }[] = [];
  let actuallySpent = 0;

  for (const prize of prizes) {
    if (prize.creditReward <= 0) continue;
    const winner = leaderboard.find(e => e.rank === prize.rank);
    if (!winner) continue;
    try {
      await savePendingReward({
        walletAddress: winner.walletAddress,
        amount: prize.creditReward,
        reason: `leaderboard_reward:${artistWallet.toLowerCase()}:${prize.rank}`,
        questId: null,
        createdAt: new Date().toISOString(),
      });
      results.push({ rank: prize.rank, walletAddress: winner.walletAddress, credited: prize.creditReward });
      actuallySpent += prize.creditReward;
    } catch {
      // Überspringen, Refund am Ende
    }
  }

  // Nicht vergebene Preise zurückerstatten
  const refund = total - actuallySpent;
  if (refund > 0) {
    await addDfaithCredits(wallet, refund);
  }

  return results;
}

/** Liefert Quartal-String + Start/End-Datum für ein Datum (default: heute) */
export function getQuarterInfo(date: Date = new Date()): {
  quarter: string;
  start: Date;
  end: Date;
} {
  const year = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3) + 1;
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { quarter: `${year}-Q${q}`, start, end };
}

/** Quartals-Reward-Konfiguration laden */
export async function getLeaderboardQuarterlyConfig(
  artistWallet: string,
): Promise<{ prizes: { rank: number; creditReward: number }[] } | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT prizes FROM leaderboard_quarterly_config
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { prizes: rows[0].prizes as { rank: number; creditReward: number }[] };
}

/** Quartals-Reward-Konfiguration speichern / aktualisieren */
export async function upsertLeaderboardQuarterlyConfig(
  artistWallet: string,
  prizes: { rank: number; creditReward: number }[],
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO leaderboard_quarterly_config (id, artist_wallet, prizes, updated_at)
    VALUES (gen_random_uuid()::text, ${artistWallet.toLowerCase()}, ${JSON.stringify(prizes)}::jsonb, NOW())
    ON CONFLICT (artist_wallet) DO UPDATE
      SET prizes = EXCLUDED.prizes, updated_at = NOW()
  `;
}

/** Quartals-Historie laden */
export async function getLeaderboardQuarterlyHistory(
  artistWallet: string,
): Promise<{ id: string; quarter: string; prizes: { rank: number; creditReward: number }[]; results: { rank: number; walletAddress: string; credited: number }[]; totalCredited: number; distributedAt: string }[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, quarter, prizes, results, total_credited, distributed_at
    FROM leaderboard_quarterly_history
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY distributed_at DESC
    LIMIT 20
  `;
  return rows.map(r => ({
    id: r.id as string,
    quarter: r.quarter as string,
    prizes: r.prizes as { rank: number; creditReward: number }[],
    results: r.results as { rank: number; walletAddress: string; credited: number }[],
    totalCredited: Number(r.total_credited),
    distributedAt: (r.distributed_at as Date).toISOString(),
  }));
}

/**
 * Quartals-Rewards verteilen.
 * force = true: auch wenn Quartal noch nicht abgelaufen
 */
export async function distributeLeaderboardQuarterly(
  artistWallet: string,
  force = false,
): Promise<{ quarter: string; distributed: { rank: number; walletAddress: string; credited: number }[] }> {
  const wallet = artistWallet.toLowerCase();
  const sql = getDb();
  const { quarter, end } = getQuarterInfo();

  if (!force && new Date() < end) {
    throw new Error(`Quartal ${quarter} läuft noch bis ${end.toLocaleDateString('de-DE')}`);
  }

  // Bereits verteilt?
  const already = await sql`
    SELECT id FROM leaderboard_quarterly_history
    WHERE artist_wallet = ${wallet} AND quarter = ${quarter}
    LIMIT 1
  `;
  if (already.length > 0 && !force) {
    throw new Error(`Quartal ${quarter} wurde bereits verteilt`);
  }

  const config = await getLeaderboardQuarterlyConfig(artistWallet);
  if (!config || config.prizes.length === 0) throw new Error('Keine Konfiguration gefunden');

  const validPrizes = config.prizes.filter(p => p.creditReward > 0);
  if (validPrizes.length === 0) throw new Error('Keine Preise > 0 konfiguriert');

  const total = validPrizes.reduce((s, p) => s + p.creditReward, 0);

  // Guthaben prüfen
  const balRows = await sql`SELECT balance FROM dfaith_credits WHERE wallet_address = ${wallet}`;
  const balance = Number(balRows[0]?.balance ?? 0);
  if (balance < total) throw new Error(`Nicht genug Credits (Guthaben: ${balance.toFixed(2)}, benötigt: ${total})`);

  const maxRank = Math.max(...validPrizes.map(p => p.rank));
  const leaderboard = await getReputationLeaderboard(artistWallet, maxRank);

  await addDfaithCredits(wallet, -total);

  const results: { rank: number; walletAddress: string; credited: number }[] = [];
  let actuallySpent = 0;

  for (const prize of validPrizes) {
    const winner = leaderboard.find(e => e.rank === prize.rank);
    if (!winner) continue;
    try {
      await addDfaithCredits(winner.walletAddress, prize.creditReward);
      results.push({ rank: prize.rank, walletAddress: winner.walletAddress, credited: prize.creditReward });
      actuallySpent += prize.creditReward;
    } catch { /* überspringen */ }
  }

  // Refund nicht vergebener Preise
  const refund = total - actuallySpent;
  if (refund > 0) await addDfaithCredits(wallet, refund);

  // Historie speichern (upsert für force-Fall)
  await sql`
    INSERT INTO leaderboard_quarterly_history
      (id, artist_wallet, quarter, prizes, results, total_credited, distributed_at)
    VALUES (
      gen_random_uuid()::text,
      ${wallet},
      ${quarter},
      ${JSON.stringify(config.prizes)}::jsonb,
      ${JSON.stringify(results)}::jsonb,
      ${actuallySpent},
      NOW()
    )
    ON CONFLICT (artist_wallet, quarter) DO UPDATE
      SET results = EXCLUDED.results,
          total_credited = EXCLUDED.total_credited,
          distributed_at = NOW()
  `;

  return { quarter, distributed: results };
}

/** Berechnet Level und Fortschritt basierend auf Reputation + Level-Config */
export function reputationToLevel(
  reputation: number,
  levels: ReputationLevel[],
): { level: number; levelName: string; nextLevelRep: number | null; progress: number } {
  const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);
  let current = sorted[0];
  for (const lvl of sorted) {
    if (reputation >= lvl.minReputation) current = lvl;
    else break;
  }
  const idx = sorted.indexOf(current);
  const next = sorted[idx + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.floor(((reputation - current.minReputation) / (next.minReputation - current.minReputation)) * 100))
    : 100;
  return {
    level: current.levelNumber,
    levelName: current.levelName,
    nextLevelRep: next?.minReputation ?? null,
    progress,
  };
}

/** Reputation eines Users für alle Artists laden */
export async function getUserReputationAll(walletAddress: string): Promise<UserArtistReputation[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT artist_wallet, reputation FROM user_reputation
    WHERE wallet_address = ${walletAddress.toLowerCase()}
    ORDER BY reputation DESC
  `;
  const result: UserArtistReputation[] = [];
  for (const row of rows) {
    const artistWallet = row.artist_wallet as string;
    const reputation = Number(row.reputation);
    const levels = await getReputationLevels(artistWallet);
    const { level, levelName, nextLevelRep, progress } = reputationToLevel(reputation, levels);
    result.push({ artistWallet, reputation, level, levelName, nextLevelRep, progress });
  }
  return result;
}

/** Alle Artists mit der Reputation des Users (0 wenn noch keine vorhanden) */
export async function getAllArtistsWithReputation(walletAddress: string): Promise<UserArtistReputation[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.wallet_address                AS artist_wallet,
      p.display_name,
      p.display_platform,
      p.instagram_handle, p.instagram_name, p.instagram_picture,
      p.tiktok_handle,    p.tiktok_name,    p.tiktok_picture,
      p.facebook_handle,  p.facebook_name,  p.facebook_picture,
      yb.channel_id          AS youtube_channel_id,
      yb.channel_name        AS youtube_channel_name,
      yb.channel_thumbnail   AS youtube_channel_thumbnail,
      COALESCE(ur.reputation, 0) AS reputation
    FROM user_profiles p
    LEFT JOIN user_reputation ur
      ON  LOWER(ur.artist_wallet)  = LOWER(p.wallet_address)
      AND LOWER(ur.wallet_address) = ${walletAddress.toLowerCase()}
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
    WHERE p.is_artist = TRUE
    ORDER BY COALESCE(ur.reputation, 0) DESC, p.display_name ASC
  `;
  const result: UserArtistReputation[] = [];
  for (const row of rows) {
    const artistWallet = row.artist_wallet as string;
    const reputation = Number(row.reputation);
    const levels = await getReputationLevels(artistWallet);
    const { level, levelName, nextLevelRep, progress } = reputationToLevel(reputation, levels);
    let artistName: string | null = (row.display_name as string | null) ?? null;
    let artistPicture: string | null = null;
    const dp = row.display_platform as string | null;
    if (dp === 'youtube' && row.youtube_channel_id) {
      artistName ??= row.youtube_channel_name as string ?? null;
      artistPicture = (row.youtube_channel_thumbnail as string | null) ?? null;
    } else if (dp === 'instagram' && row.instagram_handle) {
      artistName ??= row.instagram_name as string ?? `@${row.instagram_handle}`;
      artistPicture = (row.instagram_picture as string | null) ?? null;
    } else if (dp === 'tiktok' && row.tiktok_handle) {
      artistName ??= row.tiktok_name as string ?? `@${row.tiktok_handle}`;
      artistPicture = (row.tiktok_picture as string | null) ?? null;
    } else if (dp === 'facebook' && row.facebook_handle) {
      artistName ??= row.facebook_name as string ?? `@${row.facebook_handle}`;
      artistPicture = (row.facebook_picture as string | null) ?? null;
    } else {
      // Fallback: erste verfügbare Plattform
      if (row.youtube_channel_id) {
        artistName ??= row.youtube_channel_name as string ?? null;
        artistPicture = (row.youtube_channel_thumbnail as string | null) ?? null;
      } else if (row.instagram_name) {
        artistName ??= row.instagram_name as string;
        artistPicture = (row.instagram_picture as string | null) ?? null;
      } else if (row.tiktok_name) {
        artistName ??= row.tiktok_name as string;
        artistPicture = (row.tiktok_picture as string | null) ?? null;
      } else if (row.facebook_name) {
        artistName ??= row.facebook_name as string;
        artistPicture = (row.facebook_picture as string | null) ?? null;
      }
    }
    result.push({ artistWallet, reputation, level, levelName, nextLevelRep, progress, artistName, artistPicture });
  }
  return result;
}

/** Reputation eines Users für einen Artist laden */
export async function getUserReputation(walletAddress: string, artistWallet: string): Promise<UserArtistReputation> {
  const sql = getDb();
  const rows = await sql`
    SELECT reputation FROM user_reputation
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  const reputation = rows.length > 0 ? Number(rows[0].reputation) : 0;
  const levels = await getReputationLevels(artistWallet);
  const { level, levelName, nextLevelRep, progress } = reputationToLevel(reputation, levels);
  return { artistWallet, reputation, level, levelName, nextLevelRep, progress };
}

/** Reputation-Leaderboard für einen Artist (Top 50) */
export async function getReputationLeaderboard(
  artistWallet: string,
  limit = 50,
): Promise<ReputationLeaderboardEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      ur.wallet_address,
      ur.reputation,
      COALESCE(
        p.display_name,
        p.instagram_name,
        p.tiktok_name,
        p.facebook_name,
        yb.channel_name
      ) AS display_name
    FROM user_reputation ur
    LEFT JOIN user_profiles p  ON p.wallet_address  = ur.wallet_address
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = ur.wallet_address
    WHERE ur.artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY ur.reputation DESC
    LIMIT ${limit}
  `;
  const levels = await getReputationLevels(artistWallet);
  return rows.map((r, i) => {
    const reputation = Number(r.reputation);
    const { level, levelName } = reputationToLevel(reputation, levels);
    return {
      rank: i + 1,
      walletAddress: r.wallet_address as string,
      displayName: r.display_name ?? null,
      reputation,
      level,
      levelName,
    };
  });
}

/** Contest-Leaderboard: nur REP seit Contest-Start zählt */
export async function getContestLeaderboard(
  contestId: string,
  artistWallet: string,
  limit = 50,
): Promise<ReputationLeaderboardEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      ur.wallet_address,
      ur.reputation - COALESCE(s.reputation_at_start, 0) AS contest_rep,
      COALESCE(
        p.display_name,
        p.instagram_name,
        p.tiktok_name,
        p.facebook_name,
        yb.channel_name
      ) AS display_name
    FROM user_reputation ur
    LEFT JOIN reputation_contest_snapshots s
      ON s.contest_id = ${contestId} AND s.wallet_address = ur.wallet_address
    LEFT JOIN user_profiles p  ON p.wallet_address  = ur.wallet_address
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = ur.wallet_address
    WHERE ur.artist_wallet = ${artistWallet.toLowerCase()}
      AND ur.reputation - COALESCE(s.reputation_at_start, 0) > 0
    ORDER BY contest_rep DESC
    LIMIT ${limit}
  `;
  const levels = await getReputationLevels(artistWallet);
  return rows.map((r, i) => {
    const reputation = Number(r.contest_rep);
    const { level, levelName } = reputationToLevel(reputation, levels);
    return {
      rank: i + 1,
      walletAddress: r.wallet_address as string,
      displayName: r.display_name ?? null,
      reputation,
      level,
      levelName,
    };
  });
}
