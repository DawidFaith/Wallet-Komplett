/**
 * POST /api/tiktok-quests/complete
 *
 * Verifiziert ob ein User einen Kommentar unter dem Quest-Video hinterlassen hat.
 * Sucht via RapidAPI (tiktok-api23) nach dem uniqueId des verifizierten TikTok-Accounts.
 *
 * Body: { walletAddress, questId }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserProfile,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  loadQuestDetail,
  saveCompletion,
  savePendingReward,
  addDfaithCredits,
  addUserXp,
  addUserReputation,
  payLevelBonus,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

async function rapidGet(path: string): Promise<unknown> {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  console.log('[tiktok-complete] rapidGet:', url);
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY!,
    },
    cache: 'no-store',
  });
  console.log('[tiktok-complete] HTTP status:', res.status);
  if (!res.ok) throw new Error(`RapidAPI HTTP ${res.status}`);
  return res.json();
}

// Extrahiert die numerische Video-ID aus einer TikTok-URL oder gibt den Wert direkt zurück
function extractVideoId(videoIdOrUrl: string): string {
  // Matches z.B. https://www.tiktok.com/@user/video/7576704350974643478
  const match = videoIdOrUrl.match(/\/video\/(\d+)/);
  if (match) return match[1];
  // Nur Ziffern: bereits eine reine ID
  if (/^\d+$/.test(videoIdOrUrl)) return videoIdOrUrl;
  return videoIdOrUrl;
}

// Kommentare paginiert durchsuchen (max. 5 Seiten = 500 Kommentare)
async function findCommentByUser(
  videoId: string,
  uniqueId: string
): Promise<{ text: string } | null> {
  let cursor = 0;
  for (let page = 0; page < 5; page++) {
    const data = await rapidGet(
      `/api/post/comments?videoId=${encodeURIComponent(videoId)}&count=100&cursor=${cursor}`
    ) as { status_code?: number; comments?: { text?: string; user?: { unique_id?: string } }[]; has_more?: number | boolean; cursor?: number };

    console.log(`[tiktok-complete] page=${page} status_code=${data.status_code} comments=${data.comments?.length ?? 0} has_more=${data.has_more}`);
    if (data.status_code !== 0) break;
    const comments = data.comments ?? [];
    if (comments.length === 0) break;

    console.log(`[tiktok-complete] Suche @${uniqueId} in ${comments.length} Kommentaren:`, comments.map(c => c.user?.unique_id));
    for (const c of comments) {
      const authorId = c.user?.unique_id ?? '';
      if (authorId.toLowerCase() === uniqueId.toLowerCase()) {
        return { text: c.text ?? '' };
      }
    }

    if (!data.has_more) break;
    cursor = data.cursor ?? cursor + 100;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY nicht konfiguriert' }, { status: 500 });
  }

  let body: { walletAddress?: string; questId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 }); }

  const { walletAddress, questId } = body;
  if (!walletAddress || !questId) {
    return NextResponse.json({ error: 'walletAddress und questId sind erforderlich' }, { status: 400 });
  }

  const normalized = walletAddress.toLowerCase();

  // 1. TikTok-Account prüfen
  const profile = await getUserProfile(normalized);
  if (!profile.tiktokHandle || !profile.tiktokVerified) {
    return NextResponse.json(
      { error: 'Kein verifizierter TikTok-Account verknüpft. Verifiziere zuerst deinen Account in den Sozialen Profilen.' },
      { status: 400 }
    );
  }

  // 2. Quest laden
  const quest = await loadQuestDetail(questId);
  if (!quest) return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  if (!quest.isActive) return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
  }
  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json({ error: 'Alle Plätze für diesen Quest sind vergeben' }, { status: 400 });
  }
  if (quest.platform !== 'tiktok') {
    return NextResponse.json({ error: 'Falscher Quest-Typ' }, { status: 400 });
  }

  // 3. Doppelabschluss prüfen (Wallet-Ebene)
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json({ error: 'Du hast diesen Quest bereits abgeschlossen' }, { status: 409 });
  }

  // 3b. Handle-Schutz: gleicher TikTok-Account darf Quest nicht für eine andere Wallet nochmal abschließen
  const handleDone = await hasChannelCompletedQuest(profile.tiktokHandle, questId);
  if (handleDone) {
    return NextResponse.json({ error: 'Dieser TikTok-Account hat diesen Quest bereits abgeschlossen' }, { status: 409 });
  }

  // 4. Kommentar via RapidAPI suchen
  let foundComment: { text: string } | null = null;
  const resolvedVideoId = extractVideoId(quest.videoId);
  console.log(`[tiktok-complete] Suche Kommentar: videoId="${resolvedVideoId}" (raw="${quest.videoId}") tiktokHandle="${profile.tiktokHandle}" questId="${questId}"`);
  try {
    foundComment = await findCommentByUser(resolvedVideoId, profile.tiktokHandle);
  } catch (e) {
    console.error('[tiktok-complete] API-Fehler:', e);
    return NextResponse.json({ error: 'TikTok API nicht erreichbar. Bitte später erneut versuchen.' }, { status: 502 });
  }
  console.log('[tiktok-complete] foundComment:', foundComment);

  if (!foundComment) {
    return NextResponse.json({
      success: false,
      message: `Kein Kommentar von @${profile.tiktokHandle} unter diesem Video gefunden. Kommentiere das Video und versuche es erneut.`,
    });
  }

  // 5. Abschluss speichern
  const now = new Date().toISOString();
  const completion: QuestCompletion = {
    questId,
    walletAddress: normalized,
    channelId: profile.tiktokHandle,
    channelName: profile.tiktokHandle,
    platform: 'tiktok',
    commentId: `tiktok-comment-${normalized}-${questId}`,
    commentText: foundComment.text,
    completedAt: now,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
  };

  await saveCompletion(completion);
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `TikTok Quest abgeschlossen: ${quest.videoTitle}`,
    questId: questId,
    createdAt: new Date().toISOString(),
  });
  await addDfaithCredits(normalized, quest.rewardAmount);
  const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
  await addUserXp(normalized, 10);
  await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);

  return NextResponse.json({
    success: true,
    message: `Quest abgeschlossen! Du erhältst ${quest.rewardAmount + levelBonus} DFAITH.`,
    comment: foundComment.text,
    rewardAmount: quest.rewardAmount + levelBonus,
    levelBonus: levelBonus > 0 ? levelBonus : undefined,
  });
}
