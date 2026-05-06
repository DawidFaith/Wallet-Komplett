import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '../../../lib/questDb';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';

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

type TikTokMediaItem = {
  video_id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  created_at: string | null;
};

function extractScriptJson(html: string, scriptId: string): unknown | null {
  const regex = new RegExp(`<script[^>]*id=["']${scriptId}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
  const match = html.match(regex);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function mapObjectRecordToMedia(record: Record<string, unknown>, fallbackHandle: string): TikTokMediaItem[] {
  const posts = Object.values(record).filter((item): item is TikTokPost => Boolean(item && typeof item === 'object'));
  return mapPostsToMedia(posts, fallbackHandle);
}

function parseBrightJsonToMedia(payload: unknown, fallbackHandle: string): TikTokMediaItem[] {
  if (!payload || typeof payload !== 'object') return [];

  const candidateObjects: unknown[] = [payload];
  const root = payload as Record<string, unknown>;

  if (root.data) candidateObjects.push(root.data);
  if (root.result) candidateObjects.push(root.result);
  if (root.response) candidateObjects.push(root.response);
  if (root.body) candidateObjects.push(root.body);

  for (const candidate of candidateObjects) {
    if (!candidate || typeof candidate !== 'object') continue;
    const objectCandidate = candidate as Record<string, unknown>;

    const itemModule = objectCandidate.ItemModule;
    if (itemModule && typeof itemModule === 'object') {
      const media = mapObjectRecordToMedia(itemModule as Record<string, unknown>, fallbackHandle);
      if (media.length > 0) return media;
    }

    const itemList = objectCandidate.itemList ?? objectCandidate.item_list ?? objectCandidate.aweme_list ?? objectCandidate.items;
    if (Array.isArray(itemList)) {
      const posts = itemList
        .map((item) => {
          if (typeof item === 'string' && itemModule && typeof itemModule === 'object') {
            return (itemModule as Record<string, unknown>)[item] as TikTokPost | undefined;
          }
          return item as TikTokPost;
        })
        .filter((item): item is TikTokPost => Boolean(item && typeof item === 'object'));
      const media = mapPostsToMedia(posts, fallbackHandle);
      if (media.length > 0) return media;
    }
  }

  return [];
}

function parseBrightHtmlToMedia(html: string, fallbackHandle: string): TikTokMediaItem[] {
  const sigiState = extractScriptJson(html, 'SIGI_STATE') as { ItemModule?: Record<string, TikTokPost> } | null;
  const sigiPosts = sigiState?.ItemModule ? Object.values(sigiState.ItemModule) : [];
  const sigiMedia = mapPostsToMedia(sigiPosts, fallbackHandle);
  if (sigiMedia.length > 0) return sigiMedia;

  const universalData = extractScriptJson(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__') as {
    __DEFAULT_SCOPE__?: {
      ['webapp.user-detail']?: {
        itemList?: Array<string | TikTokPost>;
        ItemModule?: Record<string, TikTokPost>;
      };
    };
    ItemModule?: Record<string, TikTokPost>;
  } | null;

  const userDetail = universalData?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
  const universalItemModule = userDetail?.ItemModule ?? universalData?.ItemModule ?? {};
  const universalPosts = (userDetail?.itemList ?? [])
    .map((item) => typeof item === 'string' ? universalItemModule[item] : item)
    .filter((item): item is TikTokPost => Boolean(item));

  const universalMedia = mapPostsToMedia(universalPosts, fallbackHandle);
  if (universalMedia.length > 0) return universalMedia;

  const fallbackIds = Array.from(new Set(Array.from(html.matchAll(/"id":"(\d{10,})"/g)).map((match) => match[1])));
  return fallbackIds.map((videoId) => ({
    video_id: videoId,
    title: `TikTok Video ${videoId.slice(0, 8)}`,
    thumbnail_url: '',
    video_url: `https://www.tiktok.com/@${fallbackHandle}/video/${videoId}`,
    created_at: null,
  }));
}

function parseBrightPayloadToMedia(rawPayload: string, fallbackHandle: string): TikTokMediaItem[] {
  const trimmed = rawPayload.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;

      const nestedStringCandidates = [parsed.html, parsed.body, parsed.content, parsed.response, parsed.data]
        .filter((value): value is string => typeof value === 'string');

      for (const nested of nestedStringCandidates) {
        const mediaFromNested = nested.includes('<html') || nested.includes('<script')
          ? parseBrightHtmlToMedia(nested, fallbackHandle)
          : parseBrightJsonToMedia(JSON.parse(nested), fallbackHandle);
        if (mediaFromNested.length > 0) return mediaFromNested;
      }

      const mediaFromJson = parseBrightJsonToMedia(parsed, fallbackHandle);
      if (mediaFromJson.length > 0) return mediaFromJson;
    } catch {
      // Falls JSON-Parsing fehlschlägt, als HTML weiterprobieren.
    }
  }

  return parseBrightHtmlToMedia(trimmed, fallbackHandle);
}

async function fetchTikTokMediaBrightData(handle: string) {
  if (!BRIGHTDATA_API_KEY) return [];

  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const res = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      zone: BRIGHTDATA_ZONE,
      url: `https://www.tiktok.com/@${encodeURIComponent(cleanHandle)}`,
      format: 'raw',
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) return [];
  const payload = await res.text();
  return parseBrightPayloadToMedia(payload, cleanHandle);
}

function mapPostsToMedia(posts: TikTokPost[], fallbackHandle: string): TikTokMediaItem[] {
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
  if (!RAPIDAPI_KEY && !BRIGHTDATA_API_KEY) {
    return NextResponse.json({ error: 'Weder RAPIDAPI_KEY noch BRIGHTDATA_API_KEY sind konfiguriert' }, { status: 500 });
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

    let media: TikTokMediaItem[] = [];
    let source: 'bright' | 'rapid' | 'none' = 'none';

    media = await fetchTikTokMediaBrightData(profile.tiktokHandle);
    if (media.length > 0) source = 'bright';

    if (media.length === 0 && RAPIDAPI_KEY) {
      const candidates = [
        `/api/user/posts?uniqueId=${encodeURIComponent(profile.tiktokHandle)}&count=20&cursor=0`,
        `/api/user/posts?secUid=&uniqueId=${encodeURIComponent(profile.tiktokHandle)}&count=20&cursor=0`,
        `/api/user/posts?unique_id=${encodeURIComponent(profile.tiktokHandle)}&count=20&cursor=0`,
      ];

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
          if (media.length > 0) {
            source = 'rapid';
            break;
          }
        } catch {
          // Nächsten Fallback-Endpunkt probieren
        }
      }
    }

    return NextResponse.json({ media, handle: profile.tiktokHandle, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
