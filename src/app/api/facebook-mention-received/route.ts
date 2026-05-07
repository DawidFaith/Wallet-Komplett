/**
 * POST /api/facebook-mention-received
 *
 * Ehemaliger Push-Endpoint (Make.com sendet Kommentar-Events).
 * Seit Umstieg auf Pull-basierte Verifikation (Make.com wird beim
 * Verifizieren aktiv abgefragt) nicht mehr benötigt – No-Op.
 */

import { NextResponse } from 'next/server';

export const maxDuration = 5;

export async function POST() {
  // Pull-basierte Verifikation ersetzt diesen Push-Endpoint.
  // Make.com-Szenarien, die diesen Webhook noch aufrufen, werden
  // stillschweigend mit 200 beantwortet.
  return NextResponse.json({ ok: true });
}
