import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '../../../lib/questDb';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

async function rapidGet(path: string): Promise<unknown> {
  const res = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY!,
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RapidAPI HTTP ${res.status}`);
  return res.json();
}

type TikTokPost = {
  id?: string;
  desc?: string;
  createTime?: number;
  create_time?: number;
  video?: { cover?: string; originCover?: string; dynamicCover?: string };
  author?: { uniqueId?: string };
};

function mapPostsToMedia(posts: TikTokPost[], fallbackHandle: string) {
  return posts
    .map((post) => {
      const videoId = post.id;
      if (!videoId) return null;

      const title = (post.desc ?? '').trim() || `TikTok Video ${videoId.slice(0, 8)}`;
      const thumbnail = post.video?.cover ?? post.video?.originCover ?? post.video?.dynamicCover ?? '';
      const authorHandle = post.author?.uniqueId || fallbackHandle;
      const timestamp = post.createTime ?? post.create_time;

      return {
        video_id: videoId,
        title,
        thumbnail_url: thumbnail,
        video_url: `https://www.tiktok.com/@${authorHandle}/video/${videoId}`,
        created_at: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function GET(req: NextRequest) {
  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY nicht konfiguriert' }, { status: 500 });
  }

  const wallet = new URL(req.url).searchParams.get('wallet')?.toLowerCase();
  if (!wallet) {
    return NextResponse.json({ error: 'wallet Parameter fehlt' }, { status: 400 });
  }

  try {
    const profile = await getUserProfile(wallet);
    if (!profile.tiktokHandle || !profile.tiktokVerified) {
      return NextResponse.json(
        { error: 'Kein verifizierter TikTok-Account gefunden.' },
        { status: 403 }
      );
    }

    // Einige RapidAPI-Endpunkte liefern unterschiedliche Strukturen – daher mehrere Fallbacks.
    const candidates = [
      `/api/user/posts?uniqueId=${encodeURIComponent(profile.tiktokHandle)}&count=20&cursor=0`,
      `/api/user/posts?secUid=&uniqueId=${encodeURIComponent(profile.tiktokHandle)}&count=20&cursor=0`,
      `/api/user/posts?unique_id=${encodeURIComponent(profile.tiktokHandle)}&count=20&cursor=0`,
    ];

    let media: Array<{
      video_id: string;
      title: string;
      thumbnail_url: string;
      video_url: string;
      created_at: string | null;
    }> = [];

    for (const path of candidates) {
      try {
        const data = await rapidGet(path) as {
          itemList?: TikTokPost[];
          item_list?: TikTokPost[];
          items?: TikTokPost[];
          aweme_list?: TikTokPost[];
        };

        const posts =
          data.itemList ??
          data.item_list ??
          data.items ??
          data.aweme_list ??
          [];

        media = mapPostsToMedia(posts, profile.tiktokHandle);
        if (media.length > 0) break;
      } catch {
        // Nächsten Fallback-Endpunkt probieren
      }
    }

    return NextResponse.json({ media, handle: profile.tiktokHandle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
