import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { addDfaithCredits } from '@/app/lib/questDb';

export const maxDuration = 20;

/**
 * POST /api/reputation/claim-level-rewards
 * Body: { walletAddress: string }
 *
 * Alle pending Level-Up Rewards abholen:
 *  1. Pending Rows laden
 *  2. DFAITH Credits sofort gutschreiben
 *  3. Rows als 'paid' markieren
 * Gibt { claimed: number, rewards: [...] } zurück.
 */
export async function POST(req: NextRequest) {
  let walletAddress: string;
  try {
    const body = await req.json();
    walletAddress = body.walletAddress ?? '';
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  if (!walletAddress || typeof walletAddress !== 'string') {
    return NextResponse.json({ error: 'walletAddress fehlt.' }, { status: 400 });
  }

  const wallet = walletAddress.toLowerCase();
  const sql = getDb();

  // Alle pending Level-Rewards laden + atomar sperren (FOR UPDATE SKIP LOCKED)
  const rows = await sql`
    SELECT id, amount, reason
    FROM pending_rewards
    WHERE wallet_address = ${wallet}
      AND status = 'pending'
      AND reason LIKE 'level_reward:%'
    FOR UPDATE SKIP LOCKED
  `;

  if (rows.length === 0) {
    return NextResponse.json({ claimed: 0, rewards: [] });
  }

  const ids = rows.map((r) => String(r.id));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  // Credits gutschreiben
  await addDfaithCredits(wallet, total);

  // Als bezahlt markieren
  await sql`
    UPDATE pending_rewards
    SET status = 'paid', paid_at = NOW()
    WHERE id = ANY(${ids}::int[])
  `;

  const rewards = rows.map((r) => {
    const parts = String(r.reason).split(':');
    return {
      id: String(r.id),
      artistWallet: parts[1] ?? '',
      levelNumber: Number(parts[2] ?? 0),
      levelName: parts.slice(3).join(':'),
      amount: Number(r.amount),
    };
  });

  return NextResponse.json({ claimed: total, rewards });
}
