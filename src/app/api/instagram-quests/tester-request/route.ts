/**
 * POST /api/instagram-quests/tester-request
 *
 * User beantragt Beta-Zugang als Instagram-Tester.
 * Body: { walletAddress, email }
 * → Speichert Antrag in DB, sendet Admin-E-Mail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '../../../lib/questDb';
import { upsertInstagramTesterRequest } from '../../../lib/questDb';
import { sendTesterRequestAdminEmail } from '../../../lib/email';

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const walletAddress = body.walletAddress?.toLowerCase();
  const email = body.email?.trim().toLowerCase();

  if (!walletAddress || !email) {
    return NextResponse.json({ error: 'walletAddress und email sind erforderlich' }, { status: 400 });
  }

  // E-Mail-Format prüfen
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
  }

  try {
    const profile = await getUserProfile(walletAddress);
    if (!profile?.instagramHandle || !profile.instagramVerified) {
      return NextResponse.json(
        { error: 'Kein verifiziertes Instagram-Konto verknüpft.' },
        { status: 400 },
      );
    }

    await upsertInstagramTesterRequest(profile.instagramHandle, email, walletAddress);

    // Admin-Mail (non-blocking – Fehler dürfen nicht den Response blockieren)
    sendTesterRequestAdminEmail({
      instagramHandle: profile.instagramHandle,
      email,
      walletAddress,
    }).catch((e) => console.error('[tester-request] Admin-Mail Fehler:', e));

    return NextResponse.json({
      success: true,
      message: 'Dein Antrag wurde gesendet. Wir schalten dich so schnell wie möglich frei und benachrichtigen dich per E-Mail.',
    });
  } catch (err) {
    console.error('[tester-request]', err);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}
