/**
 * DB-basiertes Rate-Limiting (Fixed-Window) — kein Redis/Upstash nötig,
 * nutzt die bestehende Neon-Datenbank. Funktioniert zuverlässig über
 * Vercel-Serverless-Instanzen hinweg (im Gegensatz zu einem In-Memory-Zähler,
 * der pro kalter Instanz bei null anfangen würde).
 *
 * Verwendung:
 *   const rl = await checkRateLimit(`shop-purchase:${userId}`, 20, 60);
 *   if (!rl.ok) return rl.response;
 */
import { NextResponse } from 'next/server';
import { getDb } from './db';

export interface RateLimitResult {
  ok: boolean;
  response?: NextResponse;
}

/**
 * @param key           Eindeutiger Schlüssel pro Route + Identität, z.B. `send-sol:${userId}`
 * @param limit         Maximal erlaubte Anfragen innerhalb des Zeitfensters
 * @param windowSeconds Fenstergröße in Sekunden
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const sql = getDb();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  let count = 1;
  try {
    const rows = await sql`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, ${windowStart.toISOString()}, 1)
      ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `;
    count = Number(rows[0]?.count ?? 1);
  } catch (e) {
    // Tabelle fehlt noch (Migration nicht gelaufen) o.ä. — Rate-Limit lieber
    // offen lassen als die eigentliche Anfrage wegen eines Infra-Fehlers zu blockieren
    console.error('checkRateLimit Fehler (fail-open):', e instanceof Error ? e.message : e);
    return { ok: true };
  }

  // Opportunistische Aufräumung alter Fenster (~1% der Aufrufe), kein Cron nötig
  if (Math.random() < 0.01) {
    sql`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'`.catch(() => {});
  }

  if (count > limit) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.' },
        { status: 429 },
      ),
    };
  }
  return { ok: true };
}
