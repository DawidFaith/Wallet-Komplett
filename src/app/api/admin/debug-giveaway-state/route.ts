/**
 * GET /api/admin/debug-giveaway-state?email=...&wallet=...&handle=...
 * Header: x-admin-secret
 *
 * Diagnose-Route: zeigt den rohen DB-Zustand für einen Test-Account, um
 * herauszufinden ob giveaway_entries/user_profiles korrekt gesetzt wurden
 * (Backend-Bug) oder ob es nur ein Frontend-Anzeigeproblem ist.
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

  const sql = getDb();
  const result: Record<string, unknown> = {};

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
