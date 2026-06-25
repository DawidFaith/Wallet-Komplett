/**
 * POST /api/collectibles/burn-collection
 * Body: { artistWallet, collectionId }
 *
 * Verbrennt eine mpl-core Collection on-chain und entfernt sie aus der DB.
 * Nur möglich wenn keine Assets mehr in der Kollektion existieren.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { burnCollectibleCollection } from '../../../lib/collectibleNft';
import { decryptKey } from '../../../lib/solanaCrypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { artistWallet, collectionId } = await req.json() as {
      artistWallet?: string;
      collectionId?: string;
    };
    if (!artistWallet || !collectionId) {
      return NextResponse.json({ error: 'artistWallet und collectionId erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    // Kollektion + Artist-Keypair laden
    const collRows = await sql`
      SELECT cc.nft_collection_mint, cc.artist_wallet, sa.solana_private_key
      FROM collectible_collections cc
      LEFT JOIN solana_accounts sa ON sa.wallet_address = cc.artist_wallet
      WHERE cc.id = ${collectionId}
        AND LOWER(cc.artist_wallet) = ${artistWallet.toLowerCase()}
      LIMIT 1
    `;
    if (!collRows.length) {
      return NextResponse.json({ error: 'Kollektion nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }
    const { nft_collection_mint, solana_private_key } = collRows[0];

    // Prüfen ob noch DB-Collectibles existieren
    const activeCount = await sql`
      SELECT COUNT(*) AS cnt FROM user_collectibles WHERE collection_id = ${collectionId}
    `;
    if (Number(activeCount[0].cnt) > 0) {
      return NextResponse.json({
        error: `Es gibt noch ${activeCount[0].cnt} Collectible(s) in dieser Kollektion. Bitte zuerst alle einlösen oder als NFT minten.`,
      }, { status: 400 });
    }

    // On-chain verbrennen falls vorhanden
    if (nft_collection_mint) {
      const artistKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(solana_private_key as string)));
      await burnCollectibleCollection(nft_collection_mint as string, artistKeypair);
    }

    // DB-Eintrag entfernen
    await sql`DELETE FROM collectible_collections WHERE id = ${collectionId}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('burn-collection Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
