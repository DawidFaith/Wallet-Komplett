/**
 * GET  /api/facebook-quests/quests  → Aktive Facebook-Quests laden
 * POST /api/facebook-quests/quests  → Neuen Facebook Comment-Quest erstellen
 *
 * Body (POST):
 *   { creatorWallet, postUrl, postId, videoTitle, thumbnailUrl, description,
 *     rewardAmount, maxCompletions, durationHours }
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
import { extractFacebookPostId } from '../../../lib/metaApi';
import { randomUUID } from 'crypto';

// GET: Aktive Facebook-Quests
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');
  try {
    const [index, walletCompletions] = await Promise.all([
      loadQuestIndex(),
      walletAddress ? loadCompletionsByWallet(walletAddress) : Promise.resolve([]),
    ]);
    const activeQuests = index.filter((q) => q.isActive && q.platform === 'facebook');
    const completedIds = walletCompletions.map((c) => c.questId);
    return NextResponse.json({ quests: activeQuests, completedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Datenbankfehler: ${message}` }, { status: 500 });
  }
}

// POST: Neuen Facebook Quest erstellen
export async function POST(req: NextRequest) {
  let body: {
    creatorWallet?: string;
    postUrl?: string;
    postId?: string;
    videoTitle?: string;
    thumbnailUrl?: string;
    description?: string;
    rewardAmount?: number;
    reputationReward?: number;
    maxCompletions?: number;
    durationHours?: number;
    questType?: 'comment' | 'like' | 'secret';
    secretCode?: string;
    bonusBudget?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { creatorWallet, postUrl, postId, videoTitle, thumbnailUrl, description, rewardAmount, reputationReward, maxCompletions, durationHours, questType, secretCode, bonusBudget } = body;

  if (!creatorWallet || !postUrl || !postId) {
    return NextResponse.json(
      { error: 'creatorWallet, postUrl und postId sind erforderlich.' },
      { status: 400 }
    );
  }

  // Facebook Post-ID extrahieren/validieren
  const normalizedPostId = extractFacebookPostId(postId) || extractFacebookPostId(postUrl);
  if (!normalizedPostId) {
    return NextResponse.json(
      { error: 'Ungültige Facebook URL oder Post-ID. Format sollte sein: https://www.facebook.com/{pageId}/posts/{postId} oder pageId_postId' },
      { status: 400 }
    );
  }

  const type: 'comment' | 'like' | 'secret' = questType === 'like' || questType === 'secret' ? questType : 'comment';

  if (type === 'secret' && !secretCode?.trim()) {
    return NextResponse.json(
      { error: 'Bei Secret-Quests muss ein Code angegeben werden.' },
      { status: 400 }
    );
  }

  const reward = Math.round((Number(rewardAmount) || 100) * 100) / 100;
  const max = Math.max(1, Math.min(1000, Number(maxCompletions) || 10));
  const baseBudget = reward * max;
  const bonusBudgetNum = Math.max(0, Math.round((Number(bonusBudget) || 0) * 100) / 100);
  const totalBudget = baseBudget + bonusBudgetNum;

  const balance = await getDfaithCredits(creatorWallet.toLowerCase());
  if (balance < totalBudget) {
    return NextResponse.json(
      { error: `Nicht genug DFAITH Credits. Benötigt: ${totalBudget}, Verfügbar: ${balance}` },
      { status: 402 }
    );
  }

  let expiresAt: string | null = null;
  if (durationHours && durationHours > 0) {
    expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
  }

  const now = new Date().toISOString();
  const questId = randomUUID();

  const defaultDescription = type === 'like'
    ? '👍 Like diesen Facebook Post!'
    : type === 'secret'
    ? '🔑 Finde den geheimen Code im Post / Video und gib ihn ein!'
    : '💬 Kommentiere diesen Facebook Post!';

  const quest: QuestDetail = {
    id: questId,
    platform: 'facebook',
    type,
    creatorWallet: creatorWallet.toLowerCase(),
    videoId: normalizedPostId,  // Normalisierte Facebook Post-ID (pageId_postId)
    videoTitle: videoTitle ?? 'Facebook Post',
    videoThumbnail: thumbnailUrl ?? '',
    videoUrl: postUrl,
    description: description ?? defaultDescription,
    rewardAmount: reward,
    maxCompletions: max,
    completions: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    creditsLocked: baseBudget,
    creditsRefunded: false,
    secretCode: type === 'secret' ? secretCode!.trim() : null,
    reputationReward: Math.max(0, Math.round(Number(reputationReward) || 50)),
    bonusBudget: bonusBudgetNum,
  };

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
    message: `Facebook Comment Quest erstellt. Budget: ${totalBudget} DFAITH gesperrt.`,
  });
}
