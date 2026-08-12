/**
 * GET /api/identity/status?walletAddress=...
 * Liefert den Verifizierungsstatus des eigenen Accounts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOwnWallet } from '@/app/lib/apiAuth';
import { getVerificationStatus } from '@/app/lib/identityVerification';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const walletAddress = new URL(req.url).searchParams.get('walletAddress');
    const authCheck = requireOwnWallet(walletAddress);
    if (!authCheck.ok) return authCheck.response;

    const status = await getVerificationStatus(walletAddress!);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[identity/status]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Status konnte nicht geladen werden' }, { status: 500 });
  }
}
