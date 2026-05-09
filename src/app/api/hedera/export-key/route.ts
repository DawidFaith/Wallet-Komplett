/**
 * POST /api/hedera/export-key
 * Body: { walletAddress: "0x..." }
 *
 * Gibt den Private Key zurück damit der User ihn in HashPack importieren kann.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/hederaCrypto';

const EVM_REGEX = /^0x[0-9a-fA-F]{40}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { walletAddress } = body ?? {};

  if (!walletAddress || !EVM_REGEX.test(walletAddress)) {
    return NextResponse.json({ error: 'Ungültige walletAddress' }, { status: 400 });
  }

  const sql  = getDb();
  const rows = await sql`
    SELECT hedera_account_id, hedera_private_key FROM hedera_accounts
    WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Kein Hedera Account gefunden' }, { status: 404 });
  }

  try {
    const privateKeyDer = decryptKey(rows[0].hedera_private_key);
    const { PrivateKey }  = await import('@hashgraph/sdk');
    const key = PrivateKey.fromStringDer(privateKeyDer);

    return NextResponse.json({
      hederaAccountId: rows[0].hedera_account_id,
      privateKeyHex: key.toStringRaw(), // ED25519 Hex — für HashPack Import
      privateKeyDer,
    });
  } catch (err) {
    console.error('[hedera/export-key]', err);
    return NextResponse.json({ error: 'Entschlüsselung fehlgeschlagen' }, { status: 500 });
  }
}
