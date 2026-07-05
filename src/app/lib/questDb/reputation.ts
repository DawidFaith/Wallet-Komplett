import { unstable_noStore as noStore } from 'next/cache';
import { getDb } from '../db';
import { addDfaithCredits, redeemDfaithCredits, savePendingReward } from './credits';
import { addShard } from './collectibles';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── Reputation ───────────────────────────────────────────────────────────────

// ─── Level-Skalierung (100 Level, linearer Bonus) ────────────────────────────
// Formel: minReputation(n) = 40 * (n - 1)^2
// Bonus:  questRewardBonusPercent(n) = n - 1     (Level 1 = 0 %, Level 100 = 99 %)
//
// 10 Tiers à 10 Sub-Level (Newcomer 1 … Legend 10). Quadratische Kurve:
// motivierend früh, realistisch fordernd zum Ende – Top-Tier in Jahren erreichbar.
//
//   Aktiver Fan (~300 REP/Tag, IG-only):
//     L5  ≈    640 REP   →  ~2 Tage
//     L10 ≈  3 240 REP   →  ~11 Tage
//     L20 ≈ 14 440 REP   →  ~7 Wochen
//     L25 ≈ 23 040 REP   →  ~2,5 Monate
//     L50 ≈ 96 040 REP   →  ~10,7 Monate
//     L75 ≈ 218 960 REP  →  ~2 Jahre
//     L100 ≈ 392 040 REP →  ~3,6 Jahre
//
//   Super Fan (~1 000 REP/Tag, alle Plattformen):
//     L50 in ~3 Monaten, L100 in ~13 Monaten
// ─────────────────────────────────────────────────────────────────────────────
const LEVEL_TIER_NAMES = [
  'Newcomer', 'Follower', 'Fan', 'Supporter', 'Loyalist',
  'True Fan', 'Advocate', 'VIP', 'Elite', 'Legend',
];

function buildDefaultReputationLevels(): ReputationLevel[] {
  return Array.from({ length: 100 }, (_, i) => {
    const levelNumber = i + 1;
    const tier = LEVEL_TIER_NAMES[Math.floor(i / 10)];
    const subLevel = (i % 10) + 1;
    return {
      levelNumber,
      levelName: `${tier} ${subLevel}`,
      minReputation: 40 * Math.pow(levelNumber - 1, 2),
      prizeDescription: '',
      creditReward: 0,
      maxRecipients: 0,
      questRewardBonusPercent: levelNumber - 1,
    };
  });
}

export const DEFAULT_REPUTATION_LEVELS: ReputationLevel[] = buildDefaultReputationLevels();

/** Reputation eines Users für einen Artist erhöhen + Level-Up Credits auszahlen */
export async function addUserReputation(
  walletAddress: string,
  artistWallet: string,
  amount: number,
): Promise<void> {
  noStore(); // alle DB-Reads hier immer frisch (kein Next.js Fetch-Cache)
  const sql = getDb();
  const rounded = Math.max(0, Math.round(amount));
  if (rounded <= 0) return;
  // Alte Reputation + Level-Config laden
  const [repRows, levels] = await Promise.all([
    sql`SELECT reputation FROM user_reputation WHERE wallet_address = ${walletAddress.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()} LIMIT 1`,
    getReputationLevels(artistWallet),
  ]);
  const oldRep = repRows.length > 0 ? Number(repRows[0].reputation) : 0;
  const newRep = oldRep + rounded;
  const oldLevel = reputationToLevel(oldRep, levels).level;
  const newLevel = reputationToLevel(newRep, levels).level;

  // Reputation updaten
  await sql`
    INSERT INTO user_reputation (wallet_address, artist_wallet, reputation, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${artistWallet.toLowerCase()}, ${rounded}, NOW())
    ON CONFLICT (wallet_address, artist_wallet) DO UPDATE SET
      reputation = user_reputation.reputation + ${rounded},
      updated_at = NOW()
  `;

  // Level-Up: Credits für alle überschrittenen Level auszahlen
  if (newLevel > oldLevel) {
    for (const lvl of levels) {
      if (lvl.levelNumber > oldLevel && lvl.levelNumber <= newLevel && lvl.creditReward > 0 && lvl.maxRecipients > 0) {
        try {
          // Freien Platz prüfen + Zähler atomar erhöhen
          const updated = await sql`
            UPDATE reputation_levels
            SET recipients_count = recipients_count + 1, updated_at = NOW()
            WHERE artist_wallet = ${artistWallet.toLowerCase()}
              AND level_number = ${lvl.levelNumber}
              AND recipients_count < max_recipients
            RETURNING recipients_count
          `;
          if (updated.length > 0) {
            // Level-Up Reward zum manuellen Abholen speichern (User claimed selbst)
            await savePendingReward({
              walletAddress,
              amount: lvl.creditReward,
              reason: `level_reward:${artistWallet.toLowerCase()}:${lvl.levelNumber}:${lvl.levelName}`,
              questId: null,
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // Fehler überspringen
        }
      }
    }

    // Referral-Reward: beim erstmaligen Überschreiten des trigger_level
    // prüfen wir artistübergreifend (höchstes Level des Users zählt)
    try {
      // Referral-Konfiguration laden
      const cfgRows = await sql`
        SELECT reward_per_referral, max_referrals_paid, trigger_level, is_active
        FROM referral_config WHERE id = 'default' LIMIT 1
      `;
      const cfg = cfgRows[0];
      // Trigger: User hat trigger_level erreicht (oder war schon drüber) UND Referral noch nicht ausgelöst
      // Bedingung OHNE oldLevel-Check, damit auch nachträglich bei bereits überschrittenem Level getriggert wird.
      // Das UPDATE mit AND triggered_at IS NULL verhindert Doppel-Trigger.
      if (cfg && Boolean(cfg.is_active) && newLevel >= Number(cfg.trigger_level)) {
          // Referral-Eintrag suchen (referred_wallet = dieser User, noch nicht getriggert)
          const refRows = await sql`
            SELECT id, referrer_wallet FROM user_referrals
            WHERE referred_wallet = ${walletAddress.toLowerCase()}
              AND reward_paid = FALSE
              AND triggered_at IS NULL
            LIMIT 1
          `;
          if (refRows.length > 0) {
            const ref = refRows[0];
            const referrerWallet = ref.referrer_wallet as string;
            // Prüfen ob Referrer max_referrals_paid nicht überschritten hat
            const paidCount = await sql`
              SELECT COUNT(*)::int AS cnt FROM user_referrals
              WHERE referrer_wallet = ${referrerWallet} AND reward_paid = TRUE
            `;
            const paid = Number(paidCount[0]?.cnt ?? 0);
            if (paid < Number(cfg.max_referrals_paid)) {
              const rewardAmt = Number(cfg.reward_per_referral);
              // triggered_at setzen — Reward wird vom User manuell abgeholt
              await sql`
                UPDATE user_referrals
                SET reward_amount = ${rewardAmt}, triggered_at = NOW()
                WHERE id = ${ref.id as number} AND triggered_at IS NULL
              `;
            }
          }
      }
    } catch (refErr) {
      // Referral-Fehler dürfen die Quest-Completion nicht blockieren
      console.error('[addUserReputation] Referral-Trigger-Fehler:', refErr);
    }
  }
}

/** Reputation-Level-Konfiguration eines Artists laden (Fallback: Standardlevel) */
export async function getReputationLevels(artistWallet: string): Promise<ReputationLevel[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT level_number, level_name, min_reputation, prize_description, credit_reward, max_recipients, quest_reward_bonus_percent
    FROM reputation_levels
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY level_number ASC
  `;
  if (rows.length === 0) return DEFAULT_REPUTATION_LEVELS;
  return rows.map((r) => ({
    levelNumber: Number(r.level_number),
    levelName: String(r.level_name),
    minReputation: Number(r.min_reputation),
    prizeDescription: String(r.prize_description ?? ''),
    creditReward: Number(r.credit_reward ?? 0),
    maxRecipients: Number(r.max_recipients ?? 0),
    questRewardBonusPercent: Number(r.quest_reward_bonus_percent ?? 0),
  }));
}

/** Level-Konfiguration eines Artists speichern – Credits für Rewards sofort reservieren */
export async function saveReputationLevels(
  artistWallet: string,
  levels: ReputationLevel[],
): Promise<void> {
  const sql = getDb();
  const wallet = artistWallet.toLowerCase();

  // Alte Level laden (inkl. recipients_count zum Berechnen des noch verfügbaren Budgets)
  const oldRows = await sql`
    SELECT level_number, credit_reward, max_recipients, recipients_count
    FROM reputation_levels
    WHERE artist_wallet = ${wallet}
  `;

  type OldRow = { level_number: unknown; credit_reward: unknown; max_recipients: unknown; recipients_count: unknown };
  const oldByLevel = new Map<number, OldRow>(
    (oldRows as OldRow[]).map((r) => [Number(r.level_number), r])
  );
  const newLevelNums = new Set(levels.map((l) => l.levelNumber));

  // Netto-Kosten berechnen (positiv = abziehen, negativ = rückerstatten)
  let netCost = 0;

  // Gelöschte Level rückerstatten
  for (const [lvlNum, r] of oldByLevel) {
    if (!newLevelNums.has(lvlNum)) {
      const remaining = Math.max(
        0,
        (Number(r.max_recipients) - Number(r.recipients_count)) * Number(r.credit_reward),
      );
      netCost -= remaining;
    }
  }

  // Neue / geänderte Level
  for (const lvl of levels) {
    const creditReward   = Math.max(0, Math.round(Number(lvl.creditReward)   || 0));
    const maxRecipients  = Math.max(0, Math.round(Number(lvl.maxRecipients)  || 0));
    const newTotal = creditReward * maxRecipients;

    if (oldByLevel.has(lvl.levelNumber)) {
      const old = oldByLevel.get(lvl.levelNumber)!;
      const oldRemaining = Math.max(
        0,
        (Number(old.max_recipients) - Number(old.recipients_count)) * Number(old.credit_reward),
      );
      netCost += newTotal - oldRemaining;
    } else {
      netCost += newTotal;
    }
  }

  if (netCost > 0) {
    await redeemDfaithCredits(wallet, netCost); // wirft selbst wenn nicht genug Guthaben
  } else if (netCost < 0) {
    await addDfaithCredits(wallet, -netCost);
  }

  // Gelöschte Level entfernen
  for (const [lvlNum] of oldByLevel) {
    if (!newLevelNums.has(lvlNum)) {
      await sql`DELETE FROM reputation_levels WHERE artist_wallet = ${wallet} AND level_number = ${lvlNum}`;
    }
  }

  // Neue / geänderte Level per UPSERT einfügen (recipients_count beibehalten)
  for (const lvl of levels) {
    const creditReward        = Math.max(0, Math.round(Number(lvl.creditReward)            || 0));
    const maxRecipients       = Math.max(0, Math.round(Number(lvl.maxRecipients)           || 0));
    const questBonusPercent   = Math.min(100, Math.max(0, Math.round(Number(lvl.questRewardBonusPercent) || 0)));
    await sql`
      INSERT INTO reputation_levels
        (artist_wallet, level_number, level_name, min_reputation, prize_description, credit_reward, max_recipients, recipients_count, quest_reward_bonus_percent, updated_at)
      VALUES
        (${wallet}, ${lvl.levelNumber}, ${lvl.levelName}, ${lvl.minReputation}, ${lvl.prizeDescription}, ${creditReward}, ${maxRecipients}, 0, ${questBonusPercent}, NOW())
      ON CONFLICT (artist_wallet, level_number) DO UPDATE SET
        level_name                  = EXCLUDED.level_name,
        min_reputation              = EXCLUDED.min_reputation,
        prize_description           = EXCLUDED.prize_description,
        credit_reward               = EXCLUDED.credit_reward,
        max_recipients              = EXCLUDED.max_recipients,
        quest_reward_bonus_percent  = EXCLUDED.quest_reward_bonus_percent,
        updated_at                  = EXCLUDED.updated_at
    `;
  }
}

// ─── Level-Bonus bei Quest-Abschluss ─────────────────────────────────────────

/**
 * Prozentualen Level-Bonus auf einen Quest-Reward auszahlen.
 * Der Bonus wird aus dem allgemeinen D.FAITH-Guthaben des Artists (creatorWallet) entnommen
 * und dem Fan gutgeschrieben. Wenn der Artist nicht genug Guthaben hat, wird 0 zurückgegeben
 * und kein Fehler geworfen (Basisreward wird trotzdem ausgezahlt).
 *
 * @returns Der tatsächlich ausgezahlte Bonusbetrag (0 wenn kein Bonus).
 */
export async function payLevelBonus(
  fanWallet: string,
  artistWallet: string,
  baseReward: number,
  questId?: string,
): Promise<number> {
  if (baseReward <= 0) return 0;
  const sql = getDb();

  // Fan-Reputation für diesen Artist laden
  const repRows = await sql`
    SELECT reputation FROM user_reputation
    WHERE wallet_address = ${fanWallet.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  const reputation = repRows.length > 0 ? Number(repRows[0].reputation) : 0;

  // Level-Konfiguration laden + aktuelles Level bestimmen
  const levels = await getReputationLevels(artistWallet);
  const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);
  let currentLevel: ReputationLevel = sorted[0];
  for (const lvl of sorted) {
    if (reputation >= lvl.minReputation) currentLevel = lvl;
    else break;
  }

  const bonusPercent = currentLevel.questRewardBonusPercent ?? 0;
  if (bonusPercent <= 0) return 0;

  const bonus = Math.round(baseReward * bonusPercent / 100 * 100) / 100;
  if (bonus <= 0) return 0;

  // Zuerst Quest-Bonus-Budget versuchen (wenn questId angegeben)
  if (questId) {
    const fromQuest = await sql`
      UPDATE quests
      SET bonus_budget = bonus_budget - ${bonus}, updated_at = NOW()
      WHERE id = ${questId} AND bonus_budget >= ${bonus}
      RETURNING bonus_budget
    `;
    if (fromQuest.length > 0) {
      await addDfaithCredits(fanWallet, bonus);
      return bonus;
    }
  }

  // Fallback 1: vom allgemeinen Artist-Guthaben abziehen
  const deducted = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${bonus}, updated_at = NOW()
    WHERE wallet_address = ${artistWallet.toLowerCase()} AND balance >= ${bonus}
    RETURNING balance
  `;
  if (deducted.length > 0) {
    await addDfaithCredits(fanWallet, bonus);
    return bonus;
  }

  // Fallback 2: aus dem Quest-Locked-Budget (Überschuss, der für verbleibende Abschlüsse nicht benötigt wird)
  if (questId) {
    const fromLocked = await sql`
      UPDATE quests
      SET credits_locked = credits_locked - ${bonus}, updated_at = NOW()
      WHERE id = ${questId}
        AND credits_locked - ${bonus} >= (max_completions - completions) * reward_amount
      RETURNING credits_locked
    `;
    if (fromLocked.length > 0) {
      await addDfaithCredits(fanWallet, bonus);
      return bonus;
    }
  }

  return 0;
}

/**
 * Gibt den höchsten Quest-Reward-Bonus-Prozentsatz zurück, den irgendein Fan
 * dieses Artists aktuell hält (basierend auf ihrer gespeicherten Reputation).
 * Wird für die Level-Bonus-Reserve-Berechnung beim Bundle-Erstellen verwendet.
 * Gibt 0 zurück wenn noch kein Fan Reputation hat.
 */
export async function getMaxFanBonusPct(artistWallet: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT MAX(reputation) AS max_rep FROM user_reputation
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
  `;
  const maxRep = rows.length > 0 ? Number(rows[0].max_rep ?? 0) : 0;
  if (maxRep <= 0) return 0;

  const levels = await getReputationLevels(artistWallet);
  const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);
  let bonusPct = 0;
  for (const lvl of sorted) {
    if (maxRep >= lvl.minReputation) bonusPct = lvl.questRewardBonusPercent;
    else break;
  }
  return bonusPct;
}

/**
 * Gibt die Bonus-Prozentsätze der Top-N Fans dieses Artists zurück (absteigende Reputation).
 * Wird für die präzise Level-Bonus-Reserve-Berechnung beim Bundle-Erstellen verwendet:
 *   reserve = Σ(rewardPerFan × bonusPct[fan] / 100) × 1.02
 */
export async function getTopFanBonusPcts(
  artistWallet: string,
  limit: number,
): Promise<number[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT reputation FROM user_reputation
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY reputation DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];

  const levels = await getReputationLevels(artistWallet);
  const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);

  return (rows as { reputation: string | number }[]).map((r) => {
    const rep = Number(r.reputation);
    let bonusPct = 0;
    for (const lvl of sorted) {
      if (rep >= lvl.minReputation) bonusPct = lvl.questRewardBonusPercent;
      else break;
    }
    return bonusPct;
  });
}

// ─── Reputation Contest ────────────────────────────────────────────────────────

/** Aktiven Contest eines Artists laden */
export async function getActiveReputationContest(artistWallet: string): Promise<ReputationContest | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, artist_wallet, end_date, distributed, created_at
    FROM reputation_contests
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  const prizes = await sql`
    SELECT rank, credit_reward, shard_reward FROM reputation_contest_prizes
    WHERE contest_id = ${row.id}
    ORDER BY rank ASC
  `;
  return {
    id: row.id as string,
    artistWallet: row.artist_wallet as string,
    endDate: row.end_date instanceof Date ? row.end_date.toISOString() : String(row.end_date),
    distributed: Boolean(row.distributed),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    prizes: prizes.map(p => ({ rank: Number(p.rank), creditReward: Number(p.credit_reward), shardReward: Number(p.shard_reward ?? 0) })),
  };
}

/** Contest erstellen / ersetzen */
export async function upsertReputationContest(
  artistWallet: string,
  endDate: Date,
  prizes: { rank: number; creditReward: number; shardReward?: number }[],
): Promise<string> {
  const sql = getDb();
  const wallet = artistWallet.toLowerCase();

  // Alten Contest laden – falls nicht verteilt, gesperrte Credits zurückbuchen
  const oldContests = await sql`
    SELECT id, credits_locked, distributed FROM reputation_contests
    WHERE artist_wallet = ${wallet}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (oldContests.length > 0 && !oldContests[0].distributed) {
    const refund = Number(oldContests[0].credits_locked ?? 0);
    if (refund > 0) {
      await addDfaithCredits(wallet, refund);
    }
  }
  // Alten Contest löschen
  await sql`DELETE FROM reputation_contests WHERE artist_wallet = ${wallet}`;

  // Gesamtkosten berechnen und sofort abziehen (nur Credits werden upfront gesperrt; Shards sind gratis)
  const validPrizes = prizes.filter(p => p.creditReward > 0 || (p.shardReward ?? 0) > 0);
  const totalCost = validPrizes.reduce((sum, p) => sum + p.creditReward, 0);
  if (totalCost > 0) {
    await redeemDfaithCredits(wallet, totalCost); // wirft selbst wenn nicht genug Guthaben
  }

  const rows = await sql`
    INSERT INTO reputation_contests (artist_wallet, end_date, credits_locked)
    VALUES (${wallet}, ${endDate}, ${totalCost})
    RETURNING id
  `;
  const contestId = rows[0].id as string;
  for (const p of validPrizes) {
    await sql`
      INSERT INTO reputation_contest_prizes (contest_id, rank, credit_reward, shard_reward)
      VALUES (${contestId}, ${p.rank}, ${p.creditReward}, ${p.shardReward ?? 0})
    `;
  }

  // Aktuellen Ruf aller User dieses Artists als Startwert snapshoten
  // → jeder startet im Contest bei 0, nur neuer REP zählt
  await sql`
    INSERT INTO reputation_contest_snapshots (contest_id, wallet_address, reputation_at_start)
    SELECT ${contestId}, wallet_address, reputation
    FROM user_reputation
    WHERE artist_wallet = ${wallet}
    ON CONFLICT (contest_id, wallet_address) DO NOTHING
  `;

  return contestId;
}

/** Contest-Rewards verteilen: Credits vom Artist an Top-Fans */
export async function distributeReputationContest(
  contestId: string,
  artistWallet: string,
  force = false,
): Promise<{ rank: number; walletAddress: string; credited: number }[]> {
  const sql = getDb();
  // Prüfen ob Contest existiert, undistributed und abgelaufen
  const contestRows = await sql`
    SELECT end_date, distributed FROM reputation_contests
    WHERE id = ${contestId} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  if (contestRows.length === 0) throw new Error('Contest nicht gefunden');
  if (contestRows[0].distributed) throw new Error('Bereits verteilt');
  const endDate = contestRows[0].end_date instanceof Date ? contestRows[0].end_date : new Date(contestRows[0].end_date as string);
  if (!force && endDate > new Date()) throw new Error('Contest läuft noch');

  const prizes = await sql`
    SELECT rank, credit_reward, shard_reward FROM reputation_contest_prizes
    WHERE contest_id = ${contestId}
    ORDER BY rank ASC
  `;
  if (prizes.length === 0) throw new Error('Keine Preise definiert');

  const maxRank = Math.max(...prizes.map(p => Number(p.rank)));
  const leaderboard = await getContestLeaderboard(contestId, artistWallet, maxRank);

  const results: { rank: number; walletAddress: string; credited: number }[] = [];
  for (const prize of prizes) {
    const rank = Number(prize.rank);
    const creditReward = Number(prize.credit_reward);
    const shardReward = Number(prize.shard_reward ?? 0);
    const winner = leaderboard.find(e => e.rank === rank);
    if (!winner || (creditReward <= 0 && shardReward <= 0)) continue;
    try {
      if (creditReward > 0) {
        await savePendingReward({
          walletAddress: winner.walletAddress,
          amount: creditReward,
          reason: `contest_reward:${artistWallet.toLowerCase()}:${contestId}:${rank}`,
          questId: null,
          createdAt: new Date().toISOString(),
        });
      }
      if (shardReward > 0) {
        await addShard(winner.walletAddress, artistWallet.toLowerCase(), shardReward).catch(() => {});
      }
      results.push({ rank, walletAddress: winner.walletAddress, credited: creditReward });
    } catch {
      // Fehler beim Speichern – überspringen
    }
  }

  // Nicht vergebene Preise an Artist zurücküberweisen
  const totalAwarded = results.reduce((sum, r) => sum + r.credited, 0);
  const lockedRows = await sql`SELECT credits_locked FROM reputation_contests WHERE id = ${contestId}`;
  const locked = Number(lockedRows[0]?.credits_locked ?? 0);
  const refund = locked - totalAwarded;
  if (refund > 0) {
    await addDfaithCredits(artistWallet.toLowerCase(), refund);
  }

  await sql`UPDATE reputation_contests SET distributed = TRUE WHERE id = ${contestId}`;
  return results;
}

/**
 * Verteilt Leaderboard-Rewards sofort an die aktuellen Top-Fans.
 * Zieht Credits vom Artist ab und fügt sie den Gewinnern hinzu.
 */
export async function distributeLeaderboardRewards(
  artistWallet: string,
  prizes: { rank: number; creditReward: number; shardReward?: number }[],
): Promise<{ rank: number; walletAddress: string; credited: number }[]> {
  const wallet = artistWallet.toLowerCase();
  const total = prizes.reduce((sum, p) => sum + (p.creditReward || 0), 0);
  if (total <= 0 && prizes.every(p => (p.shardReward ?? 0) <= 0)) throw new Error('Keine Preise definiert');

  // Guthaben prüfen
  const sql = getDb();
  if (total > 0) {
    const balRows = await sql`SELECT balance FROM dfaith_credits WHERE wallet_address = ${wallet}`;
    const balance = Number(balRows[0]?.balance ?? 0);
    if (balance < total) throw new Error(`Nicht genug Credits (Guthaben: ${balance}, benötigt: ${total})`);
  }

  const maxRank = Math.max(...prizes.map(p => p.rank));
  const leaderboard = await getReputationLeaderboard(artistWallet, maxRank);

  if (total > 0) await addDfaithCredits(wallet, -total);

  const results: { rank: number; walletAddress: string; credited: number }[] = [];
  let actuallySpent = 0;

  for (const prize of prizes) {
    if (prize.creditReward <= 0 && (prize.shardReward ?? 0) <= 0) continue;
    const winner = leaderboard.find(e => e.rank === prize.rank);
    if (!winner) continue;
    try {
      if (prize.creditReward > 0) {
        await savePendingReward({
          walletAddress: winner.walletAddress,
          amount: prize.creditReward,
          reason: `leaderboard_reward:${artistWallet.toLowerCase()}:${prize.rank}`,
          questId: null,
          createdAt: new Date().toISOString(),
        });
        actuallySpent += prize.creditReward;
      }
      if ((prize.shardReward ?? 0) > 0) {
        await addShard(winner.walletAddress, artistWallet.toLowerCase(), prize.shardReward!).catch(() => {});
      }
      results.push({ rank: prize.rank, walletAddress: winner.walletAddress, credited: prize.creditReward });
    } catch {
      // Überspringen, Refund am Ende
    }
  }

  // Nicht vergebene Credit-Preise zurückerstatten
  const refund = total - actuallySpent;
  if (refund > 0) {
    await addDfaithCredits(wallet, refund);
  }

  return results;
}

/** Liefert Quartal-String + Start/End-Datum für ein Datum (default: heute) */
export function getQuarterInfo(date: Date = new Date()): {
  quarter: string;
  start: Date;
  end: Date;
} {
  const year = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3) + 1;
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { quarter: `${year}-Q${q}`, start, end };
}

/** Quartals-Reward-Konfiguration laden */
export async function getLeaderboardQuarterlyConfig(
  artistWallet: string,
): Promise<{ prizes: { rank: number; creditReward: number; shardReward: number }[]; creditsLocked: number; updatedAt: string | null } | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT prizes, COALESCE(credits_locked, 0) AS credits_locked, updated_at
    FROM leaderboard_quarterly_config
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const raw = rows[0].prizes as { rank: number; creditReward: number; shardReward?: number }[];
  return {
    prizes: raw.map(p => ({ rank: p.rank, creditReward: p.creditReward, shardReward: p.shardReward ?? 0 })),
    creditsLocked: Number(rows[0].credits_locked ?? 0),
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at as string).toISOString() : null,
  };
}

/** Quartals-Reward-Konfiguration speichern / aktualisieren */
export async function upsertLeaderboardQuarterlyConfig(
  artistWallet: string,
  prizes: { rank: number; creditReward: number; shardReward?: number }[],
): Promise<void> {
  const sql = getDb();
  const wallet = artistWallet.toLowerCase();

  // Spalte einmalig hinzufügen falls noch nicht vorhanden
  try {
    await sql`ALTER TABLE leaderboard_quarterly_config ADD COLUMN IF NOT EXISTS credits_locked NUMERIC DEFAULT 0`;
  } catch { /* ignorieren */ }

  // Bereits gesperrte Credits laden
  const old = await getLeaderboardQuarterlyConfig(artistWallet);
  const oldLocked = old?.creditsLocked ?? 0;
  const newTotal = prizes.reduce((s, p) => s + Math.max(0, Math.round(Number(p.creditReward) || 0)), 0);
  const netCost = newTotal - oldLocked;

  if (netCost > 0) {
    await redeemDfaithCredits(wallet, netCost); // wirft bei unzureichendem Guthaben
  } else if (netCost < 0) {
    await addDfaithCredits(wallet, -netCost);
  }

  await sql`
    INSERT INTO leaderboard_quarterly_config (id, artist_wallet, prizes, credits_locked, updated_at)
    VALUES (gen_random_uuid()::text, ${wallet}, ${JSON.stringify(prizes)}::jsonb, ${newTotal}, NOW())
    ON CONFLICT (artist_wallet) DO UPDATE
      SET prizes = EXCLUDED.prizes, credits_locked = EXCLUDED.credits_locked, updated_at = NOW()
  `;
}

/** Quartals-Historie laden */
export async function getLeaderboardQuarterlyHistory(
  artistWallet: string,
): Promise<{ id: string; quarter: string; prizes: { rank: number; creditReward: number; shardReward: number }[]; results: { rank: number; walletAddress: string; credited: number }[]; totalCredited: number; distributedAt: string }[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, quarter, prizes, results, total_credited, distributed_at
    FROM leaderboard_quarterly_history
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY distributed_at DESC
    LIMIT 20
  `;
  return rows.map(r => ({
    id: r.id as string,
    quarter: r.quarter as string,
    prizes: (r.prizes as { rank: number; creditReward: number; shardReward?: number }[]).map(p => ({ rank: p.rank, creditReward: p.creditReward, shardReward: p.shardReward ?? 0 })),
    results: r.results as { rank: number; walletAddress: string; credited: number }[],
    totalCredited: Number(r.total_credited),
    distributedAt: (r.distributed_at as Date).toISOString(),
  }));
}

/**
 * Quartals-Rewards verteilen.
 * force = true: auch wenn Quartal noch nicht abgelaufen
 */
export async function distributeLeaderboardQuarterly(
  artistWallet: string,
  force = false,
): Promise<{ quarter: string; distributed: { rank: number; walletAddress: string; credited: number }[] }> {
  const wallet = artistWallet.toLowerCase();
  const sql = getDb();
  const { quarter, end } = getQuarterInfo();

  if (!force && new Date() < end) {
    throw new Error(`Quartal ${quarter} läuft noch bis ${end.toLocaleDateString('de-DE')}`);
  }

  // Bereits verteilt?
  const already = await sql`
    SELECT id FROM leaderboard_quarterly_history
    WHERE artist_wallet = ${wallet} AND quarter = ${quarter}
    LIMIT 1
  `;
  if (already.length > 0 && !force) {
    throw new Error(`Quartal ${quarter} wurde bereits verteilt`);
  }

  const config = await getLeaderboardQuarterlyConfig(artistWallet);
  if (!config || config.prizes.length === 0) throw new Error('Keine Konfiguration gefunden');

  const validPrizes = config.prizes.filter(p => p.creditReward > 0 || (p.shardReward ?? 0) > 0);
  if (validPrizes.length === 0) throw new Error('Keine Preise konfiguriert');

  const total = validPrizes.reduce((s, p) => s + p.creditReward, 0);
  const creditsLocked = config.creditsLocked;

  // Credits wurden beim Speichern der Konfiguration bereits reserviert.
  // Nur die Differenz abziehen falls Konfiguration mit alter Code-Version gespeichert wurde (creditsLocked = 0).
  const stillNeeded = Math.max(0, total - creditsLocked);
  if (stillNeeded > 0) {
    const balRows = await sql`SELECT balance FROM dfaith_credits WHERE wallet_address = ${wallet}`;
    const balance = Number(balRows[0]?.balance ?? 0);
    if (balance < stillNeeded) throw new Error(`Nicht genug Credits (Guthaben: ${balance.toFixed(2)}, benötigt: ${stillNeeded})`);
    await addDfaithCredits(wallet, -stillNeeded);
  }

  const maxRank = Math.max(...validPrizes.map(p => p.rank));
  const leaderboard = await getReputationLeaderboard(artistWallet, maxRank);

  const results: { rank: number; walletAddress: string; credited: number }[] = [];
  let actuallySpent = 0;

  for (const prize of validPrizes) {
    const winner = leaderboard.find(e => e.rank === prize.rank);
    if (!winner || (prize.creditReward <= 0 && (prize.shardReward ?? 0) <= 0)) continue;
    try {
      if (prize.creditReward > 0) {
        // savePendingReward statt direkter Gutschrift → Gewinner erhalten Benachrichtigung
        await savePendingReward({
          walletAddress: winner.walletAddress,
          amount: prize.creditReward,
          reason: `leaderboard_reward:${wallet}:${prize.rank}`,
          questId: null,
          createdAt: new Date().toISOString(),
        });
        actuallySpent += prize.creditReward;
      }
      if ((prize.shardReward ?? 0) > 0) {
        await addShard(winner.walletAddress, artistWallet.toLowerCase(), prize.shardReward!).catch(() => {});
      }
      results.push({ rank: prize.rank, walletAddress: winner.walletAddress, credited: prize.creditReward });
    } catch { /* überspringen */ }
  }

  // Nicht vergebene Credits aus dem gesperrten Betrag zurückerstatten
  const totalReserved = creditsLocked + stillNeeded;
  const refund = totalReserved - actuallySpent;
  if (refund > 0) await addDfaithCredits(wallet, refund);

  // credits_locked zurücksetzen (Artist muss für nächstes Quartal neu speichern)
  await sql`UPDATE leaderboard_quarterly_config SET credits_locked = 0, updated_at = NOW() WHERE artist_wallet = ${wallet}`;

  // Historie speichern (upsert für force-Fall)
  await sql`
    INSERT INTO leaderboard_quarterly_history
      (id, artist_wallet, quarter, prizes, results, total_credited, distributed_at)
    VALUES (
      gen_random_uuid()::text,
      ${wallet},
      ${quarter},
      ${JSON.stringify(config.prizes)}::jsonb,
      ${JSON.stringify(results)}::jsonb,
      ${actuallySpent},
      NOW()
    )
    ON CONFLICT (artist_wallet, quarter) DO UPDATE
      SET results = EXCLUDED.results,
          total_credited = EXCLUDED.total_credited,
          distributed_at = NOW()
  `;

  return { quarter, distributed: results };
}

/** Berechnet Level und Fortschritt basierend auf Reputation + Level-Config */
export function reputationToLevel(
  reputation: number,
  levels: ReputationLevel[],
): { level: number; levelName: string; nextLevelRep: number | null; progress: number } {
  const sorted = [...levels].sort((a, b) => a.minReputation - b.minReputation);
  let current = sorted[0];
  for (const lvl of sorted) {
    if (reputation >= lvl.minReputation) current = lvl;
    else break;
  }
  const idx = sorted.indexOf(current);
  const next = sorted[idx + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.floor(((reputation - current.minReputation) / (next.minReputation - current.minReputation)) * 100))
    : 100;
  return {
    level: current.levelNumber,
    levelName: current.levelName,
    nextLevelRep: next?.minReputation ?? null,
    progress,
  };
}

/** Reputation eines Users für alle Artists laden */
export async function getUserReputationAll(walletAddress: string): Promise<UserArtistReputation[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT artist_wallet, reputation FROM user_reputation
    WHERE wallet_address = ${walletAddress.toLowerCase()}
    ORDER BY reputation DESC
  `;
  const result: UserArtistReputation[] = [];
  for (const row of rows) {
    const artistWallet = row.artist_wallet as string;
    const reputation = Number(row.reputation);
    const levels = await getReputationLevels(artistWallet);
    const { level, levelName, nextLevelRep, progress } = reputationToLevel(reputation, levels);
    const questRewardBonusPercent = levels.find(l => l.levelNumber === level)?.questRewardBonusPercent ?? 0;
    result.push({ artistWallet, reputation, level, levelName, nextLevelRep, progress, questRewardBonusPercent });
  }
  return result;
}

/** Alle Artists mit der Reputation des Users (0 wenn noch keine vorhanden) */
export async function getAllArtistsWithReputation(walletAddress: string): Promise<UserArtistReputation[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.wallet_address                AS artist_wallet,
      p.display_name,
      p.display_platform,
      p.clerk_image_url,
      p.clerk_name,
      p.instagram_handle, p.instagram_verified, p.instagram_name, p.instagram_picture,
      p.tiktok_handle,    p.tiktok_verified,    p.tiktok_name,    p.tiktok_picture,
      p.facebook_handle,  p.facebook_verified,  p.facebook_name,  p.facebook_picture,
      yb.channel_id          AS youtube_channel_id,
      yb.channel_name        AS youtube_channel_name,
      yb.channel_thumbnail   AS youtube_channel_thumbnail,
      COALESCE(ur.reputation, 0) AS reputation
    FROM user_profiles p
    LEFT JOIN user_reputation ur
      ON  LOWER(ur.artist_wallet)  = LOWER(p.wallet_address)
      AND LOWER(ur.wallet_address) = ${walletAddress.toLowerCase()}
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = p.wallet_address
    WHERE p.is_artist = TRUE AND COALESCE(p.is_platform_user, FALSE) = FALSE
    ORDER BY COALESCE(ur.reputation, 0) DESC, p.display_name ASC
  `;
  const result: UserArtistReputation[] = [];
  for (const row of rows) {
    const artistWallet = row.artist_wallet as string;
    const reputation = Number(row.reputation);
    const levels = await getReputationLevels(artistWallet);
    const { level, levelName, nextLevelRep, progress } = reputationToLevel(reputation, levels);
    let artistName: string | null = (row.display_name as string | null) ?? null;
    let artistPicture: string | null = null;
    const dp = row.display_platform as string | null;
    if (dp === 'youtube' && row.youtube_channel_id) {
      artistName ??= row.youtube_channel_name as string ?? null;
      artistPicture = (row.youtube_channel_thumbnail as string | null) ?? null;
    } else if (dp === 'clerk') {
      artistPicture = (row.clerk_image_url as string | null) ?? null;
      const clerkName = row.clerk_name as string | null;
      if (clerkName) {
        artistName = clerkName;
      } else {
        if (row.instagram_verified && row.instagram_name) artistName ??= row.instagram_name as string;
        else if (row.facebook_verified && row.facebook_name) artistName ??= row.facebook_name as string;
        else if (row.tiktok_verified && row.tiktok_name) artistName ??= row.tiktok_name as string;
        else if (row.youtube_channel_name) artistName ??= row.youtube_channel_name as string;
      }
    } else if (dp === 'instagram' && row.instagram_handle) {
      artistName ??= row.instagram_name as string ?? `@${row.instagram_handle}`;
      artistPicture = (row.instagram_picture as string | null) ?? null;
    } else if (dp === 'tiktok' && row.tiktok_handle) {
      artistName ??= row.tiktok_name as string ?? `@${row.tiktok_handle}`;
      artistPicture = (row.tiktok_picture as string | null) ?? null;
    } else if (dp === 'facebook' && row.facebook_handle) {
      artistName ??= row.facebook_name as string ?? `@${row.facebook_handle}`;
      artistPicture = (row.facebook_picture as string | null) ?? null;
    } else {
      // Fallback: erste verfügbare Plattform
      if (row.youtube_channel_id) {
        artistName ??= row.youtube_channel_name as string ?? null;
        artistPicture = (row.youtube_channel_thumbnail as string | null) ?? null;
      } else if (row.instagram_verified && row.instagram_handle) {
        artistName ??= row.instagram_name as string ?? `@${row.instagram_handle}`;
        artistPicture = (row.instagram_picture as string | null) ?? null;
      } else if (row.tiktok_verified && row.tiktok_handle) {
        artistName ??= row.tiktok_name as string ?? `@${row.tiktok_handle}`;
        artistPicture = (row.tiktok_picture as string | null) ?? null;
      } else if (row.facebook_verified && row.facebook_handle) {
        artistName ??= row.facebook_name as string ?? `@${row.facebook_handle}`;
        artistPicture = (row.facebook_picture as string | null) ?? null;
      }
    }
    result.push({ artistWallet, reputation, level, levelName, nextLevelRep, progress, questRewardBonusPercent: levels.find(l => l.levelNumber === level)?.questRewardBonusPercent ?? 0, artistName, artistPicture });
  }
  return result;
}

/** Reputation eines Users für einen Artist laden */
export async function getUserReputation(walletAddress: string, artistWallet: string): Promise<UserArtistReputation> {
  const sql = getDb();
  const rows = await sql`
    SELECT reputation FROM user_reputation
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  const reputation = rows.length > 0 ? Number(rows[0].reputation) : 0;
  const levels = await getReputationLevels(artistWallet);
  const { level, levelName, nextLevelRep, progress } = reputationToLevel(reputation, levels);
  const currentLevel = levels.find(l => l.levelNumber === level);
  const questRewardBonusPercent = currentLevel?.questRewardBonusPercent ?? 0;
  return { artistWallet, reputation, level, levelName, nextLevelRep, progress, questRewardBonusPercent };
}

/** Reputation-Leaderboard für einen Artist (Top 50) */
export async function getReputationLeaderboard(
  artistWallet: string,
  limit = 50,
): Promise<ReputationLeaderboardEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      ur.wallet_address,
      ur.reputation,
      COALESCE(
        p.display_name,
        p.instagram_name,
        p.tiktok_name,
        p.facebook_name,
        yb.channel_name
      ) AS display_name
    FROM user_reputation ur
    LEFT JOIN user_profiles p  ON p.wallet_address  = ur.wallet_address
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = ur.wallet_address
    WHERE ur.artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY ur.reputation DESC
    LIMIT ${limit}
  `;
  const levels = await getReputationLevels(artistWallet);
  return rows.map((r, i) => {
    const reputation = Number(r.reputation);
    const { level, levelName } = reputationToLevel(reputation, levels);
    return {
      rank: i + 1,
      walletAddress: r.wallet_address as string,
      displayName: r.display_name ?? null,
      reputation,
      level,
      levelName,
    };
  });
}

/** Contest-Leaderboard: nur REP seit Contest-Start zählt (alle starten bei 0) */
export async function getContestLeaderboard(
  contestId: string,
  artistWallet: string,
  limit = 50,
): Promise<ReputationLeaderboardEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      ur.wallet_address,
      ur.reputation - COALESCE(s.reputation_at_start, ur.reputation) AS contest_rep,
      COALESCE(
        p.display_name,
        p.instagram_name,
        p.tiktok_name,
        p.facebook_name,
        yb.channel_name
      ) AS display_name
    FROM user_reputation ur
    LEFT JOIN reputation_contest_snapshots s
      ON s.contest_id = ${contestId} AND s.wallet_address = ur.wallet_address
    LEFT JOIN user_profiles p  ON p.wallet_address  = ur.wallet_address
    LEFT JOIN youtube_bindings yb ON yb.wallet_address = ur.wallet_address
    WHERE ur.artist_wallet = ${artistWallet.toLowerCase()}
      AND ur.reputation - COALESCE(s.reputation_at_start, ur.reputation) > 0
    ORDER BY contest_rep DESC
    LIMIT ${limit}
  `;
  const levels = await getReputationLevels(artistWallet);
  return rows.map((r, i) => {
    const reputation = Number(r.contest_rep);
    const { level, levelName } = reputationToLevel(reputation, levels);
    return {
      rank: i + 1,
      walletAddress: r.wallet_address as string,
      displayName: r.display_name ?? null,
      reputation,
      level,
      levelName,
    };
  });
}

/**
 * Vergabe von Reputation mit automatischem Collectibles-REP-Bonus.
 * Ersatz für addUserReputation in allen Quest-Completion-Routen.
 */
export async function addUserReputationWithBonus(
  walletAddress: string,
  artistWallet: string,
  baseAmount: number,
): Promise<void> {
  const { getCollectiblesRepBonus } = await import('./collectibles');
  const repBonusPct = await getCollectiblesRepBonus(walletAddress, artistWallet).catch(() => 0);
  const boosted = repBonusPct > 0
    ? Math.round(baseAmount * (1 + repBonusPct / 100))
    : baseAmount;
  await addUserReputation(walletAddress, artistWallet, boosted);
}
