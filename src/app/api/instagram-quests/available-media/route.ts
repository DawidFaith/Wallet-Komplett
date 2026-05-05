/**
 * GET  /api/instagram-quests/available-media  → Liste aller gespeicherten Videos (neueste zuerst)
 * DELETE /api/instagram-quests/available-media?shortcode=xxx → Video aus DB entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT shortcode, graph_media_id, caption, thumbnail_url, permalink, posted_at, saved_at
      FROM instagram_available_media
      ORDER BY saved_at DESC
    `;
    return NextResponse.json({ media: rows });
  } catch {
    // Tabelle existiert noch nicht
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
