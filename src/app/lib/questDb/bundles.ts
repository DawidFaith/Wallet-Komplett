import { getDb } from '../db';
import { cancelQuest } from './quests';
import { addDfaithCredits } from './credits';
import { addUserReputation } from './reputation';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

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
    levelBonusBudget?: number;        // Gesamtes Budget für Level-Reputation-Boni (alle Quests, alle Teilnehmer)
    secretCodes?: Record<string, string>; // Map: questType → geheimer Code (nur für 'secret'-Typ)
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

    // Level-Bonus-Budget proportional verteilen
    const questLevelBonusBudget = params.levelBonusBudget && totalWeight > 0
      ? Math.round((item.reachWeight / totalWeight) * params.levelBonusBudget * 100) / 100
      : 0;

    // Secret Code (nur für 'secret'-Typ)
    const secretCode = item.questType === 'secret'
      ? ((params.secretCodes?.[item.questType] ?? '').trim().toUpperCase() || null)
      : null;

    // Story-Token (nur für 'dm_share'-Typ – für Fan-Sharing-Link)
    const storyToken = item.questType === 'dm_share' ? crypto.randomUUID() : null;

    await sql`
      INSERT INTO quests (
        id, platform, quest_type, creator_wallet,
        video_id, video_title, video_thumbnail, video_url,
        description, reward_amount, reputation_reward, max_completions,
        completions, is_active, expires_at, credits_locked, credits_refunded,
        bonus_budget, bundle_id, reach_weight, secret_code, story_token, created_at, updated_at
      ) VALUES (
        ${questId}, ${params.platform}, ${item.questType}, ${wallet},
        ${params.videoId}, ${params.videoTitle}, ${params.videoThumbnail}, ${params.videoUrl},
        ${params.description}, ${rewardAmount}, ${reputationReward}, ${params.maxParticipants},
        0, true, ${params.expiresAt ?? null}, ${creditsLocked}, false,
        ${questLevelBonusBudget}, ${bundleId}, ${item.reachWeight}, ${secretCode}, ${storyToken}, ${now}, ${now}
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

  const bundleIds: string[]      = bundleRows.map((r: any) => r.id as string);
  const creatorWallets: string[] = [...new Set(bundleRows.map((r: any) => r.creator_wallet as string))];

  const [questRows, completionRows, bonusRows, fanRepRows, levelRows] = await Promise.all([
    sql`
      SELECT id, bundle_id, quest_type, reach_weight, reward_amount,
             reputation_reward, completions, max_completions, is_active, story_token
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
    sql`
      SELECT artist_wallet, reputation FROM user_reputation
      WHERE wallet_address = ${normalized}
        AND artist_wallet = ANY(${creatorWallets}::text[])
    `,
    sql`
      SELECT artist_wallet, min_reputation, quest_reward_bonus_percent
      FROM reputation_levels
      WHERE artist_wallet = ANY(${creatorWallets}::text[])
      ORDER BY min_reputation ASC
    `,
  ]);

  // Standard-Level-Bonuswerte (Fallback wenn kein Kreator eigene Level konfiguriert hat)
  const DEFAULT_BONUS_LEVELS = [
    { min:      0, bonus:   0 }, { min:    200, bonus:   5 }, { min:    500, bonus:  10 },
    { min:  1_000, bonus:  15 }, { min:  2_000, bonus:  20 }, { min:  3_800, bonus:  25 },
    { min:  7_000, bonus:  35 }, { min: 13_000, bonus:  50 }, { min: 24_000, bonus:  75 },
    { min: 45_000, bonus: 100 },
  ];

  const fanRepByCreator = new Map<string, number>(
    (fanRepRows as any[]).map((r) => [r.artist_wallet as string, Number(r.reputation)]),
  );

  const levelsByCreator = new Map<string, { min: number; bonus: number }[]>();
  for (const r of levelRows as any[]) {
    const w = r.artist_wallet as string;
    if (!levelsByCreator.has(w)) levelsByCreator.set(w, []);
    levelsByCreator.get(w)!.push({ min: Number(r.min_reputation), bonus: Number(r.quest_reward_bonus_percent ?? 0) });
  }

  const completedQuestIds = new Set<string>((completionRows as any[]).map((r) => r.quest_id as string));
  const claimedBundleIds  = new Set<string>((bonusRows as any[]).map((r) => r.bundle_id as string));

  return bundleRows.map((bRow: any) => {
    const items: QuestBundleItem[] = (questRows as any[])
      .filter((q) => q.bundle_id === bRow.id)
      .map((q) => ({
        questId:           q.id,
        questType:         q.quest_type as QuestType,
        reachWeight:       Number(q.reach_weight),
        rewardAmount:      Number(q.reward_amount),
        reputationReward:  Number(q.reputation_reward ?? 0),
        completions:       Number(q.completions),
        maxCompletions:    Number(q.max_completions),
        isActive:          q.is_active,
        storyToken:        q.story_token ?? null,
      }));

    const fanCompletedTypes = items
      .filter((item) => completedQuestIds.has(item.questId))
      .map((item) => item.questType);

    const fanAllCompleted = items.length > 0 && items.every((item) => completedQuestIds.has(item.questId));
    const fanBonusClaimed = claimedBundleIds.has(bRow.id);

    const rep         = fanRepByCreator.get(bRow.creator_wallet as string) ?? 0;
    const levels      = levelsByCreator.get(bRow.creator_wallet as string) ?? DEFAULT_BONUS_LEVELS;
    const fanBonusPercent = [...levels].sort((a, b) => b.min - a.min).find((l) => l.min <= rep)?.bonus ?? 0;

    return {
      ...rowToBundle(bRow),
      items,
      fanCompletedTypes,
      fanAllCompleted,
      fanBonusClaimed,
      fanBonusPercent,
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
           reputation_reward, completions, max_completions, is_active, story_token
    FROM quests
    WHERE bundle_id = ANY(${bundleIds}::uuid[])
    ORDER BY reach_weight DESC
  `;

  return bundleRows.map((bRow: any) => {
    const items: QuestBundleItem[] = (questRows as any[])
      .filter((q) => q.bundle_id === bRow.id)
      .map((q) => ({
        questId:           q.id,
        questType:         q.quest_type as QuestType,
        reachWeight:       Number(q.reach_weight),
        rewardAmount:      Number(q.reward_amount),
        reputationReward:  Number(q.reputation_reward ?? 0),
        completions:       Number(q.completions),
        maxCompletions:    Number(q.max_completions),
        isActive:          q.is_active,
        storyToken:        q.story_token ?? null,
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

  // Alle Quest-IDs + Reputation-Rewards im Bundle laden
  const questRows = await sql`
    SELECT id, reputation_reward FROM quests WHERE bundle_id = ${bundleId} AND is_active = true
  `;
  if (questRows.length === 0) return { success: false, bonusAmount: 0, error: 'Keine aktiven Quests im Bundle' };

  const questIds: string[] = questRows.map((r: any) => r.id as string);
  const totalReputation = (questRows as any[]).reduce((s, r) => s + Number(r.reputation_reward ?? 0), 0);

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

  // Reputation für Bundle-Abschluss vergeben
  if (totalReputation > 0) {
    await addUserReputation(normalized, bundle.creator_wallet as string, totalReputation);
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
