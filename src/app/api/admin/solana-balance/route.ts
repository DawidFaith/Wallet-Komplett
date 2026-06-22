/**
 * GET /api/admin/solana-balance
 * Query: ?secret=...
 * Gibt SOL + D.FAITH Treasury Balance zurück.
 */
import { NextResponse } from 'next/server';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL    = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const treasury   = getTreasuryKeypair();
    const connection = new Connection(RPC_URL, 'confirmed');

    const lamports   = await connection.getBalance(treasury.publicKey);
    const solBalance = lamports / LAMPORTS_PER_SOL;

    let dfaithBalance: number | null = null;
    if (DFAITH_MINT) {
      try {
        const mintPk = new PublicKey(DFAITH_MINT);
        const ata    = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
        const info   = await getAccount(connection, ata);
        dfaithBalance = Number(info.amount) / 1e2;
      } catch {
        dfaithBalance = 0;
      }
    }

    return NextResponse.json({
      address: treasury.publicKey.toBase58(),
      solBalance,
      dfaithBalance,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const notConfigured = msg.toLowerCase().includes('treasury') || msg.toLowerCase().includes('private_key') || msg.toLowerCase().includes('env');
    return NextResponse.json(
      { error: notConfigured ? 'SOLANA_TREASURY_PRIVATE_KEY nicht konfiguriert.' : msg },
      { status: 500 },
    );
  }
}
