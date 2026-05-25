import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getReputationLevels } from '../../../lib/questDb';

/**
 * GET /api/reputation/bonus-estimate?artistWallet=...&rewardAmount=...&maxCompletions=...
 *
 * Berechnet einen Richtwert für das Bonus-Budget beim Quest-Erstellen.
 * Strategie "+1 Level": Für jeden Fan wird der Bonus-% des NÄCHSTEN Levels verwendet
 * (konservativer Puffer, da Fans während des Quests aufsteigen können).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');
  const rewardAmount = Number(searchParams.get('rewardAmount') ?? 0);
  const maxCompletions = Number(searchParams.get('maxCompletions') ?? 10);

  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
  }

  try {
    const sql = getDb();
    const levels = await getReputationLevels(artistWallet);
    const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);

    // Alle Fans mit Reputation bei diesem Artist laden
    const fans = await sql`
      SELECT reputation FROM user_reputation
      WHERE artist_wallet = ${artistWallet.toLowerCase()}
    `;

    let weightedBonusSum = 0;
    const fanCount = fans.length;

    for (const fan of fans) {
      const rep = Number(fan.reputation);

      // Aktuelles Level bestimmen
      let currentIdx = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (rep >= sorted[i].minReputation) currentIdx = i;
        else break;
      }

      // +1 Level (Schwelle nach oben) – falls bereits max, bleibt Level gleich
      const nextIdx = Math.min(currentIdx + 1, sorted.length - 1);
      const bonusPercent = sorted[nextIdx].questRewardBonusPercent ?? 0;
      weightedBonusSum += bonusPercent;
    }

    // Wenn keine Fans vorhanden: Level-2-Bonus als Schätzung (neue Fans)
    const estimatedBonusPercent = fanCount > 0
      ? Math.round(weightedBonusSum / fanCount * 10) / 10
      : (sorted[1]?.questRewardBonusPercent ?? 5);

    const estimatedBonusBudget = rewardAmount > 0 && maxCompletions > 0
      ? Math.ceil(rewardAmount * maxCompletions * estimatedBonusPercent / 100)
      : 0;

    // Level-Verteilung für Anzeige aufbereiten
    const levelDistribution: { levelNumber: number; levelName: string; bonusPercent: number; fanCount: number }[] = [];
    if (fanCount > 0) {
      const countByLevel: Record<number, number> = {};
      for (const fan of fans) {
        const rep = Number(fan.reputation);
        let currentIdx = 0;
        for (let i = 0; i < sorted.length; i++) {
          if (rep >= sorted[i].minReputation) currentIdx = i;
          else break;
        }
        const levelNumber = sorted[currentIdx].levelNumber;
        countByLevel[levelNumber] = (countByLevel[levelNumber] ?? 0) + 1;
      }
      for (const lvl of sorted) {
        const count = countByLevel[lvl.levelNumber] ?? 0;
        if (count > 0) {
          levelDistribution.push({
            levelNumber: lvl.levelNumber,
            levelName: lvl.levelName,
            bonusPercent: lvl.questRewardBonusPercent,
            fanCount: count,
          });
        }
      }
    }

    return NextResponse.json({
      estimatedBonusPercent,
      estimatedBonusBudget,
      fanCount,
      levelDistribution,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
