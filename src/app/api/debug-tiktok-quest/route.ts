import { NextRequest, NextResponse } from 'next/server';
import { loadQuestDetail, getUserProfile } from '../../lib/questDb';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

export async function GET(req: NextRequest) {
  const questId = req.nextUrl.searchParams.get('questId');
  const wallet  = req.nextUrl.searchParams.get('wallet');

  if (!questId || !wallet) {
    return NextResponse.json({ error: 'questId und wallet erforderlich' }, { status: 400 });
  }
  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY fehlt' }, { status: 500 });
  }

  const [quest, profile] = await Promise.all([
    loadQuestDetail(questId),
    getUserProfile(wallet.toLowerCase()),
  ]);

  if (!quest) return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });

  // Kommentare von der API holen
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/api/post/comments?videoId=${encodeURIComponent(quest.videoId)}&count=20&cursor=0`,
    { headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }, cache: 'no-store' }
  );
  const raw = await res.json() as Record<string, unknown>;

  const comments = ((raw.comments ?? []) as { text?: string; user?: { unique_id?: string } }[]).map(c => ({
    unique_id: c.user?.unique_id,
    text: (c.text ?? '').substring(0, 60),
  }));

  return NextResponse.json({
    quest: {
      id: quest.id,
      videoId: quest.videoId,
      videoUrl: quest.videoUrl,
      platform: quest.platform,
      type: quest.type,
    },
    profile: {
      tiktokHandle: profile.tiktokHandle,
      tiktokVerified: profile.tiktokVerified,
    },
    api: {
      status_code: raw.status_code,
      total: raw.total,
      has_more: raw.has_more,
      comments,
    },
    match: comments.find(c => c.unique_id?.toLowerCase() === profile.tiktokHandle?.toLowerCase()) ?? null,
  });
}
