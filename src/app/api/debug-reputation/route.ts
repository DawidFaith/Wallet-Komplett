import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { getTopFanBonusPcts, getReputationLevels, reputationToLevel } from '../../lib/questDb';

export const dynamic = 'force-dynamic';

// GET /api/debug-reputation?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const sql = getDb();
  const w = wallet.toLowerCase();

  const [rawRows, levels] = await Promise.all([
    sql`
      SELECT wallet_address, reputation
      FROM user_reputation
      WHERE artist_wallet = ${w}
      ORDER BY reputation DESC
    `,
    getReputationLevels(w),
  ]);

  // Für jeden Fan: Level-Anzeige UND Bonus-Prozentsatz berechnen
  const fansWithLevel = (rawRows as { wallet_address: string; reputation: string | number }[]).map((r) => {
    const rep = Number(r.reputation);
    const { level, levelName, questRewardBonusPercent: _ } = reputationToLevel(rep, levels) as any;
    const lvlData = levels.find(l => l.levelNumber === level);
    const bonusPct = lvlData?.questRewardBonusPercent ?? 0;
    return {
      wallet: r.wallet_address,
      reputation: rep,
      level,
      levelName,
      bonusPct,
    };
  });

  const topPcts = await getTopFanBonusPcts(w, 100);

  // Simuliere die Reserve-Berechnung für verschiedene maxParticipants
  const simulate = [1, 3, 5, 10].map((n) => {
    const slice = topPcts.slice(0, n);
    const sum = slice.reduce((s, pct) => s + 10 * pct / 100, 0);
    return { maxParticipants: n, topBonusPcts: slice, reserveFor10Reward: Math.round(sum * 1.02 * 100) / 100 };
  });

  return NextResponse.json({
    artistWallet: w,
    fanCount: rawRows.length,
    fans: fansWithLevel,
    levelConfig: {
      isCustom: levels.length !== 100,
      totalLevels: levels.length,
      first5Levels: levels.slice(0, 5).map(l => ({ n: l.levelNumber, min: l.minReputation, bonus: l.questRewardBonusPercent })),
      last5Levels: levels.slice(-5).map(l => ({ n: l.levelNumber, min: l.minReputation, bonus: l.questRewardBonusPercent })),
    },
    topFanBonusPcts: topPcts,
    simulation: simulate,
  });
}
