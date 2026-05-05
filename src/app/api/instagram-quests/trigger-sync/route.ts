/**
 * POST /api/instagram-quests/trigger-sync
 *
 * Triggert das Make.com "Watch Media" Szenario on-demand via Make.com API.
 *
 * Voraussetzungen in Make.com:
 *   - Szenario Scheduling: "On demand"
 *   - Make.com API Token generieren (Profil → API → Token)
 *   - Szenario-ID aus der URL kopieren (z.B. make.com/scenarios/12345)
 *
 * Env:
 *   MAKE_API_TOKEN    → Make.com API Token
 *   MAKE_SCENARIO_ID  → ID des Watch Media Szenarios
 *   MAKE_API_REGION   → "eu2" oder "us1" (Standard: eu2)
 */

import { NextResponse } from 'next/server';

export const maxDuration = 15;

export async function POST() {
  const token = process.env.MAKE_API_TOKEN;
  const scenarioId = process.env.MAKE_SCENARIO_ID;
  const region = process.env.MAKE_API_REGION ?? 'eu2';

  if (!token || !scenarioId) {
    return NextResponse.json(
      { error: 'MAKE_API_TOKEN und MAKE_SCENARIO_ID nicht konfiguriert' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://${region}.make.com/api/v2/scenarios/${scenarioId}/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Make.com API Fehler (${res.status})`, details: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'Sync gestartet – Aktualisieren in ~10 Sekunden' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

