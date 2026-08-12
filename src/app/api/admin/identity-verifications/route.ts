/**
 * GET   /api/admin/identity-verifications  → offene Anträge inkl. Bild-Vorschau
 * PATCH /api/admin/identity-verifications  → Antrag genehmigen/ablehnen
 * Header: x-admin-secret
 */
import { NextRequest, NextResponse } from 'next/server';
import { listPendingForAdmin, reviewVerification } from '@/app/lib/identityVerification';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return Boolean(expected) && secret === expected;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const pending = await listPendingForAdmin();
    return NextResponse.json({ pending });
  } catch (err) {
    console.error('[admin/identity-verifications GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

    const { id, decision, rejectionReason, confirmedIdNumber, force } = body as {
      id?: string;
      decision?: 'approved' | 'rejected';
      rejectionReason?: string;
      confirmedIdNumber?: string;
      force?: boolean;
    };
    if (!id || !decision) {
      return NextResponse.json({ error: 'id und decision erforderlich' }, { status: 400 });
    }

    const result = await reviewVerification({ id, decision, rejectionReason, confirmedIdNumber, force });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, conflictWallet: result.conflictWallet }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/identity-verifications PATCH]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Prüfung fehlgeschlagen' }, { status: 500 });
  }
}
