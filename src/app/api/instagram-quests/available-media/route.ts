/**
 * GET  /api/instagram-quests/available-media  → Holt Live-Videos von Make.com (Szenario 9191133)
 *                                                Fallback: gespeicherte Videos aus DB
 * DELETE /api/instagram-quests/available-media?shortcode=xxx → Video aus DB entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

interface MakeVideoItem {
  id?: string;             // Graph API Media-ID (für /insights & /comments)
  ig_id?: string;          // Legacy IG-Original-ID (NICHT für Graph API geeignet)
  username?: string;
  caption?: string;
  media_url?: string;
  permalink?: string;
  shortcode?: string;
  timestamp?: string;
  like_count?: string | number;
  media_type?: string;
  thumbnail_url?: string;
  comments_count?: string | number;
  is_comment_enabled?: boolean;
  media_product_type?: string;
}

// Top-Level-Objekte aus Make.com Aggregator-Format extrahieren.
// Make liefert oft INVALIDES JSON wie:
//   {"metrics": {obj1}, {obj2}, {obj3}}
// (mehrere unbenannte Werte hinter "metrics") oder
//   [{obj1}, {obj2}]
// Strategie: Wir betrachten die *erste* `{` oder `[` als Wrapper und sammeln
// alle Objekte direkt darin (Tiefe >= 2 für `{`-Wrapper, Tiefe >= 1 für `[`).
function extractTopLevelObjects(text: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = -1;
  let captureDepth = -1; // Tiefe, bei der wir das aktuelle Objekt zu erfassen begonnen haben
  let inString = false;
  let escape = false;
  let outerOpened = false; // erster Wrapper ({ oder [) bereits gesehen?

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      if (!outerOpened) {
        // Erster Wrapper – nicht erfassen
        outerOpened = true;
        depth++;
        continue;
      }
      // Wenn noch kein Capture läuft und wir auf einem `{` sind → Item starten
      if (start === -1 && ch === '{') {
        start = i;
        captureDepth = depth;
      }
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (start !== -1 && depth === captureDepth) {
        result.push(text.slice(start, i + 1));
        start = -1;
        captureDepth = -1;
      }
    }
  }
  return result;
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
    // Nur Top-Level-Objekte sammeln, sonst werden verschachtelte Sub-Objekte
    // (z.B. image_versions) fälschlich als eigene Media-Items interpretiert.
    const items: MakeVideoItem[] = [];
    const matches = extractTopLevelObjects(text);
    for (const m of matches) {
      try {
        const parsed = JSON.parse(m);
        // Nur Objekte akzeptieren, die plausibel ein Media-Item sind
        if (parsed && (parsed.id || parsed.ig_id || parsed.shortcode)) {
          items.push(parsed);
        }
      } catch { /* überspringen */ }
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
      shortcode: item.shortcode ?? item.id ?? item.ig_id ?? '',
      // Graph API Media-ID bevorzugen (benötigt von /insights & /comments).
      // ig_id ist die Legacy-ID und führt zu Fehlern bei Insights → Bug-Fix.
      graph_media_id: item.id ?? item.ig_id ?? '',
      ig_id: item.ig_id ?? '',
      username: item.username ?? '',
      caption: item.caption ?? '',
      media_url: item.media_url ?? '',
      thumbnail_url: item.thumbnail_url ?? item.media_url ?? '',
      permalink: item.permalink ?? '',
      posted_at: item.timestamp ?? null,
      media_type: item.media_type ?? '',
      media_product_type: item.media_product_type ?? '',
      like_count: Number(item.like_count ?? 0),
      comments_count: Number(item.comments_count ?? 0),
      is_comment_enabled: item.is_comment_enabled ?? true,
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

