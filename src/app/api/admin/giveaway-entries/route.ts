/**
 * GET /api/admin/giveaway-entries
 * Header: x-admin-secret
 * Alle Giveaway-Teilnahmen plattformweit — E-Mail, Sprache, Plattform, Handle,
 * Status, Kampagne und Künstler.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAllGiveawayEntriesForAdmin } from '@/app/lib/questDb';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const entries = await getAllGiveawayEntriesForAdmin();
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[admin/giveaway-entries]', err);
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 });
  }
}
