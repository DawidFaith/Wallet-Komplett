/**
 * Serverseitige Berechtigungsprüfung für API-Routen.
 *
 * Wichtig: Die "wallet"/"walletAddress"-Felder in dieser App sind KEINE
 * Solana-Adressen, sondern die Clerk-User-ID (z.B. "user_3dfvunr7..."),
 * kleingeschrieben in der DB. Bisher vertrauten die meisten Routen einfach
 * dem vom Client mitgeschickten wallet-Wert, ohne zu prüfen, ob die Anfrage
 * wirklich von diesem eingeloggten Nutzer stammt — jeder, der eine fremde
 * ID kennt, konnte sich für sie ausgeben (Kauf, Löschen, Burn, Key-Export…).
 *
 * requireOwnWallet() liest die echte Identität aus der Clerk-Session
 * (Cookies, serverseitig verifiziert — vom Client nicht fälschbar) und
 * vergleicht sie mit der behaupteten wallet-ID.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export interface AuthResult {
  ok: true;
  userId: string;
}
export interface AuthError {
  ok: false;
  response: NextResponse;
}

/**
 * Prüft, dass ein eingeloggter Clerk-Nutzer existiert UND dessen ID exakt
 * dem behaupteten wallet-Parameter entspricht (case-insensitive, da die DB
 * durchgehend lowercase speichert).
 *
 * Verwendung:
 *   const check = requireOwnWallet(claimedWallet);
 *   if (!check.ok) return check.response;
 *   // ab hier: check.userId === claimedWallet, garantiert vom Server geprüft
 */
export function requireOwnWallet(claimedWallet: string | undefined | null): AuthResult | AuthError {
  const { userId } = auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }),
    };
  }

  if (!claimedWallet || userId.toLowerCase() !== claimedWallet.toLowerCase()) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Nicht autorisiert — wallet stimmt nicht mit der Session überein' }, { status: 403 }),
    };
  }

  return { ok: true, userId };
}
