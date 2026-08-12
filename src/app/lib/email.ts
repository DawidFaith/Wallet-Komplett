/**
 * E-Mail Helfer via Resend
 *
 * Env-Vars:
 *   RESEND_API_KEY – Resend API-Key
 *   ADMIN_EMAIL     – Empfänger für Admin-Benachrichtigungen (optional, fällt auf dawid.faith@gmail.com zurück)
 *
 * Versanddomain ist dawidfaith.de (bei Resend verifiziert, DKIM/SPF/Custom-Return-Path
 * über Cloudflare-DNS eingerichtet).
 */

import { Resend } from 'resend';
import type { Lang } from '../utils/i18n';
import { isUnsubscribed, generateUnsubscribeToken } from './unsubscribe';

const MAIL_FROM_ADDRESS = 'noreply@dawidfaith.de';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'dawid.faith@gmail.com';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/** Geteilter Low-Level-Versand – auch von anderen Routen im Projekt genutzt. */
export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.log('[email] RESEND_API_KEY fehlt – E-Mail übersprungen');
    return;
  }
  const { error } = await resend.emails.send({
    from: `${params.fromName ?? 'D.FAITH'} <${MAIL_FROM_ADDRESS}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    console.error('[email] Resend-Fehler:', error);
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de';

/** Admin-Benachrichtigung: neuer Tester-Antrag eingegangen */
export async function sendTesterRequestAdminEmail(params: {
  instagramHandle: string;
  email: string;
  walletAddress: string;
}): Promise<void> {
  await sendMail({
    to: ADMIN_EMAIL,
    fromName: 'D.FAITH App',
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
  const confirmUrl = 'https://www.instagram.com/accounts/manage_access/';
  await sendMail({
    to: params.toEmail,
    fromName: 'D.FAITH App',
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

/** User-Benachrichtigung: Identitätsverifizierung wurde genehmigt oder abgelehnt */
export async function sendIdentityVerificationResultEmail(params: {
  toEmail: string;
  approved: boolean;
  rejectionReason?: string;
}): Promise<void> {
  const html = params.approved
    ? `
      <h2>Deine Identität wurde verifiziert! ✅</h2>
      <p>
        Du kannst jetzt Credits einlösen, NFTs im Shop kaufen und auf dem Marktplatz verkaufen.
      </p>
      <p>
        <a href="${APP_URL}" style="background:#e11d48;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Zur App
        </a>
      </p>
    `
    : `
      <h2>Deine Identitätsprüfung wurde abgelehnt</h2>
      ${params.rejectionReason ? `<p><b>Grund:</b> ${params.rejectionReason}</p>` : ''}
      <p>
        Du kannst deine Verifizierung im Profil-Tab jederzeit erneut einreichen.
      </p>
      <p>
        <a href="${APP_URL}" style="background:#e11d48;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Zur App
        </a>
      </p>
    `;
  await sendMail({
    to: params.toEmail,
    fromName: 'D.FAITH App',
    subject: params.approved ? '[D.FAITH] Identität verifiziert ✅' : '[D.FAITH] Identitätsprüfung abgelehnt',
    html,
  });
}

/** Admin-Benachrichtigung: neuer Identitätsverifizierungs-Antrag wartet auf Prüfung */
export async function sendIdentityVerificationAdminEmail(params: {
  walletAddress: string;
  idType: string;
}): Promise<void> {
  await sendMail({
    to: ADMIN_EMAIL,
    fromName: 'D.FAITH App',
    subject: `[D.FAITH] Neuer Identitäts-Verifizierungsantrag wartet auf Prüfung`,
    html: `
      <h2>Neuer Verifizierungsantrag</h2>
      <table>
        <tr><td><b>Wallet:</b></td><td>${params.walletAddress}</td></tr>
        <tr><td><b>Dokumenttyp:</b></td><td>${params.idType}</td></tr>
      </table>
      <p>
        <a href="${APP_URL}/admin#identity" style="background:#e11d48;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Admin Panel öffnen
        </a>
      </p>
    `,
  });
}

const GIVEAWAY_EMAIL_LOCALE: Record<Lang, string> = { de: 'de-DE', en: 'en-US', pl: 'pl-PL' };

const GIVEAWAY_EMAIL_STRINGS: Record<Lang, {
  subjectCredited: (reward: number) => string;
  subjectPending: (reward: number) => string;
  creditedHeading: string;
  creditedBody: (title: string, platform: string, handle: string, reward: number) => string;
  pendingHeading: string;
  pendingBody1: (title: string, platform: string, handle: string) => string;
  pendingBody2: (reward: number, platform: string, handle: string, email: string) => string;
  registerButton: string;
  alreadyHaveAccount: (platform: string) => string;
  promoHeading: string;
  releaseLine: (dateStr: string) => string;
  mythicIntro: string;
  mythicButton: string;
  unsubscribeText: string;
}> = {
  de: {
    subjectCredited: reward => `[D.FAITH] Du hast ${reward} Credits gewonnen! 🎉`,
    subjectPending: reward => `[D.FAITH] Fast geschafft! Sichere dir deine ${reward} Credits 🎁`,
    creditedHeading: 'Du hast gewonnen! 🎉',
    creditedBody: (title, platform, handle, reward) =>
      `Deine Teilnahme am Gewinnspiel „${title}" mit deinem ${platform}-Account <b>@${handle}</b> wurde verifiziert — dir wurden <b>${reward} D.FAITH Credits</b> gutgeschrieben!`,
    pendingHeading: 'Dein Kommentar wurde bestätigt! 🎉',
    pendingBody1: (title, platform, handle) =>
      `Deine Teilnahme am Gewinnspiel „${title}" mit deinem ${platform}-Account <b>@${handle}</b> wurde erfolgreich verifiziert.`,
    pendingBody2: (reward, platform, handle, email) =>
      `Damit dir die <b>${reward} D.FAITH Credits</b> gutgeschrieben werden können, fehlt nur noch ein letzter Schritt: Registriere dich kostenlos im D.FAITH Ecosystem — und zwar mit <b>genau dieser E-Mail-Adresse (${email})</b>. Dein ${platform}-Account (@${handle}) wird dann automatisch als verifiziert erkannt und deine Credits automatisch gutgeschrieben, ganz ohne weiteren Verknüpfungsschritt.`,
    registerButton: 'Jetzt registrieren & Credits sichern',
    alreadyHaveAccount: platform =>
      `Falls du bereits einen Account mit dieser E-Mail-Adresse hast, öffne einfach die App – dein ${platform}-Account wird automatisch erkannt und die Credits erscheinen in deinem Guthaben. Solltest du eine andere E-Mail-Adresse für deinen Account nutzen, verknüpfe deinen ${platform}-Account stattdessen manuell in den "Sozialen Profilen".`,
    promoHeading: 'Willst du mehr? 🎵',
    releaseLine: dateStr => `Die neue Single erscheint am <b>${dateStr}</b>.`,
    mythicIntro: 'Sichere dir zusätzlich die Chance auf ein exklusives Mythic NFT.',
    mythicButton: '💎 Mythic NFT gewinnen',
    unsubscribeText: 'Möchtest du keine Gewinnspiel-E-Mails mehr erhalten?',
  },
  en: {
    subjectCredited: reward => `[D.FAITH] You won ${reward} Credits! 🎉`,
    subjectPending: reward => `[D.FAITH] Almost there! Secure your ${reward} Credits 🎁`,
    creditedHeading: 'You won! 🎉',
    creditedBody: (title, platform, handle, reward) =>
      `Your entry for the giveaway "${title}" with your ${platform} account <b>@${handle}</b> has been verified — you've been credited <b>${reward} D.FAITH Credits</b>!`,
    pendingHeading: 'Your comment has been confirmed! 🎉',
    pendingBody1: (title, platform, handle) =>
      `Your entry for the giveaway "${title}" with your ${platform} account <b>@${handle}</b> was successfully verified.`,
    pendingBody2: (reward, platform, handle, email) =>
      `To get your <b>${reward} D.FAITH Credits</b> credited, there's just one last step: sign up for free on D.FAITH Ecosystem — using <b>exactly this email address (${email})</b>. Your ${platform} account (@${handle}) will then automatically be recognized as verified and your credits added automatically, with no extra linking step needed.`,
    registerButton: 'Sign up now & claim your credits',
    alreadyHaveAccount: platform =>
      `If you already have an account with this email address, just open the app — your ${platform} account will be recognized automatically and the credits will appear in your balance. If your account uses a different email address, link your ${platform} account manually under "Social Profiles" instead.`,
    promoHeading: 'Want more? 🎵',
    releaseLine: dateStr => `The new single drops on <b>${dateStr}</b>.`,
    mythicIntro: 'Get an extra chance to win an exclusive Mythic NFT.',
    mythicButton: '💎 Win a Mythic NFT',
    unsubscribeText: 'Don\'t want to receive giveaway emails anymore?',
  },
  pl: {
    subjectCredited: reward => `[D.FAITH] Wygrałeś/aś ${reward} kredytów! 🎉`,
    subjectPending: reward => `[D.FAITH] Już prawie! Zabezpiecz swoje ${reward} kredytów 🎁`,
    creditedHeading: 'Wygrałeś/aś! 🎉',
    creditedBody: (title, platform, handle, reward) =>
      `Twoje zgłoszenie do konkursu „${title}" z kontem ${platform} <b>@${handle}</b> zostało zweryfikowane — otrzymałeś/aś <b>${reward} kredytów D.FAITH</b>!`,
    pendingHeading: 'Twój komentarz został potwierdzony! 🎉',
    pendingBody1: (title, platform, handle) =>
      `Twoje zgłoszenie do konkursu „${title}" z kontem ${platform} <b>@${handle}</b> zostało pomyślnie zweryfikowane.`,
    pendingBody2: (reward, platform, handle, email) =>
      `Aby otrzymać <b>${reward} kredytów D.FAITH</b>, brakuje tylko jednego kroku: zarejestruj się bezpłatnie w D.FAITH Ecosystem — używając <b>dokładnie tego adresu e-mail (${email})</b>. Twoje konto ${platform} (@${handle}) zostanie wtedy automatycznie rozpoznane jako zweryfikowane, a kredyty zostaną dodane automatycznie, bez dodatkowego kroku łączenia.`,
    registerButton: 'Zarejestruj się i odbierz kredyty',
    alreadyHaveAccount: platform =>
      `Jeśli masz już konto z tym adresem e-mail, po prostu otwórz aplikację — Twoje konto ${platform} zostanie rozpoznane automatycznie, a kredyty pojawią się na Twoim koncie. Jeśli Twoje konto korzysta z innego adresu e-mail, połącz swoje konto ${platform} ręcznie w „Profilach społecznościowych".`,
    promoHeading: 'Chcesz więcej? 🎵',
    releaseLine: dateStr => `Nowy singiel ukaże się <b>${dateStr}</b>.`,
    mythicIntro: 'Zdobądź dodatkową szansę na wygranie ekskluzywnego Mythic NFT.',
    mythicButton: '💎 Wygraj Mythic NFT',
    unsubscribeText: 'Nie chcesz już otrzymywać e-maili konkursowych?',
  },
};

/**
 * Giveaway: geht an JEDE erfolgreich verifizierte Teilnahme — sowohl an Personen,
 * die sofort automatisch gutgeschrieben wurden (credited=true), als auch an
 * Personen, deren Social-Account noch keinem D.FAITH-Profil zugeordnet ist und
 * die sich dafür erst registrieren müssen (credited=false). Enthält zusätzlich,
 * falls vom Artist hinterlegt, einen Hinweis auf den Single-Release-Countdown
 * und den Presave/Preorder-Link (Chance auf ein Mythic NFT) — um Leute, die noch
 * mehr wollen, gezielt weiter anzusprechen. Sprache richtet sich danach, welche
 * die Person auf der Gewinnspiel-Seite gewählt hatte.
 */
export async function sendGiveawayParticipationEmail(params: {
  toEmail: string;
  campaignTitle: string;
  platform: string;
  handle: string;
  creditReward: number;
  credited: boolean;
  releaseAt?: string | null;
  presaveUrl?: string | null;
  lang?: Lang;
}): Promise<void> {
  if (await isUnsubscribed(params.toEmail)) {
    console.log('[email] Empfänger hat sich abgemeldet – Giveaway-Mail übersprungen:', params.toEmail);
    return;
  }
  const lang = params.lang ?? 'de';
  const s = GIVEAWAY_EMAIL_STRINGS[lang];
  const PLATFORM_LABELS: Record<string, string> = {
    tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube',
    instagram_polska: 'Instagram', tiktok_polska: 'TikTok',
  };
  const platformLabel = PLATFORM_LABELS[params.platform] ?? (params.platform.charAt(0).toUpperCase() + params.platform.slice(1));
  const buttonStyle = 'display:inline-block;background:#f59e0b;color:#000;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;';
  const mythicButtonStyle = 'display:inline-block;background:#a855f7;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;';

  const mainBlock = params.credited
    ? `<h2>${s.creditedHeading}</h2><p>${s.creditedBody(params.campaignTitle, platformLabel, params.handle, params.creditReward)}</p>`
    : `
      <h2>${s.pendingHeading}</h2>
      <p>${s.pendingBody1(params.campaignTitle, platformLabel, params.handle)}</p>
      <p>${s.pendingBody2(params.creditReward, platformLabel, params.handle, params.toEmail)}</p>
      <p>
        <a href="${APP_URL}" style="${buttonStyle}">
          ${s.registerButton}
        </a>
      </p>
      <p style="color:#888;font-size:12px;">${s.alreadyHaveAccount(platformLabel)}</p>
    `;

  let promoBlock = '';
  if (params.releaseAt || params.presaveUrl) {
    const releaseLine = params.releaseAt
      ? `<p>${s.releaseLine(new Date(params.releaseAt).toLocaleString(GIVEAWAY_EMAIL_LOCALE[lang], { dateStyle: 'full', timeStyle: 'short' }))}</p>`
      : '';
    const presaveLine = params.presaveUrl
      ? `
        <p>${s.mythicIntro}</p>
        <p>
          <a href="${params.presaveUrl}" style="${mythicButtonStyle}">
            ${s.mythicButton}
          </a>
        </p>
      `
      : '';
    promoBlock = `<hr/><h3>${s.promoHeading}</h3>${releaseLine}${presaveLine}`;
  }

  const unsubToken = generateUnsubscribeToken(params.toEmail);
  const unsubUrl = `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(params.toEmail)}&token=${unsubToken}&lang=${lang}`;
  const footerBlock = `
    <hr style="margin-top:32px;border:none;border-top:1px solid #333;"/>
    <p style="color:#666;font-size:11px;margin-top:12px;">
      ${s.unsubscribeText} <a href="${unsubUrl}" style="color:#888;">${lang === 'en' ? 'Unsubscribe' : lang === 'pl' ? 'Wypisz się' : 'Abmelden'}</a>
    </p>
  `;

  await sendMail({
    to: params.toEmail,
    fromName: 'D.FAITH App',
    subject: params.credited ? s.subjectCredited(params.creditReward) : s.subjectPending(params.creditReward),
    html: `${mainBlock}${promoBlock}${footerBlock}`,
  });
}
