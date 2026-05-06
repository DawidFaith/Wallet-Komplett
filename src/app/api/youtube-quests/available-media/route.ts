import { NextRequest, NextResponse } from 'next/server';
import { loadBindingByWallet, buildShortsUrl } from '../../../lib/questDb';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

export async function GET(req: NextRequest) {
  if (!YT_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API key nicht konfiguriert (YOUTUBE_DATA_API_KEY)' },
      { status: 500 }
    );
  }

  const wallet = new URL(req.url).searchParams.get('wallet')?.toLowerCase();
  if (!wallet) {
    return NextResponse.json({ error: 'wallet Parameter fehlt' }, { status: 400 });
  }

  try {
    const binding = await loadBindingByWallet(wallet);
    if (!binding) {
      return NextResponse.json(
        { error: 'Kein verknüpfter YouTube-Kanal gefunden.' },
        { status: 403 }
      );
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(binding.channelId)}&maxResults=25&order=date&type=video&key=${YT_API_KEY}`,
      { cache: 'no-store' }
    );
    const searchData = await searchRes.json();

    const items: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
      };
    }> = Array.isArray(searchData?.items) ? searchData.items : [];

    const media = items
      .map((item) => {
        const videoId = item.id?.videoId;
        if (!videoId) return null;
        const title = item.snippet?.title ?? '';
        const thumbnail =
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        return {
          video_id: videoId,
          title,
          thumbnail_url: thumbnail,
          video_url: buildShortsUrl(videoId),
          created_at: item.snippet?.publishedAt ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json({ media, channelName: binding.channelName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
