import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestIndex,
  saveQuestDetail,
  lockQuestBudget,
  getDfaithCredits,
  loadCompletionsByWallet,
  loadBindingByWallet,
  extractShortsVideoId,
  buildShortsUrl,
  QuestDetail,
  getMaxPossibleCreditBonusPct,
} from '../../../lib/questDb';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

// GET: Aktive Quests  +  optional abgeschlossene IDs für eine Wallet
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');

  try {
    const [index, walletCompletions] = await Promise.all([
      loadQuestIndex(),
      walletAddress ? loadCompletionsByWallet(walletAddress) : Promise.resolve([]),
    ]);

    const activeQuests = index.filter((q) => q.isActive);
    const completedIds = walletCompletions.map((c) => c.questId);

    return NextResponse.json({ quests: activeQuests, completedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quests GET]', message);
    return NextResponse.json({ error: `Datenbankfehler: ${message}` }, { status: 500 });
  }
}

// POST: Neuen YouTube-Shorts-Quest erstellen (Creator)
export async function POST(req: NextRequest) {
  if (!YT_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API key nicht konfiguriert (YOUTUBE_DATA_API_KEY)' },
      { status: 500 }
    );
  }

  let body: {
    creatorWallet?: string;
    videoUrl?: string;
    description?: string;
    rewardAmount?: number;
    reputationReward?: number;
    maxCompletions?: number;
    questType?: string;
    durationHours?: number;
    secretCode?: string;
    bonusBudget?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { creatorWallet, videoUrl, description, rewardAmount, reputationReward, maxCompletions, questType, durationHours, secretCode, bonusBudget } = body;

  if (!creatorWallet || !videoUrl) {
    return NextResponse.json(
      { error: 'creatorWallet und videoUrl sind erforderlich' },
      { status: 400 }
    );
  }

  // Secret-Quest: Code muss angegeben werden
  if (questType === 'secret') {
    if (!secretCode || secretCode.trim().length < 2) {
      return NextResponse.json(
        { error: 'Für Secret-Quests muss ein Code mit mindestens 2 Zeichen angegeben werden.' },
        { status: 400 }
      );
    }
    if (secretCode.trim().length > 50) {
      return NextResponse.json(
        { error: 'Der Code darf maximal 50 Zeichen lang sein.' },
        { status: 400 }
      );
    }
  }

  // Nur YouTube Shorts erlaubt
  const videoId = extractShortsVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json(
      {
        error:
          'Ungültiger Link. Nur YouTube Shorts sind erlaubt, z.B. https://www.youtube.com/shorts/VIDEO_ID',
      },
      { status: 400 }
    );
  }

  // Prüfen ob Creator einen verknüpften YouTube-Kanal hat
  const binding = await loadBindingByWallet(creatorWallet.toLowerCase());
  if (!binding) {
    return NextResponse.json(
      { error: 'Du musst zuerst deinen YouTube-Kanal verknüpfen, bevor du Quests erstellen kannst.' },
      { status: 403 }
    );
  }

  // Video-Info via YouTube API holen
  const ytRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`
  );
  const ytData = await ytRes.json();

  if (!ytData.items || ytData.items.length === 0) {
    return NextResponse.json({ error: 'YouTube-Video nicht gefunden' }, { status: 404 });
  }

  const video = ytData.items[0];

  // Prüfen ob das Video zum verknüpften Kanal gehört
  const videoChannelId: string = video.snippet.channelId;
  if (videoChannelId !== binding.channelId) {
    return NextResponse.json(
      { error: `Dieses Video gehört nicht zu deinem verknüpften Kanal "${binding.channelName}". Du kannst nur eigene Videos als Quest nutzen.` },
      { status: 403 }
    );
  }

  const videoTitle: string = video.snippet.title;
  const videoThumbnail: string =
    video.snippet.thumbnails?.medium?.url ??
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const videoShortsUrl = buildShortsUrl(videoId);

  const questId = crypto.randomUUID();
  const now = new Date().toISOString();

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

  // Budget für den Quest sperren (Escrow)
  const locked = await lockQuestBudget(creatorWallet.toLowerCase(), totalBudget);
  if (!locked) {
    return NextResponse.json(
      { error: 'Guthaben konnte nicht gesperrt werden. Bitte Seite neu laden und erneut versuchen.' },
      { status: 400 }
    );
  }

  // Ablaufzeit berechnen (optional)
  let expiresAt: string | null = null;
  if (durationHours && durationHours > 0) {
    const expiry = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    expiresAt = expiry.toISOString();
  }

  const questDetail: QuestDetail = {
    id: questId,
    platform: 'youtube',
    type: (questType === 'like' ? 'like' : questType === 'secret' ? 'secret' : 'comment') as QuestDetail['type'],
    creatorWallet: creatorWallet.toLowerCase(),
    videoId,
    videoTitle,
    videoThumbnail,
    videoUrl: videoShortsUrl,
    description: description?.trim() ?? '',
    rewardAmount: rewardAmountNum,
    maxCompletions: maxCompletionsNum,
    completions: 0,
    isActive: true,
    expiresAt,
    creditsLocked: baseBudget,
    creditsRefunded: false,
    bonusBudget: bonusBudgetTotal,
    secretCode: questType === 'secret' ? (secretCode ?? null) : null,
    reputationReward: Math.max(0, Math.round(Number(reputationReward) || 50)),
    createdAt: now,
    updatedAt: now,
  };

  // Quest in Postgres speichern (saveQuestDetail macht den INSERT)
  await saveQuestDetail(questDetail);

  return NextResponse.json({ success: true, quest: questDetail });
}
