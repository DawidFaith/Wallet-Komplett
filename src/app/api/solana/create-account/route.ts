/**
 * GET  /api/solana/create-account?walletAddress=0x...
 *   → Prüft ob Account existiert, gibt solana_address zurück
 * POST /api/solana/create-account
 *   Body: { walletAddress: string }
 *   → Erstellt neues Solana Keypair, verschlüsselt Private Key, speichert in DB
 *     Sendet 0.01 SOL vom Treasury als Startguthaben
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, SystemProgram, Transaction,
  LAMPORTS_PER_SOL, sendAndConfirmTransaction, PublicKey,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { encryptKey } from '@/app/lib/solanaCrypto';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;

// 0.01 SOL Startguthaben für Rent-Exemption + Fees
const FUND_SOL = 0.01;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress')?.toLowerCase();
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });

    const sql = getDb();
    const rows = await sql`
      SELECT solana_address FROM solana_accounts WHERE wallet_address = ${walletAddress}
    `;
    if (rows.length > 0) {
      return NextResponse.json({ solanaAddress: rows[0].solana_address });
    }
    return NextResponse.json({ solanaAddress: null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
  const body = await req.json().catch(() => ({}));
  const walletAddress = (body.walletAddress as string | undefined)?.toLowerCase();
  if (!walletAddress) return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });

  const sql = getDb();

  // Existenz-Check
  const existing = await sql`
    SELECT solana_address FROM solana_accounts WHERE wallet_address = ${walletAddress}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ solanaAddress: existing[0].solana_address, existed: true });
  }

  // Neues Keypair generieren
  const newKp      = Keypair.generate();
  const newAddress = newKp.publicKey.toBase58();
  const secretB58  = bs58.encode(newKp.secretKey);
  const encrypted  = encryptKey(secretB58);

  // In DB speichern
  await sql`
    INSERT INTO solana_accounts (wallet_address, solana_address, solana_private_key)
    VALUES (${walletAddress}, ${newAddress}, ${encrypted})
  `;

  // Mit SOL befüllen + ggf. ATA für D.FAITH anlegen
  try {
    const treasury = getTreasuryKeypair();
    const connection = new Connection(RPC_URL, 'confirmed');

    const instructions = [
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey:   newKp.publicKey,
        lamports:   Math.round(FUND_SOL * LAMPORTS_PER_SOL),
      }),
    ];

    // ATA für D.FAITH anlegen wenn Token konfiguriert
    if (DFAITH_MINT) {
      const mintPk = new PublicKey(DFAITH_MINT);
      const ata = await getAssociatedTokenAddress(mintPk, newKp.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      instructions.push(
        createAssociatedTokenAccountInstruction(
          treasury.publicKey, // payer
          ata,
          newKp.publicKey,    // owner
          mintPk,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    const tx = new Transaction().add(...instructions);
    const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
    return NextResponse.json({ solanaAddress: newAddress, funded: true, sig });
  } catch (e) {
    // Funding fehlgeschlagen, Account trotzdem zurückgeben
    return NextResponse.json({ solanaAddress: newAddress, funded: false, fundError: String(e) });
  }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
