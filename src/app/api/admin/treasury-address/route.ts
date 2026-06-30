/**
 * GET /api/admin/treasury-address
 * Gibt nur die öffentliche Treasury-Adresse zurück (keine sensiblen Daten).
 */
import { NextResponse } from 'next/server';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

export async function GET() {
  try {
    const treasury = getTreasuryKeypair();
    return NextResponse.json({ address: treasury.publicKey.toBase58() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
