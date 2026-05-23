/**
 * GET    /api/admin/instagram-testers           → Whitelist + offene Requests
 * POST   /api/admin/instagram-testers           → Tester manuell hinzufügen { handle, notes? }
 * PATCH  /api/admin/instagram-testers           → Request genehmigen { id } → sendet User-E-Mail
 * DELETE /api/admin/instagram-testers?handle=xy → Tester aus Whitelist entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listInstagramTesters,
  addInstagramTester,
  removeInstagramTester,
  setInstagramTesterInviteAccepted,
  listInstagramTesterRequests,
  approveInstagramTesterRequest,
  rejectInstagramTesterRequest,
} from '../../../lib/questDb';
import { sendTesterApprovedEmail } from '../../../lib/email';
import { getDb } from '../../../lib/db';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS instagram_testers (
      instagram_handle  TEXT        PRIMARY KEY,
      notes             TEXT        NOT NULL DEFAULT '',
      invite_accepted   BOOLEAN     NOT NULL DEFAULT FALSE,
      added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE instagram_testers ADD COLUMN IF NOT EXISTS invite_accepted BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`
    CREATE TABLE IF NOT EXISTS instagram_tester_requests (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      instagram_handle  TEXT        NOT NULL,
      email             TEXT        NOT NULL,
      wallet_address    TEXT        NOT NULL,
      status            TEXT        NOT NULL DEFAULT 'pending',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at       TIMESTAMPTZ
    )
  `;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureTable();
    const [testers, requests] = await Promise.all([
      listInstagramTesters(),
      listInstagramTesterRequests(),
    ]);
    return NextResponse.json({ testers, requests });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureTable();
    const body = await req.json() as { handle?: string; notes?: string };
    const handle = body.handle?.trim().toLowerCase().replace(/^@/, '');
    if (!handle) return NextResponse.json({ error: 'handle fehlt' }, { status: 400 });
    await addInstagramTester(handle, body.notes ?? '');
    return NextResponse.json({ success: true, handle });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json() as { id?: string; handle?: string; action?: 'approve' | 'reject' | 'accept_invite' | 'revoke_invite' };

    // Admin bestätigt dass User die Instagram-Einladung angenommen hat
    if (body.action === 'accept_invite' || body.action === 'revoke_invite') {
      const handle = body.handle?.trim().toLowerCase().replace(/^@/, '');
      if (!handle) return NextResponse.json({ error: 'handle fehlt' }, { status: 400 });
      await setInstagramTesterInviteAccepted(handle, body.action === 'accept_invite');
      return NextResponse.json({ success: true, action: body.action, handle });
    }

    if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });

    if (body.action === 'reject') {
      await rejectInstagramTesterRequest(body.id);
      return NextResponse.json({ success: true, action: 'rejected' });
    }

    // Genehmigen (default)
    const request = await approveInstagramTesterRequest(body.id);
    if (!request) return NextResponse.json({ error: 'Antrag nicht gefunden oder bereits verarbeitet' }, { status: 404 });

    // User-E-Mail senden (non-blocking)
    sendTesterApprovedEmail({
      toEmail: request.email,
      instagramHandle: request.instagramHandle,
    }).catch((e) => console.error('[admin/instagram-testers] User-Mail Fehler:', e));

    return NextResponse.json({ success: true, action: 'approved', handle: request.instagramHandle });
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

