/**
 * POST /api/solana/swap
 * Body: { walletAddress, quoteResponse }
 * Führt Jupiter Swap mit dem custodial User-Keypair durch.
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';

const RPC_URL       = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const JUPITER_SWAP  = 'https://quote-api.jup.ag/v6/swap';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? '';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    walletAddress?: string;
    quoteResponse?: Record<string, unknown>;
  };
  const { walletAddress, quoteResponse } = body;

  if (!walletAddress || !quoteResponse) {
    return NextResponse.json({ error: 'walletAddress und quoteResponse benötigt' }, { status: 400 });
  }

  // Keypair aus DB laden
  const sql  = getDb();
  const rows = await sql`
    SELECT solana_private_key FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Kein Solana-Account gefunden' }, { status: 404 });

  const secretB58 = decryptKey(rows[0].solana_private_key);
  const kp        = Keypair.fromSecretKey(bs58.decode(secretB58));
  const userPk    = kp.publicKey.toBase58();

  // Swap-Transaktion von Jupiter anfordern
  const swapHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) swapHeaders['Authorization'] = `Bearer ${JUPITER_API_KEY}`;

  const swapRes = await fetch(JUPITER_SWAP, {
    method:  'POST',
    headers: swapHeaders,
    body:    JSON.stringify({
      quoteResponse,
      userPublicKey:              userPk,
      wrapAndUnwrapSol:           true,
      dynamicComputeUnitLimit:    true,
      prioritizationFeeLamports:  'auto',
    }),
    signal: AbortSignal.timeout(15000),
  });

  const swapData = await swapRes.json() as { swapTransaction?: string; error?: string };
  if (!swapRes.ok || !swapData.swapTransaction) {
    return NextResponse.json({ error: swapData.error ?? 'Jupiter Swap Transaction fehlgeschlagen' }, { status: 502 });
  }

  // Transaktion deserialisieren, signieren und senden
  const connection = new Connection(RPC_URL, 'confirmed');
  const txBuf      = Buffer.from(swapData.swapTransaction, 'base64');
  const tx         = VersionedTransaction.deserialize(txBuf);
  tx.sign([kp]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight:       false,
    maxRetries:          3,
    preflightCommitment: 'confirmed',
  });

  // Auf Bestätigung warten (max 30s)
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, 'confirmed');

  return NextResponse.json({
    success:     true,
    signature:   sig,
    explorerUrl: `https://solscan.io/tx/${sig}`,
  });
}
