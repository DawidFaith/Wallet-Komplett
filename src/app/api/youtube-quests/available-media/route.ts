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

    // channels.list → Uploads-Playlist-ID, dann playlistItems.list statt search.list:
    // search.list hat eine eigene, separat indizierte Suche mit oft stunden- bis
    // teils tageslanger Verzögerung für frisch hochgeladene Videos. Die automatische
    // "Uploads"-Playlist jedes Kanals ist dagegen sofort aktuell (kein Suchindex,
    // sondern eine direkte Liste), deshalb erscheinen neue Videos hier sofort.
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(binding.channelId)}&key=${YT_API_KEY}`,
      { cache: 'no-store' }
    );
    const channelData = await channelRes.json();
    const uploadsPlaylistId: string | undefined = channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return NextResponse.json({ error: 'Uploads-Playlist des Kanals konnte nicht ermittelt werden.' }, { status: 500 });
    }

    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=25&key=${YT_API_KEY}`,
      { cache: 'no-store' }
    );
    const playlistData = await playlistRes.json();

    const items: Array<{
      snippet?: {
        title?: string;
        publishedAt?: string;
        resourceId?: { videoId?: string };
        thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
      };
    }> = Array.isArray(playlistData?.items) ? playlistData.items : [];

    const media = items
      .map((item) => {
        const videoId = item.snippet?.resourceId?.videoId;
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
