/**
 * POST /api/instagram-quests/dm-share/story-received
 *
 * Manueller Fallback: Markiert eine Story als verifiziert und gibt den DM-Link zurück.
 * Wird normalerweise NICHT mehr benötigt – der Meta-Webhook (story-mention-webhook)
 * erledigt das automatisch sobald der Fan den Künstler in der Story taggt.
 *
 * Body:
 *   { instagramHandle: string }
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

    // story_verified setzen (kein clickVerified-Check mehr – story kommt VOR dem Klick)
    await markInstagramDmStoryVerifiedByHandle(handle);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de').replace(/\/$/, '');
    const dmLink = `${appUrl}/api/instagram-quests/dm-click?token=${encodeURIComponent(verif.clickToken)}`;

    return NextResponse.json({
      ok: true,
      questId:       verif.questId,
      walletAddress: verif.walletAddress,
      clickToken:    verif.clickToken,
      dmLink,
    });
  } catch (err) {
    console.error('[dm-share/story-received]', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
