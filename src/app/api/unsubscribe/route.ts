/**
 * GET /api/unsubscribe?email=...&token=...&lang=de|en|pl
 * Öffentlicher, per E-Mail-Link aufgerufener Endpoint — kein Login nötig.
 * Token verhindert, dass fremde E-Mail-Adressen ohne Kenntnis des Secrets
 * abgemeldet werden können.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken, addUnsubscribe } from '@/app/lib/unsubscribe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TEXT: Record<string, { title: string; success: string; invalid: string }> = {
  de: { title: 'Abmeldung', success: 'Du wurdest erfolgreich von D.FAITH-Gewinnspiel-E-Mails abgemeldet.', invalid: 'Ungültiger oder abgelaufener Link.' },
  en: { title: 'Unsubscribed', success: 'You have been successfully unsubscribed from D.FAITH giveaway emails.', invalid: 'Invalid or expired link.' },
  pl: { title: 'Wypisano', success: 'Zostałeś/aś pomyślnie wypisany/a z e-maili konkursowych D.FAITH.', invalid: 'Nieprawidłowy lub wygasły link.' },
};

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body{background:#0a0908;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
    .card{max-width:420px}
    h1{font-size:20px;margin-bottom:12px}
    p{color:#a1a1aa;font-size:14px;line-height:1.5}
  </style></head>
  <body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token');
  const lang = req.nextUrl.searchParams.get('lang') ?? 'de';
  const strings = TEXT[lang] ?? TEXT.de;

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new NextResponse(page(strings.title, strings.invalid), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  await addUnsubscribe(email, 'giveaway');
  return new NextResponse(page(strings.title, strings.success), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
