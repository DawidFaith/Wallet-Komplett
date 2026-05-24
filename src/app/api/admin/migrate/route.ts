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

    // ── Fehlende Tabellen anlegen ────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS facebook_mentions (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        username    TEXT        NOT NULL,
        post_id     TEXT        NOT NULL DEFAULT '',
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_facebook_mentions_username ON facebook_mentions(username)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_facebook_mentions_received ON facebook_mentions(received_at DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS instagram_mentions (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id  TEXT        NOT NULL,
        media_id    TEXT        NOT NULL DEFAULT '',
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_mentions_username ON instagram_mentions(comment_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_instagram_mentions_received ON instagram_mentions(received_at DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS solana_accounts (
        wallet_address   TEXT        PRIMARY KEY,
        solana_address   TEXT        NOT NULL,
        solana_private_key TEXT      NOT NULL DEFAULT '',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        wallet_address     TEXT        PRIMARY KEY,
        display_name       TEXT,
        is_artist          BOOLEAN     NOT NULL DEFAULT FALSE,
        artist_type        TEXT,
        artist_bio         TEXT,
        reward_token       TEXT,
        instagram_handle   TEXT,
        instagram_verified BOOLEAN     NOT NULL DEFAULT FALSE,
        instagram_name     TEXT,
        instagram_picture  TEXT,
        tiktok_handle      TEXT,
        tiktok_verified    BOOLEAN     NOT NULL DEFAULT FALSE,
        tiktok_name        TEXT,
        tiktok_picture     TEXT,
        facebook_handle    TEXT,
        facebook_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
        facebook_name      TEXT,
        facebook_picture   TEXT,
        youtube_channel_id TEXT,
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dfaith_credits (
        wallet_address TEXT        PRIMARY KEY,
        balance        NUMERIC(20,2) NOT NULL DEFAULT 0,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_xp (
        wallet_address TEXT        PRIMARY KEY,
        xp             INTEGER     NOT NULL DEFAULT 0,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // ── Spalten nachrüsten ───────────────────────────────────────────────────
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_artist BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS artist_type TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS artist_bio TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS reward_token TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS token_mint_address TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_platform TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS instagram_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS instagram_picture TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tiktok_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tiktok_picture TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS facebook_name TEXT`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS facebook_picture TEXT`;

    // ── Reputation-System Migration ──────────────────────────────────────────
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS reputation_reward INTEGER NOT NULL DEFAULT 50`;

    await sql`
      CREATE TABLE IF NOT EXISTS user_reputation (
        wallet_address  TEXT        NOT NULL,
        artist_wallet   TEXT        NOT NULL,
        reputation      INTEGER     NOT NULL DEFAULT 0,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (wallet_address, artist_wallet)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_reputation_artist ON user_reputation(artist_wallet, reputation DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_reputation_wallet ON user_reputation(wallet_address)`;

    await sql`
      CREATE TABLE IF NOT EXISTS reputation_levels (
        artist_wallet     TEXT        NOT NULL,
        level_number      INTEGER     NOT NULL,
        level_name        TEXT        NOT NULL DEFAULT '',
        min_reputation    INTEGER     NOT NULL DEFAULT 0,
        prize_description TEXT        NOT NULL DEFAULT '',
        credit_reward     INTEGER     NOT NULL DEFAULT 0,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (artist_wallet, level_number)
      )
    `;

    // Spalten nachrüsten (idempotent)
    await sql`ALTER TABLE reputation_levels ADD COLUMN IF NOT EXISTS credit_reward INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE reputation_levels ADD COLUMN IF NOT EXISTS max_recipients INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE reputation_levels ADD COLUMN IF NOT EXISTS recipients_count INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE reputation_levels ADD COLUMN IF NOT EXISTS quest_reward_bonus_percent SMALLINT NOT NULL DEFAULT 0`;

    await sql`
      CREATE TABLE IF NOT EXISTS reputation_contests (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_wallet TEXT        NOT NULL,
        end_date      TIMESTAMPTZ NOT NULL,
        distributed   BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_reputation_contests_artist ON reputation_contests(artist_wallet, created_at DESC)`;
    await sql`ALTER TABLE reputation_contests ADD COLUMN IF NOT EXISTS credits_locked INTEGER NOT NULL DEFAULT 0`;

    await sql`
      CREATE TABLE IF NOT EXISTS reputation_contest_prizes (
        contest_id    UUID     NOT NULL,
        rank          INTEGER  NOT NULL,
        credit_reward INTEGER  NOT NULL DEFAULT 0,
        PRIMARY KEY (contest_id, rank)
      )
    `;

    // Reputation-Snapshot zu Contest-Beginn (für Contest-Zeitraum-Ranking)
    await sql`
      CREATE TABLE IF NOT EXISTS reputation_contest_snapshots (
        contest_id        TEXT    NOT NULL,
        wallet_address    TEXT    NOT NULL,
        reputation_at_start BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (contest_id, wallet_address)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_rep_contest_snap_contest ON reputation_contest_snapshots(contest_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS reputation_reward_pool (
        artist_wallet TEXT        PRIMARY KEY,
        balance       NUMERIC     NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // ── Backfill: user_profiles aus solana_accounts ──────────────────────────
    const backfill = await sql`
      INSERT INTO user_profiles (wallet_address, updated_at)
      SELECT sa.wallet_address, NOW()
      FROM solana_accounts sa
      WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles p WHERE p.wallet_address = sa.wallet_address
      )
    `;

    // ── Quarterly Leaderboard Rewards ─────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS leaderboard_quarterly_config (
        id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        artist_wallet TEXT       NOT NULL UNIQUE,
        prizes       JSONB       NOT NULL DEFAULT '[]',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS leaderboard_quarterly_history (
        id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        artist_wallet  TEXT        NOT NULL,
        quarter        TEXT        NOT NULL,
        prizes         JSONB       NOT NULL DEFAULT '[]',
        results        JSONB       NOT NULL DEFAULT '[]',
        total_credited INTEGER     NOT NULL DEFAULT 0,
        distributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_lq_history_wallet_quarter ON leaderboard_quarterly_history(artist_wallet, quarter)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lq_history_wallet ON leaderboard_quarterly_history(artist_wallet)`;

    // ── Shop-Tabellen ────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS youtube_bindings (
        wallet_address    TEXT        PRIMARY KEY,
        channel_id        TEXT        UNIQUE NOT NULL,
        channel_name      TEXT        NOT NULL,
        channel_thumbnail TEXT        NOT NULL DEFAULT '',
        verification_code TEXT        NOT NULL DEFAULT '',
        verified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_bindings_channel ON youtube_bindings(channel_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS shop_items (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_wallet  TEXT        NOT NULL,
        title          TEXT        NOT NULL,
        description    TEXT        NOT NULL DEFAULT '',
        type           TEXT        NOT NULL DEFAULT 'other',
        price_credits  INTEGER     NOT NULL DEFAULT 0,
        content_url    TEXT        NOT NULL DEFAULT '',
        image_url      TEXT        NOT NULL DEFAULT '',
        is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_shop_items_artist ON shop_items(artist_wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active)`;

    await sql`
      CREATE TABLE IF NOT EXISTS shop_purchases (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_wallet        TEXT        NOT NULL,
        item_id             UUID        NOT NULL REFERENCES shop_items(id),
        price_credits_paid  INTEGER     NOT NULL DEFAULT 0,
        purchased_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_purchases_unique ON shop_purchases(buyer_wallet, item_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shop_purchases_buyer ON shop_purchases(buyer_wallet)`;

    // ── ATA Fraud Protection ──────────────────────────────────────────────────
    // ata_first_sent_at: Zeitstempel des ersten ATA-Aufbaus durch uns
    // ata_fraud_blocked: TRUE wenn User ATA gelöscht und erneut versucht einzulösen
    // ata_fraud_blocked_at: Zeitstempel der Betrug-Erkennung
    await sql`ALTER TABLE solana_accounts ADD COLUMN IF NOT EXISTS ata_first_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE solana_accounts ADD COLUMN IF NOT EXISTS ata_fraud_blocked BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE solana_accounts ADD COLUMN IF NOT EXISTS ata_fraud_blocked_at TIMESTAMPTZ`;

    // ── price_tokens Spalte (falls noch nicht vorhanden) ─────────────────────
    await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS price_tokens NUMERIC(20,6)`;

    // ── required_level Spalte (Level-Sperre für Shop-Items) ──────────────────
    await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS required_level INTEGER NOT NULL DEFAULT 0`;

    // ── story_token Spalte (Eindeutiger Token pro Story-Quest) ────────────────
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS story_token TEXT`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_quests_story_token ON quests(story_token) WHERE story_token IS NOT NULL`;

    // ── Fix: Instagram video_id von ig_id auf graph_media_id korrigieren ─────
    // Make.com lieferte bisher ig_id (z.B. 3773769977644749878) statt der Graph
    // API ID (z.B. 18107291311629888). Shortcode wird aus video_url extrahiert.
    await sql`
      UPDATE quests q
      SET video_id = m.graph_media_id,
          updated_at = NOW()
      FROM instagram_available_media m
      WHERE q.platform = 'instagram'
        AND q.video_id != m.graph_media_id
        AND m.graph_media_id != ''
        AND (
          q.video_url LIKE '%/reel/' || m.shortcode || '/%'
          OR q.video_url LIKE '%/p/' || m.shortcode || '/%'
          OR q.video_url LIKE '%/' || m.shortcode || '/'
        )
    `;

    return NextResponse.json({ success: true, message: `Migration abgeschlossen (${(backfill as unknown as { count?: number }).count ?? backfill.length} neue Profile)` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
