/**
 * POST /api/admin/platform-setup
 *
 * Richtet dfaith_ecosystem als Platform-Artist ein:
 *   - Legt user_profiles-Eintrag mit wallet_address = 'platform_dfaith_ecosystem' an
 *   - Setzt is_artist = true, instagram_verified = true, facebook_verified = true
 *   - Testet META_SYSTEM_USER_TOKEN
 *
 * Body: { secret: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getIgAccountId } from '../../../lib/metaApi';

const PLATFORM_WALLET = 'platform_dfaith_ecosystem';
const GRAPH = 'https://graph.facebook.com/v21.0';

export async function POST(req: NextRequest) {
  let body: { secret?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  if (body.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const token = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  // ── Meta API testen ────────────────────────────────────────────────────────
  let metaStatus: Record<string, unknown> = { ok: false };
  if (token && pageId) {
    try {
      const res = await fetch(
        `${GRAPH}/${pageId}?fields=name,instagram_business_account{id,username}&access_token=${token}`,
        { cache: 'no-store' },
      );
      const data = await res.json() as Record<string, unknown>;
      metaStatus = { ok: res.ok, page: data };
    } catch (e) {
      metaStatus = { ok: false, error: String(e) };
    }
  } else {
    metaStatus = { ok: false, error: 'META_SYSTEM_USER_TOKEN oder FACEBOOK_PAGE_ID fehlt' };
  }

  // ── IG-Account-ID ermitteln ────────────────────────────────────────────────
  const igAccountId = await getIgAccountId();

  // ── user_profiles upsert ───────────────────────────────────────────────────
  const sql = getDb();
  try {
    // Spalten sicherstellen
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_platform_user BOOLEAN DEFAULT FALSE`;
  } catch { /* ignorieren falls Spalten schon existieren */ }

  await sql`
    INSERT INTO user_profiles (
      wallet_address,
      is_artist,
      is_platform_user,
      display_name,
      instagram_handle,
      instagram_verified,
      instagram_name,
      facebook_handle,
      facebook_verified,
      facebook_name,
      reward_token,
      dfaith_credits,
      xp,
      reputation
    ) VALUES (
      ${PLATFORM_WALLET},
      TRUE,
      TRUE,
      'D.Faith Ecosystem',
      'dfaith_ecosystem',
      TRUE,
      'D.Faith Ecosystem',
      'dfaith_ecosystem',
      TRUE,
      'D.Faith Ecosystem',
      'D.FAITH',
      0,
      0,
      0
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      is_artist          = TRUE,
      is_platform_user   = TRUE,
      display_name       = 'D.Faith Ecosystem',
      instagram_handle   = 'dfaith_ecosystem',
      instagram_verified = TRUE,
      instagram_name     = 'D.Faith Ecosystem',
      facebook_handle    = 'dfaith_ecosystem',
      facebook_verified  = TRUE,
      facebook_name      = 'D.Faith Ecosystem',
      reward_token       = 'D.FAITH'
  `;

  // ── Profil laden zur Bestätigung ───────────────────────────────────────────
  const rows = await sql`SELECT * FROM user_profiles WHERE wallet_address = ${PLATFORM_WALLET} LIMIT 1`;

  return NextResponse.json({
    success: true,
    platformWallet: PLATFORM_WALLET,
    igAccountId,
    metaStatus,
    profile: rows[0] ?? null,
  });
}

// GET: Aktuellen Status des Platform-Users abfragen
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  if (searchParams.get('secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`SELECT * FROM user_profiles WHERE wallet_address = ${PLATFORM_WALLET} LIMIT 1`;

  const igAccountId = await getIgAccountId();

  // Meta API Token-Status
  let tokenOk = false;
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (token && pageId) {
    try {
      const res = await fetch(`${GRAPH}/${pageId}?fields=name&access_token=${token}`, { cache: 'no-store' });
      tokenOk = res.ok;
    } catch { tokenOk = false; }
  }

  return NextResponse.json({
    exists: rows.length > 0,
    profile: rows[0] ?? null,
    igAccountId,
    metaTokenOk: tokenOk,
  });
}
