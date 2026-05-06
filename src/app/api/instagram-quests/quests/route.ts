/**
 * POST /api/instagram-quests/quests
 *
 * Erstellt einen Instagram Quest (comment | like | save).
 * Erwartet die Daten die vom resolve-reel Endpoint kommen:
 *   { creatorWallet, reelUrl, mediaId, videoTitle, thumbnailUrl, description, rewardAmount, maxCompletions, durationHours, questType }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  saveQuestDetail,
  lockQuestBudget,
  getDfaithCredits,
  loadCompletionsByWallet,
  loadQuestIndex,
  QuestDetail,
} from '../../../lib/questDb';
import { randomUUID } from 'crypto';

// GET: Aktive Instagram-Quests
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');
  try {
    const [index, walletCompletions] = await Promise.all([
      loadQuestIndex(),
      walletAddress ? loadCompletionsByWallet(walletAddress) : Promise.resolve([]),
    ]);
    const activeQuests = index.filter((q) => q.isActive && q.platform === 'instagram');
    const completedIds = walletCompletions.map((c) => c.questId);
    return NextResponse.json({ quests: activeQuests, completedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Datenbankfehler: ${message}` }, { status: 500 });
  }
}

// POST: Neuen Instagram Quest erstellen (comment | like | save)
export async function POST(req: NextRequest) {
  let body: {
    creatorWallet?: string;
    reelUrl?: string;
    mediaId?: string;
    videoTitle?: string;
    thumbnailUrl?: string;
    description?: string;
    rewardAmount?: number;
    maxCompletions?: number;
    durationHours?: number;
    questType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { creatorWallet, reelUrl, mediaId, videoTitle, thumbnailUrl, description, rewardAmount, maxCompletions, durationHours, questType } = body;

  if (!creatorWallet || !reelUrl || !mediaId) {
    return NextResponse.json(
      { error: 'creatorWallet, reelUrl und mediaId sind erforderlich. Bitte erst das Reel auflösen.' },
      { status: 400 }
    );
  }

  const type = (questType === 'like' || questType === 'save' || questType === 'engagement' || questType === 'repost') ? questType : 'comment';

  const reward = Number(rewardAmount) || 100;
  const max = Math.max(1, Math.min(1000, Number(maxCompletions) || 10));
  const totalBudget = reward * max;

  // Budget prüfen
  const balance = await getDfaithCredits(creatorWallet.toLowerCase());
  if (balance < totalBudget) {
    return NextResponse.json(
      { error: `Nicht genug DFAITH Credits. Benötigt: ${totalBudget}, Verfügbar: ${balance}` },
      { status: 402 }
    );
  }

  // Ablaufzeit
  let expiresAt: string | null = null;
  if (durationHours && durationHours > 0) {
    const expiry = new Date(Date.now() + durationHours * 3600 * 1000);
    expiresAt = expiry.toISOString();
  }

  const now = new Date().toISOString();
  const questId = randomUUID();

  const quest: QuestDetail = {
    id: questId,
    platform: 'instagram',
    type,
    creatorWallet: creatorWallet.toLowerCase(),
    videoId: mediaId,           // Instagram Media ID (pk) → wird an Make.com weitergegeben
    videoTitle: videoTitle ?? 'Instagram Reel',
    videoThumbnail: thumbnailUrl ?? '',
    videoUrl: reelUrl,
    description: description ?? (
      type === 'like'       ? '❤️ Like dieses Instagram Reel!' :
      type === 'save'       ? '🔖 Speichere dieses Instagram Reel!' :
      type === 'engagement' ? '❤️🔖 Like und speichere dieses Instagram Reel!' :
      type === 'repost'     ? '🔁 Reposte dieses Instagram Reel auf deinen Kanal!' :
                              '💬 Kommentiere dieses Instagram Reel!'
    ),
    rewardAmount: reward,
    maxCompletions: max,
    completions: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    creditsLocked: totalBudget,
    creditsRefunded: false,
  };

  // Budget sperren (atomisch)
  const locked = await lockQuestBudget(creatorWallet.toLowerCase(), totalBudget);
  if (!locked) {
    return NextResponse.json(
      { error: 'Budget konnte nicht gesperrt werden. Bitte lade zuerst DFAITH Credits auf.' },
      { status: 402 }
    );
  }

  await saveQuestDetail(quest);

  return NextResponse.json({
    success: true,
    questId,
    questType: type,
    message: `Instagram ${type === 'like' ? 'Like' : type === 'save' ? 'Save' : 'Comment'} Quest erstellt. Budget: ${totalBudget} DFAITH gesperrt.`,
  });
}
