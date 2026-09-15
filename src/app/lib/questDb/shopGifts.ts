import { getDb } from '../db';
import { grantShopItemToWallet } from '../shopGrant';

/**
 * Kostenlose Shop-Item-Vergabe an eine E-Mail-Adresse, die noch keinen Account
 * (und damit kein Solana-Wallet) haben muss — analog zu giveaway_entries: der
 * Eintrag wartet als 'pending', bis sich jemand mit genau dieser (von Clerk
 * verifizierten) E-Mail registriert. Siehe claim-by-email in giveaways.ts für
 * das gleiche Grundmuster.
 */
async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS shop_gifts (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      artist_wallet TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      claimed_wallet TEXT,
      nft_mint_address TEXT,
      edition_number INTEGER,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      claimed_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS shop_gifts_email_idx ON shop_gifts (email, status)`;
  await sql`CREATE INDEX IF NOT EXISTS shop_gifts_artist_idx ON shop_gifts (artist_wallet, created_at DESC)`;
}

export interface ShopGift {
  id: string;
  itemId: string;
  artistWallet: string;
  email: string;
  status: 'pending' | 'claiming' | 'claimed' | 'failed';
  claimedWallet: string | null;
  nftMintAddress: string | null;
  editionNumber: number | null;
  error: string | null;
  createdAt: string;
  claimedAt: string | null;
}

function rowToGift(r: Record<string, unknown>): ShopGift {
  return {
    id: r.id as string,
    itemId: r.item_id as string,
    artistWallet: r.artist_wallet as string,
    email: r.email as string,
    status: r.status as ShopGift['status'],
    claimedWallet: (r.claimed_wallet as string | null) ?? null,
    nftMintAddress: (r.nft_mint_address as string | null) ?? null,
    editionNumber: r.edition_number != null ? Number(r.edition_number) : null,
    error: (r.error as string | null) ?? null,
    createdAt: r.created_at as string,
    claimedAt: (r.claimed_at as string | null) ?? null,
  };
}

export async function createShopGift(itemId: string, artistWallet: string, email: string): Promise<ShopGift> {
  await ensureTables();
  const sql = getDb();
  const cleanEmail = email.trim().toLowerCase();
  const id = `sgift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO shop_gifts (id, item_id, artist_wallet, email, status)
    VALUES (${id}, ${itemId}, ${artistWallet}, ${cleanEmail}, 'pending')
  `;
  const rows = await sql`SELECT * FROM shop_gifts WHERE id = ${id} LIMIT 1`;
  return rowToGift(rows[0]);
}

export async function listShopGiftsForArtist(artistWallet: string, itemId?: string): Promise<ShopGift[]> {
  await ensureTables();
  const sql = getDb();
  const rows = itemId
    ? await sql`SELECT * FROM shop_gifts WHERE artist_wallet = ${artistWallet} AND item_id = ${itemId} ORDER BY created_at DESC LIMIT 200`
    : await sql`SELECT * FROM shop_gifts WHERE artist_wallet = ${artistWallet} ORDER BY created_at DESC LIMIT 200`;
  return rows.map(rowToGift);
}

/**
 * Wird beim Login aufgerufen (siehe home/page.tsx, analog zu
 * claimPendingGiveawayEntriesForEmail) — vergibt alle offenen Geschenke, die
 * auf die jetzt bekannte E-Mail warten, an das frisch verknüpfte Wallet.
 */
export async function claimPendingShopGiftsForEmail(walletAddress: string, email: string): Promise<void> {
  await ensureTables();
  const sql = getDb();
  const wallet = walletAddress.toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;

  const rows = await sql`SELECT * FROM shop_gifts WHERE email = ${cleanEmail} AND status = 'pending'`;
  for (const r of rows) {
    // Atomar reservieren, damit ein doppelter Login-Effekt (z.B. StrictMode /
    // zwei Tabs) dasselbe Geschenk nicht zweimal mintet.
    const claimed = await sql`
      UPDATE shop_gifts SET status = 'claiming' WHERE id = ${r.id} AND status = 'pending' RETURNING id
    `;
    if (!claimed.length) continue;

    try {
      const result = await grantShopItemToWallet(r.item_id as string, wallet);
      await sql`
        UPDATE shop_gifts
        SET status = 'claimed', claimed_wallet = ${wallet},
            nft_mint_address = ${result.nftMintAddress}, edition_number = ${result.editionNumber},
            claimed_at = NOW()
        WHERE id = ${r.id}
      `;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`UPDATE shop_gifts SET status = 'failed', error = ${msg} WHERE id = ${r.id}`;
    }
  }
}
