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
import { getVerificationCode, upsertUserProfile, recordFingerprintVerification, getFingerprintWalletCount } from '../../../lib/questDb';
import { getDb } from '../../../lib/db';
import { findInstagramComment, fetchPlatformIgMedia, fetchPlatformFbPosts, findFacebookComment } from '../../../lib/metaApi';
import { uploadProfileImageToBlob, extractOriginalImageUrl, fetchAndUploadFromUnavatar } from '../../../lib/profileImageStorage';

export const maxDuration = 30; // Vercel Pro: 30s für Bright Data Web Unlocker

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
      picture: `/api/avatar?platform=instagram&handle=${encodeURIComponent(handle)}`,
      bio: user.biography ?? '',
    };
  } catch {
    return null;
  }
}

async function fetchTikTokProfile(handle: string): Promise<{ name: string; picture: string; bio: string } | null> {
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  // Hilfsfunktion: tikwm.com einmal abfragen
  const tryTikwm = async (): Promise<{ name: string; picture: string; bio: string } | null> => {
    try {
      const res = await fetch(
        `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanHandle)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.code !== 0) return null;
      const user = data?.data?.user;
      if (user?.uniqueId || user?.nickname) {
        return {
          name: user.nickname || cleanHandle,
          picture: `/api/avatar?platform=tiktok&handle=${encodeURIComponent(cleanHandle)}`,
          bio: user.signature ?? '',
        };
      }
    } catch { /* ignore */ }
    return null;
  };

  // Bis zu 5 Versuche mit kurzen Pausen (Rate-Limit umgehen, bleibt unter 30s Timeout)
  const delays = [0, 500, 1000, 2000, 3000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    const result = await tryTikwm();
    if (result) return result;
  }

  // Letzter Versuch: TikTok-Seite direkt scrapen
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(cleanHandle)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const html = await res.text();

      // Prüfen ob Profil existiert (404-Seite hat keinen og:title mit @handle)
      const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
        ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);

      // Wenn Seite keine relevanten Metadaten hat → Profil nicht gefunden
      if (!ogTitle?.[1]) return null;

      let displayName = cleanHandle;
      const nameMatch = ogTitle[1].match(/^(.+?)\s*\(@/);
      if (nameMatch?.[1]) displayName = nameMatch[1].trim();

      const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
        ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i);
      const rawDesc = ogDesc?.[1]
        ? ogDesc[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
        : '';

      // og:description bei TikTok enthält Statistiken, keine echte Bio → leer lassen
      // (Signatur kann nicht zuverlässig aus der HTML-Seite extrahiert werden)
      return {
        name: displayName,
        picture: `/api/avatar?platform=tiktok&handle=${encodeURIComponent(cleanHandle)}`,
        bio: rawDesc,
      };
    }
  } catch { /* ignore */ }

  return null;
}

async function fetchFacebookProfile(handle: string): Promise<{ name: string; picture: string; bio: string } | null> {
  const cleanHandle = handle.replace(/^@/, '').trim();
  try {
    const res = await fetch(`https://www.facebook.com/${encodeURIComponent(cleanHandle)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const html = await res.text();

      // Name aus og:title
      const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
        ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
      const name = ogTitle?.[1]
        ? ogTitle[1].replace(/\s*\|\s*Facebook.*$/i, '').trim()
        : cleanHandle;

      // Bild aus og:image
      const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
        ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
      const rawPic = ogImage?.[1]?.replace(/&amp;/g, '&') ?? null;
      const picture = rawPic
        ? `/api/avatar?url=${encodeURIComponent(rawPic)}&platform=facebook&handle=${encodeURIComponent(cleanHandle)}`
        : `/api/avatar?platform=facebook&handle=${encodeURIComponent(cleanHandle)}`;

      // Bio aus og:description
      const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
        ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i);
      const bio = ogDesc?.[1]
        ? ogDesc[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
        : '';

      return {
        name,
        picture,
        bio,
      };
    }
  } catch { /* Fallback */ }

  return null;
}

async function fetchProfile(platform: Platform, handle: string) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  if (platform === 'instagram') return fetchInstagramProfile(cleanHandle);
  if (platform === 'tiktok')   return fetchTikTokProfile(cleanHandle);
  return fetchFacebookProfile(cleanHandle); // facebook
}

// ─── Bright Data Web Unlocker – Instagram Scraper (~2–5s) ────────────────────

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_ZONE    = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';

async function fetchInstagramProfileBrightData(handle: string): Promise<{
  name: string; picture: string; bio: string;
} | null> {
  if (!BRIGHTDATA_API_KEY) return null;
  try {
    const targetUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: targetUrl,
        format: 'raw',
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { user?: {
      full_name?: string; username?: string; biography?: string; profile_pic_url?: string;
    } } };
    const user = data?.data?.user;
    if (!user) return null;
    // Bild durch eigenen Proxy leiten damit keine externen CDN-Domains geblockt werden
    const picUrl = user.profile_pic_url
      ? `/api/avatar?platform=instagram&handle=${encodeURIComponent(handle)}&url=${encodeURIComponent(user.profile_pic_url)}`
      : `/api/avatar?platform=instagram&handle=${encodeURIComponent(handle)}`;
    return {
      name: user.full_name || user.username || handle,
      picture: picUrl,
      bio: user.biography ?? '',
    };
  } catch {
    return null;
  }
}

// ─── Bright Data Web Unlocker – Facebook Scraper ────────────────────────────

async function fetchFacebookProfileBrightData(handle: string): Promise<{
  name: string; picture: string;
} | null> {
  if (!BRIGHTDATA_API_KEY) return null;
  try {
    const targetUrl = `https://www.facebook.com/${encodeURIComponent(handle)}`;
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: targetUrl,
        format: 'raw',
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
      ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
    const name = ogTitle?.[1]
      ? ogTitle[1].replace(/\s*\|\s*Facebook.*$/i, '').trim()
      : handle;

    if (!name || name.toLowerCase() === handle.toLowerCase()) return null;

    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
    const rawPic = ogImage?.[1]?.replace(/&amp;/g, '&') ?? null;
    const picture = rawPic
      ? `/api/avatar?url=${encodeURIComponent(rawPic)}&platform=facebook&handle=${encodeURIComponent(handle)}`
      : `/api/avatar?platform=facebook&handle=${encodeURIComponent(handle)}`;

    return {
      name,
      picture,
    };
  } catch {
    return null;
  }
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
    fingerprint?: string;
    postId?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const { walletAddress, platform, handle, action, fingerprint, postId } = body;

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

  // ── Fingerprint-Schutz: TEMPORÄR DEAKTIVIERT FÜR TESTS ─────────────
  // TODO: Wieder aktivieren nach Tests!
  /*
  if (action === 'verify' && fingerprint) {
    const count = await getFingerprintWalletCount(fingerprint);
    const normalizedWallet = walletAddress.toLowerCase();
    // Prüfen ob diese Wallet+Fingerprint bereits bekannt ist (dann kein neuer Slot nötig)
    const { getDb } = await import('../../../lib/db');
    const sql = getDb();
    const existing = await sql`
      SELECT 1 FROM device_fingerprints
      WHERE fingerprint = ${fingerprint} AND wallet_address = ${normalizedWallet}
      LIMIT 1
    `;
    const isNewCombination = existing.length === 0;
    if (isNewCombination && count >= 2) {
      return NextResponse.json(
        { error: 'Dieses Gerät wurde bereits für 2 Wallets verwendet. Aus Sicherheitsgründen ist keine weitere Verknüpfung möglich.' },
        { status: 403 }
      );
    }
  }
  */

  // ── Preview ───────────────────────────────────────────────────────────────
  if (action === 'preview') {
    // Instagram: Profilvorschau – versuche inoffizielle API, BrightData optional
    if (p === 'instagram') {
      let profileName = cleanHandle;
      let profilePicture = `/api/avatar?platform=instagram&handle=${encodeURIComponent(cleanHandle)}`;
      const quickProfile = await fetchInstagramProfile(cleanHandle);
      if (quickProfile) {
        profileName = quickProfile.name;
        profilePicture = quickProfile.picture;
      } else if (BRIGHTDATA_API_KEY) {
        const bdProfile = await fetchInstagramProfileBrightData(cleanHandle);
        if (bdProfile) { profileName = bdProfile.name; profilePicture = bdProfile.picture; }
      }
      
      // Versuche Bild dauerhaft zu speichern
      const blobUrl = await fetchAndUploadFromUnavatar('instagram', cleanHandle);
      if (blobUrl) profilePicture = blobUrl;
      
      return NextResponse.json({ name: profileName, picture: profilePicture, verificationCode });
    }

    const profile = await fetchProfile(p, cleanHandle);
    return NextResponse.json({
      name: profile?.name ?? cleanHandle,
      picture: profile?.picture ?? `https://unavatar.io/${p}/${cleanHandle}`,
      verificationCode,
    });
  }

  // ── Verify ──────────────────────────────────────────────────────────────
  if (action === 'verify') {
    // Instagram: Schritt 2 – prüft Kommentar auf dfaith_ecosystem-Posts via Meta API
    if (p === 'instagram') {
      const igMedia = await fetchPlatformIgMedia(5);
      let mentionFound = false;
      for (const item of igMedia) {
        if (await findInstagramComment(item.id, cleanHandle, verificationCode)) {
          mentionFound = true;
          break;
        }
      }

      if (!mentionFound) {
        return NextResponse.json({
          notFound: true,
          message: `Code "${verificationCode}" nicht in einem Kommentar von @${cleanHandle} auf @dfaith_ecosystem gefunden. Kommentiere den Code auf einem Post von @dfaith_ecosystem und versuche es erneut.`,
        });
      }

      // Duplikat-Check: selber Handle bereits einer anderen Wallet zugeordnet?
      const igNormalized = walletAddress.toLowerCase();
      const sql = getDb();
      const existingIg = await sql`
        SELECT wallet_address FROM user_profiles
        WHERE LOWER(instagram_handle) = ${cleanHandle.toLowerCase()}
          AND wallet_address != ${igNormalized}
        LIMIT 1
      `;
      if (existingIg.length > 0) {
        return NextResponse.json(
          { error: 'Dieser Instagram-Account ist bereits mit einer anderen Wallet verknüpft.' },
          { status: 409 }
        );
      }

      // Profil-Daten für DB holen (optional, Fallback zu Handle)
      let profileName = cleanHandle;
      let profilePicture = `/api/avatar?platform=instagram&handle=${encodeURIComponent(cleanHandle)}`;
      const quickProfile = await fetchInstagramProfile(cleanHandle);
      if (quickProfile) { profileName = quickProfile.name; profilePicture = quickProfile.picture; }
      else if (BRIGHTDATA_API_KEY) {
        const bdProfile = await fetchInstagramProfileBrightData(cleanHandle);
        if (bdProfile) { profileName = bdProfile.name; profilePicture = bdProfile.picture; }
      }

      // Bild dauerhaft auf Blob speichern
      const blobUrl = await fetchAndUploadFromUnavatar('instagram', cleanHandle);
      if (blobUrl) profilePicture = blobUrl;

      await upsertUserProfile(walletAddress, {
        instagramHandle: cleanHandle,
        instagramVerified: true,
        instagramName: profileName,
        instagramPicture: profilePicture,
      });
      if (fingerprint) await recordFingerprintVerification(fingerprint, walletAddress);
      return NextResponse.json({ success: true, name: profileName, picture: profilePicture });
    }

    // Facebook: Schritt 2 – prüft Kommentar auf dfaith_ecosystem-Seite via Meta API
    if (p === 'facebook') {
      const sql = getDb();
      const normalized = walletAddress.toLowerCase();

      // Duplikat-Check: selber Handle bereits einer anderen Wallet zugeordnet?
      const existing = await sql`
        SELECT wallet_address FROM user_profiles
        WHERE facebook_handle = ${cleanHandle.toLowerCase()}
          AND wallet_address != ${normalized}
        LIMIT 1
      `;
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Dieser Facebook-Account ist bereits mit einer anderen Wallet verknüpft.' },
          { status: 409 }
        );
      }

      if (!process.env.META_SYSTEM_USER_TOKEN) {
        return NextResponse.json({ error: 'Facebook-Verifikation nicht konfiguriert.' }, { status: 500 });
      }

      // Neueste Facebook-Posts der dfaith_ecosystem-Seite prüfen
      const postIds = await fetchPlatformFbPosts(5);
      let fbResult: { found: boolean; fromName?: string } = { found: false };
      for (const pid of postIds) {
        const r = await findFacebookComment(pid, verificationCode);
        if (r.found) { fbResult = r; break; }
      }

      if (!fbResult.found) {
        return NextResponse.json({
          notFound: true,
          message: `Code "${verificationCode}" nicht in einem Kommentar auf der D.Faith Ecosystem Facebook-Seite gefunden. Kommentiere den Code unter einem Post und versuche es erneut.`,
        });
      }

      const fbDisplayName = fbResult.fromName ?? cleanHandle;
      
      // Facebook-Profilbild dauerhaft speichern
      let fbPicture: string | null = null;
      const fbProfile = await fetchFacebookProfile(cleanHandle);
      if (fbProfile?.picture) {
        const originalUrl = extractOriginalImageUrl(fbProfile.picture);
        if (originalUrl) {
          fbPicture = await uploadProfileImageToBlob(originalUrl, 'facebook', cleanHandle);
        }
        if (!fbPicture) {
          fbPicture = await fetchAndUploadFromUnavatar('facebook', cleanHandle);
        }
      }
      
      await upsertUserProfile(walletAddress, {
        facebookHandle: fbDisplayName,
        facebookVerified: true,
        facebookName: fbDisplayName,
        facebookPicture: fbPicture,
      });
      if (fingerprint) await recordFingerprintVerification(fingerprint, walletAddress);
      return NextResponse.json({ success: true, name: fbDisplayName, picture: null });
    }

    // TikTok: synchron
    const freshProfile = await fetchProfile(p, cleanHandle);

    if (!freshProfile) {
      return NextResponse.json(
        { error: `Profil von @${cleanHandle} konnte nicht abgerufen werden. TikTok blockiert gerade den Zugriff – bitte versuche es in 1–2 Minuten erneut.` },
        { status: 400 }
      );
    }

    const bio = freshProfile.bio ?? '';
    const profileName = freshProfile.name ?? cleanHandle;
    const profilePicture = freshProfile.picture ?? `https://unavatar.io/${p}/${cleanHandle}`;

    if (!bio) {
      return NextResponse.json(
        { error: `Deine TikTok-Bio von @${cleanHandle} ist leer. Bitte füge den Verifizierungscode in deine Bio ein und versuche es erneut.` },
        { status: 400 }
      );
    }

    const verified = bio.includes(verificationCode);
    if (!verified) {
      return NextResponse.json({
        notFound: true,
        message: `Code "${verificationCode}" nicht in der Bio von @${cleanHandle} gefunden. Bitte füge den Code zuerst in deine Bio ein und versuche es erneut.`,
      });
    }

    const name = profileName;
    const picture = profilePicture;

    // Duplikat-Check: selber TikTok-Handle bereits einer anderen Wallet zugeordnet?
    const ttNormalized = walletAddress.toLowerCase();
    const { getDb: getTtDb } = await import('../../../lib/db');
    const ttSql = getTtDb();
    const existingTt = await ttSql`
      SELECT wallet_address FROM user_profiles
      WHERE LOWER(tiktok_handle) = ${cleanHandle.toLowerCase()}
        AND wallet_address != ${ttNormalized}
      LIMIT 1
    `;
    if (existingTt.length > 0) {
      return NextResponse.json(
        { error: 'Dieser TikTok-Account ist bereits mit einer anderen Wallet verknüpft.' },
        { status: 409 }
      );
    }

    // Bild dauerhaft auf Blob speichern
    let finalPicture = picture;
    const tiktokBlobUrl = await fetchAndUploadFromUnavatar('tiktok', cleanHandle);
    if (tiktokBlobUrl) finalPicture = tiktokBlobUrl;
    
    // Nur noch TikTok in diesem Branch (Facebook hat eigenen Mention-Flow oben)
    await upsertUserProfile(walletAddress, {
      tiktokHandle: cleanHandle,
      tiktokVerified: verified,
      tiktokName: name,
      tiktokPicture: finalPicture,
    });
    if (fingerprint) await recordFingerprintVerification(fingerprint, walletAddress);
    return NextResponse.json({ success: true, name, picture });
  }

  return NextResponse.json({ error: 'Ungültige action' }, { status: 400 });
}
