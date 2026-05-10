/**
 * GET /api/solana/balance?solanaAddress=...
 * Gibt SOL-Guthaben und D.FAITH Token-Balance zurück.
 */
import { NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('solanaAddress');
  if (!address) return NextResponse.json({ error: 'solanaAddress fehlt' }, { status: 400 });

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(address);
  } catch {
    return NextResponse.json({ error: 'Ungültige Solana-Adresse' }, { status: 400 });
  }

  const connection = new Connection(RPC_URL, 'confirmed');

  // SOL Balance
  const lamports = await connection.getBalance(pubkey);
  const solBalance = lamports / LAMPORTS_PER_SOL;

  // D.FAITH Token Balance
  let dfaithBalance: number | null = null;
  if (DFAITH_MINT) {
    try {
      const mintPk = new PublicKey(DFAITH_MINT);
      const ata = await getAssociatedTokenAddress(mintPk, pubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const tokenAccount = await getAccount(connection, ata);
      dfaithBalance = Number(tokenAccount.amount) / 1e6; // 6 Dezimalstellen
    } catch {
      dfaithBalance = 0;
    }
  }

  return NextResponse.json({ solBalance, dfaithBalance });
}
