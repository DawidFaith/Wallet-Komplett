/**
 * GET /api/referral/stats?wallet=xxx
 * Gibt Referral-Statistiken für einen User zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase().trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const sql = getDb();
  try {
    const [stats, config] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int                                          AS total_invited,
          COUNT(*) FILTER (WHERE reward_paid = TRUE)::int       AS paid_referrals
        FROM user_referrals
        WHERE referrer_wallet = ${wallet}
      `.catch(() => [{ total_invited: 0, paid_referrals: 0 }]),
      sql`
        SELECT reward_per_referral, max_referrals_paid, trigger_level, is_active
        FROM referral_config WHERE id = 'default' LIMIT 1
      `.catch(() => []),
    ]);

    return NextResponse.json({
      totalInvited:      Number(stats[0]?.total_invited  ?? 0),
      paidReferrals:     Number(stats[0]?.paid_referrals ?? 0),
      triggerLevel:      Number(config[0]?.trigger_level      ?? 10),
      rewardPerReferral: Number(config[0]?.reward_per_referral ?? 10),
      maxReferralsPaid:  Number(config[0]?.max_referrals_paid  ?? 100),
      isActive:          Boolean(config[0]?.is_active ?? true),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
