import { NextRequest, NextResponse } from 'next/server';

/** Temporärer Debug-Endpoint – zeigt die echten authorDisplayName + channelId für ein Video */
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId') ?? '3m0z5meTJkE';
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) return NextResponse.json({ error: 'YOUTUBE_DATA_API_KEY fehlt' }, { status: 500 });

  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', videoId);
  url.searchParams.set('maxResults', '30');
  url.searchParams.set('order', 'time');
  url.searchParams.set('key', key);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error) return NextResponse.json({ error: data.error });

    const comments = (data.items ?? []).map((item: any) => {
      const s = item.snippet.topLevelComment.snippet;
      return {
        authorDisplayName: s.authorDisplayName,
        authorChannelId: s.authorChannelId?.value ?? null,
        text: s.textDisplay?.substring(0, 80),
        publishedAt: s.publishedAt,
      };
    });

    return NextResponse.json({ total: comments.length, comments });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
