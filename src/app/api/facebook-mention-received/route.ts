/**
 * POST /api/facebook-mention-received
 *
 * Wird von Make.com aufgerufen, sobald jemand unter einem Post/Video
 * von @dawidfaith auf Facebook mit @dawidfaith kommentiert.
 *
 * Body (von Make.com):
 *   { username: string, text?: string, post_id?: string }
 *
 * Sicherheit: Secret-Token via Header X-Make-Secret (optional, empfohlen)
 *
 * Einträge sind 2 Stunden gültig. Beim Verifizieren wird der Eintrag
 * des passenden Usernames aus der DB gelöscht (einmalig nutzbar).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const secret = process.env.FACEBOOK_MENTION_SECRET;
  if (secret) {
    const provided = req.headers.get('x-make-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { username?: string; text?: string; post_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const username = (body.username ?? '').trim().replace(/^@/, '').toLowerCase();
  const postId = (body.post_id ?? '').trim();

  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 });
  }

  try {
    const sql = getDb();

    // Alte Einträge (> 2 Stunden) aufräumen
    await sql`DELETE FROM facebook_mentions WHERE received_at < NOW() - INTERVAL '2 hours'`;

    await sql`
      INSERT INTO facebook_mentions (username, post_id)
      VALUES (${username}, ${postId})
      ON CONFLICT (username) DO UPDATE SET
        post_id     = EXCLUDED.post_id,
        received_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[facebook-mention-received] DB error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
