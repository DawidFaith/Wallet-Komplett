/**
 * Vergibt ein Collectible direkt als fertiges NFT an ein bekanntes Empfänger-
 * Wallet — der Artist (Besitzer der Kollektion) zahlt die Mint-Gebühr, exakt
 * analog zu mintSongPrintEdition bei Song-Editionen (siehe shopGrant.ts).
 *
 * Unterschied zum normalen Collectible-Drop: dort landet erst eine "unminted"
 * Zeile in user_collectibles und der Fan mintet später selbst (zahlt selbst,
 * braucht Identitätsverifizierung) über /api/collectibles/mint-nft. Hier wird
 * sofort gemintet — die DB-Zeile entsteht daher auch erst NACH erfolgreichem
 * Mint (mit nft_mint_address direkt gesetzt), nicht vorher, damit bei einem
 * Mint-Fehler kein "totes" unminted Collectible übrig bleibt.
 */
import { getDb } from './db';
import { mintCollectibleAsset } from './collectibleNft';
import { decryptKey } from './solanaCrypto';
import { RARITY_REP_MULTIPLIER, RARITY_CREDIT_MULTIPLIER, type CollectibleRarity } from './questDb/collectibles';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

function getActiveSlotsCount(rarity: CollectibleRarity): 1 | 2 | 3 {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const idx = order.indexOf(rarity);
  if (idx >= order.indexOf('mythic')) return 3;
  if (idx >= order.indexOf('epic')) return 2;
  return 1;
}

export interface CollectibleGrantResult {
  collectibleId: string;
  mintAddress: string;
}

export async function grantCollectibleAsNftToWallet(
  collectionId: string,
  rarity: CollectibleRarity,
  recipientWallet: string,
): Promise<CollectibleGrantResult> {
  const sql = getDb();
  const wallet = recipientWallet.toLowerCase();

  const collRows = await sql`
    SELECT cc.*, p.display_name AS artist_name, sa.solana_address AS artist_solana, sa.solana_private_key AS artist_key
    FROM collectible_collections cc
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = cc.artist_wallet
    LEFT JOIN solana_accounts sa ON sa.wallet_address = cc.artist_wallet
    WHERE cc.id = ${collectionId} LIMIT 1
  `;
  if (!collRows.length) throw new Error('Kollektion nicht gefunden');
  const coll = collRows[0];
  if (!coll.is_active) throw new Error('Kollektion ist nicht mehr aktiv');
  if (!(coll.artist_name as string | null)?.trim()) throw new Error('Künstler hat keinen Namen hinterlegt');
  if (!coll.artist_solana || !coll.artist_key) throw new Error('Kein Solana-Wallet für den Künstler gefunden');
  const nftCollectionMint = coll.nft_collection_mint as string | null;
  if (!nftCollectionMint) throw new Error('Diese Kollektion hat noch keine On-Chain-Collection');

  const recipientSolRows = await sql`
    SELECT solana_address FROM solana_accounts WHERE wallet_address = ${wallet} LIMIT 1
  `;
  if (!recipientSolRows.length) throw new Error('Kein Solana-Wallet gefunden');
  const recipientSolana = recipientSolRows[0].solana_address as string;

  const artistKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(coll.artist_key as string)));

  const repBonus = Math.round(Number(coll.max_rep_bonus_percent) * RARITY_REP_MULTIPLIER[rarity]);
  const creditBonus = Math.round(Number(coll.max_credit_bonus_percent) * RARITY_CREDIT_MULTIPLIER[rarity]);
  const shardBonus = Math.round(Number(coll.max_shard_chance_bonus) * RARITY_REP_MULTIPLIER[rarity]);

  const collectibleId = crypto.randomUUID();
  const result = await mintCollectibleAsset({
    collectibleId,
    collectionMint: nftCollectionMint,
    collectionName: coll.name as string,
    collectionImageUri: coll.image_url as string,
    ownerSolanaAddress: recipientSolana,
    artistSolanaAddress: coll.artist_solana as string,
    artistName: coll.artist_name as string,
    rarity,
    repBonusPercent: repBonus,
    creditBonusPercent: creditBonus,
    shardBonus,
    primaryBonus: (coll.primary_bonus ?? 'rep') as 'rep' | 'credits' | 'shard',
    activeSlots: getActiveSlotsCount(rarity),
    payerKeypair: artistKeypair,
  });

  await sql`
    INSERT INTO user_collectibles (id, wallet_address, collection_id, rarity, nft_mint_address)
    VALUES (${collectibleId}, ${wallet}, ${collectionId}, ${rarity}, ${result.assetMint})
  `;

  return { collectibleId, mintAddress: result.assetMint };
}
