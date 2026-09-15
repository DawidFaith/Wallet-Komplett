import { getDb } from '../db';
import type { CollectibleRarity } from './collectibles';
import { grantCollectibleAsNftToWallet } from '../collectibleGrant';

/**
 * Kostenlose Collectible-NFT-Vergabe an eine E-Mail-Adresse ohne bestehenden
 * Account — gleiches Grundmuster wie giveaway_entries (claim-by-email) und
 * shop_gifts: der Eintrag wartet als 'pending', bis sich jemand mit genau
 * dieser (von Clerk verifizierten) E-Mail registriert oder einloggt. Anders
 * als die alte Admin-DB-only-Vergabe wird hier beim Claim sofort ein
 * fertiges NFT gemintet (siehe collectibleGrant.ts) — der Artist zahlt die
 * Mint-Gebühr, wie bei einer Song-Edition.
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
      nft_mint_address TEXT,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      claimed_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE collectible_gifts ADD COLUMN IF NOT EXISTS nft_mint_address TEXT`;
  await sql`ALTER TABLE collectible_gifts ADD COLUMN IF NOT EXISTS error TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS collectible_gifts_email_idx ON collectible_gifts (email, status)`;
  await sql`CREATE INDEX IF NOT EXISTS collectible_gifts_collection_idx ON collectible_gifts (collection_id, created_at DESC)`;
}

export interface CollectibleGift {
  id: string;
  collectionId: string;
  rarity: CollectibleRarity;
  email: string;
  status: 'pending' | 'claiming' | 'claimed' | 'failed';
  claimedWallet: string | null;
  nftMintAddress: string | null;
  error: string | null;
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
    nftMintAddress: (r.nft_mint_address as string | null) ?? null,
    error: (r.error as string | null) ?? null,
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

/**
 * @param filter.artistWallet Nur Geschenke aus Kollektionen dieses Artists (Selbstbedienung).
 * @param filter.collectionId Zusätzlich auf eine einzelne Kollektion eingrenzen.
 */
export async function listCollectibleGifts(filter: { artistWallet?: string; collectionId?: string } = {}): Promise<CollectibleGift[]> {
  await ensureTables();
  const sql = getDb();
  const { artistWallet, collectionId } = filter;

  if (artistWallet && collectionId) {
    const rows = await sql`
      SELECT g.* FROM collectible_gifts g
      JOIN collectible_collections c ON c.id = g.collection_id
      WHERE c.artist_wallet = ${artistWallet} AND g.collection_id = ${collectionId}
      ORDER BY g.created_at DESC LIMIT 200
    `;
    return rows.map(rowToGift);
  }
  if (artistWallet) {
    const rows = await sql`
      SELECT g.* FROM collectible_gifts g
      JOIN collectible_collections c ON c.id = g.collection_id
      WHERE c.artist_wallet = ${artistWallet}
      ORDER BY g.created_at DESC LIMIT 200
    `;
    return rows.map(rowToGift);
  }
  if (collectionId) {
    const rows = await sql`SELECT * FROM collectible_gifts WHERE collection_id = ${collectionId} ORDER BY created_at DESC LIMIT 200`;
    return rows.map(rowToGift);
  }
  const rows = await sql`SELECT * FROM collectible_gifts ORDER BY created_at DESC LIMIT 200`;
  return rows.map(rowToGift);
}

/**
 * Wird beim Login aufgerufen (siehe home/page.tsx) — mintet alle offenen
 * Collectible-Geschenke, die auf die jetzt bekannte E-Mail warten, direkt als
 * NFT an das frisch verknüpfte Wallet.
 */
export async function claimPendingCollectibleGiftsForEmail(walletAddress: string, email: string): Promise<void> {
  await ensureTables();
  const sql = getDb();
  const wallet = walletAddress.toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;

  const rows = await sql`SELECT * FROM collectible_gifts WHERE email = ${cleanEmail} AND status = 'pending'`;
  for (const r of rows) {
    // Atomar reservieren, damit ein doppelter Login-Effekt dasselbe Geschenk
    // nicht zweimal mintet.
    const claimed = await sql`
      UPDATE collectible_gifts SET status = 'claiming' WHERE id = ${r.id} AND status = 'pending' RETURNING id
    `;
    if (!claimed.length) continue;

    try {
      const result = await grantCollectibleAsNftToWallet(r.collection_id as string, r.rarity as CollectibleRarity, wallet);
      await sql`
        UPDATE collectible_gifts
        SET status = 'claimed', claimed_wallet = ${wallet}, nft_mint_address = ${result.mintAddress}, claimed_at = NOW()
        WHERE id = ${r.id}
      `;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`UPDATE collectible_gifts SET status = 'failed', error = ${msg} WHERE id = ${r.id}`;
    }
  }
}
