import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestIndex,
  saveQuestDetail,
  loadCompletionsByWallet,
  extractShortsVideoId,
  buildShortsUrl,
  QuestDetail,
} from '../../../lib/questDb';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

// GET: Aktive Quests  +  optional abgeschlossene IDs für eine Wallet
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');

  const [index, walletCompletions] = await Promise.all([
    loadQuestIndex(),
    walletAddress ? loadCompletionsByWallet(walletAddress) : Promise.resolve([]),
  ]);

  const activeQuests = index.filter((q) => q.isActive);
  const completedIds = walletCompletions.map((c) => c.questId);

  return NextResponse.json({ quests: activeQuests, completedIds });
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
    maxCompletions?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { creatorWallet, videoUrl, description, rewardAmount, maxCompletions } = body;

  if (!creatorWallet || !videoUrl) {
    return NextResponse.json(
      { error: 'creatorWallet und videoUrl sind erforderlich' },
      { status: 400 }
    );
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

  // Video-Info via YouTube API holen
  const ytRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`
  );
  const ytData = await ytRes.json();

  if (!ytData.items || ytData.items.length === 0) {
    return NextResponse.json({ error: 'YouTube-Video nicht gefunden' }, { status: 404 });
  }

  const video = ytData.items[0];
  const videoTitle: string = video.snippet.title;
  const videoThumbnail: string =
    video.snippet.thumbnails?.medium?.url ??
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const videoShortsUrl = buildShortsUrl(videoId);

  const questId = crypto.randomUUID();
  const now = new Date().toISOString();

  const questDetail: QuestDetail = {
    id: questId,
    platform: 'youtube',
    type: 'comment',
    creatorWallet: creatorWallet.toLowerCase(),
    videoId,
    videoTitle,
    videoThumbnail,
    videoUrl: videoShortsUrl,
    description: description?.trim() ?? '',
    rewardAmount: Number(rewardAmount) || 100,
    maxCompletions: Number(maxCompletions) || 10,
    completions: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Quest in Postgres speichern (saveQuestDetail macht den INSERT)
  await saveQuestDetail(questDetail);

  return NextResponse.json({ success: true, quest: questDetail });
}
