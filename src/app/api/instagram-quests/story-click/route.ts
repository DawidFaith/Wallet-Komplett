/**
 * GET /api/instagram-quests/story-click?token=STORY_TOKEN[&handle=INSTAGRAM_HANDLE]
 *
 * Universeller Story-Quest Verifikationslink.
 *
 * Ablauf:
 *  1. Ohne Handle → Formular-Seite anzeigen (Handle-Eingabe)
 *  2. Mit Handle → DM-Verifikationseintrag anhand von Handle + Quest suchen
 *  3. Quest abschließen + Credits gutschreiben
 *  4. HTML-Belohnungsseite anzeigen
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQuestByStoryToken,
  getInstagramDmVerificationByHandle,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  addUserReputation,
  addUserXp,
  savePendingReward,
  payLevelBonus,
  markInstagramDmClicked,
  deleteInstagramDmVerification,
  type QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const rawHandle = req.nextUrl.searchParams.get('handle')?.toLowerCase().replace(/^@/, '').trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de').replace(/\/$/, '');
  const returnUrl = `${appUrl}/home?tab=quest-board`;

  if (!token || token.length < 10) {
    return html(buildPage('Ungültiger Link', 'Dieser Link ist ungültig oder abgelaufen.', false, returnUrl));
  }

  // ── Kein Handle → Formular anzeigen ────────────────────────────────────────
  if (!rawHandle) {
    const quest = await getQuestByStoryToken(token);
    const title = quest?.videoTitle ?? '';
    return html(buildFormPage(token, title, appUrl));
  }

  // ── Quest laden ─────────────────────────────────────────────────────────────
  const quest = await getQuestByStoryToken(token);
  if (!quest) {
    return html(buildPage('Quest nicht gefunden', 'Dieser Link ist abgelaufen oder ungültig.', false, returnUrl));
  }
  if (!quest.isActive || (quest.expiresAt && new Date(quest.expiresAt) < new Date())) {
    return html(buildPage('Quest abgelaufen', 'Diese Quest ist nicht mehr aktiv.', false, returnUrl));
  }
  if (quest.completions >= quest.maxCompletions) {
    return html(buildPage('Quest voll', 'Alle Plätze sind bereits vergeben.', false, returnUrl));
  }

  // ── DM-Verifikation anhand Handle suchen ────────────────────────────────────
  const verif = await getInstagramDmVerificationByHandle(rawHandle);

  if (!verif || verif.questId !== quest.id) {
    return html(buildPage(
      'Handle nicht gefunden',
      `Der Instagram-Account @${rawHandle} hat diese Quest noch nicht in der App gestartet. Bitte öffne zuerst die D.FAITH App, starte die Quest und versuche es dann erneut.`,
      false,
      returnUrl,
    ));
  }

  if (new Date(verif.expiresAt) < new Date()) {
    return html(buildPage('Link abgelaufen', 'Deine Verifikation ist abgelaufen. Bitte starte die Quest in der App neu.', false, returnUrl));
  }

  // ── Bereits abgeschlossen? ──────────────────────────────────────────────────
  const alreadyDone = await hasWalletCompletedQuest(verif.walletAddress, quest.id);
  if (alreadyDone || verif.clickVerified) {
    return html(buildPage('Bereits eingelöst ✓', 'Du hast diese Quest bereits abgeschlossen – deine Belohnung ist schon gutgeschrieben!', true, returnUrl));
  }

  // ── Quest abschließen ───────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const completion: QuestCompletion = {
    walletAddress: verif.walletAddress,
    channelId: rawHandle,
    channelName: rawHandle,
    questId: quest.id,
    platform: 'instagram',
    commentId: `story-click:${rawHandle}`,
    commentText: 'story_link_click',
    rewardAmount: quest.rewardAmount,
    rewardPaid: true,
    completedAt: now,
  };

  try {
    await markInstagramDmClicked(verif.clickToken, 0);
    await saveCompletion(completion);
    await addDfaithCredits(verif.walletAddress, quest.rewardAmount);
    const levelBonus = await payLevelBonus(verif.walletAddress, quest.creatorWallet, quest.rewardAmount, quest.id);
    await savePendingReward({ walletAddress: verif.walletAddress, amount: quest.rewardAmount, reason: `Story Quest: ${quest.videoTitle}`, questId: quest.id, createdAt: now });
    await addUserXp(verif.walletAddress, Math.round(quest.rewardAmount / 10));
    if ((quest.reputationReward ?? 0) > 0) {
      await addUserReputation(verif.walletAddress, quest.creatorWallet, quest.reputationReward!);
    }
    await deleteInstagramDmVerification(quest.id, verif.walletAddress);
    return html(buildRewardPage(quest.rewardAmount + levelBonus, quest.videoTitle, returnUrl));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return html(buildPage('Bereits eingelöst ✓', 'Du hast diese Quest bereits abgeschlossen!', true, returnUrl));
    }
    return html(buildPage('Fehler', `Ein Fehler ist aufgetreten: ${msg}`, false, returnUrl));
  }
}

// ── Hilfsfunktion ────────────────────────────────────────────────────────────
function html(body: string) {
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ── Seite: Handle-Eingabe-Formular ───────────────────────────────────────────
function buildFormPage(token: string, questTitle: string, appUrl: string): string {
  const action = `${appUrl}/api/instagram-quests/story-click`;
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Story Quest einlösen</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: linear-gradient(135deg,#1a0533,#0f172a,#09090b);
           color: #fff; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; padding: 20px; }
    .card { background: #18181b; border: 1px solid #e1306c50;
            border-radius: 20px; padding: 36px 28px; max-width: 380px; width: 100%; text-align: center; }
    .logo { font-size: 3rem; margin-bottom: 8px; display: block; }
    h1 { font-size: 1.3rem; font-weight: 800; margin-bottom: 6px; }
    .subtitle { font-size: 0.82rem; color: #a1a1aa; margin-bottom: 28px; line-height: 1.5; }
    .quest-title { background: #27272a; border-radius: 10px; padding: 10px 14px;
                   font-size: 0.8rem; color: #d4d4d8; margin-bottom: 24px;
                   text-align: left; border-left: 3px solid #e1306c; }
    label { display: block; text-align: left; font-size: 0.78rem; color: #a1a1aa;
            margin-bottom: 6px; font-weight: 600; letter-spacing: 0.04em; }
    .input-wrap { position: relative; margin-bottom: 16px; }
    .at { position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #71717a; font-size: 1rem; pointer-events: none; }
    input[type=text] { width: 100%; background: #27272a; border: 1px solid #3f3f46;
                       border-radius: 12px; color: #fff; font-size: 1rem;
                       padding: 13px 14px 13px 32px; outline: none;
                       transition: border-color 0.2s; }
    input[type=text]:focus { border-color: #e1306c; }
    input[type=text]::placeholder { color: #52525b; }
    button { width: 100%; background: linear-gradient(135deg,#e1306c,#c2185b);
             color: #fff; border: none; border-radius: 12px; padding: 14px;
             font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.85; }
    .hint { font-size: 0.72rem; color: #3f3f46; margin-top: 18px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <span class="logo">📸</span>
    <h1>Story Quest einlösen</h1>
    <p class="subtitle">Gib deinen Instagram-Handle ein um deine Belohnung zu erhalten.</p>
    ${questTitle ? `<div class="quest-title">🎥 ${questTitle}</div>` : ''}
    <form method="GET" action="${action}">
      <input type="hidden" name="token" value="${token}" />
      <label for="handle">Dein Instagram-Handle</label>
      <div class="input-wrap">
        <span class="at">@</span>
        <input type="text" id="handle" name="handle" placeholder="deinname"
               autocomplete="off" autocorrect="off" autocapitalize="none"
               spellcheck="false" required minlength="2" />
      </div>
      <button type="submit">🚀 Quest einlösen</button>
    </form>
    <p class="hint">Du musst die Quest vorher in der D.FAITH App gestartet haben.</p>
  </div>
</body>
</html>`;
}

// ── Belohnungs-Seite ─────────────────────────────────────────────────────────
function buildRewardPage(rewardAmount: number, questTitle: string, returnUrl: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quest abgeschlossen!</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: linear-gradient(135deg,#1a0533,#0f172a,#09090b);
           color: #fff; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; padding: 20px; }
    .card { background: #18181b; border: 1px solid #22c55e40;
            border-radius: 20px; padding: 40px 28px; max-width: 380px; width: 100%; text-align: center;
            box-shadow: 0 0 60px #22c55e20; }
    .confetti { font-size: 4rem; margin-bottom: 12px; display: block;
                animation: pop 0.5s ease-out; }
    @keyframes pop { 0%{transform:scale(0);opacity:0} 80%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
    .done { font-size: 1rem; color: #22c55e; font-weight: 700; letter-spacing: 0.05em;
            text-transform: uppercase; margin-bottom: 20px; }
    .reward-box { background: linear-gradient(135deg,#854d0e30,#a1620730);
                  border: 1px solid #ca8a0460; border-radius: 14px;
                  padding: 22px 20px; margin: 0 0 24px; }
    .reward-label { font-size: 0.72rem; color: #78716c; text-transform: uppercase;
                    letter-spacing: 0.08em; margin-bottom: 10px; }
    .reward-amount { font-size: 3rem; font-weight: 900; color: #fbbf24; line-height: 1; margin-bottom: 4px; }
    .reward-token  { font-size: 1.1rem; color: #fde68a; font-weight: 700; margin-bottom: 10px; }
    .reward-check  { font-size: 0.8rem; color: #22c55e; }
    .quest-title { font-size: 0.82rem; color: #71717a; margin-bottom: 24px; line-height: 1.4; }
    .btn { display: block; background: linear-gradient(135deg,#e1306c,#c2185b);
           color: #fff; padding: 14px; border-radius: 12px;
           text-decoration: none; font-weight: 700; font-size: 1rem; }
    .btn:hover { opacity: 0.85; }
    .hint { font-size: 0.75rem; color: #3f3f46; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="confetti">🎉</span>
    <p class="done">✅ Story Quest abgeschlossen!</p>
    <div class="reward-box">
      <p class="reward-label">Deine Belohnung</p>
      <p class="reward-amount">+${rewardAmount.toLocaleString('de-DE')}</p>
      <p class="reward-token">D.FAITH Credits</p>
      <p class="reward-check">✓ Wurde deinem Konto gutgeschrieben</p>
    </div>
    ${questTitle ? `<p class="quest-title">🎥 ${questTitle}</p>` : ''}
    <a class="btn" href="${returnUrl}">🚀 Zur App →</a>
    <p class="hint">Du kannst diese Seite auch einfach schließen.</p>
  </div>
</body>
</html>`;
}

// ── Info/Fehler-Seite ────────────────────────────────────────────────────────
function buildPage(title: string, message: string, success: boolean, returnUrl?: string): string {
  const color = success ? '#22c55e' : '#ef4444';
  const emoji = success ? '✅' : '❌';
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #09090b; color: #fff; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    .card { background: #18181b; border: 1px solid ${color}40; border-radius: 16px;
            padding: 36px 28px; max-width: 380px; width: 100%; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 12px; color: ${color}; }
    p { color: #a1a1aa; line-height: 1.6; margin: 0 0 24px; }
    .emoji { font-size: 3rem; margin-bottom: 16px; display: block; }
    .btn { display: inline-block; background: #e1306c; color: #fff; padding: 12px 28px;
           border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 0.95rem; }
    .hint { font-size: 0.78rem; color: #52525b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="emoji">${emoji}</span>
    <h1>${title}</h1>
    <p>${message}</p>
    ${returnUrl ? `<a class="btn" href="${returnUrl}">🚀 Zur App →</a>` : ''}
    <p class="hint">Du kannst diese Seite auch einfach schließen.</p>
  </div>
</body>
</html>`;
}
