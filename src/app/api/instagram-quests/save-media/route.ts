/**
 * POST /api/instagram-quests/save-media
 *
 * Akzeptiert ein einzelnes Video ODER ein Array (Batch) — ein Modul in Make.com reicht:
 *
 * Make.com Szenario "Media Sync":
 *   [1] Custom Webhook (Trigger)
 *   [2] HTTP GET /me/media?fields=id,shortcode,caption,thumbnail_url,permalink,timestamp&limit=100
 *   [3] HTTP POST https://app.dawidfaith.de/api/instagram-quests/save-media
 *       Body: { "items": {{2.data}} }    ← komplettes data[] Array, kein Iterator nötig
 *
 * Watch Media (automatisch bei neuem Post):
 *   Body: { "id": "...", "shortcode": "...", "caption": "...", ... }
 *
 * Optional: Header X-Make-Secret: {{secret}} (env: MAKE_WEBHOOK_SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

interface MediaItem {
  graphMediaId?: string;
  id?: string;             // Graph API liefert "id" direkt
  shortcode?: string;
  caption?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;  // Graph API Feldname
  permalink?: string;
  postedAt?: string;
  timestamp?: string;      // Graph API Feldname
}

function normalize(item: MediaItem) {
  return {
    graphMediaId: item.graphMediaId ?? item.id ?? '',
    shortcode:    item.shortcode ?? '',
    caption:      item.caption ?? '',
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? '',
    permalink:    item.permalink ?? '',
    postedAt:     item.postedAt ?? item.timestamp ?? null,
  };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-make-secret');
  const expectedSecret = process.env.MAKE_WEBHOOK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ({ items?: MediaItem[] }) & MediaItem;
  try {
    // Make.com injiziert Caption-Zeilenumbrüche direkt in den JSON-String → ungültiges JSON.
    // Lösung: Body als Text lesen, Steuerzeichen (außer Tab) escapen, dann parsen.
    const raw = await req.text();
    const sanitized = raw.replace(/[\x00-\x08\x0A-\x1F]/g, (c) =>
      '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
    );
    body = JSON.parse(sanitized);
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  // Batch (Array via "items") oder einzelnes Video
  const items: MediaItem[] = Array.isArray(body.items) ? body.items : [body];

  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS instagram_available_media (
      shortcode       TEXT        PRIMARY KEY,
      graph_media_id  TEXT        NOT NULL,
      caption         TEXT        NOT NULL DEFAULT '',
      thumbnail_url   TEXT        NOT NULL DEFAULT '',
      permalink       TEXT        NOT NULL DEFAULT '',
      posted_at       TIMESTAMPTZ,
      saved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  let saved = 0;
  for (const raw of items) {
    const { graphMediaId, shortcode, caption, thumbnailUrl, permalink, postedAt } = normalize(raw);
    if (!graphMediaId || !shortcode) continue;

    await sql`
      INSERT INTO instagram_available_media
        (shortcode, graph_media_id, caption, thumbnail_url, permalink, posted_at)
      VALUES (
        ${shortcode},
        ${graphMediaId},
        ${caption},
        ${thumbnailUrl},
        ${permalink || `https://www.instagram.com/reel/${shortcode}/`},
        ${postedAt ? new Date(postedAt) : null}
      )
      ON CONFLICT (shortcode) DO UPDATE SET
        graph_media_id = EXCLUDED.graph_media_id,
        caption        = EXCLUDED.caption,
        thumbnail_url  = EXCLUDED.thumbnail_url,
        permalink      = EXCLUDED.permalink,
        posted_at      = EXCLUDED.posted_at,
        saved_at       = NOW()
    `;
    saved++;
  }

  return NextResponse.json({ success: true, saved });
}
