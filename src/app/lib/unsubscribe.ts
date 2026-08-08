/**
 * E-Mail-Abmeldung (Unsubscribe) für Marketing-/Gewinnspiel-Mails.
 * Der Link in der Mail enthält einen HMAC-signierten Token, damit niemand
 * fremde E-Mail-Adressen ohne Kenntnis des Secrets abmelden kann.
 */
import { createHmac } from 'crypto';
import { getDb } from './db';

const SECRET = process.env.MIGRATION_SECRET ?? 'dfaith-unsubscribe-fallback';

export function generateUnsubscribeToken(email: string): string {
  return createHmac('sha256', SECRET).update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  return generateUnsubscribeToken(email) === token;
}

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS email_unsubscribes (
      email TEXT PRIMARY KEY,
      source TEXT,
      unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  await ensureTable();
  const sql = getDb();
  const rows = await sql`SELECT 1 FROM email_unsubscribes WHERE email = ${email.trim().toLowerCase()} LIMIT 1`;
  return rows.length > 0;
}

export async function addUnsubscribe(email: string, source: string): Promise<void> {
  await ensureTable();
  const sql = getDb();
  await sql`
    INSERT INTO email_unsubscribes (email, source)
    VALUES (${email.trim().toLowerCase()}, ${source})
    ON CONFLICT (email) DO NOTHING
  `;
}
