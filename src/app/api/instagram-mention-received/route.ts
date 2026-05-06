/**
 * POST /api/instagram-mention-received
 *
 * Wird von Make.com (Szenario 9179868 – Instagram Comments) aufgerufen,
 * sobald jemand unter einem Post/Reel von @dawidfaith kommentiert.
 *
 * Body (von Make.com):
 *   { username: string, text: string }
 *
 * Sicherheit: Secret-Token via Header X-Make-Secret (optional, empfohlen)
 *
 * Einträge sind 30 Minuten gültig. Beim Verifizieren wird der Eintrag
 * des passenden Usernames aus der DB gelöscht (einmalig nutzbar).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  // Optionaler Secret-Schutz
  const secret = process.env.INSTAGRAM_MENTION_SECRET;
  if (secret) {
    const provided = req.headers.get('x-make-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { username?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const username = (body.username ?? '').trim().replace(/^@/, '').toLowerCase();

  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 });
  }

  try {
    const sql = getDb();

    // Alte Einträge (> 30 Min) aufräumen
    await sql`DELETE FROM instagram_mentions WHERE received_at < NOW() - INTERVAL '30 minutes'`;

    // Neuen Kommentar-User speichern (upsert: selber User darf mehrfach kommentieren)
    await sql`
      INSERT INTO instagram_mentions (comment_id, media_id)
      VALUES (${username}, '')
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[instagram-mention-received] DB error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
