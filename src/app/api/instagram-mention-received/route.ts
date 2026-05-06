/**
 * POST /api/instagram-mention-received
 *
 * Wird von Make.com (Szenario 9179868 – Instagram Mention) aufgerufen,
 * sobald @dawidfaith in einem Beitrag, Kommentar oder Story getaggt wird.
 *
 * Body (von Make.com):
 *   { comment_id: string, media_id: string }
 *
 * Sicherheit: Secret-Token via Header X-Make-Secret (optional, empfohlen)
 *
 * Einträge sind 30 Minuten gültig und können je Mention genau einmal
 * für eine Verifizierung genutzt werden (then deleted).
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

  let body: { comment_id?: string; media_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const comment_id = (body.comment_id ?? '').trim();
  const media_id = (body.media_id ?? '').trim();

  if (!comment_id && !media_id) {
    return NextResponse.json({ error: 'comment_id or media_id required' }, { status: 400 });
  }

  try {
    const sql = getDb();

    // Alte Einträge (> 30 Min) aufräumen
    await sql`DELETE FROM instagram_mentions WHERE received_at < NOW() - INTERVAL '30 minutes'`;

    // Neue Mention speichern
    await sql`
      INSERT INTO instagram_mentions (comment_id, media_id)
      VALUES (${comment_id}, ${media_id})
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[instagram-mention-received] DB error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
