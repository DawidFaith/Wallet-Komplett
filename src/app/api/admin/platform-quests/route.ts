/**
 * POST /api/admin/platform-quests
 *
 * Erstellt automatisch bis zu 5 Instagram-Comment-Quests aus den neuesten
 * dfaith_ecosystem Posts. Vorhandene Quests für den gleichen Post werden
 * übersprungen (Idempotenz über video_id).
 *
 * Body: { secret: string, rewardAmount?: number, maxCompletions?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveQuestDetail } from '../../../lib/questDb';
import { fetchPlatformIgMedia } from '../../../lib/metaApi';
import { getDb } from '../../../lib/db';

const PLATFORM_WALLET = 'platform_dfaith_ecosystem';

export async function POST(req: NextRequest) {
  let body: { secret?: string; rewardAmount?: number; maxCompletions?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  if (body.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const rewardAmount = body.rewardAmount ?? 150;
  const maxCompletions = body.maxCompletions ?? 50;

  // Neueste 5 Posts von dfaith_ecosystem IG laden
  const media = await fetchPlatformIgMedia(5);
  if (media.length === 0) {
    return NextResponse.json({ error: 'Keine IG-Posts von dfaith_ecosystem geladen' }, { status: 502 });
  }

  const sql = getDb();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const item of media) {
    // Prüfen ob bereits ein aktiver Quest für diesen Post existiert
    const existing = await sql`
      SELECT id FROM quests
      WHERE creator_wallet = ${PLATFORM_WALLET}
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
      creatorWallet: PLATFORM_WALLET,
      videoId: item.id,
      videoTitle: caption,
      videoThumbnail: item.thumbnail_url || item.media_url,
      videoUrl: item.permalink,
      description: `Kommentiere unter diesem D.Faith Ecosystem Post und erhalte ${rewardAmount} Credits!`,
      rewardAmount,
      reputationReward: 20,
      maxCompletions,
      completions: 0,
      isActive: true,
      expiresAt: null,
      creditsLocked: rewardAmount * maxCompletions,
      creditsRefunded: false,
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
    created: created.length,
    skipped: skipped.length,
    questIds: created,
  });
}

// GET: Vorhandene Platform-Quests auflisten
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  if (searchParams.get('secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT id, platform, quest_type, video_id, video_title, video_thumbnail,
           video_url, reward_amount, max_completions, completions, is_active, created_at
    FROM quests
    WHERE creator_wallet = ${PLATFORM_WALLET}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({ quests: rows });
}
