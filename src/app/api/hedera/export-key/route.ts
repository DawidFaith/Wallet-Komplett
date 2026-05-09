/**
 * POST /api/hedera/export-key
 * Body: { accountId: "0.0.12345" }
 *
 * Platzhalter-Endpoint für spätere server-managed Accounts.
 * Aktuell wird kein Key in der DB gespeichert (externe Wallets).
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { accountId } = body ?? {};

  if (!accountId) {
    return NextResponse.json({ error: 'accountId fehlt' }, { status: 400 });
  }

  return NextResponse.json({
    error: 'Key-Export ist nur für server-verwaltete Accounts verfügbar.',
  }, { status: 404 });
}
