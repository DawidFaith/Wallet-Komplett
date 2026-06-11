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
  common:    0.10,
  uncommon:  0.20,
  rare:      0.35,
  epic:      0.55,
  legendary: 0.80,
  mythic:    1.00,
};

// Credits-Bonus pro Seltenheit (Multiplikator auf max_credit_bonus_percent)
export const RARITY_CREDIT_MULTIPLIER: Record<CollectibleRarity, number> = {
  common:    0.10,
  uncommon:  0.20,
  rare:      0.35,
  epic:      0.55,
  legendary: 0.80,
  mythic:    1.00,
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

export type BonusType = 'rep' | 'credits' | 'shard';

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
  maxCreditBonusPercent: number;
  /** Welcher Bonus-Typ ist primär (ab Common aktiv). Die anderen schalten sich bei Epic und Mythic frei. */
  primaryBonus: BonusType;
  createdAt: string;
}

/**
 * Gibt die Bonus-Slot-Reihenfolge einer Kollektion zurück.
 * Slot 0: ab Common, Slot 1: ab Epic, Slot 2: ab Mythic.
 * Feste Priorität der nicht-primären Slots: rep > credits > shard.
 */
export function getBonusSlots(primaryBonus: BonusType): [BonusType, BonusType, BonusType] {
  const all: BonusType[] = ['rep', 'credits', 'shard'];
  const others = all.filter(b => b !== primaryBonus) as [BonusType, BonusType];
  return [primaryBonus, others[0], others[1]];
}

/** Anzahl aktiver Bonus-Slots abhängig von der Seltenheit. */
export function getActiveSlotsCount(rarity: CollectibleRarity): 1 | 2 | 3 {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx >= RARITY_ORDER.indexOf('mythic')) return 3;
  if (idx >= RARITY_ORDER.indexOf('epic')) return 2;
  return 1;
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
  maxCreditBonusPercent?: number;
  primaryBonus?: BonusType;
}): Promise<string> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const {
    artistWallet, name, description, imageUrl,
    chanceCommon = 50, chanceUncommon = 25, chanceRare = 15,
    chanceEpic = 7, chanceLegendary = 2, chanceMythic = 1,
    maxRepBonusPercent = 0, maxShardChanceBonus = 0,
    primaryBonus = 'rep',
  } = params;

  await sql`
    INSERT INTO collectible_collections (
      id, artist_wallet, name, description, image_url,
      chance_common, chance_uncommon, chance_rare, chance_epic, chance_legendary, chance_mythic,
      max_rep_bonus_percent, max_shard_chance_bonus, max_credit_bonus_percent, primary_bonus
    ) VALUES (
      ${id}, ${artistWallet.toLowerCase()}, ${name}, ${description}, ${imageUrl},
      ${chanceCommon}, ${chanceUncommon}, ${chanceRare}, ${chanceEpic}, ${chanceLegendary}, ${chanceMythic},
      ${maxRepBonusPercent}, ${maxShardChanceBonus}, ${params.maxCreditBonusPercent ?? 0}, ${primaryBonus}
    )
  `;
  return id;
}

// ─── Kollektion aktualisieren ─────────────────────────────────────────────────

export async function updateCollectibleCollection(
  id: string,
  artistWallet: string,
  params: {
    name?: string;
    description?: string;
    imageUrl?: string;
    chanceCommon?: number;
    chanceUncommon?: number;
    chanceRare?: number;
    chanceEpic?: number;
    chanceLegendary?: number;
    chanceMythic?: number;
    maxRepBonusPercent?: number;
    maxShardChanceBonus?: number;
    maxCreditBonusPercent?: number;
    primaryBonus?: BonusType;
  }
): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    UPDATE collectible_collections SET
      name                   = COALESCE(${params.name ?? null}, name),
      description            = COALESCE(${params.description ?? null}, description),
      image_url              = COALESCE(${params.imageUrl ?? null}, image_url),
      chance_common          = COALESCE(${params.chanceCommon ?? null}, chance_common),
      chance_uncommon        = COALESCE(${params.chanceUncommon ?? null}, chance_uncommon),
      chance_rare            = COALESCE(${params.chanceRare ?? null}, chance_rare),
      chance_epic            = COALESCE(${params.chanceEpic ?? null}, chance_epic),
      chance_legendary       = COALESCE(${params.chanceLegendary ?? null}, chance_legendary),
      chance_mythic          = COALESCE(${params.chanceMythic ?? null}, chance_mythic),
      max_rep_bonus_percent  = COALESCE(${params.maxRepBonusPercent ?? null}, max_rep_bonus_percent),
      max_shard_chance_bonus = COALESCE(${params.maxShardChanceBonus ?? null}, max_shard_chance_bonus),
      max_credit_bonus_percent = COALESCE(${params.maxCreditBonusPercent ?? null}, max_credit_bonus_percent),
      primary_bonus          = COALESCE(${params.primaryBonus ?? null}, primary_bonus)
    WHERE id = ${id} AND artist_wallet = ${artistWallet.toLowerCase()}
    RETURNING id
  `;
  return result.length > 0;
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
  const rows = await sql`
    SELECT uc.rarity, uc.collection_id, cc.max_rep_bonus_percent, cc.primary_bonus
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
      AND cc.artist_wallet = ${artistWallet.toLowerCase()}
      AND cc.is_active = true
  `;
  if (rows.length === 0) return 0;
  return calcBonus(rows, 'rep', (r) => ({
    collId: r.collection_id as string,
    rarity: r.rarity as CollectibleRarity,
    value: Math.round(Number(r.max_rep_bonus_percent) * RARITY_REP_MULTIPLIER[r.rarity as CollectibleRarity]),
    primaryBonus: r.primary_bonus as BonusType,
  }));
}

/** Aktiver Credits-Bonus in Prozent – pro Kollektion bestes Collectible, Slot-Unlock beachten, dann summieren */
export async function getCollectiblesCreditBonus(
  walletAddress: string,
  artistWallet: string,
): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT uc.rarity, uc.collection_id, cc.max_credit_bonus_percent, cc.primary_bonus
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
      AND cc.artist_wallet = ${artistWallet.toLowerCase()}
      AND cc.is_active = true
  `;
  if (rows.length === 0) return 0;
  return calcBonus(rows, 'credits', (r) => ({
    collId: r.collection_id as string,
    rarity: r.rarity as CollectibleRarity,
    value: Math.round(Number(r.max_credit_bonus_percent) * RARITY_CREDIT_MULTIPLIER[r.rarity as CollectibleRarity]),
    primaryBonus: r.primary_bonus as BonusType,
  }));
}

/** Aktiver Shard-Chance-Bonus – pro Kollektion bestes Collectible, Slot-Unlock beachten, dann summieren */
export async function getCollectiblesShardBonus(
  walletAddress: string,
  artistWallet: string,
): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT uc.rarity, uc.collection_id, cc.max_shard_chance_bonus, cc.primary_bonus
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
      AND cc.artist_wallet = ${artistWallet.toLowerCase()}
      AND cc.is_active = true
  `;
  if (rows.length === 0) return 0;
  return calcBonus(rows, 'shard', (r) => ({
    collId: r.collection_id as string,
    rarity: r.rarity as CollectibleRarity,
    value: RARITY_SHARD_BONUS[r.rarity as CollectibleRarity],
    primaryBonus: r.primary_bonus as BonusType,
  }));
}

// ─── Interner Bonus-Kalkulator (Slot-Logik) ───────────────────────────────────
function calcBonus(
  rows: any[],
  bonusType: BonusType,
  mapper: (r: any) => { collId: string; rarity: CollectibleRarity; value: number; primaryBonus: BonusType },
): number {
  // Pro Kollektion: beste Seltenheit und höchsten Wert ermitteln
  type CollData = { rarity: CollectibleRarity; value: number; primaryBonus: BonusType };
  const bestPerColl = new Map<string, CollData>();
  for (const row of rows) {
    const mapped = mapper(row);
    const existing = bestPerColl.get(mapped.collId);
    if (!existing || RARITY_ORDER.indexOf(mapped.rarity) > RARITY_ORDER.indexOf(existing.rarity)) {
      bestPerColl.set(mapped.collId, { rarity: mapped.rarity, value: mapped.value, primaryBonus: mapped.primaryBonus });
    }
  }
  let total = 0;
  for (const { rarity, value, primaryBonus } of bestPerColl.values()) {
    const slots = getBonusSlots(primaryBonus);
    const activeCount = getActiveSlotsCount(rarity);
    // Prüfen ob dieser Bonus-Typ in einem aktiven Slot liegt
    if (slots.slice(0, activeCount).includes(bonusType)) {
      total += value;
    }
  }
  return total;
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
    maxCreditBonusPercent: Number(r.max_credit_bonus_percent ?? 0),
    primaryBonus: (r.primary_bonus ?? 'rep') as BonusType,
    createdAt: r.created_at,
  };
}
