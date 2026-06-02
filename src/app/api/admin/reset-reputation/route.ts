import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const { artistWallet } = await req.json();
    if (!artistWallet?.trim()) {
      return NextResponse.json({ error: 'artistWallet fehlt' }, { status: 400 });
    }
    const sql = getDb();
    const result = await sql`
      DELETE FROM user_reputation
      WHERE artist_wallet = ${artistWallet.toLowerCase()}
    `;
    return NextResponse.json({ success: true, deleted: result.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
