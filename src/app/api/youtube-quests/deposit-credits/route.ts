/**
 * POST /api/youtube-quests/deposit-credits
 *
 * Sendet D.FAITH Token aus dem custodial User-Wallet direkt an den Treasury
 * und schreibt den Betrag als Creator-Credits gut.
 *
 * Body: { walletAddress: string, amount: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferInstruction, getAccount, getMint,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';
import { creditCreatorBalance } from '@/app/lib/questDb';

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { walletAddress, amount } = body;
  if (!walletAddress || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      { error: 'walletAddress und amount (> 0) sind erforderlich' },
      { status: 400 },
    );
  }

  const treasuryAddress = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS;
  if (!treasuryAddress) {
    return NextResponse.json(
      { error: 'Treasury-Adresse nicht konfiguriert (NEXT_PUBLIC_REWARD_POOL_ADDRESS)' },
      { status: 500 },
    );
  }
  if (!DFAITH_MINT) {
    return NextResponse.json(
      { error: 'D.FAITH Token-Mint nicht konfiguriert (NEXT_PUBLIC_SOLANA_DFAITH_TOKEN)' },
      { status: 500 },
    );
  }

  // ── User-Keypair aus DB laden ──────────────────────────────────────────────
  const sql = getDb();
  const rows = await sql`
    SELECT solana_private_key FROM solana_accounts
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Kein Solana-Wallet gefunden. Bitte zuerst ein Wallet erstellen.' },
      { status: 404 },
    );
  }

  let userKp: Keypair;
  try {
    const secret = decryptKey(rows[0].solana_private_key);
    userKp = Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    return NextResponse.json({ error: 'Wallet-Schlüssel konnte nicht entschlüsselt werden.' }, { status: 500 });
  }

  // ── Token-Transfer vorbereiten ─────────────────────────────────────────────
  const mintPk     = new PublicKey(DFAITH_MINT);
  const treasuryPk = new PublicKey(treasuryAddress);
  const connection = new Connection(RPC_URL, 'confirmed');

  let decimals: number;
  try {
    const mintInfo = await getMint(connection, mintPk, 'confirmed', TOKEN_PROGRAM_ID);
    decimals = mintInfo.decimals;
  } catch {
    return NextResponse.json({ error: 'D.FAITH Mint-Info konnte nicht geladen werden.' }, { status: 502 });
  }

  const fromAta = await getAssociatedTokenAddress(
    mintPk, userKp.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const toAta = await getAssociatedTokenAddress(
    mintPk, treasuryPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();

  // Treasury-ATA anlegen falls noch nicht vorhanden (User zahlt Rent)
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(
      userKp.publicKey, toAta, treasuryPk, mintPk,
      TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  }

  const rawAmount = BigInt(Math.round(amount * 10 ** decimals));
  tx.add(createTransferInstruction(fromAta, toAta, userKp.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

  // ── Transaktion senden ─────────────────────────────────────────────────────
  let signature: string;
  try {
    signature = await sendAndConfirmTransaction(connection, tx, [userKp]);
  } catch (e: unknown) {
    const msg = (e as Error)?.message ?? '';
    if (msg.includes('insufficient') || msg.includes('0x1')) {
      return NextResponse.json(
        { error: 'Nicht genug D.FAITH Token im Wallet.' },
        { status: 402 },
      );
    }
    console.error('[deposit-credits] Transfer fehlgeschlagen:', e);
    return NextResponse.json({ error: 'Transaktion fehlgeschlagen. Bitte erneut versuchen.' }, { status: 502 });
  }

  // ── Credits gutschreiben ───────────────────────────────────────────────────
  try {
    const actualAmount = Math.round(amount * 100) / 100;
    await creditCreatorBalance(walletAddress, actualAmount, signature);
    return NextResponse.json({
      success: true,
      credited: actualAmount,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    });
  } catch (e: unknown) {
    // Duplicate TX (sollte nicht passieren, aber sicher ist sicher)
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ success: true, credited: amount, signature });
    }
    console.error('[deposit-credits] Gutschrift fehlgeschlagen:', e);
    return NextResponse.json(
      { error: `Transfer erfolgreich (TX: ${signature}), aber Gutschrift schlug fehl. Bitte Support kontaktieren.` },
      { status: 500 },
    );
  }
}
