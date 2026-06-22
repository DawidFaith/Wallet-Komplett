/**
 * POST /api/shop/purchase
 * Body: { buyerWallet, itemId, paymentMethod: 'credits' | 'tokens' }
 *
 * Credits: Zieht D.FAITH Credits ab und schreibt dem Artist gut.
 * Tokens:  Überträgt D.FAITH Tokens on-chain vom Käufer-Wallet zum Artist-Wallet.
 * Verhindert Doppelkäufe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferInstruction, getAccount, getMint,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { redeemDfaithCredits, addDfaithCredits } from '../../../lib/questDb';
import { decryptKey } from '../../../lib/solanaCrypto';
import { mintSongPrintEdition } from '../../../lib/songNft';

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { buyerWallet, itemId, paymentMethod = 'credits' } = body as {
    buyerWallet?: string;
    itemId?: string;
    paymentMethod?: 'credits' | 'tokens';
  };
  if (!buyerWallet || !itemId) {
    return NextResponse.json({ error: 'buyerWallet und itemId erforderlich' }, { status: 400 });
  }
  if (!['credits', 'tokens'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Ungültige Zahlungsmethode' }, { status: 400 });
  }

  const sql = getDb();

  // Item laden
  const items = await sql`
    SELECT id, artist_wallet, price_credits, price_tokens, title, content_url, type, is_active,
           master_edition_mint, nft_max_supply, edition_count, is_nft_enabled
    FROM shop_items
    WHERE id = ${itemId}
    LIMIT 1
  `;
  if (!items.length || !items[0].is_active) {
    return NextResponse.json({ error: 'Item nicht gefunden oder nicht aktiv' }, { status: 404 });
  }

  const item = items[0] as {
    id: string;
    artist_wallet: string;
    price_credits: number;
    price_tokens: number | null;
    title: string;
    content_url: string;
    type: string;
    is_active: boolean;
    master_edition_mint: string | null;
    nft_max_supply: number | null;
    edition_count: number;
    is_nft_enabled: boolean;
  };

  // NFT-Auflagen-Limit prüfen
  if (item.is_nft_enabled && item.master_edition_mint && item.nft_max_supply !== null) {
    if (item.edition_count >= item.nft_max_supply) {
      return NextResponse.json({ error: 'Alle NFT-Editionen sind ausverkauft' }, { status: 410 });
    }
  }

  // Artist-Token-Konfiguration laden (custom oder D.FAITH Fallback)
  const artistProfileRows = await sql`
    SELECT reward_token, token_mint_address FROM user_profiles
    WHERE wallet_address = ${item.artist_wallet} LIMIT 1
  `;
  const artistMint: string | null = artistProfileRows.length > 0
    ? (artistProfileRows[0].token_mint_address as string | null ?? null)
    : null;
  // Nutze Artist-Token wenn gesetzt, sonst globaler D.FAITH-Token
  const effectiveMint = artistMint ?? DFAITH_MINT ?? null;

  // Käufer darf sich nichts selbst verkaufen
  if (item.artist_wallet === buyerWallet.toLowerCase()) {
    return NextResponse.json({ error: 'Du kannst dein eigenes Item nicht kaufen' }, { status: 400 });
  }

  // Token-Zahlung: Mint prüfen
  if (paymentMethod === 'tokens') {
    if (!effectiveMint) {
      return NextResponse.json({ error: 'Token nicht konfiguriert' }, { status: 503 });
    }
  }

  // Doppelkauf prüfen
  const alreadyBought = await sql`
    SELECT id FROM shop_purchases
    WHERE buyer_wallet = ${buyerWallet.toLowerCase()} AND item_id = ${itemId}
    LIMIT 1
  `;
  if (alreadyBought.length) {
    return NextResponse.json({ error: 'Bereits gekauft' }, { status: 409 });
  }

  // ── Zahlung abwickeln ──────────────────────────────────────────────────────

  if (paymentMethod === 'credits') {
    try {
      await redeemDfaithCredits(buyerWallet.toLowerCase(), item.price_credits);
    } catch {
      return NextResponse.json({ error: 'Nicht genug D.FAITH Credits' }, { status: 402 });
    }
    await addDfaithCredits(item.artist_wallet, item.price_credits);

  } else {
    // Token-Transfer on-chain – gleicher Betrag wie Credits
    const tokenAmount = Number(item.price_credits);

    // Käufer-Keypair laden
    const buyerRows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${buyerWallet.toLowerCase()} LIMIT 1
    `;
    if (!buyerRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet gefunden. Bitte zuerst Wallet erstellen.' }, { status: 404 });
    }

    // Artist-Solana-Adresse laden
    const artistRows = await sql`
      SELECT solana_address FROM solana_accounts
      WHERE wallet_address = ${item.artist_wallet} LIMIT 1
    `;
    if (!artistRows.length) {
      return NextResponse.json({ error: 'Artist hat kein Solana-Wallet' }, { status: 404 });
    }

    const secretB58  = decryptKey(buyerRows[0].solana_private_key as string);
    const buyerKp    = Keypair.fromSecretKey(bs58.decode(secretB58));
    const artistPk   = new PublicKey(artistRows[0].solana_address as string);
    const mintPk     = new PublicKey(effectiveMint!);
    const connection = new Connection(RPC_URL, 'confirmed');

    const mintInfo = await getMint(connection, mintPk, 'confirmed', TOKEN_PROGRAM_ID);
    const decimals = mintInfo.decimals;

    const fromAta = await getAssociatedTokenAddress(mintPk, buyerKp.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const toAta   = await getAssociatedTokenAddress(mintPk, artistPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    const tx = new Transaction();
    try {
      await getAccount(connection, toAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(buyerKp.publicKey, toAta, artistPk, mintPk, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
    }

    const rawAmount = BigInt(Math.round(tokenAmount * 10 ** decimals));
    tx.add(createTransferInstruction(fromAta, toAta, buyerKp.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

    try {
      await sendAndConfirmTransaction(connection, tx, [buyerKp]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('insufficient')) {
        return NextResponse.json({ error: 'Nicht genug D.FAITH Tokens im Wallet' }, { status: 402 });
      }
      return NextResponse.json({ error: `Token-Transfer fehlgeschlagen: ${msg}` }, { status: 500 });
    }
  }

  // Kauf speichern
  await sql`
    INSERT INTO shop_purchases (buyer_wallet, item_id, price_credits_paid)
    VALUES (${buyerWallet.toLowerCase()}, ${itemId}, ${paymentMethod === 'credits' ? item.price_credits : 0})
  `;

  // NFT Print Edition minten (async, blockiert die Response nicht bei Fehler)
  let nftMintAddress: string | null = null;
  let editionNumber: number | null  = null;

  if (item.is_nft_enabled && item.master_edition_mint) {
    try {
      // Edition-Nummer atomar inkrementieren
      const edRows = await sql`
        UPDATE shop_items
        SET edition_count = edition_count + 1
        WHERE id = ${item.id}
        RETURNING edition_count
      `;
      const newEditionNumber = Number(edRows[0].edition_count);

      // Käufer-Solana-Adresse laden
      const buyerSolanaRows = await sql`
        SELECT solana_address FROM solana_accounts
        WHERE wallet_address = ${buyerWallet.toLowerCase()} LIMIT 1
      `;

      if (buyerSolanaRows.length && buyerSolanaRows[0].solana_address) {
        const { printMint } = await mintSongPrintEdition({
          masterMint:          item.master_edition_mint,
          buyerSolanaAddress:  buyerSolanaRows[0].solana_address as string,
          editionNumber:       newEditionNumber,
        });
        nftMintAddress = printMint;
        editionNumber  = newEditionNumber;

        // NFT-Adresse + Edition-Nummer im Kauf speichern
        await sql`
          UPDATE shop_purchases
          SET nft_mint_address = ${printMint}, edition_number = ${newEditionNumber}
          WHERE buyer_wallet = ${buyerWallet.toLowerCase()} AND item_id = ${itemId}
        `;
      }
    } catch (nftErr) {
      console.error('Print Edition Mint fehlgeschlagen (Kauf war trotzdem erfolgreich):', nftErr);
    }
  }

  return NextResponse.json({
    success:        true,
    title:          item.title,
    contentUrl:     item.content_url,
    type:           item.type,
    paymentMethod,
    nftMintAddress,
    editionNumber,
  });
}
