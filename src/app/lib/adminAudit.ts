/**
 * Protokolliert jeden Zugriff auf /api/admin/* — unabhängig davon, ob das
 * Secret gültig war. Damit lässt sich im Nachhinein sehen, wer (IP) wann
 * welche Admin-Route angefragt hat, und wiederholte Fehlversuche (mögliches
 * Erraten/Leaken des MIGRATION_SECRET) fallen auf.
 *
 * Schreibt fail-open: ein DB-Fehler beim Loggen darf den eigentlichen
 * Request niemals blockieren.
 */
import { getDb } from '@/app/lib/db';

export async function logAdminAccess(params: {
  route: string;
  method: string;
  ip: string | null;
  secretValid: boolean | null;
  statusCode: number | null;
}): Promise<void> {
  try {
    const sql = getDb();
    await sql`
      INSERT INTO admin_audit_log (route, method, ip, secret_valid, status_code)
      VALUES (${params.route}, ${params.method}, ${params.ip}, ${params.secretValid}, ${params.statusCode})
    `;
  } catch (err) {
    console.error('[adminAudit] Logging fehlgeschlagen:', err);
  }
}
