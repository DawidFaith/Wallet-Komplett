/**
 * GET  /api/admin/referral-config  → Aktuelle Konfiguration laden
 * POST /api/admin/referral-config  → Konfiguration speichern
 * GET  /api/admin/referral-config?stats=1 → Referral-Statistiken
 * Header: x-admin-secret
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  return !!process.env.MIGRATION_SECRET && secret === process.env.MIGRATION_SECRET;
}

async function ensureTables(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS referral_config (
      id                  TEXT        PRIMARY KEY DEFAULT 'default',
      reward_per_referral DECIMAL(10,2) NOT NULL DEFAULT 10.0,
      max_referrals_paid  INT         NOT NULL DEFAULT 100,
      trigger_level       INT         NOT NULL DEFAULT 10,
      is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO referral_config (id) VALUES ('default')
    ON CONFLICT (id) DO NOTHING
  `;
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
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const sql = getDb();
  await ensureTables(sql);
  const { searchParams } = new URL(req.url);

  if (searchParams.get('stats') === '1') {
    const [config, stats] = await Promise.all([
      sql`SELECT * FROM referral_config WHERE id = 'default' LIMIT 1`,
      sql`
        SELECT
          COUNT(*)::int AS total_referrals,
          COUNT(*) FILTER (WHERE reward_paid = TRUE)::int AS paid_referrals,
          COALESCE(SUM(reward_amount) FILTER (WHERE reward_paid = TRUE), 0)::numeric AS total_paid_out,
          COUNT(*) FILTER (WHERE triggered_at IS NOT NULL AND reward_paid = FALSE)::int AS pending_trigger
        FROM user_referrals
      `,
    ]);
    return NextResponse.json({ config: config[0] ?? null, stats: stats[0] ?? null });
  }

  const config = await sql`SELECT * FROM referral_config WHERE id = 'default' LIMIT 1`;
  return NextResponse.json(config[0] ?? null);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const sql = getDb();
  await ensureTables(sql);

  const body = await req.json() as {
    rewardPerReferral?: number;
    maxReferralsPaid?: number;
    triggerLevel?: number;
    isActive?: boolean;
  };

  const reward = Math.max(0, Number(body.rewardPerReferral ?? 10));
  const maxPaid = Math.max(1, Math.round(Number(body.maxReferralsPaid ?? 100)));
  const level = Math.max(1, Math.min(100, Math.round(Number(body.triggerLevel ?? 10))));
  const active = body.isActive !== false;

  await sql`
    UPDATE referral_config
    SET
      reward_per_referral = ${reward},
      max_referrals_paid  = ${maxPaid},
      trigger_level       = ${level},
      is_active           = ${active},
      updated_at          = NOW()
    WHERE id = 'default'
  `;

  return NextResponse.json({ success: true });
}
