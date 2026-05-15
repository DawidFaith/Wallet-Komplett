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
    SELECT id, artist_wallet, price_credits, price_tokens, title, content_url, type, is_active
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
  };

  // Käufer darf sich nichts selbst verkaufen
  if (item.artist_wallet === buyerWallet.toLowerCase()) {
    return NextResponse.json({ error: 'Du kannst dein eigenes Item nicht kaufen' }, { status: 400 });
  }

  // Token-Zahlung: DFAITH-Mint prüfen
  if (paymentMethod === 'tokens') {
    if (!DFAITH_MINT) {
      return NextResponse.json({ error: 'D.FAITH Token nicht konfiguriert' }, { status: 503 });
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
    const mintPk     = new PublicKey(DFAITH_MINT!);
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

  return NextResponse.json({
    success: true,
    title: item.title,
    contentUrl: item.content_url,
    type: item.type,
    paymentMethod,
  });
}
