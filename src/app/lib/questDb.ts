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
  bonusBudget: number;
}

// ─── Reputation-Typen ─────────────────────────────────────────────────────────

export interface ReputationLevel {
  levelNumber: number;
  levelName: string;
  minReputation: number;
  prizeDescription: string;
  creditReward: number;            // D.FAITH Credits die beim Level-Up ausgezahlt werden
  maxRecipients: number;           // Wie viele Fans diesen Reward erhalten können (0 = kein Reward)
  questRewardBonusPercent: number; // Prozentualer Bonus auf Quest-Rewards für dieses Level (0 = kein Bonus)
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
  questRewardBonusPercent: number;
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

// ─── Bundle-Typen ─────────────────────────────────────────────────────────────

/** Standard-Reichweiten-Gewichtung pro Quest-Typ (Algorythmus-Signalstärke) */
export const DEFAULT_REACH_WEIGHTS: Record<QuestType, number> = {
  comment:    3,  // Kommentar = starkes Signal
  like:       1,  // Like = schwaches Signal
  save:       2,  // Speichern = mittleres Signal
  repost:     3,  // Repost = starkes Signal
  dm_share:   4,  // Story-Share = höchste persönliche Reichweite
  engagement: 2,  // TikTok-Engagement-Paket
  secret:     2,  // Geheimcode = mittleres Signal
};

export interface QuestBundle {
  id: string;
  creatorWallet: string;
  platform: Platform;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  videoUrl: string;
  description: string;
  rewardPoolPerFan: number;       // Pro Fan: Gesamtreward für einzelne Tasks (aufgeteilt nach Gewichten)
  bundleCompletionBonus: number;  // Extra-Bonus wenn Fan ALLE Tasks abschließt
  bonusBudgetRemaining: number;   // Noch verfügbares Bonus-Budget
  maxParticipants: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestBundleItem {
  questId: string;
  questType: QuestType;
  reachWeight: number;
  rewardAmount: number;
  completions: number;
  maxCompletions: number;
  isActive: boolean;
}

export interface QuestBundleWithItems extends QuestBundle {
  items: QuestBundleItem[];
  /** Fan-Fortschritt: abgeschlossene Quest-Typen */
  fanCompletedTypes?: QuestType[];
  /** Fan hat den Abschluss-Bonus bereits eingelöst */
  fanBonusClaimed?: boolean;
  /** Fan hat alle Tasks abgeschlossen (Bonus einlösbar) */
  fanAllCompleted?: boolean;
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
    bonusBudget: Number(row.bonus_budget ?? 0),
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

// ─── Comment-Quest: natürlich klingender Kommentar pro Wallet+Quest ──────────
//
// Da die Facebook Graph API aus Datenschutzgründen für User-Kommentare
// kein `from`-Feld zurückgibt, identifizieren wir den Kommentar des Users
// über einen deterministisch gewählten Text aus einem festen Pool.
// Pro (wallet, questId) wird IMMER derselbe Kommentar generiert, jeder
// User bekommt aber einen anderen → Eindeutigkeit gegeben.

const QUEST_COMMENT_POOL: ReadonlyArray<string> = [
  // Track / Sound (1-40)
  'Mega Track, läuft bei mir auf Repeat! 🔥',
  'Krass produziert, Respekt 🙌',
  'Endlich neuer Sound von dir, was für ein Banger 💯',
  'Hammer, geht direkt in meine Playlist 🎶',
  'Das hier ist auf einem ganz anderen Level 🚀',
  'Boah, dieser Drop! Ich bin geflasht 🤯',
  'Genau die Vibes die ich gebraucht habe ✨',
  'Nice, du legst echt jedes Mal eine Schippe drauf 💪',
  'Banger! Kann nicht aufhören es zu hören 🎧',
  'Sounddesign on point, Hut ab 👏',
  'Das geht direkt rein, einfach stark 🔊',
  'Feinste Arbeit, danke für die Musik 🙏',
  'Was für eine Hook, bleibt sofort hängen 🎵',
  'Mood gesetzt, Track läuft den ganzen Abend 🌙',
  'Richtig richtig gut, weiter so! 🚀',
  'Atmosphäre pur, gänsehaut pur ❄️',
  'Production geht hart, gefällt mir extrem 🔥',
  'Loop läuft seit Stunden, kann nicht aufhören 🔁',
  'Das ist mein neuer Lieblingssong, fett! ❤️',
  'Sound ist ein Träumchen, perfekt für die Late-Night-Vibes 🌌',
  'Das ist Kunst, danke für die Inspiration 🎨',
  'Vibes auf Maximum, top abgeliefert 👌',
  'Diese Energie! Einfach nur stark 💥',
  'Track ist sofort hängen geblieben, Glückwunsch 🎯',
  'Du triffst genau meinen Geschmack, mehr davon 🙏',
  'Sehr starke Nummer, läuft jetzt überall mit 📻',
  'Pure Magie auf den Ohren, Hammer 🪄',
  'Das ist Liebe auf die ersten Beats ❤️‍🔥',
  'Definitiv on repeat heute, weiter so 🔁',
  'Sehr atmosphärisch, du hast es einfach drauf 🎼',
  'Sofort in die Lieblingsliste, top Sound 🌟',
  'Was für eine Stimmung, ich fühl jeden Beat 🥁',
  'Beat slaps, gefällt mir richtig 🤝',
  'Erste Note und schon im Flow, krass 🌊',
  'Mixing ist sauber, Mastering noch sauberer 🎚️',
  'Ich bekomme nicht genug, läuft seit heute morgen 🌅',
  'Track hat Charakter, fühlt sich echt an 🫶',
  'So muss Musik klingen, danke dafür 💎',
  'Sehr smooth, kann ich stundenlang hören 🍃',
  'Klanglich ein Statement, einfach groß ✨',

  // Bass / Drums / Hook (41-70)
  '808s knallen, brauche mehr davon 💣',
  'Snare sitzt perfekt, Mix ist top 🔊',
  'Diese Hook lässt mich nicht los, krass 🎤',
  'Bassline ist heavy, fühlt sich richtig fett an 🔉',
  'Hi-Hats tanzen, einfach geil produziert 🎛️',
  'Kick ist tight, geht direkt in die Brust 💥',
  'Melodie hat Suchtfaktor, weiter so 🌀',
  'Refrain ist sofort drin, große Klasse 🎶',
  'Bridge ist genial, hätte ich nicht erwartet 🔀',
  'Outro hat mich erwischt, wow 🎬',
  'Intro reißt sofort mit, Hammer Einstieg 🚪',
  'Pre-Chorus baut perfekt auf, super gemacht 📈',
  'Verses haben echt Tiefe, da steckt was drin 📚',
  'Drop ist absolute Wucht, Mann 💯',
  'Breakdown lässt einen kurz Luft holen, dann gehts richtig los 🌬️',
  'Build-up war ein Erlebnis, voll cinematic 🎥',
  'Die Layers im Beat sind perfekt verzahnt 🧩',
  'Sub-Bass schiebt, mein Subwoofer dankt 🔊',
  'Vocal Chop ist Gold wert, klasse Detail ✨',
  'Sample-Auswahl ist on point, Geschmack pur 👌',
  'Bridge nach 2 Minuten, einfach perfekt platziert ⏱️',
  'Drum-Pattern ist innovativ, gefällt mir sehr 🥁',
  'Synth-Lead schmilzt einem die Ohren weg 🎹',
  'Pad-Sounds sind cremig, klingt warm 🍯',
  'Stereo-Bild ist breit, fühlt sich riesig an 🌐',
  'Reverb-Tails sind Träume, klanglich top 💫',
  'Sidechain ist sauber, atmet richtig schön 🌬️',
  'Vocal-Mix ist on point, jedes Wort klar 🎙️',
  'Harmonien klingen wie Sahne 🍰',
  'Groove ist unfassbar, Kopfnicker garantiert 🤘',

  // Feeling / Emotion (71-110)
  'Hat mich wirklich berührt, danke für die Musik 🥺',
  'Gänsehaut von Anfang bis Ende ❄️',
  'Tränen in den Augen, so schön 🥹',
  'Habe lange auf so einen Sound gewartet 🕰️',
  'Macht mir den Tag besser, ehrlich 🌞',
  'Stimmung passt einfach perfekt zu meinem Mood 💭',
  'Hör das auf dem Heimweg, immer wieder 🚶',
  'Begleitet mich gerade durch eine harte Zeit, danke 🙏',
  'Bringt mich runter und gleichzeitig hoch, magisch ✨',
  'Erinnert mich an gute alte Zeiten 📼',
  'Macht süchtig, im positiven Sinne 🍫',
  'Werde das beim Sport hören, perfektes Tempo 🏋️',
  'Genau das richtige für die Autofahrt 🚗',
  'Perfekt zum Chillen am Wochenende 🛋️',
  'Lieblings-Track des Tages, easy 🏆',
  'Habe heute schon 10 Mal gehört, kein Ende in Sicht 🔄',
  'Inspiriert mich richtig, mache gleich auch Musik 🎼',
  'Beim ersten Hören schon Suchtgefahr ⚠️',
  'Macht definitiv Lust auf mehr 🍿',
  'Glaube das wird mein Sommer-Track 2026 ☀️',
  'Definitiv Winter-Vibes, perfekt 🥶',
  'Setzt mich in einen ganz anderen Zustand, krass 🌀',
  'Das ist Therapie für die Ohren 🛋️',
  'Fühle mich gerade frei, danke für den Vibe 🕊️',
  'Hör das gleich nochmal, ist zu gut 🔁',
  'Bringt sofort gute Laune 😊',
  'Erinnert mich an meinen ersten Sommerurlaub 🏖️',
  'Werde das auf meiner nächsten Party spielen 🪩',
  'Studio-Sessions mit dem Track im Hintergrund? Yes please 🎙️',
  'Macht alles besser, sogar Montagmorgen 🌅',
  'Schließe die Augen und bin woanders 🌍',
  'Hat Soul, das spürt man sofort 🫶',
  'Trifft genau ins Herz, stark gemacht 💖',
  'Eines dieser Lieder die hängen bleiben 📌',
  'Verbindet sich sofort mit deinem Gefühl 🔗',
  'Hat Tiefe, geht über reines Hören hinaus 🌊',
  'Heilende Wirkung, ehrlich gesagt 🌿',
  'Bringt mich in einen Flow, super Sache 🌪️',
  'Pure Eskalation, ich bin im Loop 🔁',
  'Lässt mich alles um mich herum vergessen 🌌',

  // Künstler-Wertschätzung (111-150)
  'Du bist ein echtes Talent, weiter so 🌟',
  'Einer der wenigen Artists die mich aktuell catchen 🎯',
  'Habe dich erst entdeckt, schon Fan ✨',
  'Bin von Anfang an dabei, immer wieder stark 🚀',
  'Verdienst viel mehr Reichweite, ehrlich 🌍',
  'Hoffe du machst mal eine Tour, wäre dabei 🎤',
  'Folge dir seit Tag eins, glückwunsch 🥂',
  'Karriere geht steil, freu mich für dich 📈',
  'Schreibe schon lange dein Name auf meine Wunschliste 📝',
  'Du machst genau die Musik die fehlt 🧩',
  'Echte Stimme, echte Vision, top 🎙️',
  'Hast Stil, das hört man bei jedem Track 💼',
  'Eine der besten Releases dieses Jahr für mich 🏅',
  'Glaube du wirst gross, das ist erst der Anfang 🌱',
  'Album wäre der Wahnsinn, bitte mach eins 💽',
  'Wäre cool wenn du mal Features machst, hab da Ideen 🤝',
  'Deine Musik fühlt sich ehrlich an, das ist selten 💯',
  'Du gehst deinen eigenen Weg, das respektier ich 🛤️',
  'Charisma im Sound, einfach unique 🎭',
  'Sehe dich bald auf den großen Bühnen 🎪',
  'Du bist underrated, das muss sich ändern 📢',
  'Bin Stolz dich entdeckt zu haben 🔍',
  'Werde dich überall weiterempfehlen 🗣️',
  'Bist gerade mein Lieblingsartist, ehrlich 💎',
  'Habe alle deine Tracks gehört, dieser ist top 🥇',
  'Spielst in einer eigenen Liga, weiter so 🏆',
  'Mehr von dir, immer mehr 🙏',
  'Sound ist erkennbar, das ist Gold wert 🔑',
  'Du hast eine Handschrift, das merkt man 🖋️',
  'Realer Künstler in einer Welt voller Trends 🎨',
  'Brauche dringend Merch von dir, wann? 👕',
  'Wann kommt das Musikvideo? Bin schon gespannt 🎬',
  'Setlist für die Tour, ich bin bereit 📋',
  'Würde dich gerne mal live sehen, halt mich up to date 📅',
  'Bist die Zukunft, glaube fest dran ✨',
  'Hoffe du bleibst dir treu, das ist dein Stärke 💫',
  'Authentisch durch und durch, weiter so 🫡',
  'Mit jedem Release wirst du besser 📊',
  'Bist eine Bereicherung für die Szene 🌍',
  'Wenn du irgendwo auflegst, ich bin da 🪩',

  // Allgemein / Reaction (151-200+)
  'Ok das ist echt richtig gut 👀',
  'Wow, einfach wow 😍',
  'Habe nicht damit gerechnet, krass 😳',
  'Endgegner-Track, lass dir gesagt sein 🐉',
  'Fügt sich perfekt in meine Routine ein 📅',
  'Dieser Sound ist Liebe, klar 💗',
  'Hammerhart, ohne Übertreibung 🔨',
  'Pures Feuer, mehr brauche ich nicht zu sagen 🔥',
  'Vibe-Check bestanden, mit Auszeichnung ✅',
  'Direkt in meine Top 10 dieses Jahr 🔝',
  'Lasse niemanden anders ran, das hört nur mein Player 🎧',
  'Komm gerade nicht über diesen Sound hinweg 🤤',
  'Brauche unbedingt eine instrumentale Version 🎹',
  'Acapella wäre auch goldwert 🎤',
  'Remix-Potential ist riesig, bitte 🎛️',
  'Sicher dass du das selbst gemacht hast? Krass 😂',
  'Spiele das gleich für meine Crew, die werden flippen 👥',
  'Plattenkauf in Planung, falls Vinyl kommt 💿',
  'Schon abgespeichert, läuft gleich nochmal 💾',
  'Mit Sicherheit Track des Monats 🗓️',
  'Habe einen Schauer beim ersten Beat bekommen 🥶',
  'Sound der hängen bleibt, lange 🪝',
  'Diese Melodie verfolgt mich, im besten Sinne 🎶',
  'Genau die Frequenzen die ich liebe 📡',
  'Habe Großes erwartet, du hast geliefert 📦',
  'Niemand macht es gerade so wie du 🥇',
  'Dieser Track ist Therapie, ehrlich 🛋️',
  'Ich fühle mich nach dem Hören wie neugeboren 🌅',
  'So muss neuer Sound klingen, danke 💚',
  'Den hör ich mir 100 Mal an, easy 💯',
  'Soundgewordene Inspiration, top 💡',
  'Habe nichts mehr zu sagen, einfach perfekt 🤐',
  'Ich melde mich jetzt offiziell als Fan an ✍️',
  'Track verdient mehr Aufmerksamkeit, geteilt 🔁',
  'Bookmark gesetzt, kommt definitiv wieder 🔖',
  'Atmet richtig schön, fühlt sich lebendig an 🫁',
  'Sehr cleane Produktion, kann man so lassen 🧼',
  'Energie auf 100, kann nicht still sitzen 🕺',
  'Dancefloor-ready, ich bin bereit 💃',
  'Headphone-Experience erster Klasse 🎧',
  'Speaker-Test mit voller Lautstärke, hält stand 📢',
  'Den lass ich auf Loop in der Bahn, perfekter Soundtrack 🚆',
  'Sound zum Träumen, sehr cinematic 🎞️',
  'Track hat ein Storytelling, gefällt mir extrem 📖',
  'Gute Energie aus den Lautsprechern, danke 🔋',
  'Mit besseren Songs könnte man den Tag nicht starten 🌄',
  'Wenn das nicht trendet, weiß ich auch nicht ⚠️',
  'Sehr cinematic, kommt das in einen Film? 🎬',
  'Würde sofort dazu tanzen, los gehts 💃',
  'Endlich mal wieder Musik mit Charakter 🎭',
];

/**
 * Gibt den Hash-basierten Fallback-Text zurück (nur intern als Seed-Fallback,
 * nicht mehr direkt in der Route verwendet).
 */
export function getQuestCommentText(walletAddress: string, questId: string): string {
  const seed = `${walletAddress.toLowerCase()}::${questId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % QUEST_COMMENT_POOL.length;
  return QUEST_COMMENT_POOL[idx];
}

/**
 * Reserviert einen eindeutigen Kommentarslot für (questId, walletAddress).
 *
 * Strategie:
 *   - Existiert bereits ein Eintrag → gibt denselben Text zurück (idempotent).
 *   - Sonst: findet den nächsten slot_index der für diesen Quest noch nicht
 *     vergeben ist, und speichert ihn atomar per INSERT … ON CONFLICT DO NOTHING
 *     + sofortigem Nachlesen (Retry-Loop für Race Conditions).
 *   - Sind alle 200 Slots belegt → fällt auf Hash-Fallback zurück (kein Fehler).
 */
export async function reserveQuestCommentSlot(
  questId: string,
  walletAddress: string,
): Promise<string> {
  const sql = getDb();
  const normalized = walletAddress.toLowerCase();

  // Bereits reserviert?
  const existing = await sql`
    SELECT comment_text FROM facebook_comment_slots
    WHERE quest_id = ${questId} AND wallet_address = ${normalized}
    LIMIT 1
  `;
  if (existing.length > 0) return existing[0].comment_text as string;

  const poolSize = QUEST_COMMENT_POOL.length;

  // Nächsten freien slot_index finden (MAX + 1, sicher gegen Race mit SKIP LOCKED)
  for (let attempt = 0; attempt < 5; attempt++) {
    const nextSlotRes = await sql`
      SELECT COALESCE(MAX(slot_index) + 1, 0) AS next_slot
      FROM facebook_comment_slots
      WHERE quest_id = ${questId}
    `;
    const nextSlot: number = Number(nextSlotRes[0].next_slot);

    if (nextSlot >= poolSize) {
      // Pool erschöpft → Hash-Fallback (Text wird evtl. doppelt vergeben, aber kein Fehler)
      return getQuestCommentText(normalized, questId);
    }

    const text = QUEST_COMMENT_POOL[nextSlot];
    try {
      await sql`
        INSERT INTO facebook_comment_slots (quest_id, wallet_address, slot_index, comment_text)
        VALUES (${questId}, ${normalized}, ${nextSlot}, ${text})
      `;
      return text;
    } catch {
      // Unique-Verletzung (Race) → nochmal mit aktualisierten Werten
      // Zuerst prüfen ob zwischenzeitlich unser wallet eingetragen wurde
      const raceCheck = await sql`
        SELECT comment_text FROM facebook_comment_slots
        WHERE quest_id = ${questId} AND wallet_address = ${normalized}
        LIMIT 1
      `;
      if (raceCheck.length > 0) return raceCheck[0].comment_text as string;
      // slot_index war belegt → Loop läuft weiter
    }
  }

  // Letzte Sicherheit
  return getQuestCommentText(normalized, questId);
}

/**
 * Liest den bereits reservierten Kommentartext aus der DB.
 * Gibt null zurück wenn keine Reservierung gefunden.
 */
export async function getReservedQuestCommentSlot(
  questId: string,
  walletAddress: string,
): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT comment_text FROM facebook_comment_slots
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? (rows[0].comment_text as string) : null;
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

// ─── Instagram Testers Whitelist ──────────────────────────────────────────────

export async function isInstagramTester(handle: string): Promise<boolean> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT 1 FROM instagram_testers WHERE instagram_handle = ${handle.toLowerCase()} LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    // Tabelle existiert noch nicht (Migration noch nicht ausgeführt) → als Nicht-Tester behandeln
    return false;
  }
}

export async function addInstagramTester(handle: string, notes = ''): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO instagram_testers (instagram_handle, notes)
    VALUES (${handle.toLowerCase()}, ${notes})
    ON CONFLICT (instagram_handle) DO UPDATE SET notes = ${notes}, added_at = NOW()
  `;
}

export async function removeInstagramTester(handle: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM instagram_testers WHERE instagram_handle = ${handle.toLowerCase()}`;
}

export async function listInstagramTesters(): Promise<Array<{ instagramHandle: string; notes: string; inviteAccepted: boolean; addedAt: string }>> {
  const sql = getDb();
  const rows = await sql`SELECT instagram_handle, notes, invite_accepted, added_at FROM instagram_testers ORDER BY added_at DESC`;
  return rows.map((r: any) => ({
    instagramHandle: r.instagram_handle,
    notes: r.notes,
    inviteAccepted: Boolean(r.invite_accepted),
    addedAt: r.added_at instanceof Date ? r.added_at.toISOString() : r.added_at,
  }));
}

export async function getInstagramTesterStatus(handle: string): Promise<{ isTester: boolean; inviteAccepted: boolean }> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT invite_accepted FROM instagram_testers WHERE instagram_handle = ${handle.toLowerCase()} LIMIT 1
    `;
    if (rows.length === 0) return { isTester: false, inviteAccepted: false };
    return { isTester: true, inviteAccepted: Boolean(rows[0].invite_accepted) };
  } catch {
    // invite_accepted-Spalte existiert noch nicht (Migration noch nicht ausgeführt)
    // → prüfen ob der User überhaupt in der Whitelist ist, und falls ja: isTester=true, inviteAccepted=false
    try {
      const rows2 = await sql`
        SELECT 1 FROM instagram_testers WHERE instagram_handle = ${handle.toLowerCase()} LIMIT 1
      `;
      if (rows2.length > 0) return { isTester: true, inviteAccepted: false };
    } catch { /* Tabelle existiert nicht → kein Tester */ }
    return { isTester: false, inviteAccepted: false };
  }
}

export async function setInstagramTesterInviteAccepted(handle: string, accepted: boolean): Promise<void> {
  const sql = getDb();
  try {
    await sql`
      UPDATE instagram_testers SET invite_accepted = ${accepted} WHERE instagram_handle = ${handle.toLowerCase()}
    `;
  } catch {
    // Spalte fehlt → Spalte anlegen, dann nochmal versuchen
    await sql`ALTER TABLE instagram_testers ADD COLUMN IF NOT EXISTS invite_accepted BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`
      UPDATE instagram_testers SET invite_accepted = ${accepted} WHERE instagram_handle = ${handle.toLowerCase()}
    `;
  }
}

// ─── Instagram Tester Anfragen ────────────────────────────────────────────────

export interface InstagramTesterRequest {
  id: string;
  instagramHandle: string;
  email: string;
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt: string | null;
}

export async function upsertInstagramTesterRequest(
  instagramHandle: string,
  email: string,
  walletAddress: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO instagram_tester_requests (instagram_handle, email, wallet_address)
    VALUES (${instagramHandle.toLowerCase()}, ${email.toLowerCase()}, ${walletAddress.toLowerCase()})
    ON CONFLICT (instagram_handle) WHERE status = 'pending'
    DO UPDATE SET email = ${email.toLowerCase()}, wallet_address = ${walletAddress.toLowerCase()}, created_at = NOW()
  `;
}

export async function listInstagramTesterRequests(status?: string): Promise<InstagramTesterRequest[]> {
  const sql = getDb();
  const rows = status
    ? await sql`SELECT * FROM instagram_tester_requests WHERE status = ${status} ORDER BY created_at DESC`
    : await sql`SELECT * FROM instagram_tester_requests ORDER BY created_at DESC`;
  return rows.map((r: any) => ({
    id: r.id,
    instagramHandle: r.instagram_handle,
    email: r.email,
    walletAddress: r.wallet_address,
    status: r.status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    approvedAt: r.approved_at ? (r.approved_at instanceof Date ? r.approved_at.toISOString() : r.approved_at) : null,
  }));
}

export async function approveInstagramTesterRequest(id: string): Promise<InstagramTesterRequest | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE instagram_tester_requests
    SET status = 'approved', approved_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `;
  if (!rows.length) return null;
  const r = rows[0];
  // Auch in Whitelist eintragen
  await addInstagramTester(r.instagram_handle, `Approved via request ${r.id}`);
  return {
    id: r.id,
    instagramHandle: r.instagram_handle,
    email: r.email,
    walletAddress: r.wallet_address,
    status: 'approved',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    approvedAt: r.approved_at instanceof Date ? r.approved_at.toISOString() : r.approved_at,
  };
}

export async function rejectInstagramTesterRequest(id: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE instagram_tester_requests SET status = 'rejected' WHERE id = ${id}`;
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
      facebookHandle: null, facebookVerified: false, facebookName: null, facebookPicture: null,
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

// ─── Reputation ───────────────────────────────────────────────────────────────

// ─── Level-Skalierung ────────────────────────────────────────────────────────
// Bewährtes Konzept: ~2× Verdopplung des Abstands pro Level (Discord/RPG-Muster).
// Jede Schwelle ≈ doppelt so viel Gesamtrep wie die vorherige (exponentiell).
//
// Kalibriert auf die Quest-REP-Werte (Story=120, Repost=80, Comment=40, Like=20):
//   Casual Fan   (~90 REP/Mo) → Level 5 in ~22 Monate
//   Aktiver Fan  (~500 REP/Mo) → Level 7 in ~14 Monate, Level 10 in ~7,5 Jahre
//   Super Fan    (~1000 REP/Mo) → Level 10 in ~3,5 Jahre  ← "Legend" ist erreichbar
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_REPUTATION_LEVELS: ReputationLevel[] = [
  { levelNumber:  1, levelName: 'Newcomer',  minReputation:      0, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent:  0 },
  { levelNumber:  2, levelName: 'Follower',  minReputation:    200, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent:  5 },
  { levelNumber:  3, levelName: 'Fan',       minReputation:    500, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 10 },
  { levelNumber:  4, levelName: 'Supporter', minReputation:  1_000, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 15 },
  { levelNumber:  5, levelName: 'Loyalist',  minReputation:  2_000, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 20 },
  { levelNumber:  6, levelName: 'True Fan',  minReputation:  3_800, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 25 },
  { levelNumber:  7, levelName: 'Advocate',  minReputation:  7_000, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 35 },
  { levelNumber:  8, levelName: 'VIP',       minReputation: 13_000, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 50 },
  { levelNumber:  9, levelName: 'Elite',     minReputation: 24_000, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 75 },
  { levelNumber: 10, levelName: 'Legend',    minReputation: 45_000, prizeDescription: '', creditReward: 0, maxRecipients: 0, questRewardBonusPercent: 100 },
];

/** Reputation eines Users für einen Artist erhöhen + Level-Up Credits auszahlen */
export async function addUserReputation(
  walletAddress: string,
  artistWallet: string,
  amount: number,
): Promise<void> {
  const sql = getDb();
  const rounded = Math.max(0, Math.round(amount));
  if (rounded <= 0) return;
  // Alte Reputation + Level-Config laden
  const [repRows, levels] = await Promise.all([
    sql`SELECT reputation FROM user_reputation WHERE wallet_address = ${walletAddress.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()} LIMIT 1`,
    getReputationLevels(artistWallet),
  ]);
  const oldRep = repRows.length > 0 ? Number(repRows[0].reputation) : 0;
  const newRep = oldRep + rounded;
  const oldLevel = reputationToLevel(oldRep, levels).level;
  const newLevel = reputationToLevel(newRep, levels).level;

  // Reputation updaten
  await sql`
    INSERT INTO user_reputation (wallet_address, artist_wallet, reputation, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${artistWallet.toLowerCase()}, ${rounded}, NOW())
    ON CONFLICT (wallet_address, artist_wallet) DO UPDATE SET
      reputation = user_reputation.reputation + ${rounded},
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
    SELECT level_number, level_name, min_reputation, prize_description, credit_reward, max_recipients, quest_reward_bonus_percent
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
    questRewardBonusPercent: Number(r.quest_reward_bonus_percent ?? 0),
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
    const creditReward        = Math.max(0, Math.round(Number(lvl.creditReward)            || 0));
    const maxRecipients       = Math.max(0, Math.round(Number(lvl.maxRecipients)           || 0));
    const questBonusPercent   = Math.min(100, Math.max(0, Math.round(Number(lvl.questRewardBonusPercent) || 0)));
    await sql`
      INSERT INTO reputation_levels
        (artist_wallet, level_number, level_name, min_reputation, prize_description, credit_reward, max_recipients, recipients_count, quest_reward_bonus_percent, updated_at)
      VALUES
        (${wallet}, ${lvl.levelNumber}, ${lvl.levelName}, ${lvl.minReputation}, ${lvl.prizeDescription}, ${creditReward}, ${maxRecipients}, 0, ${questBonusPercent}, NOW())
      ON CONFLICT (artist_wallet, level_number) DO UPDATE SET
        level_name                  = EXCLUDED.level_name,
        min_reputation              = EXCLUDED.min_reputation,
        prize_description           = EXCLUDED.prize_description,
        credit_reward               = EXCLUDED.credit_reward,
        max_recipients              = EXCLUDED.max_recipients,
        quest_reward_bonus_percent  = EXCLUDED.quest_reward_bonus_percent,
        updated_at                  = EXCLUDED.updated_at
    `;
  }
}

// ─── Level-Bonus bei Quest-Abschluss ─────────────────────────────────────────

/**
 * Prozentualen Level-Bonus auf einen Quest-Reward auszahlen.
 * Der Bonus wird aus dem allgemeinen D.FAITH-Guthaben des Artists (creatorWallet) entnommen
 * und dem Fan gutgeschrieben. Wenn der Artist nicht genug Guthaben hat, wird 0 zurückgegeben
 * und kein Fehler geworfen (Basisreward wird trotzdem ausgezahlt).
 *
 * @returns Der tatsächlich ausgezahlte Bonusbetrag (0 wenn kein Bonus).
 */
export async function payLevelBonus(
  fanWallet: string,
  artistWallet: string,
  baseReward: number,
  questId?: string,
): Promise<number> {
  if (baseReward <= 0) return 0;
  const sql = getDb();

  // Fan-Reputation für diesen Artist laden
  const repRows = await sql`
    SELECT reputation FROM user_reputation
    WHERE wallet_address = ${fanWallet.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  const reputation = repRows.length > 0 ? Number(repRows[0].reputation) : 0;

  // Level-Konfiguration laden + aktuelles Level bestimmen
  const levels = await getReputationLevels(artistWallet);
  const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);
  let currentLevel: ReputationLevel = sorted[0];
  for (const lvl of sorted) {
    if (reputation >= lvl.minReputation) currentLevel = lvl;
    else break;
  }

  const bonusPercent = currentLevel.questRewardBonusPercent ?? 0;
  if (bonusPercent <= 0) return 0;

  const bonus = Math.round(baseReward * bonusPercent / 100 * 100) / 100;
  if (bonus <= 0) return 0;

  // Zuerst Quest-Bonus-Budget versuchen (wenn questId angegeben)
  if (questId) {
    const fromQuest = await sql`
      UPDATE quests
      SET bonus_budget = bonus_budget - ${bonus}, updated_at = NOW()
      WHERE id = ${questId} AND bonus_budget >= ${bonus}
      RETURNING bonus_budget
    `;
    if (fromQuest.length > 0) {
      await addDfaithCredits(fanWallet, bonus);
      return bonus;
    }
  }

  // Fallback 1: vom allgemeinen Artist-Guthaben abziehen
  const deducted = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${bonus}, updated_at = NOW()
    WHERE wallet_address = ${artistWallet.toLowerCase()} AND balance >= ${bonus}
    RETURNING balance
  `;
  if (deducted.length > 0) {
    await addDfaithCredits(fanWallet, bonus);
    return bonus;
  }

  // Fallback 2: aus dem Quest-Locked-Budget (Überschuss, der für verbleibende Abschlüsse nicht benötigt wird)
  if (questId) {
    const fromLocked = await sql`
      UPDATE quests
      SET credits_locked = credits_locked - ${bonus}, updated_at = NOW()
      WHERE id = ${questId}
        AND credits_locked - ${bonus} >= (max_completions - completions) * reward_amount
      RETURNING credits_locked
    `;
    if (fromLocked.length > 0) {
      await addDfaithCredits(fanWallet, bonus);
      return bonus;
    }
  }

  return 0;
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
    const questRewardBonusPercent = levels.find(l => l.levelNumber === level)?.questRewardBonusPercent ?? 0;
    result.push({ artistWallet, reputation, level, levelName, nextLevelRep, progress, questRewardBonusPercent });
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
      p.clerk_image_url,
      p.clerk_name,
      p.instagram_handle, p.instagram_verified, p.instagram_name, p.instagram_picture,
      p.tiktok_handle,    p.tiktok_verified,    p.tiktok_name,    p.tiktok_picture,
      p.facebook_handle,  p.facebook_verified,  p.facebook_name,  p.facebook_picture,
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
    ORDER BY COALESCE(p.is_platform_user, FALSE) DESC, COALESCE(ur.reputation, 0) DESC, p.display_name ASC
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
    } else if (dp === 'clerk') {
      artistPicture = (row.clerk_image_url as string | null) ?? null;
      const clerkName = row.clerk_name as string | null;
      if (clerkName) {
        artistName = clerkName;
      } else {
        if (row.instagram_verified && row.instagram_name) artistName ??= row.instagram_name as string;
        else if (row.facebook_verified && row.facebook_name) artistName ??= row.facebook_name as string;
        else if (row.tiktok_verified && row.tiktok_name) artistName ??= row.tiktok_name as string;
        else if (row.youtube_channel_name) artistName ??= row.youtube_channel_name as string;
      }
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
      } else if (row.instagram_verified && row.instagram_handle) {
        artistName ??= row.instagram_name as string ?? `@${row.instagram_handle}`;
        artistPicture = (row.instagram_picture as string | null) ?? null;
      } else if (row.tiktok_verified && row.tiktok_handle) {
        artistName ??= row.tiktok_name as string ?? `@${row.tiktok_handle}`;
        artistPicture = (row.tiktok_picture as string | null) ?? null;
      } else if (row.facebook_verified && row.facebook_handle) {
        artistName ??= row.facebook_name as string ?? `@${row.facebook_handle}`;
        artistPicture = (row.facebook_picture as string | null) ?? null;
      }
    }
    result.push({ artistWallet, reputation, level, levelName, nextLevelRep, progress, questRewardBonusPercent: levels.find(l => l.levelNumber === level)?.questRewardBonusPercent ?? 0, artistName, artistPicture });
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
  const currentLevel = levels.find(l => l.levelNumber === level);
  const questRewardBonusPercent = currentLevel?.questRewardBonusPercent ?? 0;
  return { artistWallet, reputation, level, levelName, nextLevelRep, progress, questRewardBonusPercent };
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

// ─── Quest Bundle Operationen ─────────────────────────────────────────────────

/**
 * Bundle erstellen: Sperrt Gesamtbudget + legt quest_bundles + einzelne quests an.
 * Gibt die neue Bundle-ID zurück.
 */
export async function createQuestBundle(
  params: {
    creatorWallet: string;
    platform: Platform;
    videoId: string;
    videoTitle: string;
    videoThumbnail: string;
    videoUrl: string;
    description: string;
    rewardPoolPerFan: number;
    bundleCompletionBonus: number;
    maxParticipants: number;
    expiresAt: string | null;
    reputationReward?: number;
  },
  itemTypes: Array<{ questType: QuestType; reachWeight: number }>,
): Promise<string> {
  const sql = getDb();
  const bundleId = crypto.randomUUID();
  const now = new Date().toISOString();
  const wallet = params.creatorWallet.toLowerCase();

  const totalWeight = itemTypes.reduce((s, i) => s + i.reachWeight, 0);
  const bonusBudgetTotal = Math.round(params.bundleCompletionBonus * params.maxParticipants * 100) / 100;

  // Bundle-Datensatz anlegen
  await sql`
    INSERT INTO quest_bundles (
      id, creator_wallet, platform, video_id, video_title, video_thumbnail,
      video_url, description, reward_pool_per_fan, bundle_completion_bonus,
      bonus_budget_remaining, max_participants, is_active, expires_at, created_at, updated_at
    ) VALUES (
      ${bundleId}, ${wallet}, ${params.platform}, ${params.videoId},
      ${params.videoTitle}, ${params.videoThumbnail}, ${params.videoUrl},
      ${params.description}, ${params.rewardPoolPerFan}, ${params.bundleCompletionBonus},
      ${bonusBudgetTotal}, ${params.maxParticipants}, true,
      ${params.expiresAt ?? null}, ${now}, ${now}
    )
  `;

  // Einzelne Quest-Datensätze für jeden Typ anlegen
  for (const item of itemTypes) {
    const questId = crypto.randomUUID();
    const rewardAmount = totalWeight > 0
      ? Math.round((item.reachWeight / totalWeight) * params.rewardPoolPerFan * 100) / 100
      : 0;
    const creditsLocked = Math.round(rewardAmount * params.maxParticipants * 100) / 100;
    const reputationReward = params.reputationReward ?? Math.round(item.reachWeight * 20);

    await sql`
      INSERT INTO quests (
        id, platform, quest_type, creator_wallet,
        video_id, video_title, video_thumbnail, video_url,
        description, reward_amount, reputation_reward, max_completions,
        completions, is_active, expires_at, credits_locked, credits_refunded,
        bonus_budget, bundle_id, reach_weight, created_at, updated_at
      ) VALUES (
        ${questId}, ${params.platform}, ${item.questType}, ${wallet},
        ${params.videoId}, ${params.videoTitle}, ${params.videoThumbnail}, ${params.videoUrl},
        ${params.description}, ${rewardAmount}, ${reputationReward}, ${params.maxParticipants},
        0, true, ${params.expiresAt ?? null}, ${creditsLocked}, false,
        0, ${bundleId}, ${item.reachWeight}, ${now}, ${now}
      )
    `;
  }

  return bundleId;
}

function rowToBundle(row: any): QuestBundle {
  return {
    id: row.id,
    creatorWallet: row.creator_wallet,
    platform: row.platform as Platform,
    videoId: row.video_id,
    videoTitle: row.video_title,
    videoThumbnail: row.video_thumbnail,
    videoUrl: row.video_url,
    description: row.description,
    rewardPoolPerFan: Number(row.reward_pool_per_fan),
    bundleCompletionBonus: Number(row.bundle_completion_bonus),
    bonusBudgetRemaining: Number(row.bonus_budget_remaining),
    maxParticipants: Number(row.max_participants),
    isActive: row.is_active,
    expiresAt: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/** Aktive Bundles mit Fan-Fortschritt laden */
export async function getBundlesWithProgressForFan(
  fanWallet: string,
  filterCreator?: string,
): Promise<QuestBundleWithItems[]> {
  const sql = getDb();
  const normalized = fanWallet.toLowerCase();

  const bundleRows = filterCreator
    ? await sql`
        SELECT * FROM quest_bundles
        WHERE is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
          AND creator_wallet = ${filterCreator.toLowerCase()}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT * FROM quest_bundles
        WHERE is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
      `;

  if (bundleRows.length === 0) return [];

  const bundleIds: string[] = bundleRows.map((r: any) => r.id as string);

  const [questRows, completionRows, bonusRows] = await Promise.all([
    sql`
      SELECT id, bundle_id, quest_type, reach_weight, reward_amount,
             completions, max_completions, is_active
      FROM quests
      WHERE bundle_id = ANY(${bundleIds}::uuid[])
      ORDER BY reach_weight DESC
    `,
    sql`
      SELECT quest_id FROM quest_completions
      WHERE wallet_address = ${normalized}
        AND quest_id = ANY(
          SELECT id FROM quests WHERE bundle_id = ANY(${bundleIds}::uuid[])
        )
    `,
    sql`
      SELECT bundle_id FROM quest_bundle_completions
      WHERE fan_wallet = ${normalized}
        AND bundle_id = ANY(${bundleIds}::uuid[])
    `,
  ]);

  const completedQuestIds = new Set<string>((completionRows as any[]).map((r) => r.quest_id as string));
  const claimedBundleIds  = new Set<string>((bonusRows as any[]).map((r) => r.bundle_id as string));

  return bundleRows.map((bRow: any) => {
    const items: QuestBundleItem[] = (questRows as any[])
      .filter((q) => q.bundle_id === bRow.id)
      .map((q) => ({
        questId:        q.id,
        questType:      q.quest_type as QuestType,
        reachWeight:    Number(q.reach_weight),
        rewardAmount:   Number(q.reward_amount),
        completions:    Number(q.completions),
        maxCompletions: Number(q.max_completions),
        isActive:       q.is_active,
      }));

    const fanCompletedTypes = items
      .filter((item) => completedQuestIds.has(item.questId))
      .map((item) => item.questType);

    const fanAllCompleted = items.length > 0 && items.every((item) => completedQuestIds.has(item.questId));
    const fanBonusClaimed = claimedBundleIds.has(bRow.id);

    return {
      ...rowToBundle(bRow),
      items,
      fanCompletedTypes,
      fanAllCompleted,
      fanBonusClaimed,
    };
  });
}

/** Bundles eines Creators laden (inkl. Item-Infos) */
export async function getBundlesForCreator(
  creatorWallet: string,
): Promise<QuestBundleWithItems[]> {
  const sql = getDb();
  const wallet = creatorWallet.toLowerCase();

  const bundleRows = await sql`
    SELECT * FROM quest_bundles WHERE creator_wallet = ${wallet}
    ORDER BY created_at DESC
  `;
  if (bundleRows.length === 0) return [];

  const bundleIds: string[] = bundleRows.map((r: any) => r.id as string);
  const questRows = await sql`
    SELECT id, bundle_id, quest_type, reach_weight, reward_amount,
           completions, max_completions, is_active
    FROM quests
    WHERE bundle_id = ANY(${bundleIds}::uuid[])
    ORDER BY reach_weight DESC
  `;

  return bundleRows.map((bRow: any) => {
    const items: QuestBundleItem[] = (questRows as any[])
      .filter((q) => q.bundle_id === bRow.id)
      .map((q) => ({
        questId:        q.id,
        questType:      q.quest_type as QuestType,
        reachWeight:    Number(q.reach_weight),
        rewardAmount:   Number(q.reward_amount),
        completions:    Number(q.completions),
        maxCompletions: Number(q.max_completions),
        isActive:       q.is_active,
      }));
    return { ...rowToBundle(bRow), items };
  });
}

/**
 * Bundle-Abschluss-Bonus einlösen.
 * Gibt { success, bonusAmount, error? } zurück.
 */
export async function claimBundleCompletionBonus(
  bundleId: string,
  fanWallet: string,
): Promise<{ success: boolean; bonusAmount: number; error?: string }> {
  const sql = getDb();
  const normalized = fanWallet.toLowerCase();

  // Bereits eingelöst?
  const existing = await sql`
    SELECT bonus_paid FROM quest_bundle_completions
    WHERE bundle_id = ${bundleId} AND fan_wallet = ${normalized}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return { success: false, bonusAmount: 0, error: 'Bundle-Bonus bereits eingelöst' };
  }

  // Bundle laden
  const bundleRows = await sql`
    SELECT * FROM quest_bundles WHERE id = ${bundleId} AND is_active = true LIMIT 1
  `;
  if (bundleRows.length === 0) return { success: false, bonusAmount: 0, error: 'Bundle nicht gefunden' };
  const bundle = bundleRows[0];

  // Alle Quest-IDs im Bundle laden
  const questRows = await sql`
    SELECT id FROM quests WHERE bundle_id = ${bundleId} AND is_active = true
  `;
  if (questRows.length === 0) return { success: false, bonusAmount: 0, error: 'Keine aktiven Quests im Bundle' };

  const questIds: string[] = questRows.map((r: any) => r.id as string);

  // Prüfen ob Fan alle Quests abgeschlossen hat
  const completedRows = await sql`
    SELECT quest_id FROM quest_completions
    WHERE wallet_address = ${normalized}
      AND quest_id = ANY(${questIds}::uuid[])
  `;
  if (completedRows.length < questIds.length) {
    return { success: false, bonusAmount: 0, error: 'Noch nicht alle Bundle-Quests abgeschlossen' };
  }

  const bonusAmount = Number(bundle.bundle_completion_bonus);

  if (bonusAmount > 0) {
    // Bonus-Budget atomar abziehen
    const deducted = await sql`
      UPDATE quest_bundles
      SET bonus_budget_remaining = bonus_budget_remaining - ${bonusAmount},
          updated_at = NOW()
      WHERE id = ${bundleId} AND bonus_budget_remaining >= ${bonusAmount}
      RETURNING bonus_budget_remaining
    `;
    if (deducted.length === 0) {
      return { success: false, bonusAmount: 0, error: 'Bonus-Budget erschöpft' };
    }
    await addDfaithCredits(normalized, bonusAmount);
  }

  // Completion-Record anlegen
  await sql`
    INSERT INTO quest_bundle_completions (bundle_id, fan_wallet, bonus_paid, completed_at)
    VALUES (${bundleId}, ${normalized}, ${bonusAmount}, NOW())
    ON CONFLICT DO NOTHING
  `;

  return { success: true, bonusAmount };
}

/**
 * Bundle stornieren (Creator): Alle Quests deaktivieren + Budget zurückgeben.
 * Gibt erstatteten Betrag zurück, -1 wenn nicht gefunden/berechtigt.
 */
export async function cancelQuestBundle(
  bundleId: string,
  creatorWallet: string,
): Promise<number> {
  const sql = getDb();
  const wallet = creatorWallet.toLowerCase();

  const bundleRows = await sql`
    SELECT * FROM quest_bundles WHERE id = ${bundleId} AND creator_wallet = ${wallet} LIMIT 1
  `;
  if (bundleRows.length === 0) return -1;
  const bundle = bundleRows[0];
  if (!bundle.is_active) return 0;

  // Alle aktiven Quests des Bundles stornieren
  const questRows = await sql`
    SELECT id FROM quests WHERE bundle_id = ${bundleId}
  `;
  let totalRefund = 0;
  for (const q of questRows as any[]) {
    const refund = await cancelQuest(q.id, wallet);
    if (refund > 0) totalRefund += refund;
  }

  // Verbleibendes Bonus-Budget zurückerstatten
  const bonusRemaining = Number(bundle.bonus_budget_remaining);
  if (bonusRemaining > 0) {
    await addDfaithCredits(wallet, bonusRemaining);
    totalRefund += bonusRemaining;
  }

  // Bundle deaktivieren
  await sql`
    UPDATE quest_bundles
    SET is_active = false, bonus_budget_remaining = 0, updated_at = NOW()
    WHERE id = ${bundleId}
  `;

  return totalRefund;
}
