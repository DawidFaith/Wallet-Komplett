/**
 * GET /api/instagram-quests/dm-click?name=INSTAGRAM_HANDLE
 *
 * Universeller Klick-Link – nur der Instagram-Handle als Variable.
 * Wird aufgerufen wenn der User den Link in seiner DM anklickt (Teil 2).
 *
 * Voraussetzung: Teil 1 (Story-Share) muss bereits verifiziert sein.
 *
 * Ablauf:
 *  1. Handle → neueste aktive DM-Verifikation laden
 *  2. Prüfen ob story_verified = TRUE (Share muss zuerst erfolgt sein)
 *  3. click_verified = TRUE setzen
 *  4. Quest abschließen + DFAITH Credits gutschreiben
 *  5. HTML-Erfolgsseite mit Auto-Redirect zur App
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getInstagramDmVerificationByToken,
  getInstagramDmVerificationByHandle,
  markInstagramDmClicked,
  markInstagramDmClickedByHandle,
  loadQuestDetail,
  getUserProfile,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  payLevelBonus,
  payQuestCreditBonus,
  deleteInstagramDmVerification,
  type QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 20;

// ── Quest-Abschluss-Logik via Token (universeller Link) ──────────────────────
async function processToken(token: string): Promise<
  | { ok: true; rewardAmount: number; questTitle: string; message: string; alreadyDone?: boolean }
  | { ok: false; status: number; error: string }
> {
  const verif = await getInstagramDmVerificationByToken(token);

  if (!verif) {
    return { ok: false, status: 404, error: 'Dieser Link ist ungültig oder wurde bereits verwendet.' };
  }

  if (new Date(verif.expiresAt) < new Date()) {
    return { ok: false, status: 410, error: 'Dieser Link ist abgelaufen. Bitte starte die Quest neu.' };
  }

  const alreadyDone = await hasWalletCompletedQuest(verif.walletAddress, verif.questId);
  if (alreadyDone || verif.clickVerified) {
    return { ok: true, alreadyDone: true, rewardAmount: 0, questTitle: '', message: 'Diese Quest hast du bereits erfolgreich abgeschlossen.' };
  }

  const quest = await loadQuestDetail(verif.questId);
  if (!quest) {
    return { ok: false, status: 404, error: 'Quest nicht gefunden.' };
  }

  const profile = await getUserProfile(verif.walletAddress);
  const handle = verif.instagramHandle;

  await markInstagramDmClicked(token, 0);

  const now = new Date().toISOString();
  const completion: QuestCompletion = {
    walletAddress: verif.walletAddress,
    channelId: handle,
    channelName: profile.instagramName ?? handle,
    questId: verif.questId,
    platform: 'instagram',
    commentId: `dm_share:${handle}`,
    commentText: `dm_share|handle:${handle}`,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
    completedAt: now,
  };

  await saveCompletion(completion);
  await addDfaithCredits(verif.walletAddress, quest.rewardAmount);
  const levelBonus = await payLevelBonus(verif.walletAddress, quest.creatorWallet, quest.rewardAmount, quest.id);
  const creditBonus = await payQuestCreditBonus(verif.walletAddress, quest.creatorWallet, quest.rewardAmount, quest.id);
  await savePendingReward({ walletAddress: verif.walletAddress, amount: quest.rewardAmount, reason: `Story Quest: ${quest.videoTitle}`, questId: verif.questId, createdAt: now });
  await addUserXp(verif.walletAddress, quest.reputationReward);
  await addUserReputation(verif.walletAddress, quest.creatorWallet, quest.reputationReward);
  await deleteInstagramDmVerification(verif.questId, verif.walletAddress);

  return { ok: true, rewardAmount: quest.rewardAmount + levelBonus, questTitle: quest.videoTitle, message: `+${quest.rewardAmount + levelBonus} D.FAITH Credits wurden gutgeschrieben.` };
}

// ── Rückwärtskompatibel: Abschluss via Handle (für POST / manuelle Trigger) ──
async function processHandle(handle: string): Promise<
  | { ok: true; rewardAmount: number; questTitle: string; message: string; alreadyDone?: boolean }
  | { ok: false; status: number; error: string }
> {
  const verif = await getInstagramDmVerificationByHandle(handle);
  if (!verif) {
    return { ok: false, status: 404, error: 'Keine aktive Quest für diesen Account gefunden.' };
  }
  return processToken(verif.clickToken);
}

// ── POST /api/instagram-quests/dm-click  (von /dm-quest Formular) ────────────
export async function POST(req: NextRequest) {
  let rawHandle: string;
  try {
    const body = await req.json();
    rawHandle = body.handle ?? '';
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  if (!rawHandle || typeof rawHandle !== 'string') {
    return NextResponse.json({ error: 'Handle fehlt.' }, { status: 400 });
  }

  const handle = rawHandle.toLowerCase().replace(/^@/, '').trim();

  try {
    const result = await processHandle(handle);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, rewardAmount: result.rewardAmount, message: result.message, alreadyDone: result.alreadyDone ?? false });
  } catch (err) {
    console.error('[dm-click POST] Error:', err);
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten.' }, { status: 500 });
  }
}

async function fetchBaselineShares(
  webhookUrl: string,
  graphMediaId: string,
): Promise<number> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphMediaId }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!text) return 0;
    const extract = (arr: any[]): number | null => {
      for (const it of arr) {
        if (it && typeof it === 'object' && it.name === 'shares') {
          const n = Number(it?.values?.[0]?.value);
          if (Number.isFinite(n)) return n;
        }
      }
      return null;
    };
    try {
      const json = JSON.parse(text);
      if (typeof json?.shares === 'number') return json.shares;
      if (Array.isArray(json?.metrics)) {
        const n = extract(json.metrics);
        if (n !== null) return n;
      }
      if (Array.isArray(json?.data)) {
        const n = extract(json.data);
        if (n !== null) return n;
      }
      if (Array.isArray(json)) {
        const n = extract(json);
        if (n !== null) return n;
      }
    } catch {
      // Fallthrough
    }
    const block = text.match(/"name"\s*:\s*"shares"[\s\S]{0,300}?"value"\s*:\s*(\d+)/);
    if (block) return Number(block[1]);
    const direct = text.match(/(?<!\/)"shares"\s*:\s*(\d+)/);
    if (direct) return Number(direct[1]);
    return 0;
  } catch {
    return 0;
  }
}

// ── GET /api/instagram-quests/dm-click?token=UUID  (universeller DM-Link) ─────────────
export async function GET(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get('token');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de').replace(/\/$/, '');

  if (!token) {
    return new NextResponse(buildPage(
      'Ungültiger Link',
      'Dieser Link enthält keinen Token. Bitte öffne die App und starte die Quest erneut.',
      false,
      `${appUrl}/?tab=quests`,
    ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  try {
    const result = await processToken(token);

    if (!result.ok) {
      return new NextResponse(buildPage(
        result.status === 410 ? 'Link abgelaufen' : 'Quest nicht gefunden',
        result.error,
        false,
        `${appUrl}/?tab=quests`,
      ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (result.alreadyDone) {
      return new NextResponse(buildPage(
        'Bereits abgeschlossen',
        'Diese Quest hast du bereits abgeschlossen. Deine Belohnung ist schon gutgeschrieben.',
        true,
        `${appUrl}/?tab=quests`,
      ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new NextResponse(buildRewardPage(
      result.rewardAmount,
      result.questTitle,
      `${appUrl}/?tab=quests`,
    ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err) {
    console.error('[dm-click GET] Error:', err);
    return new NextResponse(buildPage('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.', false, `${appUrl}/?tab=quests`), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ── Große Belohnungs-Seite nach erfolgreichem Quest-Abschluss ────────────────────────
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
    .reward-amount { font-size: 3rem; font-weight: 900; color: #fbbf24;
                     line-height: 1; margin-bottom: 4px; }
    .reward-token  { font-size: 1.1rem; color: #fde68a; font-weight: 700; margin-bottom: 10px; }
    .reward-check  { font-size: 0.8rem; color: #22c55e; }
    .quest-title { font-size: 0.82rem; color: #71717a; margin-bottom: 24px;
                   line-height: 1.4; max-height: 3em; overflow: hidden; }
    .btn { display: block; background: linear-gradient(135deg,#e1306c,#c2185b);
           color: #fff; padding: 14px; border-radius: 12px;
           text-decoration: none; font-weight: 700; font-size: 1rem;
           transition: opacity .2s; }
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
    .btn:hover { background: #c2185b; }
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
