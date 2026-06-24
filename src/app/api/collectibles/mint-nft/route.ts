/**
 * POST /api/collectibles/mint-nft
 * Body: { walletAddress, collectionId, rarity }
 *
 * Mintет ein DB-Collectible als mpl-core Asset on-chain.
 * User zahlt keine Gebühren (Treasury übernimmt) — der Wert liegt im NFT selbst.
 * Lazy-erstellt die mpl-core Collection falls noch nicht vorhanden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { mintCollectibleCollection, mintCollectibleAsset } from '../../../lib/collectibleNft';
import type { CollectibleRarity } from '../../../lib/questDb/collectibles';
import { RARITY_REP_MULTIPLIER, RARITY_CREDIT_MULTIPLIER, RARITY_SHARD_BONUS } from '../../../lib/questDb/collectibles';
import { decryptKey } from '../../../lib/solanaCrypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getActiveSlotsCount(rarity: CollectibleRarity): 1 | 2 | 3 {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const idx = order.indexOf(rarity);
  if (idx >= order.indexOf('mythic')) return 3;
  if (idx >= order.indexOf('epic'))   return 2;
  return 1;
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, collectionId, rarity } = await req.json() as {
      walletAddress?: string;
      collectionId?: string;
      rarity?: string;
    };
    if (!walletAddress || !collectionId || !rarity) {
      return NextResponse.json({ error: 'walletAddress, collectionId und rarity erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    // Kollektion laden
    const collRows = await sql`
      SELECT cc.*, p.display_name AS artist_name, sa.solana_address AS artist_solana
      FROM collectible_collections cc
      LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = cc.artist_wallet
      LEFT JOIN solana_accounts sa ON sa.wallet_address = cc.artist_wallet
      WHERE cc.id = ${collectionId} LIMIT 1
    `;
    if (!collRows.length) return NextResponse.json({ error: 'Kollektion nicht gefunden' }, { status: 404 });
    const coll = collRows[0];

    if (!coll.artist_name?.trim()) return NextResponse.json({ error: 'Künstler hat keinen Namen' }, { status: 400 });
    if (!coll.artist_solana)       return NextResponse.json({ error: 'Kein Solana-Wallet für Künstler' }, { status: 400 });

    // User Solana-Adresse + Keypair laden (User zahlt die Mint-Gebühren)
    const userSolRows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!userSolRows.length) return NextResponse.json({ error: 'Kein Solana-Wallet für User' }, { status: 400 });
    const userSolana   = userSolRows[0].solana_address as string;
    const userKeypair  = Keypair.fromSecretKey(bs58.decode(decryptKey(userSolRows[0].solana_private_key as string)));

    // DB-only Collectible dieser Rarität holen (kein nft_mint_address)
    const collectibleRows = await sql`
      SELECT id FROM user_collectibles
      WHERE wallet_address  = ${walletAddress.toLowerCase()}
        AND collection_id   = ${collectionId}
        AND rarity          = ${rarity}
        AND nft_mint_address IS NULL
      LIMIT 1
    `;
    if (!collectibleRows.length) {
      return NextResponse.json({ error: `Kein ${rarity}-Collectible ohne NFT gefunden` }, { status: 404 });
    }
    const collectibleId = collectibleRows[0].id as string;

    // Collection muss on-chain existieren (wird bei Erstellung angelegt)
    const nftCollectionMint = coll.nft_collection_mint as string | null;
    if (!nftCollectionMint) {
      return NextResponse.json({ error: 'Diese Kollektion hat noch keine on-chain Collection — bitte Künstler kontaktieren' }, { status: 400 });
    }

    // Boni berechnen
    const r          = rarity as CollectibleRarity;
    const repBonus    = parseFloat((Number(coll.max_rep_bonus_percent)    * RARITY_REP_MULTIPLIER[r]).toFixed(1));
    const creditBonus = parseFloat((Number(coll.max_credit_bonus_percent) * RARITY_CREDIT_MULTIPLIER[r]).toFixed(1));
    const shardBonus  = RARITY_SHARD_BONUS[r];

    // Asset minten — User zahlt die Gebühren (~0.002-0.003 SOL)
    const result = await mintCollectibleAsset({
      collectionMint:      nftCollectionMint,
      collectionName:      coll.name as string,
      collectionImageUri:  coll.image_url as string,
      ownerSolanaAddress:  userSolana,
      artistSolanaAddress: coll.artist_solana as string,
      artistName:          coll.artist_name as string,
      rarity:              r,
      repBonusPercent:     repBonus,
      creditBonusPercent:  creditBonus,
      shardBonus,
      primaryBonus:        (coll.primary_bonus ?? 'rep') as 'rep' | 'credits' | 'shard',
      activeSlots:         getActiveSlotsCount(r),
      payerKeypair:        userKeypair,
    });

    // DB-Eintrag mit mint_address aktualisieren
    await sql`UPDATE user_collectibles SET nft_mint_address = ${result.assetMint} WHERE id = ${collectibleId}`;

    return NextResponse.json({ success: true, mintAddress: result.assetMint, collectibleId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('mint-nft Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
