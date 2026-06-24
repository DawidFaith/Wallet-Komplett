/**
 * POST /api/collectibles/redeem-nft
 * Body: { walletAddress, mintAddress, collectionMint }
 *
 * Verbrennt ein mpl-core Collectible-Asset und legt einen DB-Eintrag an.
 * Funktioniert auch für Sekundärmarkt-Käufer (wenn registrierter D.FAITH User).
 * User-Keypair als Payer → Rent-SOL geht zurück an User (~0.002 SOL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { redeemCollectibleAsset } from '../../../lib/collectibleNft';
import type { CollectibleRarity } from '../../../lib/questDb/collectibles';
import { decryptKey } from '../../../lib/solanaCrypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, mintAddress, collectionMint } = await req.json() as {
      walletAddress?: string;
      mintAddress?: string;
      collectionMint?: string;
    };
    if (!walletAddress || !mintAddress || !collectionMint) {
      return NextResponse.json({ error: 'walletAddress, mintAddress und collectionMint erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    // User Solana-Adresse + Keypair laden (Keypair → User bekommt Rent-SOL zurück)
    const userSolRows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!userSolRows.length) return NextResponse.json({ error: 'Kein Solana-Wallet für User' }, { status: 400 });
    const userSolana  = userSolRows[0].solana_address as string;
    const userKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(userSolRows[0].solana_private_key as string)));

    // Kollektion in DB suchen
    const collRows = await sql`
      SELECT id, artist_wallet FROM collectible_collections
      WHERE nft_collection_mint = ${collectionMint} LIMIT 1
    `;
    if (!collRows.length) return NextResponse.json({ error: 'Kollektion nicht gefunden' }, { status: 404 });
    const collectionId = collRows[0].id as string;

    // DB-Rarity als Fallback für alte Assets ohne on-chain Attributes-Plugin
    const dbRarityRows = await sql`
      SELECT rarity FROM user_collectibles
      WHERE nft_mint_address = ${mintAddress} LIMIT 1
    `;
    const fallbackRarity = dbRarityRows[0]?.rarity as CollectibleRarity | undefined;

    let rarity: CollectibleRarity;

    try {
      // On-chain Asset lesen + verbrennen; User bekommt Rent-SOL zurück
      const result = await redeemCollectibleAsset(
        mintAddress,
        collectionMint,
        userKeypair,
        fallbackRarity,
      );

      // Sicherheitsprüfung: Besitzer muss dem User entsprechen
      if (result.ownerAddress.toLowerCase() !== userSolana.toLowerCase()) {
        return NextResponse.json({ error: 'Dieses NFT gehört nicht deinem Wallet' }, { status: 403 });
      }

      rarity = result.rarity;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg === 'ASSET_ALREADY_BURNED') {
        // NFT bereits verbrannt (Doppelklick / DAS-Cache-Lag)
        // Prüfen ob DB-Eintrag schon angelegt wurde
        const existing = await sql`
          SELECT id, rarity FROM user_collectibles
          WHERE wallet_address = ${walletAddress.toLowerCase()}
            AND collection_id  = ${collectionId}
            AND nft_mint_address IS NULL
          ORDER BY created_at DESC LIMIT 1
        `;
        if (existing.length) {
          return NextResponse.json({ success: true, rarity: existing[0].rarity, collectibleId: existing[0].id, alreadyRedeemed: true });
        }
        // Burn war erfolgreich aber DB-Schritt fehlte → mit Fallback-Rarity nachanlegen
        if (!fallbackRarity) {
          return NextResponse.json({ error: 'NFT bereits verbrannt aber Rarity nicht bestimmbar. Bitte Support kontaktieren.' }, { status: 400 });
        }
        rarity = fallbackRarity;
      } else {
        throw err;
      }
    }

    // Alten DB-Eintrag (falls vorhanden) entfernen + neuen anlegen
    await sql`DELETE FROM user_collectibles WHERE nft_mint_address = ${mintAddress}`;
    const newId = crypto.randomUUID();
    await sql`
      INSERT INTO user_collectibles (id, wallet_address, collection_id, rarity)
      VALUES (${newId}, ${walletAddress.toLowerCase()}, ${collectionId}, ${rarity})
    `;

    return NextResponse.json({ success: true, rarity, collectibleId: newId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('redeem-nft Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
