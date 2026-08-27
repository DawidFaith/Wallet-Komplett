/**
 * GET  /api/admin/ugc-submissions  → offene (pending) UGC-Quest-Einreichungen
 * POST /api/admin/ugc-submissions  → Einreichung freigeben/ablehnen
 *   Body: { id, decision: 'approved' | 'rejected', rejectionReason? }
 *
 * Landet eine Einreichung hier, konnte der automatische oEmbed-Check
 * (siehe api/quests/ugc-submit) technisch nicht durchgeführt werden —
 * der Fan hat den geforderten Hashtag nicht zwingend verpasst.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listPendingUgcSubmissions, reviewUgcSubmission } from '../../../lib/questDb';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const submissions = await listPendingUgcSubmissions();
  return NextResponse.json({ submissions });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  let body: { id?: string; decision?: 'approved' | 'rejected'; rejectionReason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }
  const { id, decision, rejectionReason } = body;
  if (!id || (decision !== 'approved' && decision !== 'rejected')) {
    return NextResponse.json({ error: 'id und decision (approved|rejected) sind erforderlich' }, { status: 400 });
  }

  const result = await reviewUgcSubmission(id, decision, rejectionReason);
  if (!result) {
    return NextResponse.json({ error: 'Einreichung nicht gefunden oder bereits bearbeitet' }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...result });
}
