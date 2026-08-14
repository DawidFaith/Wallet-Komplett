/**
 * Einmaliger Willkommens-Mail-Versand + Speicherung der bevorzugten Sprache
 * pro Nutzer (bisher nur clientseitig in localStorage, siehe LangContext.tsx).
 */
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from './db';
import { sendWelcomeEmail } from './email';
import type { Lang } from '../utils/i18n';

async function ensureColumns(sql: ReturnType<typeof getDb>) {
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_lang TEXT`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ`;
}

export async function setPreferredLang(walletAddress: string, lang: string): Promise<void> {
  const sql = getDb();
  await ensureColumns(sql);
  const wallet = walletAddress.toLowerCase();
  await sql`
    INSERT INTO user_profiles (wallet_address, preferred_lang)
    VALUES (${wallet}, ${lang})
    ON CONFLICT (wallet_address) DO UPDATE SET preferred_lang = ${lang}
  `;
}

const VALID_LANGS: Lang[] = ['de', 'en', 'pl'];

export interface WelcomeEmailSendResult {
  total: number;
  sent: number;
  skippedNoEmail: number;
}

/** Sendet die Willkommensmail an alle Nutzer, die sie noch nicht erhalten haben. Idempotent — wiederholbar, überspringt bereits versendete. */
export async function sendWelcomeEmailsToAllPending(): Promise<WelcomeEmailSendResult> {
  const sql = getDb();
  await ensureColumns(sql);

  const rows = await sql`
    SELECT wallet_address, preferred_lang FROM user_profiles WHERE welcome_email_sent_at IS NULL
  `;
  const wallets = rows.map(r => r.wallet_address as string);
  if (!wallets.length) return { total: 0, sent: 0, skippedNoEmail: 0 };

  const langByWallet = new Map<string, string | null>();
  for (const r of rows) langByWallet.set(r.wallet_address as string, (r.preferred_lang as string | null) ?? null);

  // DB speichert wallet_address als lowercase, Clerk-IDs können Großbuchstaben enthalten →
  // getUserList({ userId }) findet nichts. Deshalb alle User paginiert laden und per
  // lowercase-Vergleich matchen (gleiches Muster wie reputation/leaderboard/route.ts).
  const emailByWallet = new Map<string, string | null>();
  try {
    const clerk = await clerkClient();
    const idSet = new Set(wallets);
    let offset = 0;
    const pageSize = 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: batch, totalCount } = await clerk.users.getUserList({ limit: pageSize, offset });
      for (const u of batch) {
        const lcId = u.id.toLowerCase();
        if (idSet.has(lcId)) {
          emailByWallet.set(lcId, u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? null);
        }
      }
      if (batch.length < pageSize || offset + batch.length >= totalCount) break;
      offset += pageSize;
    }
  } catch { /* Emails bleiben null falls Clerk-Abruf fehlschlägt */ }

  let sent = 0;
  let skippedNoEmail = 0;
  const CHUNK_SIZE = 10;
  for (let i = 0; i < wallets.length; i += CHUNK_SIZE) {
    const chunk = wallets.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (wallet) => {
      const email = emailByWallet.get(wallet);
      if (!email) {
        // Kein Retry-Gewinn ohne E-Mail — trotzdem als bearbeitet markieren, sonst
        // taucht der Nutzer bei jedem erneuten Klick wieder in der Liste auf.
        skippedNoEmail++;
        await sql`UPDATE user_profiles SET welcome_email_sent_at = NOW() WHERE wallet_address = ${wallet}`;
        return;
      }
      const rawLang = langByWallet.get(wallet);
      const lang: Lang = VALID_LANGS.includes(rawLang as Lang) ? (rawLang as Lang) : 'de';
      try {
        await sendWelcomeEmail({ toEmail: email, lang });
        sent++;
        // Nur bei Erfolg markieren — bei einem Versandfehler bleibt der Nutzer in der
        // Liste, damit ein erneuter Klick auf "Senden" es automatisch nochmal versucht.
        await sql`UPDATE user_profiles SET welcome_email_sent_at = NOW() WHERE wallet_address = ${wallet}`;
      } catch (err) {
        console.error('[welcomeEmail] Versand fehlgeschlagen:', wallet, err instanceof Error ? err.message : err);
      }
    }));
  }

  return { total: wallets.length, sent, skippedNoEmail };
}
