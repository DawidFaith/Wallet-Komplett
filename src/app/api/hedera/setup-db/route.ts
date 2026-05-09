import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS hedera_accounts (
        wallet_address     TEXT PRIMARY KEY,
        hedera_account_id  TEXT NOT NULL UNIQUE,
        hedera_private_key TEXT NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    return NextResponse.json({ success: true, message: 'hedera_accounts Tabelle erstellt (oder bereits vorhanden).' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
