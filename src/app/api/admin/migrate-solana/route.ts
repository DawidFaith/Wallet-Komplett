import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({}));
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS solana_accounts (
      wallet_address   TEXT        PRIMARY KEY,
      solana_address   TEXT        UNIQUE NOT NULL,
      solana_private_key TEXT      NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  return NextResponse.json({ ok: true, message: 'solana_accounts Tabelle erstellt (oder bereits vorhanden).' });
}
