/**
 * GET  /api/admin/referrals            → Alle Referral-Einträge (optional ?referrer=xyz filtern)
 * POST /api/admin/referrals            → Referral manuell eintragen { referrerWallet, referredWallet }
 * Auth: x-admin-secret Header
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function authCheck(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const deny = authCheck(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const referrerFilter = searchParams.get('referrer')?.toLowerCase().trim();

  const sql = getDb();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_referrals (
        id               SERIAL      PRIMARY KEY,
        referrer_wallet  TEXT        NOT NULL,
        referred_wallet  TEXT        NOT NULL UNIQUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        triggered_at     TIMESTAMPTZ,
        reward_paid      BOOLEAN     NOT NULL DEFAULT FALSE,
        reward_amount    DECIMAL(10,2)
      )
    `;

    const rows = referrerFilter
      ? await sql`
          SELECT id, referrer_wallet, referred_wallet, created_at, triggered_at, reward_paid, reward_amount
          FROM user_referrals
          WHERE referrer_wallet = ${referrerFilter}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT id, referrer_wallet, referred_wallet, created_at, triggered_at, reward_paid, reward_amount
          FROM user_referrals
          ORDER BY created_at DESC
          LIMIT 200
        `;

    return NextResponse.json({ referrals: rows, total: rows.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = authCheck(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { referrerWallet?: string; referredWallet?: string };
  const referrerWallet = body.referrerWallet?.toLowerCase().trim();
  const referredWallet = body.referredWallet?.toLowerCase().trim();

  if (!referrerWallet || !referredWallet) {
    return NextResponse.json({ error: 'referrerWallet und referredWallet erforderlich' }, { status: 400 });
  }
  if (referrerWallet === referredWallet) {
    return NextResponse.json({ error: 'Selbst-Referral nicht erlaubt' }, { status: 400 });
  }

  const sql = getDb();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_referrals (
        id               SERIAL      PRIMARY KEY,
        referrer_wallet  TEXT        NOT NULL,
        referred_wallet  TEXT        NOT NULL UNIQUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        triggered_at     TIMESTAMPTZ,
        reward_paid      BOOLEAN     NOT NULL DEFAULT FALSE,
        reward_amount    DECIMAL(10,2)
      )
    `;
    await sql`
      INSERT INTO user_referrals (referrer_wallet, referred_wallet)
      VALUES (${referrerWallet}, ${referredWallet})
      ON CONFLICT (referred_wallet) DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
