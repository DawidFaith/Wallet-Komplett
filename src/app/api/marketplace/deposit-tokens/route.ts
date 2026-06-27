/**
 * POST /api/marketplace/deposit-tokens
 * Body: { walletAddress, amount }
 *
 * Überträgt D.FAITH-Token aus dem Platform-Wallet des Users ins Treasury
 * und schreibt den Gegenwert als D.FAITH-Credits gut.
 * Treasury zahlt die Tx-Fees (User-Wallet hat kein SOL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferInstruction, getAccount,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { decryptKey } from '../../../lib/solanaCrypto';
import { addDfaithCredits } from '../../../lib/questDb/credits';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';
const DECIMALS    = 6;

async function ensureTxTable(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      from_wallet  TEXT        NOT NULL,
      to_wallet    TEXT        NOT NULL,
      amount       NUMERIC(20,2) NOT NULL,
      type         TEXT        NOT NULL,
      reference_id TEXT,
      note         TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_credit_tx_to   ON credit_transactions(to_wallet, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_credit_tx_from ON credit_transactions(from_wallet, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(type, created_at DESC)`;
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, amount } = await req.json() as {
      walletAddress?: string;
      amount?: number;
    };
    if (!walletAddress || !amount || amount <= 0) {
      return NextResponse.json({ error: 'walletAddress und amount > 0 erforderlich' }, { status: 400 });
    }
    if (!DFAITH_MINT) {
      return NextResponse.json({ error: 'D.FAITH Token-Adresse nicht konfiguriert' }, { status: 503 });
    }

    const sql = getDb();
    await ensureTxTable(sql);

    // User-Solana-Keypair aus DB laden
    const solRows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!solRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet gefunden' }, { status: 400 });
    }
    const userPk      = new PublicKey(solRows[0].solana_address as string);
    const userKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(solRows[0].solana_private_key as string)));

    const treasury    = getTreasuryKeypair();
    const mintPk      = new PublicKey(DFAITH_MINT);
    const connection  = new Connection(RPC_URL, 'confirmed');

    // Token-Adressen bestimmen
    const fromAta = await getAssociatedTokenAddress(mintPk, userPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const toAta   = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    // Guthaben des Users prüfen
    let userTokenBalance = 0;
    try {
      const fromAccount = await getAccount(connection, fromAta);
      userTokenBalance  = Number(fromAccount.amount) / 10 ** DECIMALS;
    } catch {
      return NextResponse.json({ error: 'Kein D.FAITH-Token-Konto gefunden — du hast keine Tokens' }, { status: 400 });
    }
    if (userTokenBalance < amount) {
      return NextResponse.json({
        error: `Nicht genug Tokens. Verfügbar: ${userTokenBalance.toFixed(2)} DFAITH`,
      }, { status: 400 });
    }

    // Transaktion bauen: Treasury zahlt Fees, User überträgt Tokens
    const rawAmount = BigInt(Math.round(amount * 10 ** DECIMALS));
    const tx = new Transaction({ feePayer: treasury.publicKey });

    // Treasury-ATA erstellen falls nicht vorhanden
    try {
      await getAccount(connection, toAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(
        treasury.publicKey, toAta, treasury.publicKey, mintPk,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }

    tx.add(createTransferInstruction(fromAta, toAta, userPk, rawAmount, [], TOKEN_PROGRAM_ID));

    // Treasury signiert als Fee-Payer, User signiert als Token-Authority
    const signature = await sendAndConfirmTransaction(connection, tx, [treasury, userKeypair]);

    // Credits gutschreiben + Transaktion loggen
    await addDfaithCredits(walletAddress, amount);
    const treasuryWallet = treasury.publicKey.toBase58().toLowerCase();
    await sql`
      INSERT INTO credit_transactions (from_wallet, to_wallet, amount, type, reference_id, note)
      VALUES (
        ${walletAddress.toLowerCase()},
        ${treasuryWallet},
        ${amount},
        'token_deposit',
        ${signature},
        ${'Token → Credits: ' + amount + ' DFAITH'}
      )
    `;

    return NextResponse.json({ success: true, amount, signature });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('deposit-tokens Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
