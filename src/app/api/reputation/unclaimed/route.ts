import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export const maxDuration = 10;

/**
 * GET /api/reputation/unclaimed?wallet=0x...
 *
 * Gibt alle noch nicht abgeholten Rewards einer Wallet zurück.
 * Unterstützte Reason-Formate:
 *   level_reward:<artistWallet>:<levelNumber>:<levelName>
 *   contest_reward:<artistWallet>:<contestId>:<rank>
 *   leaderboard_reward:<artistWallet>:<rank>
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
      AND (
        reason LIKE 'level_reward:%'
        OR reason LIKE 'contest_reward:%'
        OR reason LIKE 'leaderboard_reward:%'
      )
    ORDER BY created_at ASC
  `;

  const rewards = rows.map((r) => {
    const reason = String(r.reason);
    const parts = reason.split(':');

    let type: 'level' | 'contest' | 'leaderboard' = 'level';
    let artistWallet = '';
    let levelNumber = 0;
    let levelName = '';
    let rank = 0;

    if (reason.startsWith('level_reward:')) {
      type = 'level';
      artistWallet = parts[1] ?? '';
      levelNumber = Number(parts[2] ?? 0);
      levelName = parts.slice(3).join(':');
    } else if (reason.startsWith('contest_reward:')) {
      type = 'contest';
      artistWallet = parts[1] ?? '';
      rank = Number(parts[3] ?? 0);
      levelName = `🏆 Platz #${rank} im Contest`;
    } else if (reason.startsWith('leaderboard_reward:')) {
      type = 'leaderboard';
      artistWallet = parts[1] ?? '';
      rank = Number(parts[2] ?? 0);
      levelName = `🥇 Platz #${rank} im Leaderboard`;
    }

    return {
      id: String(r.id),
      type,
      artistWallet,
      levelNumber,
      levelName,
      rank,
      amount: Number(r.amount),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  });

  const total = rewards.reduce((s, r) => s + r.amount, 0);
  return NextResponse.json({ total, rewards });
}
