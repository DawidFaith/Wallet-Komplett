/**
 * GET /api/giveaways/youtube-premiere-info?videoId=...
 * Liefert den Live-Start eines YouTube-Videos (falls Premiere/Livestream), damit
 * das Premiere-Giveaway-Formular ihn automatisch vorschlagen kann.
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractYoutubeVideoId } from '@/app/lib/giveawayVerify';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

export async function GET(req: NextRequest) {
  const videoIdOrUrl = req.nextUrl.searchParams.get('videoId');
  if (!videoIdOrUrl) return NextResponse.json({ error: 'videoId erforderlich' }, { status: 400 });
  if (!YT_API_KEY) return NextResponse.json({ startsAt: null });

  try {
    const videoId = extractYoutubeVideoId(videoIdOrUrl);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'liveStreamingDetails');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', YT_API_KEY);

    const res = await fetch(url.toString());
    const data = await res.json() as {
      items?: { liveStreamingDetails?: { actualStartTime?: string; scheduledStartTime?: string } }[];
    };
    const details = data.items?.[0]?.liveStreamingDetails;
    const startsAt = details?.actualStartTime ?? details?.scheduledStartTime ?? null;
    return NextResponse.json({ startsAt });
  } catch (err) {
    console.error('[giveaways/youtube-premiere-info]', err instanceof Error ? err.message : err);
    return NextResponse.json({ startsAt: null });
  }
}
