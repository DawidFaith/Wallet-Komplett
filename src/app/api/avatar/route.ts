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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') as Platform | null;
  const handle = searchParams.get('handle')?.replace(/^@/, '').trim();
  const directUrl = searchParams.get('url'); // direkte Bild-URL (z.B. von Apify)

  // Direkte URL proxyen (z.B. Apify-Profilbild)
  if (directUrl) {
    try {
      const imgRes = await fetch(directUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
        });
      }
    } catch { /* Fallback below */ }
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
  }
  // facebook + youtube: kein zuverlässiger öffentlicher Endpoint → Fallback

  if (!avatarUrl) {
    // Fallback: redirect zu unavatar.io (funktioniert für instagram/facebook/youtube)
    return NextResponse.redirect(`https://unavatar.io/${platform}/${handle}`, 302);
  }

  // Bild proxyen
  try {
    const imgRes = await fetch(avatarUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
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
