/**
 * POST /api/solana/send-token
 * Body: { walletAddress: string, toAddress: string, amount: number, mintAddress?: string }
 * Sendet SPL-Token (default: D.FAITH) aus dem custodial User-Wallet.
 */
import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferInstruction, getAccount, getMint,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { walletAddress, toAddress, amount, mintAddress } = body as {
    walletAddress?: string; toAddress?: string; amount?: number; mintAddress?: string;
  };

  if (!walletAddress || !toAddress || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'Ungültige Eingabe (walletAddress, toAddress, amount benötigt)' }, { status: 400 });
  }
  const usedMint = mintAddress ?? DFAITH_MINT;
  if (!usedMint) return NextResponse.json({ error: 'Token-Adresse nicht konfiguriert' }, { status: 503 });

  let toPk: PublicKey;
  try { toPk = new PublicKey(toAddress); } catch {
    return NextResponse.json({ error: 'Ungültige Ziel-Adresse' }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT solana_private_key FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Kein Solana-Account gefunden' }, { status: 404 });

  const secretB58 = decryptKey(rows[0].solana_private_key);
  const kp = Keypair.fromSecretKey(bs58.decode(secretB58));

  const mintPk     = new PublicKey(usedMint);
  const connection = new Connection(RPC_URL, 'confirmed');

  // Decimals dynamisch vom Mint lesen
  const mintInfo = await getMint(connection, mintPk, 'confirmed', TOKEN_PROGRAM_ID);
  const decimals = mintInfo.decimals;

  const fromAta = await getAssociatedTokenAddress(mintPk, kp.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const toAta   = await getAssociatedTokenAddress(mintPk, toPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const tx = new Transaction();

  // Ziel-ATA anlegen wenn nötig
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(kp.publicKey, toAta, toPk, mintPk, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
  }

  const rawAmount = BigInt(Math.round(amount * 10 ** decimals));
  tx.add(createTransferInstruction(fromAta, toAta, kp.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

  const sig = await sendAndConfirmTransaction(connection, tx, [kp]);
  return NextResponse.json({ success: true, signature: sig, explorerUrl: `https://solscan.io/tx/${sig}` });
}
