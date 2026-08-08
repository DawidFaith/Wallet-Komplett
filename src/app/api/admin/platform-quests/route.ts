/**
 * POST /api/admin/platform-quests?account=ecosystem|polska
 *
 * Erstellt automatisch bis zu 5 Instagram-Comment-Quests aus den neuesten
 * Posts des jeweiligen Platform-Accounts (siehe lib/platformAccounts.ts).
 * Vorhandene Quests für den gleichen Post werden übersprungen (Idempotenz
 * über video_id).
 *
 * Body: { rewardAmount?: number, maxCompletions?: number }
 *
 * POST /api/admin/platform-quests/tiktok?account=polska
 *   Erstellt einen einzelnen TikTok-Quest aus einem manuell eingefügten Link
 *   (kein offizielles Auto-Fetch für TikTok-Posts verfügbar).
 *   Body: { videoUrl: string, description?: string, rewardAmount?: number, maxCompletions?: number }
 *
 * Ohne ?account= wird weiterhin 'ecosystem' angenommen (Rückwärtskompatibilität).
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveQuestDetail } from '../../../lib/questDb';
import { fetchPlatformIgMedia } from '../../../lib/metaApi';
import { getDb } from '../../../lib/db';
import { getPlatformAccount } from '../../../lib/platformAccounts';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const account = getPlatformAccount(req.nextUrl.searchParams.get('account'));

  let body: { rewardAmount?: number; maxCompletions?: number } = {};
  try { body = await req.json(); } catch { /* optionaler Body */ }

  const rewardAmount = body.rewardAmount ?? 150;
  const maxCompletions = body.maxCompletions ?? 50;

  // Neueste 5 Posts von der Instagram-Page des Accounts laden
  const media = await fetchPlatformIgMedia(5, account.facebookPageId);
  if (media.length === 0) {
    return NextResponse.json({ error: `Keine IG-Posts von ${account.handle} geladen` }, { status: 502 });
  }

  const sql = getDb();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const item of media) {
    // Prüfen ob bereits ein aktiver Quest für diesen Post existiert
    const existing = await sql`
      SELECT id FROM quests
      WHERE creator_wallet = ${account.wallet}
        AND video_id = ${item.id}
        AND is_active = TRUE
      LIMIT 1
    `;
    if (existing.length > 0) {
      skipped.push(item.id);
      continue;
    }

    const caption = item.caption
      ? item.caption.slice(0, 100) + (item.caption.length > 100 ? '…' : '')
      : 'Instagram Post';

    const now = new Date().toISOString();
    const questId = uuidv4();

    await saveQuestDetail({
      id: questId,
      platform: 'instagram',
      type: 'comment',
      creatorWallet: account.wallet,
      videoId: item.id,
      videoTitle: caption,
      videoThumbnail: item.thumbnail_url || item.media_url,
      videoUrl: item.permalink,
      description: `Kommentiere unter diesem ${account.displayName} Post und erhalte ${rewardAmount} Credits!`,
      rewardAmount,
      reputationReward: 20,
      maxCompletions,
      completions: 0,
      isActive: true,
      expiresAt: null,
      creditsLocked: rewardAmount * maxCompletions,
      creditsRefunded: false,
      bonusBudget: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Credits-Lock für Platform-Quest (kein echter Wallet-Abzug)
    await sql`
      UPDATE quests SET credits_locked = ${rewardAmount * maxCompletions} WHERE id = ${questId}
    `;

    created.push(questId);
  }

  return NextResponse.json({
    success: true,
    account: account.key,
    created: created.length,
    skipped: skipped.length,
    questIds: created,
  });
}

// GET: Vorhandene Platform-Quests auflisten
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const account = getPlatformAccount(req.nextUrl.searchParams.get('account'));

  const sql = getDb();
  const rows = await sql`
    SELECT id, platform, quest_type, video_id, video_title, video_thumbnail,
           video_url, reward_amount, max_completions, completions, is_active, created_at
    FROM quests
    WHERE creator_wallet = ${account.wallet}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({ quests: rows });
}
