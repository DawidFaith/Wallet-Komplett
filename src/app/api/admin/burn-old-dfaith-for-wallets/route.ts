/**
 * POST /api/admin/burn-old-dfaith-for-wallets — TEMPORÄR (2026-07-15)
 * Header: x-admin-secret
 *
 * Verbrennt die Restbestände des ALTEN D.FAITH-Mints in den angegebenen
 * Solana-Wallets und schließt die jeweilige ATA (Rent geht an den
 * Wallet-Besitzer selbst zurück). Treasury zahlt die Tx-Gebühren, da
 * einige Fan-Wallets kein eigenes SOL haben.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, getAccount, createBurnInstruction, createCloseAccountInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const OLD_DFAITH_MINT = '9jB95PZQ2eYs83upTpDv7gqMvuMVtB55QRATZajnmki6';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { solanaAddresses } = await req.json() as { solanaAddresses?: string[] };
  if (!Array.isArray(solanaAddresses) || solanaAddresses.length === 0) {
    return NextResponse.json({ error: 'solanaAddresses (Array) erforderlich' }, { status: 400 });
  }

  const sql = getDb();
  const connection = new Connection(RPC_URL, 'confirmed');
  const treasury = getTreasuryKeypair();
  const mintPk = new PublicKey(OLD_DFAITH_MINT);
  const results: Array<{ address: string; status: string; error?: string }> = [];

  for (const solanaAddress of solanaAddresses) {
    try {
      const rows = await sql`
        SELECT solana_private_key FROM solana_accounts WHERE solana_address = ${solanaAddress} LIMIT 1
      `;
      if (!rows.length) {
        results.push({ address: solanaAddress, status: 'kein Account in DB gefunden' });
        continue;
      }
      const ownerKp = Keypair.fromSecretKey(bs58.decode(decryptKey(rows[0].solana_private_key as string)));

      const ata = await getAssociatedTokenAddress(mintPk, ownerKp.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      let balance = 0n;
      try {
        const acct = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
        balance = acct.amount;
      } catch {
        results.push({ address: solanaAddress, status: 'kein ATA für alten Token gefunden — übersprungen' });
        continue;
      }

      const tx = new Transaction();
      tx.feePayer = treasury.publicKey;
      if (balance > 0n) {
        tx.add(createBurnInstruction(ata, mintPk, ownerKp.publicKey, balance, [], TOKEN_PROGRAM_ID));
      }
      tx.add(createCloseAccountInstruction(ata, ownerKp.publicKey, ownerKp.publicKey, [], TOKEN_PROGRAM_ID));

      const sig = await sendAndConfirmTransaction(connection, tx, [treasury, ownerKp]);
      results.push({ address: solanaAddress, status: `verbrannt (${balance}) + ATA geschlossen: ${sig}` });
    } catch (e) {
      results.push({ address: solanaAddress, status: 'Fehler', error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ results });
}
