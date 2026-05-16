import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { addDfaithCredits } from '@/app/lib/questDb';

export const maxDuration = 20;

/**
 * POST /api/reputation/claim-level-rewards
 * Body: { walletAddress: string }
 *
 * Alle pending Rewards abholen (Level-Up, Contest, Leaderboard):
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

  // Atomar: nur Rows die noch 'pending' sind auf 'paid' setzen und zurückgeben.
  // UPDATE ist von sich aus serialisiert – kein doppeltes Abholen möglich.
  const rows = await sql`
    UPDATE pending_rewards
    SET status = 'paid', paid_at = NOW()
    WHERE wallet_address = ${wallet}
      AND status = 'pending'
      AND (
        reason LIKE 'level_reward:%'
        OR reason LIKE 'contest_reward:%'
        OR reason LIKE 'leaderboard_reward:%'
      )
    RETURNING id, amount, reason
  `;

  if (rows.length === 0) {
    return NextResponse.json({ claimed: 0, rewards: [] });
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  // Credits erst gutschreiben, nachdem die Rows als 'paid' markiert wurden
  await addDfaithCredits(wallet, total);

  const rewards = rows.map((r) => {
    const reason = String(r.reason);
    const parts = reason.split(':');
    let type = 'level', artistWallet = '', levelNumber = 0, levelName = '';
    if (reason.startsWith('level_reward:')) {
      type = 'level'; artistWallet = parts[1] ?? ''; levelNumber = Number(parts[2] ?? 0); levelName = parts.slice(3).join(':');
    } else if (reason.startsWith('contest_reward:')) {
      type = 'contest'; artistWallet = parts[1] ?? ''; levelName = `🏆 Platz #${parts[3] ?? '?'} im Contest`;
    } else if (reason.startsWith('leaderboard_reward:')) {
      type = 'leaderboard'; artistWallet = parts[1] ?? ''; levelName = `🥇 Platz #${parts[2] ?? '?'} im Leaderboard`;
    }
    return { id: String(r.id), type, artistWallet, levelNumber, levelName, amount: Number(r.amount) };
  });

  return NextResponse.json({ claimed: total, rewards });
}
