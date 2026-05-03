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

export type Platform = 'youtube'; // erweiterbar: | 'instagram' | 'tiktok'
export type QuestType = 'comment'; // erweiterbar: | 'like' | 'subscribe'

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
  maxCompletions: number;
  completions: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
  creditsLocked: number;
  creditsRefunded: boolean;
}

export interface QuestDetail extends QuestIndexEntry {
  description: string;
  updatedAt: string;
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
  await sql`
    INSERT INTO quests (
      id, platform, quest_type, creator_wallet,
      video_id, video_title, video_thumbnail, video_url,
      description, reward_amount, max_completions,
      completions, is_active, expires_at, credits_locked, credits_refunded, created_at, updated_at
    ) VALUES (
      ${quest.id}, ${quest.platform}, ${quest.type}, ${quest.creatorWallet},
      ${quest.videoId}, ${quest.videoTitle}, ${quest.videoThumbnail}, ${quest.videoUrl},
      ${quest.description}, ${quest.rewardAmount}, ${quest.maxCompletions},
      ${quest.completions}, ${quest.isActive}, ${expiresAt}, ${creditsLocked}, false, ${quest.createdAt}, ${quest.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      video_title      = EXCLUDED.video_title,
      video_thumbnail  = EXCLUDED.video_thumbnail,
      description      = EXCLUDED.description,
      reward_amount    = EXCLUDED.reward_amount,
      max_completions  = EXCLUDED.max_completions,
      is_active        = EXCLUDED.is_active,
      expires_at       = EXCLUDED.expires_at,
      updated_at       = NOW()
  `;
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
    const used = Number(row.completions) * Number(row.reward_amount);
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

