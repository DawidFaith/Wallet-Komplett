/**
 * POST /api/shop/purchase
 * Body: { buyerWallet, itemId, paymentMethod: 'credits' | 'tokens' }
 *
 * Ablauf:
 *  1. Verfügbarkeit prüfen (max supply, atomar reservieren)
 *  2. Zahlung abwickeln (Credits abziehen / Token-Transfer)
 *  3. NFT minten → bei Fehler: Credits zurückerstatten + Slot freigeben + Error-Response
 *  4. Kauf in DB speichern (nur bei erfolgreichem Mint)
 *
 * Kein Limit pro User — jeder kann beliebig viele Editionen kaufen.
 * Inventar zeigt nur Käufe mit erfolgreich geminteter NFT.
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
  try {
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

  // ── Item laden ────────────────────────────────────────────────────────────
  const items = await sql`
    SELECT id, artist_wallet, price_credits, price_tokens, title, content_url, type, is_active,
           master_edition_mint, nft_collection_mint, nft_max_supply, edition_count, is_nft_enabled
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
    master_edition_mint:  string | null;
    nft_collection_mint:  string | null;
    nft_max_supply: number | null;
    edition_count: number;
    is_nft_enabled: boolean;
  };

  // ── Max Supply prüfen ─────────────────────────────────────────────────────
  if (item.is_nft_enabled && item.nft_max_supply !== null) {
    if (Number(item.edition_count) >= Number(item.nft_max_supply)) {
      return NextResponse.json({ error: 'Alle NFT-Editionen sind ausverkauft' }, { status: 410 });
    }
  }

  // ── Token-Konfiguration + Artist-Name (für NFT-Attribute) ────────────────
  const artistProfileRows = await sql`
    SELECT token_mint_address, display_name FROM user_profiles
    WHERE wallet_address = ${item.artist_wallet} LIMIT 1
  `;
  const artistName: string = (artistProfileRows[0]?.display_name as string | null)?.trim() || 'D.FAITH Artist';
  const artistMint: string | null = artistProfileRows[0]?.token_mint_address as string | null ?? null;
  const effectiveMint = artistMint ?? DFAITH_MINT ?? null;

  if (paymentMethod === 'tokens' && !effectiveMint) {
    return NextResponse.json({ error: 'Token nicht konfiguriert' }, { status: 503 });
  }

  const isSelfPurchase = item.artist_wallet === buyerWallet.toLowerCase();

  // ── Käufer-Solana-Konto laden ─────────────────────────────────────────────
  const buyerSolanaRows = await sql`
    SELECT solana_address, solana_private_key FROM solana_accounts
    WHERE wallet_address = ${buyerWallet.toLowerCase()} LIMIT 1
  `;
  if (!buyerSolanaRows.length) {
    return NextResponse.json({ error: 'Kein Solana-Wallet gefunden' }, { status: 404 });
  }
  const buyerSolanaAddress = buyerSolanaRows[0].solana_address as string;

  // ── Edition-Slot atomar reservieren ──────────────────────────────────────
  const slotRows = await sql`
    UPDATE shop_items
    SET edition_count = COALESCE(edition_count, 0) + 1
    WHERE id = ${item.id}
      AND (nft_max_supply IS NULL OR COALESCE(edition_count, 0) < nft_max_supply)
    RETURNING edition_count
  `;
  if (!slotRows.length) {
    return NextResponse.json({ error: 'Alle NFT-Editionen sind ausverkauft' }, { status: 410 });
  }
  const editionNumber = Number(slotRows[0].edition_count ?? 1);

  // ── 1. Zahlung abwickeln ──────────────────────────────────────────────────
  if (paymentMethod === 'credits' && !isSelfPurchase) {
    try {
      await redeemDfaithCredits(buyerWallet.toLowerCase(), item.price_credits);
    } catch {
      await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
      return NextResponse.json({ error: 'Nicht genug D.FAITH Credits' }, { status: 402 });
    }
    await addDfaithCredits(item.artist_wallet, item.price_credits);

  } else if (paymentMethod === 'tokens' && !isSelfPurchase) {
    const artistRows = await sql`
      SELECT solana_address FROM solana_accounts
      WHERE wallet_address = ${item.artist_wallet} LIMIT 1
    `;
    if (!artistRows.length) {
      await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
      return NextResponse.json({ error: 'Artist hat kein Solana-Wallet' }, { status: 404 });
    }

    const secretB58 = decryptKey(buyerSolanaRows[0].solana_private_key as string);
    const buyerKp   = Keypair.fromSecretKey(bs58.decode(secretB58));
    const artistPk  = new PublicKey(artistRows[0].solana_address as string);
    const mintPk    = new PublicKey(effectiveMint!);
    const conn      = new Connection(RPC_URL, 'confirmed');
    const mintInfo  = await getMint(conn, mintPk, 'confirmed', TOKEN_PROGRAM_ID);
    const fromAta   = await getAssociatedTokenAddress(mintPk, buyerKp.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const toAta     = await getAssociatedTokenAddress(mintPk, artistPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    const tx = new Transaction();
    try { await getAccount(conn, toAta); } catch {
      tx.add(createAssociatedTokenAccountInstruction(buyerKp.publicKey, toAta, artistPk, mintPk, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
    }
    const rawAmount = BigInt(Math.round(Number(item.price_credits) * 10 ** mintInfo.decimals));
    tx.add(createTransferInstruction(fromAta, toAta, buyerKp.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

    try {
      await sendAndConfirmTransaction(conn, tx, [buyerKp]);
    } catch (err) {
      await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        error: msg.toLowerCase().includes('insufficient')
          ? 'Nicht genug D.FAITH Tokens im Wallet'
          : `Token-Transfer fehlgeschlagen: ${msg}`,
      }, { status: 402 });
    }
  }

  // ── 2. NFT minten ─────────────────────────────────────────────────────────
  // Artist-Keypair laden damit Artist die Mint-Gebühren zahlt
  const artistKeyRows = await sql`
    SELECT solana_private_key FROM solana_accounts
    WHERE wallet_address = ${item.artist_wallet} LIMIT 1
  `;
  if (!artistKeyRows.length) {
    await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
    return NextResponse.json({ error: 'Artist hat kein Solana-Wallet für NFT-Mint' }, { status: 404 });
  }

  // mpl-core: Editionen werden in die Song-Collection geminted
  const songCollectionMint = item.nft_collection_mint ?? item.master_edition_mint;
  if (!songCollectionMint) {
    await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
    return NextResponse.json({ error: 'Item hat keine On-Chain-Collection für den NFT-Mint' }, { status: 500 });
  }

  let nftMintAddress: string;
  try {
    const { printMint } = await mintSongPrintEdition({
      itemId:            item.id,
      collectionMint:    songCollectionMint,
      buyerSolanaAddress,
      artistPrivateKey:  artistKeyRows[0].solana_private_key as string,
      artistName,
      title:             item.title,
      maxSupply:         item.nft_max_supply !== null ? Number(item.nft_max_supply) : null,
      editionNumber,
    });
    nftMintAddress = printMint;
  } catch (nftErr) {
    // Slot freigeben
    await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;

    // Credits zurückerstatten
    if (paymentMethod === 'credits' && !isSelfPurchase) {
      await addDfaithCredits(buyerWallet.toLowerCase(), item.price_credits);
      await redeemDfaithCredits(item.artist_wallet, item.price_credits).catch(() => {});
    }

    const msg = nftErr instanceof Error ? nftErr.message : String(nftErr);
    console.error('Print Edition Mint fehlgeschlagen:', msg);
    return NextResponse.json({
      error: paymentMethod === 'credits'
        ? `NFT Mint fehlgeschlagen — deine Credits wurden zurückerstattet. Fehler: ${msg}`
        : `NFT Mint fehlgeschlagen. Tokens können nicht automatisch zurückgesendet werden — bitte Support kontaktieren. Fehler: ${msg}`,
      nftError: true,
    }, { status: 500 });
  }

  // ── 3. Kauf speichern (nur bei erfolgreichem Mint) ────────────────────────
  await sql`
    INSERT INTO shop_purchases (buyer_wallet, item_id, price_credits_paid, nft_mint_address, edition_number)
    VALUES (
      ${buyerWallet.toLowerCase()},
      ${itemId},
      ${paymentMethod === 'credits' && !isSelfPurchase ? item.price_credits : 0},
      ${nftMintAddress},
      ${editionNumber}
    )
  `;

  return NextResponse.json({
    success:       true,
    title:         item.title,
    contentUrl:    item.content_url,
    type:          item.type,
    paymentMethod,
    nftMintAddress,
    editionNumber,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Unerwarteter Fehler in /api/shop/purchase:', msg);
    return NextResponse.json({ error: `Interner Fehler: ${msg}` }, { status: 500 });
  }
}
