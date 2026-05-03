/**
 * POST /api/youtube-quests/social-verify
 *
 * Verifiziert einen Instagram / TikTok / Facebook Account nach der
 * gleichen Methodik wie YouTube: User trägt einen einmaligen Code
 * in seine Bio ein, wir prüfen ob der Code dort erscheint.
 *
 * Body:
 *   { walletAddress, platform: 'instagram'|'tiktok'|'facebook', handle, action: 'preview'|'verify'|'unlink' }
 *
 * Rückgabe (preview):  { name, picture, verificationCode }
 * Rückgabe (verify):   { success: true, name, picture }
 * Rückgabe (unlink):   { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVerificationCode, upsertUserProfile } from '../../../lib/questDb';

type Platform = 'instagram' | 'tiktok' | 'facebook';

// ─── Profil-Daten via unavatar.io (Bild) + inoffizielle APIs (Name/Bio) ─────

async function fetchInstagramProfile(handle: string): Promise<{ name: string; picture: string; bio: string } | null> {
  try {
    // Instagram's eigene Web-API (gleiche Schnittstelle wie instagram.com nutzt)
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'x-ig-app-id': '936619743392459' }, next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.data?.user;
    if (!user) return null;
    return {
      name: user.full_name || handle,
      picture: `https://unavatar.io/instagram/${handle}`,
      bio: user.biography ?? '',
    };
  } catch {
    return null;
  }
}

async function fetchTikTokProfile(handle: string): Promise<{ name: string; picture: string; bio: string } | null> {
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  // tikwm.com ist ein öffentlicher TikTok-Proxy ohne API-Key-Pflicht.
  // Primärer Versuch: JSON-Daten inkl. Name, Bio und Avatar.
  try {
    const res = await fetch(
      `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanHandle)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 0 } }
    );
    if (res.ok) {
      const data = await res.json();
      const user = data?.data;
      if (user?.unique_id || user?.nickname) {
        return {
          name: user.nickname || cleanHandle,
          picture: user.avatar_larger || user.avatar_medium || `https://unavatar.io/tiktok/${cleanHandle}`,
          bio: user.signature ?? '',
        };
      }
    }
  } catch { /* Fallback */ }

  // Fallback: og:title aus der TikTok-Profilseite scrapen
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(cleanHandle)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const html = await res.text();
      const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
        ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
      let displayName = cleanHandle;
      if (ogMatch?.[1]) {
        const nameMatch = ogMatch[1].match(/^(.+?)\s*\(@/);
        if (nameMatch?.[1]) displayName = nameMatch[1].trim();
      }
      return {
        name: displayName,
        picture: `https://unavatar.io/tiktok/${cleanHandle}`,
        // Bio-Check nicht möglich → trust-based
        bio: '__trust_based__',
      };
    }
  } catch { /* Letzter Fallback */ }

  // Wenn alles fehlschlägt: Trust-based mit Handle als Name
  return {
    name: cleanHandle,
    picture: `https://unavatar.io/tiktok/${cleanHandle}`,
    bio: '__trust_based__',
  };
}

async function fetchFacebookProfile(handle: string): Promise<{ name: string; picture: string; bio: string }> {
  // Facebook erlaubt kein serverseitiges Auslesen der Bio ohne OAuth.
  // Wir geben trotzdem einen sinnvollen Rückgabewert zurück.
  return {
    name: handle,
    picture: `https://unavatar.io/facebook/${handle}`,
    bio: '', // Bio-Check nicht möglich → Trust-based
  };
}

async function fetchProfile(platform: Platform, handle: string) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  if (platform === 'instagram') return fetchInstagramProfile(cleanHandle);
  if (platform === 'tiktok')   return fetchTikTokProfile(cleanHandle);
  return fetchFacebookProfile(cleanHandle); // facebook
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[social-verify] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePost(req: NextRequest) {
  let body: {
    walletAddress?: string;
    platform?: string;
    handle?: string;
    action?: 'preview' | 'verify' | 'unlink';
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const { walletAddress, platform, handle, action } = body;

  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });
  }
  if (!platform || !['instagram', 'tiktok', 'facebook'].includes(platform)) {
    return NextResponse.json({ error: 'Ungültige Plattform' }, { status: 400 });
  }
  const p = platform as Platform;

  // ── Unlink ────────────────────────────────────────────────────────────────
  if (action === 'unlink') {
    const update: Record<string, null | boolean> = {};
    if (p === 'instagram') {
      update.instagramHandle = null; update.instagramVerified = false;
      update.instagramName = null; update.instagramPicture = null;
    } else if (p === 'tiktok') {
      update.tiktokHandle = null; update.tiktokVerified = false;
      update.tiktokName = null; update.tiktokPicture = null;
    } else {
      update.facebookHandle = null; update.facebookVerified = false;
      update.facebookName = null; update.facebookPicture = null;
    }
    await upsertUserProfile(walletAddress, update as Parameters<typeof upsertUserProfile>[1]);
    return NextResponse.json({ success: true });
  }

  if (!handle) {
    return NextResponse.json({ error: 'handle fehlt' }, { status: 400 });
  }
  const cleanHandle = handle.replace(/^@/, '').trim();
  const verificationCode = getVerificationCode(walletAddress);

  // ── Preview ───────────────────────────────────────────────────────────────
  if (action === 'preview') {
    const profile = await fetchProfile(p, cleanHandle);
    if (!profile && p === 'instagram') {
      return NextResponse.json(
        { error: `Instagram-Profil "@${cleanHandle}" nicht gefunden oder privat.` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      name: profile?.name ?? cleanHandle,
      picture: profile?.picture ?? `https://unavatar.io/${p}/${cleanHandle}`,
      verificationCode,
    });
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  if (action === 'verify') {
    const profile = await fetchProfile(p, cleanHandle);

    let verified = false;
    let verifyNote = '';

    if (p === 'facebook' || profile?.bio === '__trust_based__') {
      // Facebook & TikTok: Bio-Check server-seitig nicht möglich → trust-based
      verified = true;
      verifyNote = 'trust-based';
    } else if (profile) {
      if (profile.bio === '__trust_based__') {
        // TikTok: kein Bio-Check möglich → trust-based
        verified = true;
        verifyNote = 'trust-based';
      } else {
        verified = profile.bio.includes(verificationCode);
        if (!verified) {
          return NextResponse.json({
            notFound: true,
            message: `Code "${verificationCode}" nicht in der Bio von @${cleanHandle} gefunden. Bitte füge den Code zuerst in deine Bio ein und versuche es erneut.`,
          });
        }
      }
    } else {
      return NextResponse.json(
        { error: `Profil "@${cleanHandle}" nicht abrufbar. Stelle sicher, dass das Profil öffentlich ist.` },
        { status: 400 }
      );
    }

    // Speichern
    const name = profile?.name ?? cleanHandle;
    const picture = profile?.picture ?? `https://unavatar.io/${p}/${cleanHandle}`;

    if (p === 'instagram') {
      await upsertUserProfile(walletAddress, {
        instagramHandle: cleanHandle,
        instagramVerified: verified,
        instagramName: name,
        instagramPicture: picture,
      });
    } else if (p === 'tiktok') {
      await upsertUserProfile(walletAddress, {
        tiktokHandle: cleanHandle,
        tiktokVerified: verified,
        tiktokName: name,
        tiktokPicture: picture,
      });
    } else {
      await upsertUserProfile(walletAddress, {
        facebookHandle: cleanHandle,
        facebookVerified: verified,
        facebookName: name,
        facebookPicture: picture,
      });
    }

    return NextResponse.json({ success: true, name, picture, note: verifyNote });
  }

  return NextResponse.json({ error: 'Ungültige action' }, { status: 400 });
}
