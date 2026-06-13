/**
 * GET /api/referral/stats?wallet=xxx
 * Gibt Referral-Statistiken für einen User zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase().trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const sql = getDb();
  try {
    // Tabellen anlegen falls noch nicht vorhanden
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
      CREATE TABLE IF NOT EXISTS referral_config (
        id                  TEXT          PRIMARY KEY DEFAULT 'default',
        reward_per_referral DECIMAL(10,2) NOT NULL DEFAULT 10.0,
        max_referrals_paid  INT           NOT NULL DEFAULT 100,
        trigger_level       INT           NOT NULL DEFAULT 10,
        is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;
    // Spalten nachrüsten falls Tabelle in älterer Version ohne sie erstellt wurde
    await sql`ALTER TABLE referral_config ADD COLUMN IF NOT EXISTS trigger_level      INT           NOT NULL DEFAULT 10`;
    await sql`ALTER TABLE referral_config ADD COLUMN IF NOT EXISTS max_referrals_paid INT           NOT NULL DEFAULT 100`;
    await sql`ALTER TABLE referral_config ADD COLUMN IF NOT EXISTS is_active          BOOLEAN       NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE referral_config ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()`;
    await sql`INSERT INTO referral_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`;
    const [stats, config] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int                                                                AS total_invited,
          COUNT(*) FILTER (WHERE reward_paid = TRUE)::int                             AS paid_referrals,
          COALESCE(SUM(reward_amount) FILTER (WHERE triggered_at IS NOT NULL AND reward_paid = FALSE), 0)::numeric AS claimable_amount,
          COUNT(*) FILTER (WHERE triggered_at IS NOT NULL AND reward_paid = FALSE)::int AS claimable_count
        FROM user_referrals
        WHERE LOWER(TRIM(referrer_wallet)) = LOWER(TRIM(${wallet}))
      `.catch(() => [{ total_invited: 0, paid_referrals: 0, claimable_amount: 0, claimable_count: 0 }]),
      sql`
        SELECT reward_per_referral, max_referrals_paid, trigger_level, is_active
        FROM referral_config WHERE id = 'default' LIMIT 1
      `,
    ]);

    return NextResponse.json({
      totalInvited:      Number(stats[0]?.total_invited    ?? 0),
      paidReferrals:     Number(stats[0]?.paid_referrals   ?? 0),
      claimableAmount:   Number(stats[0]?.claimable_amount ?? 0),
      claimableCount:    Number(stats[0]?.claimable_count  ?? 0),
      triggerLevel:      Number(config[0]?.trigger_level       ?? 10),
      rewardPerReferral: Number(config[0]?.reward_per_referral ?? 10),
      maxReferralsPaid:  Number(config[0]?.max_referrals_paid  ?? 100),
      isActive:          Boolean(config[0]?.is_active ?? true),
      _walletQueried:    wallet, // Debug: zum Vergleich mit DB-Einträgen
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
