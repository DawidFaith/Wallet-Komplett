/**
 * GET /api/admin/audit-log
 * Header: x-admin-secret
 * Zeigt die letzten Zugriffe auf /api/admin/* (siehe middleware.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 100));

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, route, method, ip, secret_valid, status_code, created_at
      FROM admin_audit_log
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ entries: rows });
  } catch (err) {
    console.error('[admin/audit-log]', err);
    return NextResponse.json({ error: 'Log konnte nicht geladen werden' }, { status: 500 });
  }
}
