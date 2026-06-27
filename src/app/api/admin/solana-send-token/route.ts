/**
 * POST /api/admin/solana-send-token
 * Body: { secret, toAddress, amount }
 * Sendet D.FAITH aus dem Treasury-Wallet.
 */
import { NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferInstruction, getAccount,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;
const DECIMALS    = 6;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { secret, toAddress, amount } = body as { secret?: string; toAddress?: string; amount?: number };

    if (secret !== process.env.MIGRATION_SECRET) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    if (!toAddress || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'toAddress und amount (>0) benötigt' }, { status: 400 });
    }
    if (!DFAITH_MINT) {
      return NextResponse.json({ error: 'D.FAITH Token-Adresse nicht konfiguriert (NEXT_PUBLIC_SOLANA_DFAITH_TOKEN fehlt)' }, { status: 503 });
    }

    let toPk: PublicKey;
    try {
      toPk = new PublicKey(toAddress);
    } catch {
      return NextResponse.json({ error: 'Ungültige Solana-Adresse' }, { status: 400 });
    }

    const treasury   = getTreasuryKeypair();
    const mintPk     = new PublicKey(DFAITH_MINT);
    const connection = new Connection(RPC_URL, 'confirmed');

    const fromAta = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const toAta   = await getAssociatedTokenAddress(mintPk, toPk,               false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    // Treasury-Guthaben prüfen
    let treasuryBalance = 0;
    try {
      const fromAccount = await getAccount(connection, fromAta);
      treasuryBalance   = Number(fromAccount.amount) / 10 ** DECIMALS;
    } catch {
      return NextResponse.json({ error: 'Treasury hat kein D.FAITH-Token-Konto — noch keine Tokens erhalten' }, { status: 400 });
    }
    if (treasuryBalance < amount) {
      return NextResponse.json({
        error: `Treasury hat nicht genug D.FAITH. Verfügbar: ${treasuryBalance.toLocaleString('de-DE', { maximumFractionDigits: 2 })} — Angefordert: ${amount.toLocaleString('de-DE')}`,
      }, { status: 400 });
    }

    const tx = new Transaction();

    // Empfänger-ATA erstellen falls nicht vorhanden
    try {
      await getAccount(connection, toAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(
        treasury.publicKey, toAta, toPk, mintPk,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }

    const rawAmount = BigInt(Math.round(amount * 10 ** DECIMALS));
    tx.add(createTransferInstruction(fromAta, toAta, treasury.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

    const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);

    return NextResponse.json({
      success:     true,
      signature:   sig,
      explorerUrl: `https://solscan.io/tx/${sig}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('solana-send-token Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
