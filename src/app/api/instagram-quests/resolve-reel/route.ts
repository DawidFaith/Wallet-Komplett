/**
 * GET /api/instagram-quests/resolve-reel?url=https://www.instagram.com/reel/DRXhfTpjFm6/
 *
 * Löst eine Instagram Reel-URL auf:
 * - Shortcode extrahieren
 * - Zuerst in DB-Cache prüfen (instagram_reel_cache) → kein Bright Data Aufruf nötig
 * - Falls nicht im Cache: Bright Data Web Unlocker → xdt_api Block → pk (Media ID) + Details
 * - Ergebnis in Cache speichern
 *
 * Bright Data wird so pro Video nur EINMAL aufgerufen, egal wie viele Quests damit erstellt werden.
 *
 * Rückgabe: { mediaId, shortcode, title, thumbnailUrl, ownerUsername, reelUrl, fromCache }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const maxDuration = 30;

function extractShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]{10,12})/);
  return m ? m[1] : null;
}

async function getCachedReel(shortcode: string) {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT media_id, title, thumbnail_url, owner_username
      FROM instagram_reel_cache
      WHERE shortcode = ${shortcode}
      LIMIT 1
    `;
    if (rows.length > 0) {
      return {
        mediaId: rows[0].media_id as string,
        title: rows[0].title as string,
        thumbnailUrl: rows[0].thumbnail_url as string,
        ownerUsername: rows[0].owner_username as string,
      };
    }
  } catch {
    // Tabelle existiert noch nicht → ignorieren, Bright Data aufrufen
  }
  return null;
}

async function saveCachedReel(shortcode: string, mediaId: string, title: string, thumbnailUrl: string, ownerUsername: string) {
  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS instagram_reel_cache (
        shortcode       TEXT        PRIMARY KEY,
        media_id        TEXT        NOT NULL,
        title           TEXT        NOT NULL DEFAULT '',
        thumbnail_url   TEXT        NOT NULL DEFAULT '',
        owner_username  TEXT        NOT NULL DEFAULT '',
        cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO instagram_reel_cache (shortcode, media_id, title, thumbnail_url, owner_username)
      VALUES (${shortcode}, ${mediaId}, ${title}, ${thumbnailUrl}, ${ownerUsername})
      ON CONFLICT (shortcode) DO UPDATE SET
        media_id       = EXCLUDED.media_id,
        title          = EXCLUDED.title,
        thumbnail_url  = EXCLUDED.thumbnail_url,
        owner_username = EXCLUDED.owner_username,
        cached_at      = NOW()
    `;
  } catch {
    // Cache-Fehler sind nicht kritisch
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';

  if (!apiKey) {
    return NextResponse.json({ error: 'BRIGHTDATA_API_KEY nicht konfiguriert' }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url Parameter fehlt' }, { status: 400 });
  }

  const shortcode = extractShortcode(url);
  if (!shortcode) {
    return NextResponse.json(
      { error: 'Ungültige Instagram Reel URL. Erwartet: https://www.instagram.com/reel/SHORTCODE/' },
      { status: 400 }
    );
  }

  const reelUrl = `https://www.instagram.com/reel/${shortcode}/`;

  // ── Cache prüfen: DB-Lookup vor Bright Data ───────────────────────────────
  const cached = await getCachedReel(shortcode);
  if (cached) {
    return NextResponse.json({
      ...cached,
      shortcode,
      reelUrl,
      fromCache: true,
    });
  }

  // ── Cache miss: Bright Data Web Unlocker aufrufen ─────────────────────────
  let html: string;
  try {
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ zone, url: reelUrl, format: 'raw' }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Bright Data Fehler: ${res.status}` }, { status: 502 });
    }
    html = await res.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Bright Data nicht erreichbar: ${msg}` }, { status: 502 });
  }

  // xdt_api__v1__media__shortcode__web_info Block parsen
  const blockIdx = html.indexOf('xdt_api__v1__media__shortcode__web_info');
  if (blockIdx < 0) {
    return NextResponse.json(
      { error: 'Reel nicht gefunden oder privater Account. Stelle sicher dass das Reel öffentlich ist.' },
      { status: 404 }
    );
  }

  const chunk = html.slice(blockIdx, blockIdx + 8000);

  // pk (Media ID) extrahieren
  const pkMatch = chunk.match(/"pk":"(\d+)"/);
  const mediaId = pkMatch?.[1] ?? null;

  // Owner-Username
  const ownerMatch = chunk.match(/"ig_artist":\{"username":"([^"]+)"/);
  const ownerUsername = ownerMatch?.[1] ?? shortcode;

  // Thumbnail: erstes image_versions2 src
  const imgMatch = html.match(/image_versions2[^}]{0,500}"url":"(https:\/\/[^"]+)"/);
  const thumbnailUrl = imgMatch?.[1]?.replace(/\\u0025/g, '%').replace(/\\\//g, '/') ?? '';

  // Fallback: og:image aus HTML
  const ogImgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  const thumbnail = thumbnailUrl || ogImgMatch?.[1] ?? '';

  // Titel aus og:title oder "Original audio by @owner"
  const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  const title = ogTitleMatch?.[1]
    ? ogTitleMatch[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
    : `Instagram Reel – @${ownerUsername}`;

  if (!mediaId) {
    return NextResponse.json(
      { error: 'Media ID konnte nicht ermittelt werden. Bitte versuche es erneut.' },
      { status: 422 }
    );
  }

  // ── In Cache speichern für zukünftige Aufrufe (kein Bright Data mehr nötig) ─
  await saveCachedReel(shortcode, mediaId, title, thumbnail, ownerUsername);

  return NextResponse.json({
    mediaId,
    shortcode,
    title,
    thumbnailUrl: thumbnail,
    ownerUsername,
    reelUrl,
    fromCache: false,
  });
}
