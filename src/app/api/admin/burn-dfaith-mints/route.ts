/**
 * POST /api/admin/burn-dfaith-mints — TEMPORÄR (2026-07-15), 3. Runde
 * Header: x-admin-secret
 *
 * Verbrennt die volle Treasury-Balance und schließt die Treasury-ATA für
 * den vorherigen D.FAITH-Testmint, der durch einen neueren ersetzt wurde.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, getAccount, createBurnInstruction, createCloseAccountInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

const MINTS = [
  '2zg8xeNLTrXnk9MHrJ2GAuuCWz7W6MKqDvLo9TQkXErk',
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const treasury    = getTreasuryKeypair();
  const results: Array<{ mint: string; status: string; error?: string }> = [];

  for (const mintStr of MINTS) {
    try {
      const mintPk = new PublicKey(mintStr);
      const ata = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      let balance = 0n;
      try {
        const acct = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
        balance = acct.amount;
      } catch {
        results.push({ mint: mintStr, status: 'kein ATA gefunden — übersprungen' });
        continue;
      }

      const tx = new Transaction();
      if (balance > 0n) {
        tx.add(createBurnInstruction(ata, mintPk, treasury.publicKey, balance, [], TOKEN_PROGRAM_ID));
      }
      tx.add(createCloseAccountInstruction(ata, treasury.publicKey, treasury.publicKey, [], TOKEN_PROGRAM_ID));

      const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
      results.push({ mint: mintStr, status: `verbrannt (${balance}) + ATA geschlossen: ${sig}` });
    } catch (e) {
      results.push({ mint: mintStr, status: 'Fehler', error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ results });
}
