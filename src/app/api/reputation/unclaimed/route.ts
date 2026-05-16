import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export const maxDuration = 10;

/**
 * GET /api/reputation/unclaimed?wallet=0x...
 *
 * Gibt alle noch nicht abgeholten Level-Up Rewards einer Wallet zurück.
 * Reason-Format: level_reward:<artistWallet>:<levelNumber>:<levelName>
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase();
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const sql = getDb();
  const rows = await sql`
    SELECT id, amount, reason, created_at
    FROM pending_rewards
    WHERE wallet_address = ${wallet}
      AND status = 'pending'
      AND reason LIKE 'level_reward:%'
    ORDER BY created_at ASC
  `;

  const rewards = rows.map((r) => {
    const parts = String(r.reason).split(':');
    // parts: ['level_reward', artistWallet, levelNumber, ...levelName (may contain :)]
    const artistWallet = parts[1] ?? '';
    const levelNumber = Number(parts[2] ?? 0);
    const levelName = parts.slice(3).join(':');
    return {
      id: String(r.id),
      artistWallet,
      levelNumber,
      levelName,
      amount: Number(r.amount),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  });

  const total = rewards.reduce((s, r) => s + r.amount, 0);
  return NextResponse.json({ total, rewards });
}
