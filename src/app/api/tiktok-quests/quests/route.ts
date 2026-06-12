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
  getMaxPossibleCreditBonusPct,
  loadCompletionsByWallet,
  getUserProfile,
  QuestDetail,
} from '../../../lib/questDb';

export const maxDuration = 30;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

// TikTok-Video-ID aus URL extrahieren
// Unterstützt: tiktok.com/@user/video/123 direkt, oder vm.tiktok.com/xxx (Short-Link → Redirect auflösen)
function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

function extractTikTokHandle(url: string): string | null {
  const match = url.match(/tiktok\.com\/@([^/]+)\/video\//i);
  return match?.[1] ?? null;
}

// Short-URL auflösen: vm.tiktok.com/xxx → folgt Redirects ohne Body
async function resolveShortUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.url || url;
  } catch {
    // Falls HEAD nicht klappt, GET ohne Body-Download probieren
    try {
      const res = await fetch(url, { redirect: 'follow' });
      return res.url || url;
    } catch {
      return url;
    }
  }
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
  let body: {
    creatorWallet?: string;
    videoUrl?: string;
    videoTitle?: string;
    thumbnailUrl?: string;
    description?: string;
    rewardAmount?: number;
    reputationReward?: number;
    maxCompletions?: number;
    durationHours?: number;
    questType?: string;
    secretCode?: string;
    bonusBudget?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { creatorWallet, videoUrl, videoTitle, thumbnailUrl, description, rewardAmount, reputationReward, maxCompletions, durationHours, questType, secretCode, bonusBudget } = body;

  if (!creatorWallet || !videoUrl) {
    return NextResponse.json(
      { error: 'creatorWallet und videoUrl sind erforderlich' },
      { status: 400 }
    );
  }

  // Video-ID aus URL extrahieren – ggf. Short-URL auflösen
  const isShortUrl = /vm\.tiktok\.com|vt\.tiktok\.com/.test(videoUrl);
  const resolvedUrl = isShortUrl ? await resolveShortUrl(videoUrl) : videoUrl;
  const videoId = extractTikTokVideoId(resolvedUrl);
  const videoHandle = extractTikTokHandle(resolvedUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: 'TikTok-Video-ID konnte nicht gefunden werden. Bitte direkte Video-URL oder vm.tiktok.com-Link verwenden.' },
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

  let finalVideoTitle = (videoTitle ?? '').trim();
  let finalThumbnailUrl = (thumbnailUrl ?? '').trim();
  let finalAuthorHandle = (videoHandle ?? '').trim();

  if (finalAuthorHandle && finalAuthorHandle.toLowerCase() !== profile.tiktokHandle.toLowerCase()) {
    return NextResponse.json(
      {
        error: `Dieses Video gehört nicht zu deinem verknüpften TikTok-Account "@${profile.tiktokHandle}". Du kannst nur eigene Videos nutzen.`,
      },
      { status: 403 }
    );
  }

  if (!finalVideoTitle || !finalThumbnailUrl || !finalAuthorHandle) {
    if (!RAPIDAPI_KEY) {
      return NextResponse.json(
        { error: 'TikTok-Metadaten fehlen und RAPIDAPI_KEY ist nicht konfiguriert.' },
        { status: 500 }
      );
    }

    const videoInfo = await fetchTikTokVideoInfo(videoId);
    if (!videoInfo) {
      return NextResponse.json({ error: 'TikTok-Video nicht gefunden oder API nicht erreichbar.' }, { status: 404 });
    }

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

    finalVideoTitle = videoInfo.title;
    finalThumbnailUrl = videoInfo.thumbnail;
    finalAuthorHandle = videoInfo.authorUniqueId;
  }

  const rewardAmountNum = Math.round((Number(rewardAmount) || 100) * 100) / 100;
  const maxCompletionsNum = Number(maxCompletions) || 10;
  const baseBudget = rewardAmountNum * maxCompletionsNum;
  const bonusBudgetNum = Math.max(0, Math.round((Number(bonusBudget) || 0) * 100) / 100);
  // Collectibles-Reserve: Worst-Case (alle Fans mit Mythic) vorab sperren
  const maxCollBonusPct = await getMaxPossibleCreditBonusPct(creatorWallet.toLowerCase()).catch(() => 0);
  const collectiblesReserve = Math.ceil(rewardAmountNum * maxCompletionsNum * maxCollBonusPct / 100 * 100) / 100;
  const bonusBudgetTotal = bonusBudgetNum + collectiblesReserve;
  const totalBudget = baseBudget + bonusBudgetTotal;

  // Creator-Guthaben prüfen
  const creatorCredits = await getDfaithCredits(creatorWallet.toLowerCase());
  if (creatorCredits < totalBudget) {
    return NextResponse.json(
      {
        error: `Nicht genug Credits. Du brauchst ${totalBudget} DFAITH (${rewardAmountNum} × ${maxCompletionsNum} Teilnehmer + ${bonusBudgetNum} Bonus-Budget + ${collectiblesReserve} Collectibles-Reserve), hast aber nur ${creatorCredits}.`,
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

  const finalQuestType = questType === 'engagement' ? 'engagement' : questType === 'secret' ? 'secret' : 'comment';

  if (finalQuestType === 'secret' && !secretCode?.trim()) {
    return NextResponse.json(
      { error: 'Ein geheimer Code ist für Secret-Quests erforderlich' },
      { status: 400 }
    );
  }

  const autoDescription = description?.trim() ||
    (finalQuestType === 'engagement'
      ? '👍 Like, 🔄 Teile und 🔖 Speichere dieses TikTok-Video!'
      : finalQuestType === 'secret'
      ? '🔑 Finde den geheimen Code im Video und gib ihn ein!'
      : '💬 Schreibe einen positiven Kommentar unter dieses TikTok-Video!');

  const questDetail: QuestDetail = {
    id: questId,
    platform: 'tiktok',
    type: finalQuestType as 'comment' | 'engagement' | 'secret',
    creatorWallet: creatorWallet.toLowerCase(),
    videoId,
    videoTitle: finalVideoTitle || `TikTok Video ${videoId}`,
    videoThumbnail: finalThumbnailUrl,
    videoUrl: `https://www.tiktok.com/@${finalAuthorHandle || profile.tiktokHandle}/video/${videoId}`,
    description: autoDescription,
    rewardAmount: rewardAmountNum,
    maxCompletions: maxCompletionsNum,
    completions: 0,
    isActive: true,
    expiresAt,
    creditsLocked: baseBudget,
    creditsRefunded: false,
    secretCode: finalQuestType === 'secret' ? (secretCode?.trim() ?? null) : null,
    reputationReward: Math.max(0, Math.round(Number(reputationReward) || 50)),
    bonusBudget: bonusBudgetTotal,
    createdAt: now,
    updatedAt: now,
  };

  await saveQuestDetail(questDetail);

  return NextResponse.json({ success: true, quest: questDetail });
}
