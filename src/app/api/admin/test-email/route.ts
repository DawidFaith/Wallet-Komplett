import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

/**
 * TEMPORÄR: Diagnose-Endpoint um den Gmail-Mailversand direkt zu testen.
 * Gibt den echten nodemailer-Fehler zurück statt ihn nur in den Server-Logs
 * verschwinden zu lassen. Nach Gebrauch wieder entfernen.
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  let body: { toEmail?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 }); }

  const toEmail = body.toEmail;
  if (!toEmail) return NextResponse.json({ error: 'toEmail erforderlich' }, { status: 400 });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return NextResponse.json({
      ok: false,
      reason: 'env_missing',
      gmailUserSet: !!user,
      gmailAppPasswordSet: !!pass,
    });
  }

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await transporter.verify();
    await transporter.sendMail({
      from: `"D.FAITH App" <${user}>`,
      to: toEmail,
      subject: '[D.FAITH] Test-Mail',
      html: `<p>Das ist eine Test-Mail vom D.FAITH Ecosystem, gesendet über ${user}.</p>`,
    });
    return NextResponse.json({ ok: true, sentFrom: user, sentTo: toEmail });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      reason: 'send_failed',
      gmailUser: user,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
