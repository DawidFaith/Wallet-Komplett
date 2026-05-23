/**
 * GET  /api/admin/instagram-testers          → Alle Tester auflisten
 * POST /api/admin/instagram-testers          → Tester hinzufügen { handle, notes? }
 * DELETE /api/admin/instagram-testers?handle=xy → Tester entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listInstagramTesters,
  addInstagramTester,
  removeInstagramTester,
} from '../../../lib/questDb';
import { getDb } from '../../../lib/db';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret');
  return ADMIN_SECRET.length > 0 && auth === ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Tabelle anlegen falls noch nicht vorhanden (idempotent)
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS instagram_testers (
        instagram_handle  TEXT        PRIMARY KEY,
        notes             TEXT        NOT NULL DEFAULT '',
        added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const testers = await listInstagramTesters();
    return NextResponse.json({ testers });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json() as { handle?: string; notes?: string };
    const handle = body.handle?.trim().toLowerCase().replace(/^@/, '');
    if (!handle) return NextResponse.json({ error: 'handle fehlt' }, { status: 400 });
    await addInstagramTester(handle, body.notes ?? '');
    return NextResponse.json({ success: true, handle });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const handle = req.nextUrl.searchParams.get('handle')?.trim().toLowerCase().replace(/^@/, '');
    if (!handle) return NextResponse.json({ error: 'handle fehlt' }, { status: 400 });
    await removeInstagramTester(handle);
    return NextResponse.json({ success: true, handle });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
