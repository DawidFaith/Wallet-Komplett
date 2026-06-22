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

const RPC_URL    = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;
const DECIMALS   = 6;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { secret, toAddress, amount } = body as { secret?: string; toAddress?: string; amount?: number };

  if (secret !== process.env.MIGRATION_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!toAddress || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'toAddress und amount (>0) benötigt' }, { status: 400 });
  }
  if (!DFAITH_MINT) return NextResponse.json({ error: 'D.FAITH Token-Adresse nicht konfiguriert' }, { status: 503 });

  let toPk: PublicKey;
  try { toPk = new PublicKey(toAddress); } catch {
    return NextResponse.json({ error: 'Ungültige Solana-Adresse' }, { status: 400 });
  }

  const treasury   = getTreasuryKeypair();
  const mintPk     = new PublicKey(DFAITH_MINT);
  const connection = new Connection(RPC_URL, 'confirmed');

  const fromAta = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const toAta   = await getAssociatedTokenAddress(mintPk, toPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const tx = new Transaction();
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(treasury.publicKey, toAta, toPk, mintPk, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
  }

  const rawAmount = BigInt(Math.round(amount * 10 ** DECIMALS));
  tx.add(createTransferInstruction(fromAta, toAta, treasury.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
  return NextResponse.json({ success: true, signature: sig, explorerUrl: `https://solscan.io/tx/${sig}` });
}
