/**
 * Einmalige Datenbank-Migration
 * Aufruf: POST /api/youtube-quests/setup-db
 *
 * Sicherung: Route ist nur ausführbar wenn MIGRATION_SECRET als Header übergeben wird.
 * Setze MIGRATION_SECRET als Vercel-Umgebungsvariable (beliebiger langer String).
 *
 * Beispiel curl:
 *   curl -X POST https://deine-domain.vercel.app/api/youtube-quests/setup-db \
 *     -H "x-migration-secret: DEIN_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, MIGRATION_SQL } from '../../../lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret');
  const expected = process.env.MIGRATION_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const sql = getDb();
    // Mehrere Statements via neon HTTP ausführen
    const statements = MIGRATION_SQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    return NextResponse.json({
      success: true,
      message: 'Tabellen youtube_bindings, quests, quest_completions und Indizes erstellt.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Migration fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
