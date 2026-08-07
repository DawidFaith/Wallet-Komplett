/**
 * GET /api/admin/debug-giveaway-state?email=...&wallet=...&handle=...&trace=1
 * Header: x-admin-secret
 *
 * Diagnose-Route: zeigt den rohen DB-Zustand für einen Test-Account. Mit
 * &trace=1&wallet=...&handle=...&name=... wird der exakte Ablauf von
 * autoVerifyPlatformForWallet (Facebook-Zweig) mit echten Werten nachgestellt
 * und jeder Zwischenschritt zurückgegeben, ohne tatsächlich zu schreiben.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim().toLowerCase();
  const handle = req.nextUrl.searchParams.get('handle')?.trim().toLowerCase();
  const trace = req.nextUrl.searchParams.get('trace') === '1';

  const sql = getDb();
  const result: Record<string, unknown> = {};

  if (trace && wallet && handle) {
    const taken = await sql`SELECT wallet_address FROM user_profiles WHERE LOWER(facebook_handle) = ${handle} AND wallet_address != ${wallet} LIMIT 1`;
    const existing = await sql`SELECT wallet_address, facebook_verified FROM user_profiles WHERE wallet_address = ${wallet} LIMIT 1`;
    result.trace = {
      wallet,
      handle,
      takenCheck: { query: 'LOWER(facebook_handle) = handle AND wallet_address != wallet', rows: taken, wouldReturnEarly: taken.length > 0 },
      existingCheck: { rows: existing, existsAlready: existing.length > 0, alreadyVerified: existing.length > 0 ? existing[0].facebook_verified : null, wouldReturnEarly: existing.length > 0 && Boolean(existing[0].facebook_verified) },
    };
    return NextResponse.json(result);
  }

  if (email) {
    result.giveawayEntries = await sql`
      SELECT id, campaign_id, platform, handle, email, status, verified_name, credited_wallet, created_at, verified_at
      FROM giveaway_entries WHERE email = ${email} ORDER BY created_at DESC LIMIT 10
    `;
  }
  if (wallet) {
    result.userProfile = await sql`
      SELECT wallet_address, facebook_handle, facebook_verified, facebook_name,
             instagram_handle, instagram_verified, tiktok_handle, tiktok_verified,
             updated_at
      FROM user_profiles WHERE wallet_address = ${wallet} LIMIT 1
    `;
    result.solanaAccount = await sql`
      SELECT wallet_address, solana_address, created_at FROM solana_accounts WHERE wallet_address = ${wallet} LIMIT 1
    `;
  }
  if (handle) {
    result.handleTakenBy = await sql`
      SELECT wallet_address, facebook_handle, facebook_verified, updated_at
      FROM user_profiles WHERE LOWER(facebook_handle) = ${handle}
    `;
  }

  return NextResponse.json(result);
}
