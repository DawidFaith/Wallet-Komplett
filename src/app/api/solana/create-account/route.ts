/**
 * GET  /api/solana/create-account?walletAddress=0x...
 *   → Prüft ob Account existiert, gibt solana_address zurück
 * POST /api/solana/create-account
 *   Body: { walletAddress: string }
 *   → Erstellt neues Solana Keypair, verschlüsselt Private Key, speichert in DB
 *     Kein Funding, kein ATA – Account existiert off-chain in der DB.
 */
import { NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { encryptKey } from '@/app/lib/solanaCrypto';

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

  return NextResponse.json({ solanaAddress: newAddress });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
