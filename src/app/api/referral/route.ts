/**
 * POST /api/referral
 * Body: { referrerWallet: string, referredWallet: string }
 * Speichert eine Referral-Beziehung (idempotent).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { referrerWallet?: string; referredWallet?: string };
    const referrerWallet = body.referrerWallet?.toLowerCase().trim();
    const referredWallet = body.referredWallet?.toLowerCase().trim();

    if (!referrerWallet || !referredWallet) {
      return NextResponse.json({ error: 'referrerWallet und referredWallet erforderlich' }, { status: 400 });
    }
    if (referrerWallet === referredWallet) {
      return NextResponse.json({ error: 'Selbst-Referral nicht erlaubt' }, { status: 400 });
    }

    const sql = getDb();
    // Sicherstellen dass Tabelle existiert
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
