/**
 * POST /api/solana/swap
 * Body: { walletAddress, quoteResponse }
 *
 * Reihenfolge bei DFAITH→SOL ohne SOL:
 *  1. Balance + Rent prüfen
 *  2. Treasury-Vorschuss senden (falls nötig)
 *  3. ERST DANACH Jupiter-Tx holen (frischer Blockhash!)
 *  4. Fee aus Tx berechnen, ggf. nachschießen
 *  5. Swap ausführen
 *  6. Vorschuss zurückzahlen
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, VersionedTransaction,
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

async function fetchJupiterTx(
  quoteResponse: Record<string, unknown>,
  userPk: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) headers['Authorization'] = `Bearer ${JUPITER_API_KEY}`;

  const res = await fetch(JUPITER_SWAP, {
    method:  'POST',
    headers,
    body:    JSON.stringify({
      quoteResponse,
      userPublicKey:             userPk,
      wrapAndUnwrapSol:          true,
      dynamicComputeUnitLimit:   true,
      prioritizationFeeLamports: 'auto',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json() as { swapTransaction?: string; error?: string };
  if (!res.ok || !data.swapTransaction) {
    throw new Error(data.error ?? 'Jupiter Swap Transaction fehlgeschlagen');
  }
  return data.swapTransaction;
}

export async function POST(req: Request) {
  let kp:               Keypair | null = null;
  let connection:       Connection | null = null;
  let advancedLamports  = 0;

  try {
  const body = await req.json().catch(() => ({})) as {
    walletAddress?: string;
    quoteResponse?: Record<string, unknown>;
  };
  const { walletAddress, quoteResponse } = body;

  if (!walletAddress || !quoteResponse) {
    return NextResponse.json({ error: 'walletAddress und quoteResponse benötigt' }, { status: 400 });
  }

  const sql  = getDb();
  const rows = await sql`
    SELECT solana_private_key FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Kein Solana-Account gefunden' }, { status: 404 });

  const secretB58 = decryptKey(rows[0].solana_private_key);
  kp         = Keypair.fromSecretKey(bs58.decode(secretB58));
  const userPk    = kp.publicKey.toBase58();
  connection = new Connection(RPC_URL, 'confirmed');

  const isDfaithToSol =
    DFAITH_MINT &&
    (quoteResponse.inputMint as string | undefined) === DFAITH_MINT &&
    (quoteResponse.outputMint as string | undefined) === SOL_MINT;

  let treasuryAdvanceSig: string | null = null;

  if (isDfaithToSol) {
    const [userLamports, rentExemptMin] = await Promise.all([
      connection.getBalance(kp.publicKey),
      connection.getMinimumBalanceForRentExemption(165),
    ]);

    const estimatedFee = 10_000;
    const minRequired  = estimatedFee + rentExemptMin;
    const missing      = minRequired - userLamports;

    if (missing > 0) {
      advancedLamports = missing;
      const treasury   = getTreasuryKeypair();
      const advanceTx  = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: treasury.publicKey,
          toPubkey:   kp.publicKey,
          lamports:   missing,
        }),
      );
      treasuryAdvanceSig = await sendAndConfirmTransaction(connection, advanceTx, [treasury], {
        commitment: 'confirmed',
        maxRetries: 3,
      });
      console.log(`[swap] Treasury-Vorschuss: ${missing} Lamports gesendet`);
    }
  }

  // Jupiter-Tx mit frischem Blockhash holen (NACH dem Vorschuss)
  const swapTxB64 = await fetchJupiterTx(quoteResponse, userPk);
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTxB64, 'base64'));

  tx.sign([kp]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight:       false,
    maxRetries:          3,
    preflightCommitment: 'confirmed',
  });

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, 'confirmed');

  // Vorschuss zurückzahlen (Swap erfolgreich)
  let treasuryRefundSig: string | null = null;
  if (advancedLamports > 0) {
    try {
      const treasury         = getTreasuryKeypair();
      const userBalanceAfter = await connection.getBalance(kp.publicKey);
      const refundAmount     = Math.min(advancedLamports, userBalanceAfter - 5000);
      if (refundAmount > 0) {
        const refundTx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: treasury.publicKey, lamports: refundAmount }),
        );
        treasuryRefundSig = await sendAndConfirmTransaction(connection, refundTx, [kp], { commitment: 'confirmed', maxRetries: 3 });
        console.log(`[swap] Treasury-Rückzahlung: ${refundAmount} Lamports`);
        advancedLamports = 0; // Rückzahlung erledigt
      }
    } catch (refundErr) {
      console.error('[swap] Rückzahlung fehlgeschlagen (nicht kritisch):', refundErr);
    }
  }

  return NextResponse.json({
    success:            true,
    signature:          sig,
    explorerUrl:        `https://solscan.io/tx/${sig}`,
    treasuryAdvanceSig,
    treasuryRefundSig,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[swap] uncaught error:', msg);

    // Vorschuss zurückholen falls Swap fehlschlug oder User abgebrochen hat
    if (advancedLamports > 0 && kp && connection) {
      try {
        const treasury         = getTreasuryKeypair();
        const userBalanceAfter = await connection.getBalance(kp.publicKey);
        const refundAmount     = Math.min(advancedLamports, userBalanceAfter - 5000);
        if (refundAmount > 0) {
          const refundTx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: treasury.publicKey, lamports: refundAmount }),
          );
          await sendAndConfirmTransaction(connection, refundTx, [kp], { commitment: 'confirmed', maxRetries: 3 });
          console.log(`[swap] Notfall-Rückzahlung nach Fehler: ${refundAmount} Lamports`);
        }
      } catch (refundErr) {
        console.error('[swap] Notfall-Rückzahlung fehlgeschlagen:', refundErr);
      }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
