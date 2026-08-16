/**
 * TEMPORÄR — Diagnose-Route zum Testen der Premiere-Live-Chat-Verifizierung.
 * GET ?videoId=...&handle=...&code=dfaith
 * Header: x-admin-secret
 * Nach dem Test wieder entfernen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractYoutubeVideoId } from '@/app/lib/giveawayVerify';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.MIGRATION_SECRET || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const videoIdOrUrl = req.nextUrl.searchParams.get('videoId');
  const handle = req.nextUrl.searchParams.get('handle');
  const code = req.nextUrl.searchParams.get('code') ?? 'dfaith';
  if (!videoIdOrUrl || !handle) {
    return NextResponse.json({ error: 'videoId und handle erforderlich' }, { status: 400 });
  }
  if (!YT_API_KEY) return NextResponse.json({ error: 'YOUTUBE_DATA_API_KEY fehlt' }, { status: 500 });

  const videoId = extractYoutubeVideoId(videoIdOrUrl);

  // 1. liveStreamingDetails abrufen
  const videoUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videoUrl.searchParams.set('part', 'liveStreamingDetails,snippet');
  videoUrl.searchParams.set('id', videoId);
  videoUrl.searchParams.set('key', YT_API_KEY);
  const videoRes = await fetch(videoUrl.toString());
  const videoData = await videoRes.json();
  const details = videoData.items?.[0]?.liveStreamingDetails;
  const title = videoData.items?.[0]?.snippet?.title;
  const liveChatId: string | undefined = details?.activeLiveChatId;

  if (!liveChatId) {
    return NextResponse.json({
      videoId, title,
      liveStreamingDetails: details ?? null,
      liveChatId: null,
      hint: 'Keine activeLiveChatId gefunden — entweder ist der Warteraum/die Premiere noch nicht offen, oder das Video ist gar keine Premiere/kein Livestream.',
    });
  }

  // 2. Live-Chat-Nachrichten abrufen (eine Seite reicht für den Diagnose-Zweck)
  const chatUrl = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages');
  chatUrl.searchParams.set('liveChatId', liveChatId);
  chatUrl.searchParams.set('part', 'snippet,authorDetails');
  chatUrl.searchParams.set('key', YT_API_KEY);
  const chatRes = await fetch(chatUrl.toString());
  const chatData = await chatRes.json();

  const cleanHandle = handle.toLowerCase().replace(/^@/, '');
  const items = (chatData.items ?? []) as { snippet: { displayMessage?: string; publishedAt?: string }; authorDetails: { displayName?: string } }[];
  const messages = items.map(i => ({
    author: i.authorDetails.displayName,
    text: i.snippet.displayMessage,
    publishedAt: i.snippet.publishedAt,
  }));
  const match = items.find(i => {
    const author = (i.authorDetails.displayName ?? '').toLowerCase().replace(/^@/, '');
    return author === cleanHandle && (i.snippet.displayMessage ?? '').toLowerCase().includes(code.toLowerCase());
  });

  return NextResponse.json({
    videoId, title,
    liveChatId,
    messageCount: messages.length,
    messages,
    searchedFor: { handle: cleanHandle, code },
    matchFound: !!match,
    apiError: chatData.error ?? null,
  });
}
