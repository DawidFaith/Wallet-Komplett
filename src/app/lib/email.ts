/**
 * E-Mail Helfer via Resend (https://resend.com)
 *
 * Erforderliche Env-Vars:
 *   RESEND_API_KEY  – API Key von resend.com
 *   RESEND_FROM     – Absender-Adresse (muss verifizierte Domain sein, z.B. noreply@dawidfaith.de)
 *   ADMIN_EMAIL     – Empfänger für Admin-Benachrichtigungen
 */

import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM ?? 'D.FAITH <noreply@dawidfaith.de>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de';

/** Admin-Benachrichtigung: neuer Tester-Antrag eingegangen */
export async function sendTesterRequestAdminEmail(params: {
  instagramHandle: string;
  email: string;
  walletAddress: string;
}): Promise<void> {
  const resend = getResend();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!resend || !adminEmail) {
    console.log('[email] RESEND_API_KEY oder ADMIN_EMAIL fehlt – E-Mail übersprungen');
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `[D.FAITH] Neuer Instagram Tester-Antrag: @${params.instagramHandle}`,
    html: `
      <h2>Neuer Tester-Antrag</h2>
      <table>
        <tr><td><b>Instagram Handle:</b></td><td>@${params.instagramHandle}</td></tr>
        <tr><td><b>E-Mail:</b></td><td>${params.email}</td></tr>
        <tr><td><b>Wallet:</b></td><td>${params.walletAddress}</td></tr>
      </table>
      <p>
        <a href="${APP_URL}/admin#testers" style="background:#e11d48;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Admin Panel öffnen
        </a>
      </p>
      <p style="color:#888;font-size:12px;">
        Schritte:<br/>
        1. Trage @${params.instagramHandle} in der Meta Developer Console als Instagram Tester ein<br/>
        2. Klicke dann im Admin Panel auf "Eingetragen" – der User bekommt automatisch eine E-Mail
      </p>
    `,
  });
}

/** User-Benachrichtigung: wurde als Tester eingetragen */
export async function sendTesterApprovedEmail(params: {
  toEmail: string;
  instagramHandle: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log('[email] RESEND_API_KEY fehlt – User-E-Mail übersprungen');
    return;
  }
  const confirmUrl = 'https://www.instagram.com/accounts/manage_access/';
  await resend.emails.send({
    from: FROM,
    to: params.toEmail,
    subject: `[D.FAITH] Du wurdest als Beta-Tester freigeschaltet! 🎉`,
    html: `
      <h2>Dein Beta-Zugang ist bereit!</h2>
      <p>Hey @${params.instagramHandle},</p>
      <p>
        Wir haben dich als Instagram Beta-Tester eingetragen. Du hast nun eine Einladung in Instagram erhalten.
      </p>
      <h3>Nächster Schritt – Einladung bestätigen:</h3>
      <p>
        <a href="${confirmUrl}" style="background:#e11d48;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          Einladung in Instagram bestätigen
        </a>
      </p>
      <p style="color:#888;font-size:13px;">
        Oder in der Instagram-App:<br/>
        Einstellungen → Sicherheit → Apps und Websites → Tester-Einladungen
      </p>
      <hr/>
      <p>
        Danach kannst du Story Quests auf der Plattform abschließen:<br/>
        <a href="${APP_URL}">${APP_URL}</a>
      </p>
    `,
  });
}
