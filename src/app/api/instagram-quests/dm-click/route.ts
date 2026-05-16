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
  getInstagramDmVerificationByHandle,
  markInstagramDmClickedByHandle,
  loadQuestDetail,
  getUserProfile,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  deleteInstagramDmVerification,
  type QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 20;

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

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');

  if (!name) {
    return new NextResponse(buildPage('Ungültiger Link', 'Kein Benutzername gefunden.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const handle = decodeURIComponent(name).toLowerCase().replace(/^@/, '');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://wallet-komplett.vercel.app').replace(/\/$/, '');

  try {
    const verif = await getInstagramDmVerificationByHandle(handle);

    if (!verif) {
      return new NextResponse(buildPage('Link ungültig', 'Keine aktive Quest für diesen Account gefunden. Bitte starte die Quest zuerst in der App.', false), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (new Date(verif.expiresAt) < new Date()) {
      return new NextResponse(buildPage('Link abgelaufen', 'Dieser Link ist abgelaufen. Bitte starte die Quest neu.', false), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Teil 1 (Story-Share) muss zuerst abgeschlossen sein
    if (!verif.storyVerified) {
      return new NextResponse(buildPage(
        '⏳ Warte auf Share-Prüfung',
        'Dein Story-Share wurde noch nicht bestätigt. Gehe zurück zur App und klicke "Share prüfen".',
        false,
        `${appUrl}/?tab=quests`,
      ), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Bereits abgeschlossen?
    const alreadyDone = await hasWalletCompletedQuest(verif.walletAddress, verif.questId);
    if (alreadyDone || verif.clickVerified) {
      return new NextResponse(buildPage('Bereits abgeschlossen', 'Diese Quest hast du bereits erfolgreich abgeschlossen.', true, `${appUrl}/?tab=quests`), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // ── Quest abschließen ─────────────────────────────────────────────────────
    const quest = await loadQuestDetail(verif.questId);
    if (!quest) {
      return new NextResponse(buildPage('Quest nicht gefunden', 'Diese Quest existiert nicht mehr.', false), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const profile = await getUserProfile(verif.walletAddress);

    // Klick markieren (baseline_shares bleibt wie beim start gesetzt)
    await markInstagramDmClickedByHandle(handle, verif.baselineShares);

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
    await savePendingReward({ walletAddress: verif.walletAddress, amount: quest.rewardAmount, reason: `DM-Share Quest: ${quest.videoTitle}`, questId: verif.questId, createdAt: now });
    await addUserXp(verif.walletAddress, Math.round(quest.rewardAmount / 10));
    await addUserReputation(verif.walletAddress, quest.creatorWallet, quest.reputationReward);
    await deleteInstagramDmVerification(verif.questId, verif.walletAddress);

    const returnUrl = `${appUrl}/?tab=quests`;

    return new NextResponse(buildPage(
      '🎉 Quest abgeschlossen!',
      `+${quest.rewardAmount} DFAITH Credits wurden gutgeschrieben. Beide Teile erfolgreich abgeschlossen!`,
      true,
      returnUrl,
    ), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('[dm-click] Error:', err);
    return new NextResponse(buildPage('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
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
    ${returnUrl ? `<a class="btn" href="${returnUrl}">Zur App →</a>` : ''}
    <p class="hint">Du kannst diese Seite auch einfach schließen.</p>
  </div>
</body>
</html>`;
}
