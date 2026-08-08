/**
 * GET /api/admin/unsubscribes
 * Header: x-admin-secret
 * Zeigt E-Mail-Adressen, die sich von Gewinnspiel-Mails abgemeldet haben.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 200));

  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS email_unsubscribes (
        email TEXT PRIMARY KEY,
        source TEXT,
        unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const rows = await sql`
      SELECT email, source, unsubscribed_at
      FROM email_unsubscribes
      ORDER BY unsubscribed_at DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ entries: rows });
  } catch (err) {
    console.error('[admin/unsubscribes]', err);
    return NextResponse.json({ error: 'Liste konnte nicht geladen werden' }, { status: 500 });
  }
}
