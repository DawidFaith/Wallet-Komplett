/**
 * POST /api/marketplace/buy
 * Body: { buyerWallet, listingId }
 *
 * Aufteilung des Kaufpreises:
 *   92.5% → Verkäufer
 *    5.0% → Artist-Royalty (aus collectible_collections.artist_wallet)
 *    2.5% → Platform-Treasury (getTreasuryKeypair().publicKey)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { transferCollectibleAsset } from '../../../lib/collectibleNft';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getDfaithCredits, addDfaithCredits, redeemDfaithCredits } from '../../../lib/questDb/credits';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PLATFORM_FEE  = 0.025; // 2.5%
const ROYALTY_FEE   = 0.05;  // 5.0%

export async function POST(req: NextRequest) {
  try {
    const { buyerWallet, listingId } = await req.json() as {
      buyerWallet?: string;
      listingId?: string;
    };
    if (!buyerWallet || !listingId) {
      return NextResponse.json({ error: 'buyerWallet und listingId erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    // 1. Listing laden
    const listingRows = await sql`
      SELECT * FROM nft_listings WHERE id = ${listingId} AND status = 'active' LIMIT 1
    `;
    if (!listingRows.length) {
      return NextResponse.json({ error: 'Listing nicht gefunden oder bereits verkauft' }, { status: 404 });
    }
    const listing      = listingRows[0];
    const price        = Number(listing.price_dfaith);
    const sellerWallet = listing.seller_wallet as string;

    if (sellerWallet === buyerWallet.toLowerCase()) {
      return NextResponse.json({ error: 'Du kannst dein eigenes NFT nicht kaufen' }, { status: 400 });
    }

    // 2. Käufer-Guthaben prüfen
    const buyerBalance = await getDfaithCredits(buyerWallet);
    if (buyerBalance < price) {
      return NextResponse.json({
        error: `Nicht genug D.FAITH. Benötigt: ${price.toLocaleString('de-DE')}, Verfügbar: ${buyerBalance.toFixed(2)}`,
      }, { status: 400 });
    }

    // 3. Seller-Keypair + Collection + Artist laden
    const sellerSolRows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${sellerWallet} LIMIT 1
    `;
    if (!sellerSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet für Verkäufer gefunden' }, { status: 400 });
    }
    const sellerKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(sellerSolRows[0].solana_private_key as string)));

    const buyerSolRows = await sql`
      SELECT solana_address FROM solana_accounts
      WHERE wallet_address = ${buyerWallet.toLowerCase()} LIMIT 1
    `;
    if (!buyerSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet für Käufer gefunden' }, { status: 400 });
    }
    const buyerSolanaAddress = buyerSolRows[0].solana_address as string;

    // Collection-Mint + Artist-Wallet für Royalties holen
    // Primär: user_collectibles JOIN collectible_collections
    // Fallback: nft_collection_mint direkt aus nft_listings + CC lookup
    const collectibleRows = await sql`
      SELECT cc.nft_collection_mint, cc.artist_wallet
      FROM user_collectibles uc
      JOIN collectible_collections cc ON cc.id = uc.collection_id
      WHERE uc.wallet_address = ${sellerWallet}
        AND uc.nft_mint_address = ${listing.mint_address as string}
      LIMIT 1
    `;

    let collectionMint: string | null = null;
    let artistWallet: string | null   = null;
    let hasDbEntry = false;

    if (collectibleRows.length) {
      collectionMint = collectibleRows[0].nft_collection_mint as string | null;
      artistWallet   = (collectibleRows[0].artist_wallet as string | null)?.toLowerCase() ?? null;
      hasDbEntry     = true;
    } else {
      // Fallback: nft_collection_mint aus Listing selbst lesen
      const listingMint = (listing as any).nft_collection_mint as string | null;
      if (listingMint) {
        const ccRows = await sql`
          SELECT nft_collection_mint, artist_wallet FROM collectible_collections
          WHERE nft_collection_mint = ${listingMint} LIMIT 1
        `;
        if (ccRows.length) {
          collectionMint = ccRows[0].nft_collection_mint as string | null;
          artistWallet   = (ccRows[0].artist_wallet as string | null)?.toLowerCase() ?? null;
        } else {
          collectionMint = listingMint;
        }
      }
    }

    if (!collectionMint) {
      return NextResponse.json({ error: 'Collection-Mint fehlt — NFT kann nicht übertragen werden' }, { status: 500 });
    }

    // Treasury-Wallet-Adresse aus vorhandenem Keypair ableiten
    const treasuryWallet = getTreasuryKeypair().publicKey.toBase58().toLowerCase();

    // 4. Beträge berechnen
    // Artist bekommt keine Royalty wenn er selbst der Verkäufer ist (Erstverkauf)
    const isFirstSale    = artistWallet === sellerWallet;
    const royaltyAmount  = isFirstSale ? 0 : Math.round(price * ROYALTY_FEE  * 100) / 100;
    const platformAmount = Math.round(price * PLATFORM_FEE * 100) / 100;
    const sellerAmount   = Math.round((price - royaltyAmount - platformAmount) * 100) / 100;

    // 5. D.FAITH Credits buchen
    await redeemDfaithCredits(buyerWallet, price);
    await addDfaithCredits(sellerWallet, sellerAmount);
    await addDfaithCredits(treasuryWallet, platformAmount);
    if (!isFirstSale && artistWallet && royaltyAmount > 0) {
      await addDfaithCredits(artistWallet, royaltyAmount);
    }

    // 6. NFT on-chain übertragen (bei Fehler: Credits zurückbuchen)
    try {
      await transferCollectibleAsset(
        listing.mint_address as string,
        collectionMint,
        sellerKeypair,
        buyerSolanaAddress,
      );
    } catch (transferErr) {
      await addDfaithCredits(buyerWallet, price);
      await redeemDfaithCredits(sellerWallet, sellerAmount);
      await redeemDfaithCredits(treasuryWallet, platformAmount);
      if (!isFirstSale && artistWallet && royaltyAmount > 0) {
        await redeemDfaithCredits(artistWallet, royaltyAmount);
      }
      throw new Error(`NFT-Transfer fehlgeschlagen: ${transferErr instanceof Error ? transferErr.message : String(transferErr)}`);
    }

    // 7. DB aktualisieren
    await sql`UPDATE nft_listings SET status = 'sold' WHERE id = ${listingId}`;
    if (hasDbEntry) {
      await sql`
        UPDATE user_collectibles
        SET wallet_address = ${buyerWallet.toLowerCase()}
        WHERE wallet_address = ${sellerWallet}
          AND nft_mint_address = ${listing.mint_address as string}
      `;
    }

    return NextResponse.json({
      success: true,
      price,
      sellerAmount,
      royaltyAmount,
      platformAmount,
      isFirstSale,
      mintAddress: listing.mint_address,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('marketplace/buy Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
