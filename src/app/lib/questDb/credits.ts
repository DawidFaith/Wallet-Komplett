import { getDb } from '../db';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── Pending Rewards ──────────────────────────────────────────────────────────

function rowToPendingReward(row: any): PendingReward {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    amount: Number(row.amount),
    reason: row.reason,
    questId: row.quest_id ?? null,
    status: row.status as 'pending' | 'paid',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    paidAt: row.paid_at ? (row.paid_at instanceof Date ? row.paid_at.toISOString() : row.paid_at) : null,
  };
}

/** Neuen ausstehenden Reward speichern */
export async function savePendingReward(reward: Omit<PendingReward, 'id' | 'status' | 'paidAt'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO pending_rewards (wallet_address, amount, reason, quest_id, created_at)
    VALUES (
      ${reward.walletAddress.toLowerCase()},
      ${reward.amount},
      ${reward.reason},
      ${reward.questId},
      ${reward.createdAt}
    )
  `;
}

/** Alle ausstehenden Rewards einer Wallet laden */
export async function loadPendingRewardsByWallet(walletAddress: string): Promise<PendingReward[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM pending_rewards
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND status = 'pending'
    ORDER BY created_at DESC
  `;
  return rows.map(rowToPendingReward);
}

/** Gesamtsumme aller ausstehenden Rewards einer Wallet */
export async function getPendingRewardTotal(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM pending_rewards
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND status = 'pending'
  `;
  return Number(rows[0]?.total ?? 0);
}

// ─── Creator Balance ──────────────────────────────────────────────────────────

/** Aktuelles Guthaben eines Creators laden */
export async function getCreatorBalance(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT balance FROM creator_balances WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

/**
 * DFAITH-Einzahlung eines Creators gutschreiben.
 * tx_hash ist UNIQUE – verhindert Doppel-Gutschriften.
 * Gleichzeitig werden die Dfaith Credits des Creators erhöht.
 */
export async function creditCreatorBalance(
  walletAddress: string,
  amount: number,
  txHash: string,
): Promise<void> {
  const sql = getDb();
  // Deposit-Record anlegen (UNIQUE tx_hash wirft bei Duplikat)
  await sql`
    INSERT INTO creator_deposits (wallet_address, tx_hash, amount)
    VALUES (${walletAddress.toLowerCase()}, ${txHash.toLowerCase()}, ${amount})
  `;
  // creator_balances aufstocken
  await sql`
    INSERT INTO creator_balances (wallet_address, balance, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      balance    = creator_balances.balance + EXCLUDED.balance,
      updated_at = NOW()
  `;
  // Dfaith Credits aufstocken
  await addDfaithCredits(walletAddress, amount);
}

/** Guthaben eines Creators reduzieren (z.B. nach Quest-Abschluss) */
export async function debitCreatorBalance(walletAddress: string, amount: number): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  // Dfaith Credits des Creators ebenfalls reduzieren (hält beide Werte synchron)
  await sql`
    UPDATE dfaith_credits
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
}

// ─── Dfaith Credits (Unified Balance) ────────────────────────────────────────

/** Aktuelles Dfaith-Credits-Guthaben laden */
export async function getDfaithCredits(walletAddress: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT balance FROM dfaith_credits WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

/** Dfaith Credits hinzufügen (Fan-Reward oder Creator-Deposit) */
export async function addDfaithCredits(walletAddress: string, amount: number): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO dfaith_credits (wallet_address, balance, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      balance    = dfaith_credits.balance + EXCLUDED.balance,
      updated_at = NOW()
  `;
}

/**
 * Dfaith Credits einlösen: Guthaben reduzieren.
 * Gibt neues Guthaben zurück. Wirft wenn nicht genug Credits vorhanden.
 */
export async function redeemDfaithCredits(walletAddress: string, amount: number): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND balance >= ${amount}
    RETURNING balance
  `;
  if (rows.length === 0) {
    throw new Error('Nicht genug Dfaith Credits');
  }
  // Auch creator_balances reduzieren damit beide Tabellen synchron bleiben
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  return Number(rows[0].balance);
}

// ── Reputation Reward Pool ────────────────────────────────────────────────────

/** Aktuellen Pool-Stand eines Artists laden */
export async function getReputationPool(artistWallet: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT balance FROM reputation_reward_pool
    WHERE artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

/**
 * Budget in den Reward-Pool einzahlen:
 * Sofortiger Abzug vom Künstler-Guthaben + Gutschrift auf den Pool.
 * Gibt false zurück wenn nicht genug Guthaben vorhanden.
 */
export async function depositReputationPool(artistWallet: string, amount: number): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dfaith_credits
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE wallet_address = ${artistWallet.toLowerCase()} AND balance >= ${amount}
    RETURNING balance
  `;
  if (rows.length === 0) return false;
  await sql`
    UPDATE creator_balances
    SET balance = GREATEST(0, balance - ${amount}), updated_at = NOW()
    WHERE wallet_address = ${artistWallet.toLowerCase()}
  `;
  await sql`
    INSERT INTO reputation_reward_pool (artist_wallet, balance, updated_at)
    VALUES (${artistWallet.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (artist_wallet) DO UPDATE SET
      balance    = reputation_reward_pool.balance + ${amount},
      updated_at = NOW()
  `;
  return true;
}

/**
 * Claim-Sperre setzen: verhindert gleichzeitige Einlösungen für dieselbe Wallet.
 * Gibt true zurück wenn die Sperre erfolgreich gesetzt wurde, false wenn bereits gesperrt.
 */
export async function startClaimLock(walletAddress: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dfaith_credits
    SET is_claiming = true
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND is_claiming = false
    RETURNING wallet_address
  `;
  return rows.length > 0;
}

/**
 * Claim-Sperre aufheben. Immer aufrufen nach Abschluss (Erfolg oder Fehler).
 */
export async function endClaimLock(walletAddress: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE dfaith_credits
    SET is_claiming = false
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
}

