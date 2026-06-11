import { getDb } from '../db';

export type CollectibleRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: CollectibleRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_LABELS: Record<CollectibleRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

// Rep-Bonus pro Seltenheit (Multiplikator auf den max_rep_bonus_percent der Kollektion)
export const RARITY_REP_MULTIPLIER: Record<CollectibleRarity, number> = {
  common: 0.05,
  uncommon: 0.12,
  rare: 0.25,
  epic: 0.5,
  legendary: 0.75,
  mythic: 1.0,
};

// Shard-Chance-Bonus pro Seltenheit (addiert auf die Basis-20%-Chance)
export const RARITY_SHARD_BONUS: Record<CollectibleRarity, number> = {
  common: 0,
  uncommon: 2,
  rare: 5,
  epic: 10,
  legendary: 15,
  mythic: 25,
};

export interface CollectibleCollection {
  id: string;
  artistWallet: string;
  name: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  chanceCommon: number;
  chanceUncommon: number;
  chanceRare: number;
  chanceEpic: number;
  chanceLegendary: number;
  chanceMythic: number;
  maxRepBonusPercent: number;
  maxShardChanceBonus: number;
  createdAt: string;
}

export interface UserShard {
  walletAddress: string;
  artistWallet: string;
  count: number;
}

export interface UserCollectible {
  id: string;
  walletAddress: string;
  collectionId: string;
  rarity: CollectibleRarity;
  obtainedAt: string;
  // Joined:
  collectionName?: string;
  collectionImageUrl?: string;
  artistWallet?: string;
}

// ─── Kollektion erstellen ─────────────────────────────────────────────────────
export async function createCollectibleCollection(params: {
  artistWallet: string;
  name: string;
  description: string;
  imageUrl: string;
  chanceCommon?: number;
  chanceUncommon?: number;
  chanceRare?: number;
  chanceEpic?: number;
  chanceLegendary?: number;
  chanceMythic?: number;
  maxRepBonusPercent?: number;
  maxShardChanceBonus?: number;
}): Promise<string> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const {
    artistWallet, name, description, imageUrl,
    chanceCommon = 50, chanceUncommon = 25, chanceRare = 15,
    chanceEpic = 7, chanceLegendary = 2, chanceMythic = 1,
    maxRepBonusPercent = 0, maxShardChanceBonus = 0,
  } = params;

  await sql`
    INSERT INTO collectible_collections (
      id, artist_wallet, name, description, image_url,
      chance_common, chance_uncommon, chance_rare, chance_epic, chance_legendary, chance_mythic,
      max_rep_bonus_percent, max_shard_chance_bonus
    ) VALUES (
      ${id}, ${artistWallet.toLowerCase()}, ${name}, ${description}, ${imageUrl},
      ${chanceCommon}, ${chanceUncommon}, ${chanceRare}, ${chanceEpic}, ${chanceLegendary}, ${chanceMythic},
      ${maxRepBonusPercent}, ${maxShardChanceBonus}
    )
  `;
  return id;
}

// ─── Kollektion laden ─────────────────────────────────────────────────────────
export async function getCollectionsByArtist(artistWallet: string): Promise<CollectibleCollection[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM collectible_collections
    WHERE artist_wallet = ${artistWallet.toLowerCase()} AND is_active = true
    ORDER BY created_at ASC
  `;
  return rows.map(rowToCollection);
}

export async function getCollectionById(id: string): Promise<CollectibleCollection | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM collectible_collections WHERE id = ${id} LIMIT 1`;
  return rows.length > 0 ? rowToCollection(rows[0]) : null;
}

export async function getAllActiveCollections(): Promise<CollectibleCollection[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM collectible_collections WHERE is_active = true ORDER BY created_at DESC
  `;
  return rows.map(rowToCollection);
}

// ─── Shard-Operationen ────────────────────────────────────────────────────────

/** Gibt aktuelle Shard-Anzahl zurück */
export async function getUserShards(walletAddress: string, artistWallet: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT count FROM user_shards
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND artist_wallet = ${artistWallet.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].count) : 0;
}

/** Alle Shards eines Users */
export async function getAllUserShards(walletAddress: string): Promise<UserShard[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM user_shards WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  return rows.map((r: any) => ({
    walletAddress: r.wallet_address,
    artistWallet: r.artist_wallet,
    count: Number(r.count),
  }));
}

/** Shard hinzufügen (atomar) */
export async function addShard(walletAddress: string, artistWallet: string, amount = 1): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO user_shards (wallet_address, artist_wallet, count, updated_at)
    VALUES (${walletAddress.toLowerCase()}, ${artistWallet.toLowerCase()}, ${amount}, NOW())
    ON CONFLICT (wallet_address, artist_wallet) DO UPDATE SET
      count = user_shards.count + ${amount},
      updated_at = NOW()
    RETURNING count
  `;
  return Number(rows[0].count);
}

/** Shards abziehen (wirft Fehler wenn nicht genug) */
export async function deductShards(walletAddress: string, artistWallet: string, amount: number): Promise<void> {
  const sql = getDb();
  const rows = await sql`
    UPDATE user_shards SET count = count - ${amount}, updated_at = NOW()
    WHERE wallet_address = ${walletAddress.toLowerCase()}
      AND artist_wallet = ${artistWallet.toLowerCase()}
      AND count >= ${amount}
    RETURNING count
  `;
  if (rows.length === 0) throw new Error('Nicht genug Shards');
}

// ─── Fusion: 10 Shards → 1 Collectible ───────────────────────────────────────

export async function fuseShards(
  walletAddress: string,
  collectionId: string,
): Promise<{ rarity: CollectibleRarity; collectibleId: string }> {
  const sql = getDb();
  const collection = await getCollectionById(collectionId);
  if (!collection) throw new Error('Kollektion nicht gefunden');
  if (!collection.isActive) throw new Error('Kollektion nicht aktiv');

  const artistWallet = collection.artistWallet;

  // 10 Shards abziehen
  await deductShards(walletAddress, artistWallet, 10);

  // Seltenheit via RNG ermitteln
  const rarity = rollRarity(collection);

  // Collectible anlegen
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO user_collectibles (id, wallet_address, collection_id, rarity)
    VALUES (${id}, ${walletAddress.toLowerCase()}, ${collectionId}, ${rarity})
  `;

  return { rarity, collectibleId: id };
}

// ─── Upgrade: 10 gleiche Seltenheit → 1 nächste Stufe ────────────────────────

export async function upgradeCollectibles(
  walletAddress: string,
  collectionId: string,
  fromRarity: CollectibleRarity,
): Promise<{ newRarity: CollectibleRarity; collectibleId: string }> {
  const sql = getDb();

  const rarityIndex = RARITY_ORDER.indexOf(fromRarity);
  if (rarityIndex === -1) throw new Error('Ungültige Seltenheit');
  if (rarityIndex === RARITY_ORDER.length - 1) throw new Error('Mythic ist bereits die höchste Stufe');

  const nextRarity = RARITY_ORDER[rarityIndex + 1];

  // 10 Collectibles der from-Seltenheit in der Kollektion holen
  const owned = await sql`
    SELECT id FROM user_collectibles
    WHERE wallet_address = ${walletAddress.toLowerCase()}
      AND collection_id = ${collectionId}
      AND rarity = ${fromRarity}
    LIMIT 10
  `;
  if (owned.length < 10) throw new Error(`Mindestens 10 ${RARITY_LABELS[fromRarity]}-Collectibles benötigt`);

  const idsToDelete = owned.map((r: any) => r.id as string);

  // Löschen + neues anlegen (atomar via Transaktion)
  await sql`DELETE FROM user_collectibles WHERE id = ANY(${idsToDelete}::uuid[])`;

  const newId = crypto.randomUUID();
  await sql`
    INSERT INTO user_collectibles (id, wallet_address, collection_id, rarity)
    VALUES (${newId}, ${walletAddress.toLowerCase()}, ${collectionId}, ${nextRarity})
  `;

  return { newRarity: nextRarity, collectibleId: newId };
}

// ─── Collectibles laden ───────────────────────────────────────────────────────

export async function getUserCollectibles(walletAddress: string): Promise<UserCollectible[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT uc.*, cc.name AS collection_name, cc.image_url AS collection_image_url, cc.artist_wallet
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
    ORDER BY uc.obtained_at DESC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    walletAddress: r.wallet_address,
    collectionId: r.collection_id,
    rarity: r.rarity as CollectibleRarity,
    obtainedAt: r.obtained_at,
    collectionName: r.collection_name,
    collectionImageUrl: r.collection_image_url,
    artistWallet: r.artist_wallet,
  }));
}

/** Anzahl pro Seltenheit in einer Kollektion für einen User */
export async function getUserCollectibleCountsByRarity(
  walletAddress: string,
  collectionId: string,
): Promise<Partial<Record<CollectibleRarity, number>>> {
  const sql = getDb();
  const rows = await sql`
    SELECT rarity, COUNT(*) AS cnt
    FROM user_collectibles
    WHERE wallet_address = ${walletAddress.toLowerCase()} AND collection_id = ${collectionId}
    GROUP BY rarity
  `;
  const result: Partial<Record<CollectibleRarity, number>> = {};
  for (const r of rows) {
    result[r.rarity as CollectibleRarity] = Number(r.cnt);
  }
  return result;
}

// ─── Aktiver Rep-Bonus aus Collectibles berechnen ────────────────────────────

export async function getCollectiblesRepBonus(
  walletAddress: string,
  artistWallet: string,
): Promise<number> {
  const sql = getDb();
  // Alle Collectibles des Users für diesen Künstler laden
  const rows = await sql`
    SELECT uc.rarity, cc.max_rep_bonus_percent
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
      AND cc.artist_wallet = ${artistWallet.toLowerCase()}
  `;
  if (rows.length === 0) return 0;

  // Bestes Collectible pro Seltenheit zählt (höchste Seltenheit dominiert)
  let highestBonus = 0;
  for (const row of rows) {
    const rarity = row.rarity as CollectibleRarity;
    const maxBonus = Number(row.max_rep_bonus_percent);
    const bonus = Math.round(maxBonus * RARITY_REP_MULTIPLIER[rarity]);
    if (bonus > highestBonus) highestBonus = bonus;
  }
  return highestBonus;
}

/** Aktiver Shard-Chance-Bonus (addiert auf 20%) */
export async function getCollectiblesShardBonus(
  walletAddress: string,
  artistWallet: string,
): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT uc.rarity
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
      AND cc.artist_wallet = ${artistWallet.toLowerCase()}
  `;
  if (rows.length === 0) return 0;

  let maxBonus = 0;
  for (const row of rows) {
    const bonus = RARITY_SHARD_BONUS[row.rarity as CollectibleRarity];
    if (bonus > maxBonus) maxBonus = bonus;
  }
  return maxBonus;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function rollRarity(collection: CollectibleCollection): CollectibleRarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  const chances: Array<{ rarity: CollectibleRarity; chance: number }> = [
    { rarity: 'common', chance: collection.chanceCommon },
    { rarity: 'uncommon', chance: collection.chanceUncommon },
    { rarity: 'rare', chance: collection.chanceRare },
    { rarity: 'epic', chance: collection.chanceEpic },
    { rarity: 'legendary', chance: collection.chanceLegendary },
    { rarity: 'mythic', chance: collection.chanceMythic },
  ];
  for (const { rarity, chance } of chances) {
    cumulative += chance;
    if (roll < cumulative) return rarity;
  }
  return 'common';
}

function rowToCollection(r: any): CollectibleCollection {
  return {
    id: r.id,
    artistWallet: r.artist_wallet,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    isActive: r.is_active,
    chanceCommon: Number(r.chance_common),
    chanceUncommon: Number(r.chance_uncommon),
    chanceRare: Number(r.chance_rare),
    chanceEpic: Number(r.chance_epic),
    chanceLegendary: Number(r.chance_legendary),
    chanceMythic: Number(r.chance_mythic),
    maxRepBonusPercent: Number(r.max_rep_bonus_percent),
    maxShardChanceBonus: Number(r.max_shard_chance_bonus),
    createdAt: r.created_at,
  };
}
