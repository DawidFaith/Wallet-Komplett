/**
 * POST /api/solana/export-key
 * Body: { walletAddress: string }
 * Gibt den entschlüsselten Private Key (BS58) zurück.
 * Nur über authentifizierte Session aufzurufen!
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { walletAddress } = body as { walletAddress?: string };
  if (!walletAddress) return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });

  const sql = getDb();
  const rows = await sql`
    SELECT solana_private_key FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Kein Solana-Account gefunden' }, { status: 404 });

  const privateKeyBs58 = decryptKey(rows[0].solana_private_key);
  return NextResponse.json({ privateKeyBs58 });
}
