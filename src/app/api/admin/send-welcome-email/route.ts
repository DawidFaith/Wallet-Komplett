/**
 * POST /api/admin/send-welcome-email
 * Header: x-admin-secret
 * Sendet die einmalige Willkommensmail an alle Nutzer, die sie noch nicht
 * erhalten haben (idempotent, kann bei Timeout/Fehlern gefahrlos erneut
 * aufgerufen werden).
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmailsToAllPending } from '@/app/lib/welcomeEmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const result = await sendWelcomeEmailsToAllPending();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/send-welcome-email]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Versand fehlgeschlagen' }, { status: 500 });
  }
}
