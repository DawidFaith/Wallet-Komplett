import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { getTopFanBonusPcts, getReputationLevels, reputationToLevel } from '../../lib/questDb';
import { getCollectiblesRepBonus, getCollectiblesCreditBonus } from '../../lib/questDb/collectibles';

export const dynamic = 'force-dynamic';

// GET /api/debug-reputation?wallet=0x...
// GET /api/debug-reputation?fanWallet=0x...&artistWallet=0x...  → Collectibles-Bonus-Debug
export async function GET(req: NextRequest) {
  const wallet      = req.nextUrl.searchParams.get('wallet');
  const fanWallet   = req.nextUrl.searchParams.get('fanWallet');
  const artistWallet = req.nextUrl.searchParams.get('artistWallet');

  // ── Collectibles-Bonus-Debug-Modus ───────────────────────────────────────
  if (fanWallet && artistWallet) {
    const sql = getDb();
    const fw = fanWallet.toLowerCase();
    const aw = artistWallet.toLowerCase();

    const [ownedRows, collections, repBonus, creditBonus] = await Promise.all([
      sql`
        SELECT uc.rarity, uc.collection_id, cc.name, cc.max_rep_bonus_percent, cc.max_credit_bonus_percent, cc.primary_bonus
        FROM user_collectibles uc
        JOIN collectible_collections cc ON cc.id = uc.collection_id
        WHERE uc.wallet_address = ${fw} AND cc.artist_wallet = ${aw} AND cc.is_active = true
      `,
      sql`
        SELECT id, name, max_rep_bonus_percent, max_credit_bonus_percent, primary_bonus
        FROM collectible_collections
        WHERE artist_wallet = ${aw} AND is_active = true
      `,
      getCollectiblesRepBonus(fw, aw).catch(() => -1),
      getCollectiblesCreditBonus(fw, aw).catch(() => -1),
    ]);

    return NextResponse.json({
      fanWallet: fw, artistWallet: aw,
      activeCollections: collections.map(c => ({
        id: c.id, name: c.name,
        maxRepBonusPercent: Number(c.max_rep_bonus_percent),
        maxCreditBonusPercent: Number(c.max_credit_bonus_percent),
        primaryBonus: c.primary_bonus,
      })),
      ownedCollectibles: ownedRows.map(r => ({
        collection: r.name, rarity: r.rarity,
        maxRepBonus: Number(r.max_rep_bonus_percent),
        primaryBonus: r.primary_bonus,
      })),
      computedRepBonus: repBonus,
      computedCreditBonus: creditBonus,
    });
  }

  if (!wallet) return NextResponse.json({ error: 'wallet fehlt (oder fanWallet+artistWallet)' }, { status: 400 });

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
