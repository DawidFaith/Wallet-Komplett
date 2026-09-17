import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from './db';

/**
 * Findet das Wallet (= Clerk-User-ID, lowercase) einer bereits registrierten
 * Person anhand ihrer E-Mail-Adresse — und nur, wenn diese Person auch schon
 * ein Solana-Wallet hat (sonst kann ohnehin nichts gemintet werden, siehe
 * grantShopItemToWallet/grantCollectibleAsNftToWallet).
 *
 * Wird bei der Geschenk-Erstellung genutzt, um bereits registrierten
 * Empfänger:innen sofort zuzustellen, statt sie unnötig auf den nächsten
 * Login warten zu lassen (der Login-Claim bleibt als Fallback für Empfänger,
 * die noch keinen Account haben).
 */
export async function resolveRegisteredWalletByEmail(email: string): Promise<string | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  try {
    const clerk = await clerkClient();
    const { data: matches } = await clerk.users.getUserList({ emailAddress: [cleanEmail] });
    if (!matches.length) return null;
    const wallet = matches[0].id.toLowerCase();

    const sql = getDb();
    const rows = await sql`SELECT 1 FROM solana_accounts WHERE wallet_address = ${wallet} LIMIT 1`;
    return rows.length > 0 ? wallet : null;
  } catch {
    // Clerk-Lookup fehlgeschlagen — Geschenk bleibt einfach 'pending' und
    // wird beim nächsten Login der Person zugestellt.
    return null;
  }
}
