import { getDb } from '../db';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

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

