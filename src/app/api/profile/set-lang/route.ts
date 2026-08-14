/**
 * POST /api/profile/set-lang
 * Body: { walletAddress, lang }
 * Speichert die bevorzugte Sprache serverseitig (bisher nur clientseitig in
 * localStorage) — wird u.a. für die Sprachwahl der Willkommens-Mail genutzt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOwnWallet } from '@/app/lib/apiAuth';
import { setPreferredLang } from '@/app/lib/welcomeEmail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

    const { walletAddress, lang } = body as { walletAddress?: string; lang?: string };
    const authCheck = requireOwnWallet(walletAddress);
    if (!authCheck.ok) return authCheck.response;

    if (!lang || !['de', 'en', 'pl'].includes(lang)) {
      return NextResponse.json({ error: 'Ungültige Sprache' }, { status: 400 });
    }

    await setPreferredLang(walletAddress!, lang);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[profile/set-lang]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
