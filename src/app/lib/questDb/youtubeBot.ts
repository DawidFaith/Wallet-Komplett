import { getDb } from '../db';

async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS youtube_bot_auth (
      id TEXT PRIMARY KEY DEFAULT 'default',
      refresh_token_encrypted TEXT NOT NULL,
      channel_id TEXT,
      channel_name TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS youtube_bot_replies (
      comment_id TEXT PRIMARY KEY,
      replied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

/** Speichert (oder ersetzt) den einzigen gespeicherten OAuth-Refresh-Token — single-tenant, nur für einen Kanal gedacht. */
export async function saveYoutubeBotRefreshToken(encryptedToken: string, channelId: string | null, channelName: string | null): Promise<void> {
  await ensureTables();
  const sql = getDb();
  await sql`
    INSERT INTO youtube_bot_auth (id, refresh_token_encrypted, channel_id, channel_name, updated_at)
    VALUES ('default', ${encryptedToken}, ${channelId}, ${channelName}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      channel_id = EXCLUDED.channel_id,
      channel_name = EXCLUDED.channel_name,
      updated_at = NOW()
  `;
}

export async function getYoutubeBotRefreshToken(): Promise<{ encryptedToken: string; channelId: string | null; channelName: string | null } | null> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM youtube_bot_auth WHERE id = 'default' LIMIT 1`;
  if (rows.length === 0) return null;
  return {
    encryptedToken: rows[0].refresh_token_encrypted as string,
    channelId: rows[0].channel_id as string | null,
    channelName: rows[0].channel_name as string | null,
  };
}

export async function hasRepliedToYoutubeComment(commentId: string): Promise<boolean> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`SELECT 1 FROM youtube_bot_replies WHERE comment_id = ${commentId} LIMIT 1`;
  return rows.length > 0;
}

export async function recordYoutubeBotReply(commentId: string): Promise<void> {
  const sql = getDb();
  await sql`INSERT INTO youtube_bot_replies (comment_id) VALUES (${commentId}) ON CONFLICT (comment_id) DO NOTHING`;
}
