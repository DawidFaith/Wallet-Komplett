/**
 * POST /api/solana/send-sol
 * Body: { walletAddress: string, toAddress: string, amountSol: number }
 * Sendet SOL aus dem custodial User-Wallet.
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { walletAddress, toAddress, amountSol } = body as {
    walletAddress?: string; toAddress?: string; amountSol?: number;
  };

  if (!walletAddress || !toAddress || typeof amountSol !== 'number' || amountSol <= 0) {
    return NextResponse.json({ error: 'Ungültige Eingabe (walletAddress, toAddress, amountSol benötigt)' }, { status: 400 });
  }

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

  const connection = new Connection(RPC_URL, 'confirmed');
  const lamports   = Math.round(amountSol * LAMPORTS_PER_SOL);

  const tx  = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: toPk, lamports }));
  const sig = await sendAndConfirmTransaction(connection, tx, [kp]);

  return NextResponse.json({ success: true, signature: sig, explorerUrl: `https://solscan.io/tx/${sig}` });
}
