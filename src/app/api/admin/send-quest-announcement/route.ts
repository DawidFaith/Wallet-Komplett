/**
 * POST /api/admin/send-quest-announcement
 * Header: x-admin-secret
 * Sendet die "Neue Quests verfügbar"-Mail an ALLE registrierten Nutzer mit
 * bekannter E-Mail-Adresse (in ihrer gespeicherten Sprache), abgemeldete
 * Empfänger übersprungen. Nicht idempotent — jeder Klick versendet erneut.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendNewQuestsAnnouncementToAllUsers } from '@/app/lib/questAnnouncementEmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const result = await sendNewQuestsAnnouncementToAllUsers();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/send-quest-announcement]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Versand fehlgeschlagen' }, { status: 500 });
  }
}
