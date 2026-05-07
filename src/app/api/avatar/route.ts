/**
 * GET /api/avatar?platform=tiktok&handle=dawidfaith
 *
 * Proxy-Endpunkt für Profilbilder. Holt das Bild live von der Quelle
 * und leitet es weiter – so laufen keine gecachten CDN-URLs ab.
 *
 * Unterstützte Plattformen: tiktok, instagram, facebook, youtube
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube'] as const;
type Platform = typeof PLATFORMS[number];

async function getTikTokAvatarUrl(handle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(handle)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const url = data?.data?.avatar_larger ?? data?.data?.avatar_medium ?? data?.data?.avatar_thumb;
    return url || null;
  } catch {
    return null;
  }
}

async function getInstagramAvatarUrl(handle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'x-ig-app-id': '936619743392459' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.user?.profile_pic_url_hd ?? data?.data?.user?.profile_pic_url ?? null;
  } catch {
    return null;
  }
}

async function getFacebookAvatarUrlBrightData(handle: string): Promise<string | null> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone,
        url: `https://www.facebook.com/${encodeURIComponent(handle)}`,
        format: 'raw',
      }),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
    return ogImage?.[1]?.replace(/&amp;/g, '&') ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') as Platform | null;
  const handle = searchParams.get('handle')?.replace(/^@/, '').trim();
  const directUrl = searchParams.get('url'); // direkte Bild-URL (z.B. von Apify)

  // Direkte URL proxyen (z.B. Facebook CDN, Apify-Profilbild)
  if (directUrl) {
    const isFbCdn = directUrl.includes('fbcdn.net') || directUrl.includes('facebook.com');

    // Erstversuch: direkt
    try {
      const imgRes = await fetch(directUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          ...(isFbCdn ? { 'Referer': 'https://www.facebook.com/' } : {}),
        },
      });
      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
        });
      }
    } catch { /* Fallback below */ }

    // Fallback für Facebook CDN: über Bright Data Web Unlocker
    if (isFbCdn) {
      const apiKey = process.env.BRIGHTDATA_API_KEY;
      const zone = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';
      if (apiKey) {
        try {
          const bdRes = await fetch('https://api.brightdata.com/request', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ zone, url: directUrl, format: 'raw' }),
          });
          if (bdRes.ok) {
            const contentType = bdRes.headers.get('content-type') ?? 'image/jpeg';
            const buffer = await bdRes.arrayBuffer();
            return new NextResponse(buffer, {
              status: 200,
              headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
            });
          }
        } catch { /* ignore */ }
      }
    }

    if (platform && handle) {
      return NextResponse.redirect(`https://unavatar.io/${platform}/${handle}`, 302);
    }
    return new NextResponse('Not Found', { status: 404 });
  }

  if (!platform || !PLATFORMS.includes(platform) || !handle) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  let avatarUrl: string | null = null;

  if (platform === 'tiktok') {
    avatarUrl = await getTikTokAvatarUrl(handle);
  } else if (platform === 'instagram') {
    avatarUrl = await getInstagramAvatarUrl(handle);
  } else if (platform === 'facebook') {
    avatarUrl = await getFacebookAvatarUrlBrightData(handle);
  }
  // youtube: kein zuverlässiger öffentlicher Endpoint → Fallback

  if (!avatarUrl) {
    // Fallback: redirect zu unavatar.io (funktioniert für instagram/facebook/youtube)
    return NextResponse.redirect(`https://unavatar.io/${platform}/${handle}`, 302);
  }

  // Bild proxyen
  try {
    const isFbCdn = avatarUrl.includes('fbcdn.net') || avatarUrl.includes('facebook.com');
    let imgRes = await fetch(avatarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...(isFbCdn ? { 'Referer': 'https://www.facebook.com/' } : {}),
      },
    });

    // Facebook CDN-Fallback via Bright Data falls direkt blockiert
    if (!imgRes.ok && isFbCdn) {
      const apiKey = process.env.BRIGHTDATA_API_KEY;
      const zone = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';
      if (apiKey) {
        const bdRes = await fetch('https://api.brightdata.com/request', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ zone, url: avatarUrl, format: 'raw' }),
        });
        if (bdRes.ok) imgRes = bdRes;
      }
    }

    if (!imgRes.ok) {
      return NextResponse.redirect(`https://unavatar.io/${platform}/${handle}`, 302);
    }
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch {
    return NextResponse.redirect(`https://unavatar.io/${platform}/${handle}`, 302);
  }
}
