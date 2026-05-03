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
        expires_at      TIMESTAMPTZ,
        credits_locked  INTEGER     NOT NULL DEFAULT 0,
        credits_refunded BOOLEAN    NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // Bestehende Installationen: Spalten nachrüsten
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS credits_locked INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS credits_refunded BOOLEAN NOT NULL DEFAULT FALSE`;
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
    // Für bestehende Installationen: expires_at nachrüsten
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;

    await sql`CREATE INDEX IF NOT EXISTS idx_quests_active      ON quests(is_active, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quests_creator     ON quests(creator_wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_completions_wallet ON quest_completions(wallet_address)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_completions_quest  ON quest_completions(quest_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bindings_channel   ON youtube_bindings(channel_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS pending_rewards (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT        NOT NULL,
        amount         INTEGER     NOT NULL,
        reason         TEXT        NOT NULL DEFAULT '',
        quest_id       UUID        REFERENCES quests(id) ON DELETE SET NULL,
        status         TEXT        NOT NULL DEFAULT 'pending',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at        TIMESTAMPTZ
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_rewards_wallet ON pending_rewards(wallet_address, status)`;

    await sql`
      CREATE TABLE IF NOT EXISTS creator_balances (
        wallet_address  TEXT        PRIMARY KEY,
        balance         INTEGER     NOT NULL DEFAULT 0,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS creator_deposits (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT        NOT NULL,
        tx_hash        TEXT        UNIQUE NOT NULL,
        amount         INTEGER     NOT NULL,
        deposited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_creator_deposits_wallet ON creator_deposits(wallet_address)`;

    // UNIQUE-Constraint: dieselbe channel_id darf denselben Quest nur einmal abschließen
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_completions_channel_quest
      ON quest_completions(quest_id, channel_id)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dfaith_credits (
        wallet_address  TEXT        PRIMARY KEY,
        balance         INTEGER     NOT NULL DEFAULT 0,
        is_claiming     BOOLEAN     NOT NULL DEFAULT false,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // Für bestehende Installationen: Spalte nachrüsten falls fehlt
    await sql`ALTER TABLE dfaith_credits ADD COLUMN IF NOT EXISTS is_claiming BOOLEAN NOT NULL DEFAULT false`;

    // Einmalig: dfaith_credits aus creator_balances befüllen (nur wenn noch kein Eintrag)
    // Verhindert dass Credits nach dem Einlösen wieder auf den alten Wert springen
    await sql`
      INSERT INTO dfaith_credits (wallet_address, balance, is_claiming, updated_at)
      SELECT wallet_address, balance, false, NOW()
      FROM creator_balances
      ON CONFLICT (wallet_address) DO NOTHING
    `;

    // Like-Verifications: temporäre Tabelle für den 3-Schritt-Like-Nachweis
    await sql`
      CREATE TABLE IF NOT EXISTS like_verifications (
        quest_id        UUID        NOT NULL,
        wallet_address  TEXT        NOT NULL,
        video_id        TEXT        NOT NULL,
        baseline_likes  INTEGER     NOT NULL,
        removed_likes   INTEGER,
        step            TEXT        NOT NULL DEFAULT 'baseline',
        removal_at      TIMESTAMPTZ,
        expires_at      TIMESTAMPTZ,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (quest_id, wallet_address)
      )
    `;

    // Secret-Quest: Code-Spalte nachrüsten (idempotent)
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS secret_code TEXT`;

    // ── Benutzerprofile ──────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        wallet_address      TEXT        PRIMARY KEY,
        instagram_handle    TEXT,
        instagram_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
        instagram_name      TEXT,
        instagram_picture   TEXT,
        tiktok_handle       TEXT,
        tiktok_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
        tiktok_name         TEXT,
        tiktok_picture      TEXT,
        facebook_handle     TEXT,
        facebook_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
        facebook_name       TEXT,
        facebook_picture    TEXT,
        youtube_channel_id  TEXT,
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // Bestehende Installationen: Spalten idempotent nachrüsten
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS instagram_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS instagram_picture TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tiktok_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tiktok_picture TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS facebook_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS facebook_picture TEXT`;

    // ── XP / Level ───────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS user_xp (
        wallet_address  TEXT        PRIMARY KEY,
        xp              INTEGER     NOT NULL DEFAULT 0,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // XP pro abgeschlossenem Quest gutschreiben: Spalte in quest_completions (idempotent)
    await sql`ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS xp_awarded INTEGER NOT NULL DEFAULT 0`;

    return NextResponse.json({
      success: true,
      message: 'Alle Tabellen (inkl. dfaith_credits, expires_at) erstellt.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Migration fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
