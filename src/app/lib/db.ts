/**
 * Neon PostgreSQL Client
 *
 * Umgebungsvariable: DATABASE_URL
 * Format: postgres://user:password@host/dbname?sslmode=require
 *
 * Einrichten:
 *  1. Neon-Projekt erstellen auf neon.tech
 *  2. Connection String unter PROJECT → Connection Details kopieren
 *  3. In Vercel unter Settings → Environment Variables als DATABASE_URL eintragen
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL Umgebungsvariable ist nicht gesetzt');
  }
  // Singleton pro Serverless-Instanz (Connection-Reuse)
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

/**
 * Migrations-SQL – idempotent, kann jederzeit erneut ausgeführt werden.
 * Läuft über /api/youtube-quests/setup-db (einmalig nach Deployment).
 *
 * Skalierungsnotizen:
 *  - UNIQUE(quest_id, wallet_address) verhindert Doppelabschlüsse auf DB-Ebene (race-condition-safe)
 *  - completions wird mit UPDATE ... SET completions = completions + 1 atomar erhöht
 *  - Für weitere Plattformen: neue Spalten in quest_completions + neue Binding-Tabellen
 */
export const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS youtube_bindings (
    wallet_address    TEXT        PRIMARY KEY,
    channel_id        TEXT        UNIQUE NOT NULL,
    channel_name      TEXT        NOT NULL,
    channel_thumbnail TEXT        NOT NULL DEFAULT '',
    verification_code TEXT        NOT NULL,
    verified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

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
    reward_amount   NUMERIC(20,2) NOT NULL DEFAULT 100,
    max_completions INTEGER     NOT NULL DEFAULT 10,
    completions     INTEGER     NOT NULL DEFAULT 0,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    credits_locked  NUMERIC(20,2) NOT NULL DEFAULT 0,
    credits_refunded BOOLEAN    NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS quest_completions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_id       UUID        NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    wallet_address TEXT        NOT NULL,
    channel_id     TEXT        NOT NULL,
    channel_name   TEXT        NOT NULL,
    platform       TEXT        NOT NULL DEFAULT 'youtube',
    comment_id     TEXT        NOT NULL,
    comment_text   TEXT        NOT NULL DEFAULT '',
    reward_amount  NUMERIC(20,2) NOT NULL,
    reward_paid    BOOLEAN     NOT NULL DEFAULT FALSE,
    completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(quest_id, wallet_address)
  );

  CREATE TABLE IF NOT EXISTS pending_rewards (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT        NOT NULL,
    amount         NUMERIC(20,2) NOT NULL,
    reason         TEXT        NOT NULL DEFAULT '',
    quest_id       UUID        REFERENCES quests(id) ON DELETE SET NULL,
    status         TEXT        NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at        TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS creator_balances (
    wallet_address  TEXT        PRIMARY KEY,
    balance         NUMERIC(20,2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS creator_deposits (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT        NOT NULL,
    tx_hash        TEXT        UNIQUE NOT NULL,
    amount         NUMERIC(20,2) NOT NULL,
    deposited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Unified Dfaith Credits Balance (Fan + Creator)
  CREATE TABLE IF NOT EXISTS dfaith_credits (
    wallet_address  TEXT        PRIMARY KEY,
    balance         NUMERIC(20,2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Instagram Comment Events (von Make.com Watch Comments gepushed)
  -- comment_id Spalte wird als username verwendet
  CREATE TABLE IF NOT EXISTS instagram_mentions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id  TEXT        NOT NULL,
    media_id    TEXT        NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_mentions_username ON instagram_mentions(comment_id);
  CREATE INDEX IF NOT EXISTS idx_instagram_mentions_received ON instagram_mentions(received_at DESC);

  -- Facebook Comment Events (von Make.com gepushed, analog zu Instagram)
  CREATE TABLE IF NOT EXISTS facebook_mentions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT        NOT NULL,
    post_id     TEXT        NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_facebook_mentions_username ON facebook_mentions(username);
  CREATE INDEX IF NOT EXISTS idx_facebook_mentions_received ON facebook_mentions(received_at DESC);

  CREATE INDEX IF NOT EXISTS idx_quests_active    ON quests(is_active, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_quests_creator   ON quests(creator_wallet);
  CREATE INDEX IF NOT EXISTS idx_completions_wallet ON quest_completions(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_completions_quest  ON quest_completions(quest_id);
  CREATE INDEX IF NOT EXISTS idx_bindings_channel   ON youtube_bindings(channel_id);
  CREATE INDEX IF NOT EXISTS idx_pending_rewards_wallet ON pending_rewards(wallet_address, status);
  CREATE INDEX IF NOT EXISTS idx_creator_deposits_wallet ON creator_deposits(wallet_address);

  CREATE TABLE IF NOT EXISTS tiktok_engagement_verifications (
    quest_id        TEXT        NOT NULL,
    wallet_address  TEXT        NOT NULL,
    video_id        TEXT        NOT NULL,
    baseline_likes  INTEGER     NOT NULL DEFAULT 0,
    baseline_shares INTEGER     NOT NULL DEFAULT 0,
    baseline_saves  INTEGER     NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (quest_id, wallet_address)
  );

  CREATE TABLE IF NOT EXISTS facebook_like_verifications (
    quest_id        TEXT        NOT NULL,
    wallet_address  TEXT        NOT NULL,
    post_id         TEXT        NOT NULL,
    baseline_likes  INTEGER     NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (quest_id, wallet_address)
  );

  -- ── Migrationen: bestehende INTEGER-Spalten auf NUMERIC(20,2) erweitern ──
  -- DFAITH hat 2 Decimals, daher müssen Beträge mit 2 Nachkommastellen gespeichert werden.
  ALTER TABLE quests             ALTER COLUMN reward_amount  TYPE NUMERIC(20,2) USING reward_amount::numeric;
  ALTER TABLE quests             ALTER COLUMN credits_locked TYPE NUMERIC(20,2) USING credits_locked::numeric;
  ALTER TABLE quest_completions  ALTER COLUMN reward_amount  TYPE NUMERIC(20,2) USING reward_amount::numeric;
  ALTER TABLE pending_rewards    ALTER COLUMN amount         TYPE NUMERIC(20,2) USING amount::numeric;
  ALTER TABLE creator_balances   ALTER COLUMN balance        TYPE NUMERIC(20,2) USING balance::numeric;
  ALTER TABLE creator_deposits   ALTER COLUMN amount         TYPE NUMERIC(20,2) USING amount::numeric;
  ALTER TABLE dfaith_credits     ALTER COLUMN balance        TYPE NUMERIC(20,2) USING balance::numeric;
`;
