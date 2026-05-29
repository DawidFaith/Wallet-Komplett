import { NextRequest, NextResponse } from 'next/server';

/** Debug-Endpoint: zeigt rohe TikTok-Kommentar-API-Antwort */
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId');
  const key = process.env.RAPIDAPI_KEY;
  const host = 'tiktok-api23.p.rapidapi.com';

  if (!key) return NextResponse.json({ error: 'RAPIDAPI_KEY fehlt' }, { status: 500 });
  if (!videoId) return NextResponse.json({ error: 'videoId query param fehlt' }, { status: 400 });

  try {
    const res = await fetch(
      `https://${host}/api/post/comments?videoId=${encodeURIComponent(videoId)}&count=20&cursor=0`,
      {
        headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': key },
        cache: 'no-store',
      }
    );
    const raw = await res.json();

    // Zeige die Top-Level-Keys und die ersten 5 Kommentare mit user-Feldern
    const comments = (raw.comments ?? raw.data?.comments ?? []).slice(0, 5).map((c: Record<string, unknown>) => ({
      text: c.text,
      user: c.user,
      unique_id: (c.user as Record<string, unknown>)?.unique_id,
      nickname: (c.user as Record<string, unknown>)?.nickname,
    }));

    return NextResponse.json({
      topLevelKeys: Object.keys(raw),
      statusCode: raw.statusCode,
      status_code: raw.status_code,
      hasMore: raw.hasMore,
      cursor: raw.cursor,
      commentCount: (raw.comments ?? raw.data?.comments ?? []).length,
      sampleComments: comments,
      rawTopLevel: Object.fromEntries(
        Object.entries(raw).filter(([k]) => k !== 'comments')
      ),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
