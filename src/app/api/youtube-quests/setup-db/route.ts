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
import { getDb } from '../../../lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret');
  const expected = process.env.MIGRATION_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const sql = getDb();
    // Neon HTTP-Treiber unterstützt kein sql.unsafe() – jeden Statement einzeln ausführen
    await sql`
      CREATE TABLE IF NOT EXISTS youtube_bindings (
        wallet_address    TEXT        PRIMARY KEY,
        channel_id        TEXT        UNIQUE NOT NULL,
        channel_name      TEXT        NOT NULL,
        channel_thumbnail TEXT        NOT NULL DEFAULT '',
        verification_code TEXT        NOT NULL,
        verified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS quests (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        platform        TEXT        NOT NULL DEFAULT 'youtube',
        quest_type      TEXT        NOT NULL DEFAULT 'comment',
        creator_wallet  TEXT        NOT NULL,
        video_id        TEXT        NOT NULL,
        video_title     TEXT        NOT NULL,
        video_thumbnail TEXT        NOT NULL DEFAULT '',
        video_url       TEXT        NOT NULL,
        description     TEXT        NOT NULL DEFAULT '',
        reward_amount   INTEGER     NOT NULL DEFAULT 100,
        max_completions INTEGER     NOT NULL DEFAULT 10,
        completions     INTEGER     NOT NULL DEFAULT 0,
        is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS quest_completions (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        quest_id       UUID        NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        wallet_address TEXT        NOT NULL,
        channel_id     TEXT        NOT NULL,
        channel_name   TEXT        NOT NULL,
        platform       TEXT        NOT NULL DEFAULT 'youtube',
        comment_id     TEXT        NOT NULL,
        comment_text   TEXT        NOT NULL DEFAULT '',
        reward_amount  INTEGER     NOT NULL,
        reward_paid    BOOLEAN     NOT NULL DEFAULT FALSE,
        completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(quest_id, wallet_address)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_quests_active      ON quests(is_active, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quests_creator     ON quests(creator_wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_completions_wallet ON quest_completions(wallet_address)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_completions_quest  ON quest_completions(quest_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bindings_channel   ON youtube_bindings(channel_id)`;

    return NextResponse.json({
      success: true,
      message: 'Tabellen youtube_bindings, quests, quest_completions und Indizes erstellt.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Migration fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
