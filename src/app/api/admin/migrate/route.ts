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
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_artist BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS artist_type TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS artist_bio TEXT`;

    // Backfill: user_profiles-Einträge für alle solana_accounts ohne Profil anlegen
    const backfill = await sql`
      INSERT INTO user_profiles (wallet_address, updated_at)
      SELECT sa.wallet_address, NOW()
      FROM solana_accounts sa
      WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles p WHERE p.wallet_address = sa.wallet_address
      )
    `;

    return NextResponse.json({ success: true, message: `Migration + Backfill abgeschlossen (${backfill.count} neue Profile)` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
