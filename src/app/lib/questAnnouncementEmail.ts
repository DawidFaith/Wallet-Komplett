/**
 * Manuell vom Admin ausgelöster Massenversand: "Neue Quests sind verfügbar"-Mail
 * an ALLE registrierten Nutzer (nicht idempotent — jeder Klick versendet erneut
 * an alle, im Gegensatz zur einmaligen Willkommensmail). Abgemeldete Empfänger
 * werden übersprungen (siehe isUnsubscribed in sendNewQuestsAnnouncementEmail).
 */
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from './db';
import { sendNewQuestsAnnouncementEmail } from './email';
import type { Lang } from '../utils/i18n';

const VALID_LANGS: Lang[] = ['de', 'en', 'pl'];

export interface QuestAnnouncementSendResult {
  total: number;
  sent: number;
  skippedNoEmail: number;
}

export async function sendNewQuestsAnnouncementToAllUsers(): Promise<QuestAnnouncementSendResult> {
  const sql = getDb();
  const rows = await sql`SELECT wallet_address, preferred_lang FROM user_profiles`;
  const wallets = rows.map(r => r.wallet_address as string);
  if (!wallets.length) return { total: 0, sent: 0, skippedNoEmail: 0 };

  const langByWallet = new Map<string, string | null>();
  for (const r of rows) langByWallet.set(r.wallet_address as string, (r.preferred_lang as string | null) ?? null);

  // DB speichert wallet_address als lowercase, Clerk-IDs können Großbuchstaben enthalten →
  // getUserList({ userId }) findet nichts. Deshalb alle User paginiert laden und per
  // lowercase-Vergleich matchen (gleiches Muster wie welcomeEmail.ts).
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
        skippedNoEmail++;
        return;
      }
      const rawLang = langByWallet.get(wallet);
      const lang: Lang = VALID_LANGS.includes(rawLang as Lang) ? (rawLang as Lang) : 'de';
      try {
        await sendNewQuestsAnnouncementEmail({ toEmail: email, lang });
        sent++;
      } catch (err) {
        console.error('[questAnnouncementEmail] Versand fehlgeschlagen:', wallet, err instanceof Error ? err.message : err);
      }
    }));
  }

  return { total: wallets.length, sent, skippedNoEmail };
}
