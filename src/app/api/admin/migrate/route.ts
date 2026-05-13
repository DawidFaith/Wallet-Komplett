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

    // ── Backfill: user_profiles aus solana_accounts ──────────────────────────
    const backfill = await sql`
      INSERT INTO user_profiles (wallet_address, updated_at)
      SELECT sa.wallet_address, NOW()
      FROM solana_accounts sa
      WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles p WHERE p.wallet_address = sa.wallet_address
      )
    `;

    return NextResponse.json({ success: true, message: `Migration abgeschlossen (${(backfill as unknown as { count?: number }).count ?? backfill.length} neue Profile)` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
