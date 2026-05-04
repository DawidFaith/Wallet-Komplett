/**
 * GET  /api/tiktok-quests/quests?wallet=0x...
 *   → Gibt alle aktiven TikTok-Quests + abgeschlossene IDs für die Wallet zurück
 *
 * POST /api/tiktok-quests/quests
 *   → Erstellt einen neuen TikTok-Kommentar-Quest (Creator)
 *   Body: { creatorWallet, videoUrl, description?, rewardAmount?, maxCompletions?, durationHours? }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestIndex,
  saveQuestDetail,
  lockQuestBudget,
  getDfaithCredits,
  loadCompletionsByWallet,
  getUserProfile,
  QuestDetail,
} from '../../../lib/questDb';

export const maxDuration = 30;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

// TikTok-Video-ID aus URL extrahieren
// Unterstützt: tiktok.com/@user/video/123, vm.tiktok.com/xxx (redirect)
function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

// Video-Info via RapidAPI holen
async function fetchTikTokVideoInfo(videoId: string): Promise<{
  title: string;
  thumbnail: string;
  authorUniqueId: string;
  authorSecUid: string;
} | null> {
  if (!RAPIDAPI_KEY) return null;
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/api/post/detail?videoId=${encodeURIComponent(videoId)}`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.statusCode !== 0) return null;
    const item = data?.itemInfo?.itemStruct;
    if (!item) return null;
    return {
      title: item.desc || `TikTok Video ${videoId}`,
      thumbnail: item.video?.cover ?? item.video?.originCover ?? '',
      authorUniqueId: item.author?.uniqueId ?? '',
      authorSecUid: item.author?.secUid ?? '',
    };
  } catch {
    return null;
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');

  try {
    const [index, walletCompletions] = await Promise.all([
      loadQuestIndex(),
      walletAddress ? loadCompletionsByWallet(walletAddress) : Promise.resolve([]),
    ]);

    const activeQuests = index.filter((q) => q.isActive && q.platform === 'tiktok');
    const completedIds = walletCompletions.map((c) => c.questId);

    return NextResponse.json({ quests: activeQuests, completedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Datenbankfehler: ${message}` }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!RAPIDAPI_KEY) {
    return NextResponse.json(
      { error: 'RAPIDAPI_KEY nicht konfiguriert' },
      { status: 500 }
    );
  }

  let body: {
    creatorWallet?: string;
    videoUrl?: string;
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

  const { creatorWallet, videoUrl, description, rewardAmount, maxCompletions, durationHours, questType } = body;

  if (!creatorWallet || !videoUrl) {
    return NextResponse.json(
      { error: 'creatorWallet und videoUrl sind erforderlich' },
      { status: 400 }
    );
  }

  // Video-ID aus URL extrahieren
  const videoId = extractTikTokVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: 'Ungültige TikTok-URL. Bitte eine URL im Format tiktok.com/@user/video/ID verwenden.' },
      { status: 400 }
    );
  }

  // Prüfen ob Creator TikTok verknüpft hat
  const profile = await getUserProfile(creatorWallet.toLowerCase());
  if (!profile.tiktokHandle || !profile.tiktokVerified) {
    return NextResponse.json(
      { error: 'Du musst zuerst deinen TikTok-Account verifizieren (Sozialen Profile), bevor du Quests erstellen kannst.' },
      { status: 403 }
    );
  }

  // Video-Info via RapidAPI holen
  const videoInfo = await fetchTikTokVideoInfo(videoId);
  if (!videoInfo) {
    return NextResponse.json({ error: 'TikTok-Video nicht gefunden oder API nicht erreichbar.' }, { status: 404 });
  }

  // Prüfen ob das Video zum verknüpften TikTok-Account gehört
  if (
    videoInfo.authorUniqueId &&
    videoInfo.authorUniqueId.toLowerCase() !== profile.tiktokHandle.toLowerCase()
  ) {
    return NextResponse.json(
      {
        error: `Dieses Video gehört nicht zu deinem verknüpften TikTok-Account "@${profile.tiktokHandle}". Du kannst nur eigene Videos nutzen.`,
      },
      { status: 403 }
    );
  }

  const rewardAmountNum = Number(rewardAmount) || 100;
  const maxCompletionsNum = Number(maxCompletions) || 10;
  const totalBudget = rewardAmountNum * maxCompletionsNum;

  // Creator-Guthaben prüfen
  const creatorCredits = await getDfaithCredits(creatorWallet.toLowerCase());
  if (creatorCredits < totalBudget) {
    return NextResponse.json(
      {
        error: `Nicht genug Credits. Du brauchst ${totalBudget} DFAITH (${rewardAmountNum} × ${maxCompletionsNum} Teilnehmer), hast aber nur ${creatorCredits}.`,
      },
      { status: 400 }
    );
  }

  const locked = await lockQuestBudget(creatorWallet.toLowerCase(), totalBudget);
  if (!locked) {
    return NextResponse.json(
      { error: 'Guthaben konnte nicht gesperrt werden. Bitte Seite neu laden und erneut versuchen.' },
      { status: 400 }
    );
  }

  const questId = crypto.randomUUID();
  const now = new Date().toISOString();
  const hours = Number(durationHours) || 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const finalQuestType = questType === 'engagement' ? 'engagement' : 'comment';

  const autoDescription = description?.trim() ||
    (finalQuestType === 'engagement'
      ? '👍 Like, 🔄 Teile und 🔖 Speichere dieses TikTok-Video!'
      : '💬 Schreibe einen positiven Kommentar unter dieses TikTok-Video!');

  const questDetail: QuestDetail = {
    id: questId,
    platform: 'tiktok',
    type: finalQuestType as 'comment' | 'engagement',
    creatorWallet: creatorWallet.toLowerCase(),
    videoId,
    videoTitle: videoInfo.title,
    videoThumbnail: videoInfo.thumbnail,
    videoUrl: `https://www.tiktok.com/@${videoInfo.authorUniqueId}/video/${videoId}`,
    description: autoDescription,
    rewardAmount: rewardAmountNum,
    maxCompletions: maxCompletionsNum,
    completions: 0,
    isActive: true,
    expiresAt,
    creditsLocked: totalBudget,
    creditsRefunded: false,
    secretCode: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveQuestDetail(questDetail);

  return NextResponse.json({ success: true, quest: questDetail });
}
