/**
 * POST /api/solana/send-sol
 * Body: { walletAddress: string, toAddress: string, amountSol: number | 'max' }
 * Sendet SOL aus dem custodial User-Wallet.
 * Bei amountSol = 'max' wird die Tx-Gebühr automatisch abgezogen.
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
    walletAddress?: string; toAddress?: string; amountSol?: number | 'max';
  };

  if (!walletAddress || !toAddress || amountSol === undefined || amountSol === null) {
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

  let lamports: number;

  if (amountSol === 'max') {
    // Aktuelle Balance holen
    const balanceLamports = await connection.getBalance(kp.publicKey);

    // Dummy-Transaktion bauen um echte Gebühr zu berechnen
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const dummyTx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: kp.publicKey,
    }).add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: toPk, lamports: 1 }));
    dummyTx.sign(kp);

    const fee = await connection.getFeeForMessage(dummyTx.compileMessage(), 'confirmed');
    const feeValue = fee.value ?? 5000; // Fallback: 5000 Lamports

    lamports = balanceLamports - feeValue;
    if (lamports <= 0) {
      return NextResponse.json({ error: 'Nicht genug SOL für die Transaktionsgebühr' }, { status: 400 });
    }
  } else {
    if (typeof amountSol !== 'number' || amountSol <= 0) {
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
    }
    lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  }

  const tx  = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: toPk, lamports }));
  const sig = await sendAndConfirmTransaction(connection, tx, [kp]);

  return NextResponse.json({ success: true, signature: sig, explorerUrl: `https://solscan.io/tx/${sig}` });
}
