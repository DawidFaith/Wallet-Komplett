/**
 * GET  /api/instagram-quests/available-media  → Holt Live-Videos von Make.com (Szenario 9191133)
 *                                                Fallback: gespeicherte Videos aus DB
 * DELETE /api/instagram-quests/available-media?shortcode=xxx → Video aus DB entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

interface MakeVideoItem {
  ig_id?: string;
  caption?: string;
  media_url?: string;
  permalink?: string;
  shortcode?: string;
  timestamp?: string;
  like_count?: string | number;
  media_type?: string;
  thumbnail_url?: string;
  comments_count?: string | number;
  media_product_type?: string;
}

async function fetchFromMake(): Promise<MakeVideoItem[] | null> {
  const webhookUrl = process.env.MAKE_INSTAGRAM_VIDEO_WEBHOOK_URL;
  if (!webhookUrl) return null;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20000),
    });

    const text = await res.text();
    if (!text || !text.trim()) return null;

    // Versuche normales JSON-Parse
    try {
      const data = JSON.parse(text);
      const arr = data?.metrics ?? data?.media ?? data;
      if (Array.isArray(arr)) return arr;
    } catch { /* weiter zu Regex-Fallback */ }

    // Regex-Fallback für Make.com Array-Aggregator-Format
    const items: MakeVideoItem[] = [];
    const objRegex = /\{[^{}]*\}/g;
    const matches = text.match(objRegex);
    if (matches) {
      for (const m of matches) {
        try { items.push(JSON.parse(m)); } catch { /* überspringen */ }
      }
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export async function GET() {
  // Live-Daten von Make.com holen
  const makeItems = await fetchFromMake();

  if (makeItems && makeItems.length > 0) {
    const media = makeItems.map((item) => ({
      shortcode: item.shortcode ?? item.ig_id ?? '',
      graph_media_id: item.ig_id ?? '',
      caption: item.caption ?? '',
      thumbnail_url: item.thumbnail_url ?? item.media_url ?? '',
      permalink: item.permalink ?? '',
      posted_at: item.timestamp ?? null,
      media_type: item.media_type ?? '',
      like_count: Number(item.like_count ?? 0),
      comments_count: Number(item.comments_count ?? 0),
    }));
    return NextResponse.json({ media, source: 'make' });
  }

  // Fallback: DB
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT shortcode, graph_media_id, caption, thumbnail_url, permalink, posted_at, saved_at
      FROM instagram_available_media
      ORDER BY saved_at DESC
    `;
    return NextResponse.json({ media: rows, source: 'db' });
  } catch {
    return NextResponse.json({ media: [] });
  }
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

