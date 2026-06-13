/**
 * POST /api/referral/claim
 * Body: { wallet: string }
 * Zahlt alle ausstehenden Referral-Rewards an den Referrer aus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { addDfaithCredits } from '../../../lib/questDb/credits';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { wallet?: string };
    const wallet = body.wallet?.toLowerCase().trim();
    if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

    const sql = getDb();

    // Alle abholbaren Referral-Einträge holen (triggered, aber noch nicht paid)
    const rows = await sql`
      SELECT id, reward_amount FROM user_referrals
      WHERE referrer_wallet = ${wallet}
        AND triggered_at IS NOT NULL
        AND reward_paid = FALSE
        AND reward_amount > 0
    `;

    if (rows.length === 0) {
      return NextResponse.json({ claimed: 0, total: 0 });
    }

    const totalAmount = rows.reduce((sum, r) => sum + Number(r.reward_amount), 0);
    const ids = rows.map(r => r.id as number);

    // Credits auszahlen
    await addDfaithCredits(wallet, totalAmount);

    // Alle als bezahlt markieren
    await sql`
      UPDATE user_referrals
      SET reward_paid = TRUE
      WHERE id = ANY(${ids}::int[])
    `;

    return NextResponse.json({ claimed: rows.length, total: totalAmount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
