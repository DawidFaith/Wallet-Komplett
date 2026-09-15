import { getDb } from '../db';
import type { CollectibleRarity } from './collectibles';

/**
 * Kostenlose Collectible-Vergabe an eine E-Mail-Adresse ohne bestehenden
 * Account — gleiches Grundmuster wie giveaway_entries (claim-by-email) und
 * shop_gifts, aber ohne On-Chain-Mint-Schritt: eine vergebene Collectible-
 * Zeile in user_collectibles ist von Haus aus "unminted" (nft_mint_address
 * bleibt NULL, bis der Fan sie später selbst über /api/collectibles/mint-nft
 * mintet) — die Vergabe hier ist also ein reiner DB-Insert, sobald das
 * Empfänger-Wallet bekannt ist.
 */
async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS collectible_gifts (
      id TEXT PRIMARY KEY,
      collection_id UUID NOT NULL REFERENCES collectible_collections(id) ON DELETE CASCADE,
      rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary','mythic')),
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      claimed_wallet TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      claimed_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS collectible_gifts_email_idx ON collectible_gifts (email, status)`;
  await sql`CREATE INDEX IF NOT EXISTS collectible_gifts_collection_idx ON collectible_gifts (collection_id, created_at DESC)`;
}

export interface CollectibleGift {
  id: string;
  collectionId: string;
  rarity: CollectibleRarity;
  email: string;
  status: 'pending' | 'claimed';
  claimedWallet: string | null;
  createdAt: string;
  claimedAt: string | null;
}

function rowToGift(r: Record<string, unknown>): CollectibleGift {
  return {
    id: r.id as string,
    collectionId: r.collection_id as string,
    rarity: r.rarity as CollectibleRarity,
    email: r.email as string,
    status: r.status as CollectibleGift['status'],
    claimedWallet: (r.claimed_wallet as string | null) ?? null,
    createdAt: r.created_at as string,
    claimedAt: (r.claimed_at as string | null) ?? null,
  };
}

export async function createCollectibleGift(collectionId: string, rarity: CollectibleRarity, email: string): Promise<CollectibleGift> {
  await ensureTables();
  const sql = getDb();
  const cleanEmail = email.trim().toLowerCase();
  const id = `cgift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO collectible_gifts (id, collection_id, rarity, email, status)
    VALUES (${id}, ${collectionId}, ${rarity}, ${cleanEmail}, 'pending')
  `;
  const rows = await sql`SELECT * FROM collectible_gifts WHERE id = ${id} LIMIT 1`;
  return rowToGift(rows[0]);
}

export async function listCollectibleGifts(collectionId?: string): Promise<CollectibleGift[]> {
  await ensureTables();
  const sql = getDb();
  const rows = collectionId
    ? await sql`SELECT * FROM collectible_gifts WHERE collection_id = ${collectionId} ORDER BY created_at DESC LIMIT 200`
    : await sql`SELECT * FROM collectible_gifts ORDER BY created_at DESC LIMIT 200`;
  return rows.map(rowToGift);
}

/**
 * Wird beim Login aufgerufen (siehe home/page.tsx) — vergibt alle offenen
 * Collectible-Geschenke, die auf die jetzt bekannte E-Mail warten, an das
 * frisch verknüpfte Wallet.
 */
export async function claimPendingCollectibleGiftsForEmail(walletAddress: string, email: string): Promise<void> {
  await ensureTables();
  const sql = getDb();
  const wallet = walletAddress.toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;

  const rows = await sql`SELECT * FROM collectible_gifts WHERE email = ${cleanEmail} AND status = 'pending'`;
  for (const r of rows) {
    const claimed = await sql`
      UPDATE collectible_gifts SET status = 'claimed', claimed_wallet = ${wallet}, claimed_at = NOW()
      WHERE id = ${r.id} AND status = 'pending' RETURNING id
    `;
    if (!claimed.length) continue;
    await sql`
      INSERT INTO user_collectibles (id, wallet_address, collection_id, rarity)
      VALUES (${crypto.randomUUID()}, ${wallet}, ${r.collection_id}, ${r.rarity})
    `;
  }
}
