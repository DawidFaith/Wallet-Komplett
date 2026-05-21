/**
 * GET    /api/instagram-quests/available-media  → Holt aktuelle IG-Posts direkt via Meta Graph API
 *                                                  Fallback: gespeicherte Videos aus DB
 * POST   /api/instagram-quests/available-media  → Erzwingt DB-Aktualisierung aus Meta API
 * DELETE /api/instagram-quests/available-media?shortcode=xxx → Video aus DB entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { fetchPlatformIgMedia } from '../../../lib/metaApi';

export async function GET() {
  const sql = getDb();

  // Live-Daten direkt von Meta Graph API holen
  const liveItems = await fetchPlatformIgMedia(20);

  if (liveItems.length > 0) {
    // DB-Einträge aktualisieren (upsert)
    try {
      for (const item of liveItems) {
        await sql`
          INSERT INTO instagram_available_media
            (shortcode, graph_media_id, caption, thumbnail_url, media_url, permalink, posted_at, saved_at, media_type, like_count, comments_count)
          VALUES (
            ${item.shortcode},
            ${item.id},
            ${item.caption},
            ${item.thumbnail_url || item.media_url},
            ${item.media_url},
            ${item.permalink},
            ${item.timestamp || null},
            NOW(),
            ${item.media_type},
            ${item.like_count},
            ${item.comments_count}
          )
          ON CONFLICT (shortcode) DO UPDATE SET
            graph_media_id   = EXCLUDED.graph_media_id,
            caption          = EXCLUDED.caption,
            thumbnail_url    = EXCLUDED.thumbnail_url,
            media_url        = EXCLUDED.media_url,
            permalink        = EXCLUDED.permalink,
            posted_at        = EXCLUDED.posted_at,
            saved_at         = NOW(),
            media_type       = EXCLUDED.media_type,
            like_count       = EXCLUDED.like_count,
            comments_count   = EXCLUDED.comments_count
        `;
      }
    } catch { /* DB-Fehler ignorieren – Live-Daten trotzdem zurückgeben */ }

    const media = liveItems.map((item) => ({
      shortcode: item.shortcode,
      graph_media_id: item.id,
      caption: item.caption,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url || item.media_url,
      permalink: item.permalink,
      posted_at: item.timestamp,
      media_type: item.media_type,
      media_product_type: item.media_product_type,
      like_count: item.like_count,
      comments_count: item.comments_count,
    }));
    return NextResponse.json({ media, source: 'meta_api' });
  }

  // Fallback: DB
  try {
    const rows = await sql`
      SELECT shortcode, graph_media_id, caption, thumbnail_url, media_url, permalink, posted_at, saved_at, media_type, like_count, comments_count
      FROM instagram_available_media
      ORDER BY posted_at DESC NULLS LAST, saved_at DESC
    `;
    return NextResponse.json({ media: rows, source: 'db' });
  } catch {
    return NextResponse.json({ media: [], source: 'empty' });
  }
}

// Erzwingt Aktualisierung der DB aus Meta API
export async function POST() {
  const liveItems = await fetchPlatformIgMedia(20);
  if (liveItems.length === 0) {
    return NextResponse.json({ error: 'Meta API lieferte keine Daten' }, { status: 502 });
  }

  const sql = getDb();
  for (const item of liveItems) {
    await sql`
      INSERT INTO instagram_available_media
        (shortcode, graph_media_id, caption, thumbnail_url, media_url, permalink, posted_at, saved_at, media_type, like_count, comments_count)
      VALUES (
        ${item.shortcode},
        ${item.id},
        ${item.caption},
        ${item.thumbnail_url || item.media_url},
        ${item.media_url},
        ${item.permalink},
        ${item.timestamp || null},
        NOW(),
        ${item.media_type},
        ${item.like_count},
        ${item.comments_count}
      )
      ON CONFLICT (shortcode) DO UPDATE SET
        graph_media_id   = EXCLUDED.graph_media_id,
        caption          = EXCLUDED.caption,
        thumbnail_url    = EXCLUDED.thumbnail_url,
        media_url        = EXCLUDED.media_url,
        permalink        = EXCLUDED.permalink,
        posted_at        = EXCLUDED.posted_at,
        saved_at         = NOW(),
        media_type       = EXCLUDED.media_type,
        like_count       = EXCLUDED.like_count,
        comments_count   = EXCLUDED.comments_count
    `;
  }

  return NextResponse.json({ success: true, count: liveItems.length });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shortcode = searchParams.get('shortcode');

  if (!shortcode) {
    return NextResponse.json({ error: 'shortcode Parameter fehlt' }, { status: 400 });
  }

  const sql = getDb();
  try {
    await sql`DELETE FROM instagram_available_media WHERE shortcode = ${shortcode}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

