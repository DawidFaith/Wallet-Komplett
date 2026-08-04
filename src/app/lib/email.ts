/**
 * E-Mail Helfer via Gmail + Nodemailer
 *
 * Verwendet dieselben Env-Vars wie die anderen Mailer im Projekt:
 *   GMAIL_USER         – dawid.faith@gmail.com
 *   GMAIL_APP_PASSWORD – Google App-Passwort
 *   ADMIN_EMAIL        – Empfänger für Admin-Benachrichtigungen (optional, fällt auf GMAIL_USER zurück)
 */

import nodemailer from 'nodemailer';
import type { Lang } from '../utils/i18n';

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de';

/** Admin-Benachrichtigung: neuer Tester-Antrag eingegangen */
export async function sendTesterRequestAdminEmail(params: {
  instagramHandle: string;
  email: string;
  walletAddress: string;
}): Promise<void> {
  const transporter = createTransporter();
  const gmailUser = process.env.GMAIL_USER;
  const adminEmail = process.env.ADMIN_EMAIL ?? gmailUser;
  if (!transporter || !adminEmail) {
    console.log('[email] GMAIL_USER/GMAIL_APP_PASSWORD fehlt – E-Mail übersprungen');
    return;
  }
  await transporter.sendMail({
    from: `"D.FAITH App" <${gmailUser}>`,
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
  const transporter = createTransporter();
  const gmailUser = process.env.GMAIL_USER;
  if (!transporter) {
    console.log('[email] GMAIL_USER/GMAIL_APP_PASSWORD fehlt – User-E-Mail übersprungen');
    return;
  }
  const confirmUrl = 'https://www.instagram.com/accounts/manage_access/';
  await transporter.sendMail({
    from: `"D.FAITH App" <${gmailUser}>`,
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

const GIVEAWAY_EMAIL_LOCALE: Record<Lang, string> = { de: 'de-DE', en: 'en-US', pl: 'pl-PL' };

const GIVEAWAY_EMAIL_STRINGS: Record<Lang, {
  subjectCredited: (reward: number) => string;
  subjectPending: (reward: number) => string;
  creditedHeading: string;
  creditedBody: (title: string, platform: string, handle: string, reward: number) => string;
  pendingHeading: string;
  pendingBody1: (title: string, platform: string, handle: string) => string;
  pendingBody2: (reward: number, platform: string, handle: string) => string;
  registerButton: string;
  alreadyHaveAccount: (platform: string) => string;
  promoHeading: string;
  releaseLine: (dateStr: string) => string;
  mythicIntro: string;
  mythicButton: string;
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
    pendingBody2: (reward, platform, handle) =>
      `Damit dir die <b>${reward} D.FAITH Credits</b> gutgeschrieben werden können, fehlt nur noch ein letzter Schritt: Registriere dich kostenlos im D.FAITH Ecosystem und verknüpfe dort denselben ${platform}-Account (@${handle}) in deinem Profil. Deine Credits werden dann automatisch gutgeschrieben.`,
    registerButton: 'Jetzt registrieren & Credits sichern',
    alreadyHaveAccount: platform =>
      `Falls du bereits einen Account hast, melde dich einfach an und verknüpfe deinen ${platform}-Account in den "Sozialen Profilen" – die Credits erscheinen dann automatisch in deinem Guthaben.`,
    promoHeading: 'Willst du mehr? 🎵',
    releaseLine: dateStr => `Die neue Single erscheint am <b>${dateStr}</b>.`,
    mythicIntro: 'Sichere dir zusätzlich die Chance auf ein exklusives Mythic NFT.',
    mythicButton: '💎 Mythic NFT Gewinnen durch Presave',
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
    pendingBody2: (reward, platform, handle) =>
      `To get your <b>${reward} D.FAITH Credits</b> credited, there's just one last step: sign up for free on D.FAITH Ecosystem and link the same ${platform} account (@${handle}) in your profile. Your credits will then be added automatically.`,
    registerButton: 'Sign up now & claim your credits',
    alreadyHaveAccount: platform =>
      `If you already have an account, just log in and link your ${platform} account under "Social Profiles" — your credits will then appear automatically in your balance.`,
    promoHeading: 'Want more? 🎵',
    releaseLine: dateStr => `The new single drops on <b>${dateStr}</b>.`,
    mythicIntro: 'Get an extra chance to win an exclusive Mythic NFT.',
    mythicButton: '💎 Win a Mythic NFT via Presave',
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
    pendingBody2: (reward, platform, handle) =>
      `Aby otrzymać <b>${reward} kredytów D.FAITH</b>, brakuje tylko jednego kroku: zarejestruj się bezpłatnie w D.FAITH Ecosystem i połącz tam to samo konto ${platform} (@${handle}) w swoim profilu. Twoje kredyty zostaną wtedy dodane automatycznie.`,
    registerButton: 'Zarejestruj się i odbierz kredyty',
    alreadyHaveAccount: platform =>
      `Jeśli masz już konto, po prostu zaloguj się i połącz swoje konto ${platform} w „Profilach społecznościowych" — kredyty pojawią się wtedy automatycznie na Twoim koncie.`,
    promoHeading: 'Chcesz więcej? 🎵',
    releaseLine: dateStr => `Nowy singiel ukaże się <b>${dateStr}</b>.`,
    mythicIntro: 'Zdobądź dodatkową szansę na wygranie ekskluzywnego Mythic NFT.',
    mythicButton: '💎 Wygraj Mythic NFT dzięki Presave',
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
  const transporter = createTransporter();
  const gmailUser = process.env.GMAIL_USER;
  if (!transporter) {
    console.log('[email] GMAIL_USER/GMAIL_APP_PASSWORD fehlt – Giveaway-Mail übersprungen');
    return;
  }
  const lang = params.lang ?? 'de';
  const s = GIVEAWAY_EMAIL_STRINGS[lang];
  const platformLabel = params.platform === 'tiktok' ? 'TikTok' : params.platform.charAt(0).toUpperCase() + params.platform.slice(1);

  const mainBlock = params.credited
    ? `<h2>${s.creditedHeading}</h2><p>${s.creditedBody(params.campaignTitle, platformLabel, params.handle, params.creditReward)}</p>`
    : `
      <h2>${s.pendingHeading}</h2>
      <p>${s.pendingBody1(params.campaignTitle, platformLabel, params.handle)}</p>
      <p>${s.pendingBody2(params.creditReward, platformLabel, params.handle)}</p>
      <p>
        <a href="${APP_URL}" style="background:#f59e0b;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
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
          <a href="${params.presaveUrl}" style="background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
            ${s.mythicButton}
          </a>
        </p>
      `
      : '';
    promoBlock = `<hr/><h3>${s.promoHeading}</h3>${releaseLine}${presaveLine}`;
  }

  await transporter.sendMail({
    from: `"D.FAITH App" <${gmailUser}>`,
    to: params.toEmail,
    subject: params.credited ? s.subjectCredited(params.creditReward) : s.subjectPending(params.creditReward),
    html: `${mainBlock}${promoBlock}`,
  });
}
