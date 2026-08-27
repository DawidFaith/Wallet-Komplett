import { getDb } from '../db';
import { loadQuestDetail } from './quests';
import { hasWalletCompletedQuest, hasChannelCompletedQuest, saveCompletion } from './completions';
import { addDfaithCredits, savePendingReward } from './credits';
import { payLevelBonus, addUserReputationWithBonus } from './reputation';
import { payQuestCreditBonus } from './collectibles';

/**
 * UGC-Quest-Einreichungen ("erstelle einen eigenen Beitrag zum Thema des
 * Künstlers, inkl. Hashtag/Erwähnung, und reiche den Link ein").
 * Verifizierung läuft primär automatisch (oEmbed-Caption-Check, siehe
 * lib/oembed.ts + api/quests/ugc-submit/route.ts) — landet nur dann als
 * 'pending' hier, wenn der automatische Check technisch fehlschlägt
 * (Endpoint nicht erreichbar, Berechtigung fehlt etc.), damit Fans nicht
 * wegen eines technischen Problems leer ausgehen.
 */

export interface UgcSubmission {
  id: string;
  questId: string;
  walletAddress: string;
  platform: string;
  submittedUrl: string;
  detectedCaption: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

async function ensureTable(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS ugc_quest_submissions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quest_id          UUID NOT NULL,
      wallet_address    TEXT NOT NULL,
      platform          TEXT NOT NULL,
      submitted_url     TEXT NOT NULL,
      detected_caption  TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      rejection_reason  TEXT,
      submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at       TIMESTAMPTZ
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_ugc_submissions_quest_wallet ON ugc_quest_submissions(quest_id, wallet_address)`;
}

function rowToSubmission(row: any): UgcSubmission {
  return {
    id: row.id,
    questId: row.quest_id,
    walletAddress: row.wallet_address,
    platform: row.platform,
    submittedUrl: row.submitted_url,
    detectedCaption: row.detected_caption ?? null,
    status: row.status,
    rejectionReason: row.rejection_reason ?? null,
    submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
    reviewedAt: row.reviewed_at
      ? (row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : row.reviewed_at)
      : null,
  };
}

/** Bereits existierende Einreichung für (quest, wallet) laden — für Idempotenz/Anzeige. */
export async function getUgcSubmission(questId: string, walletAddress: string): Promise<UgcSubmission | null> {
  const sql = getDb();
  await ensureTable(sql);
  const rows = await sql`
    SELECT * FROM ugc_quest_submissions
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? rowToSubmission(rows[0]) : null;
}

/** Neue Einreichung anlegen (Status wird direkt mitgegeben — approved/rejected/pending). */
export async function createUgcSubmission(params: {
  questId: string;
  walletAddress: string;
  platform: string;
  submittedUrl: string;
  detectedCaption: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
}): Promise<UgcSubmission> {
  const sql = getDb();
  await ensureTable(sql);
  const wallet = params.walletAddress.toLowerCase();
  const reviewedAt = params.status === 'pending' ? null : new Date().toISOString();
  const rows = await sql`
    INSERT INTO ugc_quest_submissions (
      quest_id, wallet_address, platform, submitted_url, detected_caption,
      status, rejection_reason, reviewed_at
    ) VALUES (
      ${params.questId}, ${wallet}, ${params.platform}, ${params.submittedUrl}, ${params.detectedCaption},
      ${params.status}, ${params.rejectionReason ?? null}, ${reviewedAt}
    )
    RETURNING *
  `;
  return rowToSubmission(rows[0]);
}

/** Für den Admin: alle noch offenen (pending) Einreichungen, neueste zuerst. */
export async function listPendingUgcSubmissions(): Promise<UgcSubmission[]> {
  const sql = getDb();
  await ensureTable(sql);
  const rows = await sql`
    SELECT * FROM ugc_quest_submissions
    WHERE status = 'pending'
    ORDER BY submitted_at ASC
  `;
  return rows.map(rowToSubmission);
}

/**
 * Admin-Entscheidung zu einer pending-Einreichung. Bei Freigabe wird direkt
 * der gleiche Auszahlungspfad wie bei der automatischen Freigabe ausgelöst.
 */
export async function reviewUgcSubmission(
  id: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string,
): Promise<{ submission: UgcSubmission; rewardAmount?: number; levelBonus?: number; creditBonus?: number } | null> {
  const sql = getDb();
  await ensureTable(sql);
  const rows = await sql`
    UPDATE ugc_quest_submissions
    SET status = ${decision}, rejection_reason = ${decision === 'rejected' ? (rejectionReason ?? null) : null}, reviewed_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `;
  if (rows.length === 0) return null;
  const submission = rowToSubmission(rows[0]);
  if (decision !== 'approved') return { submission };

  const quest = await loadQuestDetail(submission.questId);
  if (!quest) return { submission };
  const alreadyDone = await hasWalletCompletedQuest(submission.walletAddress, submission.questId);
  if (alreadyDone) return { submission };
  const handleDone = await hasChannelCompletedQuest(submission.walletAddress, submission.questId);
  if (handleDone) return { submission };

  const now = new Date().toISOString();
  await saveCompletion({
    questId: submission.questId,
    walletAddress: submission.walletAddress,
    channelId: submission.walletAddress,
    channelName: submission.walletAddress,
    platform: quest.platform,
    commentId: `ugc-${submission.walletAddress}-${submission.questId}`,
    commentText: submission.submittedUrl,
    completedAt: now,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
  });
  await addDfaithCredits(submission.walletAddress, quest.rewardAmount);
  const levelBonus = await payLevelBonus(submission.walletAddress, quest.creatorWallet, quest.rewardAmount, quest.id);
  const creditBonus = await payQuestCreditBonus(submission.walletAddress, quest.creatorWallet, quest.rewardAmount, quest.id);
  await savePendingReward({
    walletAddress: submission.walletAddress,
    amount: quest.rewardAmount,
    reason: `UGC Quest abgeschlossen (manuell geprüft): ${quest.videoTitle}`,
    questId: submission.questId,
    createdAt: now,
  });
  await addUserReputationWithBonus(submission.walletAddress, quest.creatorWallet, quest.reputationReward);

  return {
    submission,
    rewardAmount: quest.rewardAmount + levelBonus + creditBonus,
    levelBonus: levelBonus > 0 ? levelBonus : undefined,
    creditBonus: creditBonus > 0 ? creditBonus : undefined,
  };
}
