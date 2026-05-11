/**
 * POST /api/solana/swap
 * Body: { walletAddress, quoteResponse }
 * Führt Jupiter Swap mit dem custodial User-Keypair durch.
 * Sonderfall: DFAITH → SOL ohne SOL-Balance → Treasury sendet vorher SOL-Vorschuss.
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL,
  SystemProgram, Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL         = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const JUPITER_SWAP    = 'https://api.jup.ag/swap/v1/swap';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? '';
const DFAITH_MINT     = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';
const SOL_MINT        = 'So11111111111111111111111111111111111111112';

/** Unter diesem Wert sendet Treasury einen SOL-Vorschuss an den User (bei DFAITH→SOL Swaps). */
const MIN_SOL_FOR_FEE = 0.012;

export async function POST(req: Request) {
  try {
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

  const connection = new Connection(RPC_URL, 'confirmed');

  // Prüfen ob Treasury-Vorschuss nötig:
  // Nur bei DFAITH→SOL Swap UND User hat zu wenig SOL für Fees
  const isDfaithToSol =
    DFAITH_MINT &&
    (quoteResponse.inputMint as string | undefined) === DFAITH_MINT &&
    (quoteResponse.outputMint as string | undefined) === SOL_MINT;

  let treasuryAdvanceSig: string | null = null;
  if (isDfaithToSol) {
    const lamports   = await connection.getBalance(kp.publicKey);
    const solBalance = lamports / LAMPORTS_PER_SOL;

    if (solBalance < MIN_SOL_FOR_FEE) {
      const treasury   = getTreasuryKeypair();
      // Nur die Differenz senden, nicht mehr
      const needed = MIN_SOL_FOR_FEE - solBalance;
      const advanceLamports = Math.ceil(needed * LAMPORTS_PER_SOL);

      const advanceTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: treasury.publicKey,
          toPubkey:   kp.publicKey,
          lamports:   advanceLamports,
        }),
      );

      // Vorschuss senden und bestätigen (Treasury zahlt hier die Fee)
      treasuryAdvanceSig = await sendAndConfirmTransaction(connection, advanceTx, [treasury], {
        commitment:          'confirmed',
        maxRetries:          3,
      });
      console.log('[swap] Treasury-Vorschuss gesendet:', treasuryAdvanceSig);
    }
  }

  // Swap-Transaktion von Jupiter anfordern
  const swapHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) swapHeaders['Authorization'] = `Bearer ${JUPITER_API_KEY}`;

  const swapRes = await fetch(JUPITER_SWAP, {
    method:  'POST',
    headers: swapHeaders,
    body:    JSON.stringify({
      quoteResponse,
      userPublicKey:             userPk,
      wrapAndUnwrapSol:          true,
      dynamicComputeUnitLimit:   true,
      prioritizationFeeLamports: 'auto',
    }),
    signal:  AbortSignal.timeout(15000),
  });

  const swapData = await swapRes.json() as { swapTransaction?: string; error?: string };
  if (!swapRes.ok || !swapData.swapTransaction) {
    return NextResponse.json({ error: swapData.error ?? 'Jupiter Swap Transaction fehlgeschlagen' }, { status: 502 });
  }

  // Transaktion deserialisieren, signieren (nur User) und senden
  const txBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const tx    = VersionedTransaction.deserialize(txBuf);
  tx.sign([kp]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight:       false,
    maxRetries:          3,
    preflightCommitment: 'confirmed',
  });

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, 'confirmed');

  return NextResponse.json({
    success:             true,
    signature:           sig,
    explorerUrl:         `https://solscan.io/tx/${sig}`,
    treasuryAdvanceSig,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[swap] uncaught error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
