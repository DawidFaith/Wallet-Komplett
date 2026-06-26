/**
 * POST /api/marketplace/buy
 * Body: { buyerWallet, listingId }
 *
 * Ablauf:
 * 1. Listing + Verkäufer laden, Preis prüfen
 * 2. Käufer-Guthaben prüfen (dfaith_credits)
 * 3. D.FAITH Credits: Käufer → Verkäufer (97.5%) + Platform-Treasury (2.5%)
 * 4. NFT on-chain: Verkäufer → Käufer (mpl-core transfer)
 * 5. DB: Listing als 'sold' markieren, user_collectibles-Owner wechseln
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { transferCollectibleAsset } from '../../../lib/collectibleNft';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getDfaithCredits, addDfaithCredits, redeemDfaithCredits } from '../../../lib/questDb/credits';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PLATFORM_FEE = 0.025; // 2.5%
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS ?? '').toLowerCase();

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
    const listing = listingRows[0];
    const price     = Number(listing.price_dfaith);
    const sellerWallet = listing.seller_wallet as string;

    if (sellerWallet === buyerWallet.toLowerCase()) {
      return NextResponse.json({ error: 'Du kannst dein eigenes NFT nicht kaufen' }, { status: 400 });
    }

    // 2. Käufer-Guthaben prüfen
    const buyerBalance = await getDfaithCredits(buyerWallet);
    if (buyerBalance < price) {
      return NextResponse.json({
        error: `Nicht genug D.FAITH. Benötigt: ${price}, Verfügbar: ${buyerBalance.toFixed(2)}`,
      }, { status: 400 });
    }

    // 3. Seller-Keypair laden (für NFT-Transfer)
    const sellerSolRows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${sellerWallet} LIMIT 1
    `;
    if (!sellerSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet für Verkäufer gefunden' }, { status: 400 });
    }
    const sellerKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(sellerSolRows[0].solana_private_key as string)));

    // Käufer Solana-Adresse laden (für NFT-Empfang)
    const buyerSolRows = await sql`
      SELECT solana_address FROM solana_accounts
      WHERE wallet_address = ${buyerWallet.toLowerCase()} LIMIT 1
    `;
    if (!buyerSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet für Käufer gefunden' }, { status: 400 });
    }
    const buyerSolanaAddress = buyerSolRows[0].solana_address as string;

    // Collection-Mint für NFT-Transfer holen
    const collectibleRows = await sql`
      SELECT uc.nft_mint_address, cc.nft_collection_mint
      FROM user_collectibles uc
      JOIN collectible_collections cc ON cc.id = uc.collection_id
      WHERE uc.wallet_address = ${sellerWallet}
        AND uc.nft_mint_address = ${listing.mint_address as string}
      LIMIT 1
    `;
    if (!collectibleRows.length) {
      return NextResponse.json({ error: 'NFT nicht mehr im Besitz des Verkäufers (DB)' }, { status: 409 });
    }
    const collectionMint = collectibleRows[0].nft_collection_mint as string | null;
    if (!collectionMint) {
      return NextResponse.json({ error: 'Collection-Mint fehlt' }, { status: 500 });
    }

    // 4. D.FAITH Credits buchen (Käufer abziehen → Verkäufer + Platform)
    const feeAmount    = Math.round(price * PLATFORM_FEE * 100) / 100;
    const sellerAmount = Math.round((price - feeAmount) * 100) / 100;

    await redeemDfaithCredits(buyerWallet, price);
    await addDfaithCredits(sellerWallet, sellerAmount);
    if (PLATFORM_WALLET) {
      await addDfaithCredits(PLATFORM_WALLET, feeAmount);
    }

    // 5. NFT on-chain übertragen
    try {
      await transferCollectibleAsset(
        listing.mint_address as string,
        collectionMint,
        sellerKeypair,
        buyerSolanaAddress,
      );
    } catch (transferErr) {
      // Credits-Buchung rückgängig machen bei NFT-Fehler
      await addDfaithCredits(buyerWallet, price);
      await redeemDfaithCredits(sellerWallet, sellerAmount);
      if (PLATFORM_WALLET) await redeemDfaithCredits(PLATFORM_WALLET, feeAmount);
      throw new Error(`NFT-Transfer fehlgeschlagen: ${transferErr instanceof Error ? transferErr.message : String(transferErr)}`);
    }

    // 6. DB aktualisieren
    await sql`UPDATE nft_listings SET status = 'sold' WHERE id = ${listingId}`;
    await sql`
      UPDATE user_collectibles
      SET wallet_address = ${buyerWallet.toLowerCase()}
      WHERE wallet_address = ${sellerWallet}
        AND nft_mint_address = ${listing.mint_address as string}
    `;

    return NextResponse.json({
      success: true,
      price,
      sellerAmount,
      feeAmount,
      mintAddress: listing.mint_address,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('marketplace/buy Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
