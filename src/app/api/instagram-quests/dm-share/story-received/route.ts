/**
 * POST /api/instagram-quests/dm-share/story-received
 *
 * Wird von Make.com aufgerufen, wenn ein User einen Story-Share hochgeladen hat.
 *
 * Body (von Make.com):
 *   { instagramHandle: string }   ← Instagram-Handle des Users der die Story geteilt hat
 *
 * Sicherheit: Secret-Token via Header X-Make-Secret
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  markInstagramDmStoryVerifiedByHandle,
  getInstagramDmVerificationByHandle,
} from '../../../../lib/questDb';

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const secret = process.env.INSTAGRAM_DM_STORY_SECRET;
  if (secret) {
    const provided = req.headers.get('x-make-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { instagramHandle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const handle = (body.instagramHandle ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!handle) {
    return NextResponse.json({ error: 'instagramHandle erforderlich' }, { status: 400 });
  }

  try {
    const verif = await getInstagramDmVerificationByHandle(handle);
    if (!verif) {
      return NextResponse.json({ error: 'Keine aktive Quest für diesen Handle gefunden' }, { status: 404 });
    }
    if (!verif.clickVerified) {
      return NextResponse.json({ error: 'Teil 1 (Klick) noch nicht verifiziert' }, { status: 400 });
    }
    await markInstagramDmStoryVerifiedByHandle(handle);
    return NextResponse.json({ ok: true, questId: verif.questId, walletAddress: verif.walletAddress });
  } catch (err) {
    console.error('[dm-share/story-received]', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
