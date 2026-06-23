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
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS bonus_budget NUMERIC(20,2) NOT NULL DEFAULT 0`;
    // Standardwerte für bestehende Zeilen setzen (nur wenn noch 0)
    await sql`
      UPDATE reputation_levels
      SET quest_reward_bonus_percent = CASE level_number
        WHEN  1 THEN   0
        WHEN  2 THEN   5
        WHEN  3 THEN  10
        WHEN  4 THEN  15
        WHEN  5 THEN  20
        WHEN  6 THEN  25
        WHEN  7 THEN  35
        WHEN  8 THEN  50
        WHEN  9 THEN  75
        WHEN 10 THEN 100
        ELSE 0
      END
      WHERE quest_reward_bonus_percent = 0
    `;

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
    await sql`CREATE INDEX IF NOT EXISTS idx_shop_purchases_unique ON shop_purchases(buyer_wallet, item_id)`;
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

    // ── secret_code Spalte (Geheimer Code für Secret-Quests) ─────────────────
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS secret_code TEXT`;

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

    // ── Facebook Comment Slots ────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS facebook_comment_slots (
        quest_id        TEXT        NOT NULL,
        wallet_address  TEXT        NOT NULL,
        slot_index      INTEGER     NOT NULL,
        comment_text    TEXT        NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (quest_id, wallet_address)
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_fb_comment_slots_unique ON facebook_comment_slots(quest_id, slot_index)`;

    // ── Quest-Bundle-System ───────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS quest_bundles (
        id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_wallet          TEXT          NOT NULL,
        platform                TEXT          NOT NULL,
        video_id                TEXT          NOT NULL DEFAULT '',
        video_title             TEXT          NOT NULL DEFAULT '',
        video_thumbnail         TEXT          NOT NULL DEFAULT '',
        video_url               TEXT          NOT NULL DEFAULT '',
        description             TEXT          NOT NULL DEFAULT '',
        reward_pool_per_fan     NUMERIC(20,2) NOT NULL DEFAULT 0,
        bundle_completion_bonus NUMERIC(20,2) NOT NULL DEFAULT 0,
        bonus_budget_remaining  NUMERIC(20,2) NOT NULL DEFAULT 0,
        max_participants        INTEGER       NOT NULL DEFAULT 10,
        is_active               BOOLEAN       NOT NULL DEFAULT true,
        expires_at              TIMESTAMPTZ,
        created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_quest_bundles_creator ON quest_bundles(creator_wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quest_bundles_active  ON quest_bundles(is_active, created_at DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS quest_bundle_completions (
        bundle_id    UUID          NOT NULL,
        fan_wallet   TEXT          NOT NULL,
        bonus_paid   NUMERIC(20,2) NOT NULL DEFAULT 0,
        completed_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        PRIMARY KEY (bundle_id, fan_wallet)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_quest_bundle_comp_fan ON quest_bundle_completions(fan_wallet)`;

    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS bundle_id    UUID    REFERENCES quest_bundles(id)`;
    await sql`ALTER TABLE quests ADD COLUMN IF NOT EXISTS reach_weight INTEGER NOT NULL DEFAULT 0`;

    // ── story_token Backfill: bestehende dm_share Bundle-Quests ohne Token ────
    await sql`
      UPDATE quests
      SET story_token = gen_random_uuid()::text
      WHERE quest_type = 'dm_share'
        AND bundle_id IS NOT NULL
        AND story_token IS NULL
    `;

    // ── DFAITH-Beträge: INTEGER → NUMERIC(20,2) ──────────────────────────────
    // sql.unsafe() funktioniert im Neon HTTP-Driver nicht → tagged template literals
    const typeChanges: Record<string, string> = {};
    const alter = async (key: string, fn: () => Promise<unknown>) => {
      try { await fn(); typeChanges[key] = 'ok'; }
      catch (e) { typeChanges[key] = (e instanceof Error ? e.message : String(e)).slice(0, 120); }
    };
    await alter('dfaith_credits.balance',         () => sql`ALTER TABLE dfaith_credits           ALTER COLUMN balance            TYPE NUMERIC(20,2) USING balance::numeric`);
    await alter('creator_balances.balance',        () => sql`ALTER TABLE creator_balances         ALTER COLUMN balance            TYPE NUMERIC(20,2) USING balance::numeric`);
    await alter('creator_deposits.amount',         () => sql`ALTER TABLE creator_deposits         ALTER COLUMN amount             TYPE NUMERIC(20,2) USING amount::numeric`);
    await alter('quests.reward_amount',            () => sql`ALTER TABLE quests                   ALTER COLUMN reward_amount      TYPE NUMERIC(20,2) USING reward_amount::numeric`);
    await alter('quests.credits_locked',           () => sql`ALTER TABLE quests                   ALTER COLUMN credits_locked     TYPE NUMERIC(20,2) USING credits_locked::numeric`);
    await alter('quests.bonus_budget',             () => sql`ALTER TABLE quests                   ALTER COLUMN bonus_budget       TYPE NUMERIC(20,2) USING bonus_budget::numeric`);
    await alter('quest_completions.reward_amount', () => sql`ALTER TABLE quest_completions        ALTER COLUMN reward_amount      TYPE NUMERIC(20,2) USING reward_amount::numeric`);
    await alter('pending_rewards.amount',          () => sql`ALTER TABLE pending_rewards          ALTER COLUMN amount             TYPE NUMERIC(20,2) USING amount::numeric`);
    await alter('reputation_contests.credits_locked', () => sql`ALTER TABLE reputation_contests   ALTER COLUMN credits_locked     TYPE NUMERIC(20,2) USING credits_locked::numeric`);
    await alter('reputation_contest_prizes.credit_reward', () => sql`ALTER TABLE reputation_contest_prizes ALTER COLUMN credit_reward TYPE NUMERIC(20,2) USING credit_reward::numeric`);
    await alter('reputation_levels.credit_reward', () => sql`ALTER TABLE reputation_levels        ALTER COLUMN credit_reward      TYPE NUMERIC(20,2) USING credit_reward::numeric`);
    await alter('shop_items.price_credits',        () => sql`ALTER TABLE shop_items               ALTER COLUMN price_credits      TYPE NUMERIC(20,2) USING price_credits::numeric`);
    await alter('shop_purchases.price_credits_paid', () => sql`ALTER TABLE shop_purchases         ALTER COLUMN price_credits_paid TYPE NUMERIC(20,2) USING price_credits_paid::numeric`);
    await alter('leaderboard_quarterly_history.total_credited', () => sql`ALTER TABLE leaderboard_quarterly_history ALTER COLUMN total_credited TYPE NUMERIC(20,2) USING total_credited::numeric`);

    // Spaltentypen aus DB lesen zur Verifikation
    const colTypes = await sql`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'dfaith_credits'    AND column_name = 'balance') OR
          (table_name = 'creator_balances'  AND column_name = 'balance') OR
          (table_name = 'creator_deposits'  AND column_name = 'amount') OR
          (table_name = 'quests'            AND column_name IN ('reward_amount','credits_locked','bonus_budget')) OR
          (table_name = 'quest_completions' AND column_name = 'reward_amount') OR
          (table_name = 'pending_rewards'   AND column_name = 'amount') OR
          (table_name = 'reputation_contests'       AND column_name = 'credits_locked') OR
          (table_name = 'reputation_contest_prizes' AND column_name = 'credit_reward') OR
          (table_name = 'reputation_levels'         AND column_name = 'credit_reward') OR
          (table_name = 'shop_items'                AND column_name = 'price_credits') OR
          (table_name = 'shop_purchases'            AND column_name = 'price_credits_paid') OR
          (table_name = 'leaderboard_quarterly_history' AND column_name = 'total_credited')
        )
      ORDER BY table_name, column_name
    `;

    // ── Collectibles-System ───────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS collectible_collections (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_wallet    TEXT        NOT NULL,
        name             TEXT        NOT NULL,
        description      TEXT        NOT NULL DEFAULT '',
        image_url        TEXT        NOT NULL DEFAULT '',
        is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
        chance_common    SMALLINT    NOT NULL DEFAULT 50,
        chance_uncommon  SMALLINT    NOT NULL DEFAULT 25,
        chance_rare      SMALLINT    NOT NULL DEFAULT 15,
        chance_epic      SMALLINT    NOT NULL DEFAULT 7,
        chance_legendary SMALLINT    NOT NULL DEFAULT 2,
        chance_mythic    SMALLINT    NOT NULL DEFAULT 1,
        max_rep_bonus_percent    SMALLINT NOT NULL DEFAULT 0,
        max_shard_chance_bonus   SMALLINT NOT NULL DEFAULT 0,
        max_credit_bonus_percent SMALLINT NOT NULL DEFAULT 0,
        primary_bonus    TEXT        NOT NULL DEFAULT 'rep',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_collectible_collections_artist ON collectible_collections(artist_wallet)`;
    await sql`ALTER TABLE collectible_collections ADD COLUMN IF NOT EXISTS max_credit_bonus_percent SMALLINT NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE collectible_collections ADD COLUMN IF NOT EXISTS primary_bonus TEXT NOT NULL DEFAULT 'rep'`;

    await sql`
      CREATE TABLE IF NOT EXISTS user_shards (
        wallet_address TEXT        NOT NULL,
        artist_wallet  TEXT        NOT NULL,
        count          INTEGER     NOT NULL DEFAULT 0,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (wallet_address, artist_wallet)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_shards_wallet ON user_shards(wallet_address)`;

    await sql`
      CREATE TABLE IF NOT EXISTS user_collectibles (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT        NOT NULL,
        collection_id  UUID        NOT NULL REFERENCES collectible_collections(id) ON DELETE CASCADE,
        rarity         TEXT        NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary','mythic')),
        obtained_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_collectibles_wallet     ON user_collectibles(wallet_address)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_collectibles_collection ON user_collectibles(collection_id)`;

    // ── Bundle Shard-Drop-Chance (ersetzt Abschluss-Token-Bonus) ─────────────
    await sql`ALTER TABLE quest_bundles ADD COLUMN IF NOT EXISTS shard_drop_chance SMALLINT NOT NULL DEFAULT 20`;

    // ── NFT-Integration (Solana On-Chain) ────────────────────────────────────
    await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS master_edition_mint TEXT`;
    await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS nft_max_supply      INTEGER`;
    await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS edition_count       INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS is_nft_enabled      BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE shop_purchases ADD COLUMN IF NOT EXISTS nft_mint_address TEXT`;
    await sql`ALTER TABLE shop_purchases ADD COLUMN IF NOT EXISTS edition_number   INTEGER`;
    // Unique-Constraint entfernen damit User mehrere Editionen kaufen können
    await sql`DROP INDEX IF EXISTS idx_shop_purchases_unique`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shop_purchases_buyer_item ON shop_purchases(buyer_wallet, item_id)`;
    await sql`ALTER TABLE collectible_collections ADD COLUMN IF NOT EXISTS nft_collection_mint TEXT`;
    await sql`ALTER TABLE user_collectibles ADD COLUMN IF NOT EXISTS nft_mint_address TEXT`;

    return NextResponse.json({
      success: true,
      message: `Migration abgeschlossen (${(backfill as unknown as { count?: number }).count ?? backfill.length} neue Profile)`,
      typeChanges,
      columnTypes: colTypes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
