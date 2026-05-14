/**
 * POST /api/instagram-quests/comment-verify
 *
 * Verifiziert einen Instagram-Kommentar-Quest via Make.com Webhook.
 *
 * Flow:
 *   1. App sendet { walletAddress, questId }
 *   2. Wir laden Instagram-Handle aus user_profiles
 *   3. Wir rufen einen Make.com Webhook auf
 *   4. Make.com ruft die Instagram Graph API auf (mit Dawids Token)
 *      → GET /{mediaId}/comments → sucht Kommentar von diesem User mit dem Verifizierungscode
 *   5. Make.com antwortet synchron mit { found: boolean, commentId?: string }
 *   6. Bei Erfolg: Quest-Abschluss speichern + Credits vergeben
 *
 * Env-Variablen:
 *   MAKE_INSTAGRAM_COMMENT_WEBHOOK_URL  – URL des Make.com Instant Webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  getUserProfile,
} from '../../../lib/questDb';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const makeWebhookUrl = process.env.MAKE_INSTAGRAM_COMMENT_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_INSTAGRAM_COMMENT_WEBHOOK_URL nicht konfiguriert' },
      { status: 500 }
    );
  }

  let body: { walletAddress?: string; questId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { walletAddress, questId } = body;
  if (!walletAddress || !questId) {
    return NextResponse.json(
      { error: 'walletAddress und questId sind erforderlich' },
      { status: 400 }
    );
  }

  const normalized = walletAddress.toLowerCase();

  // 1. Profil prüfen – Instagram muss verknüpft + verifiziert sein
  const profile = await getUserProfile(normalized);
  if (!profile?.instagramHandle || !profile.instagramVerified) {
    return NextResponse.json(
      { error: 'Kein verifiziertes Instagram-Konto verknüpft. Verknüpfe zuerst dein Instagram im Profil.' },
      { status: 400 }
    );
  }

  // 2. Quest laden
  const quest = await loadQuestDetail(questId);
  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }
  if (quest.platform !== 'instagram') {
    return NextResponse.json({ error: 'Kein Instagram-Quest' }, { status: 400 });
  }
  if (!quest.isActive) {
    return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
  }
  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
  }
  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json(
      { error: 'Alle Plätze für diesen Quest sind vergeben' },
      { status: 400 }
    );
  }

  // 3. Doppelabschluss prüfen
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json(
      { error: 'Du hast diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }

  // 4. Make.com Webhook aufrufen – prüft ob username in den Kommentaren des Reels vorkommt
  const graphMediaId = quest.videoId;

  let makeResult: { found: boolean | string; total?: number };
  try {
    const makeRes = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.instagramHandle,
        graphMediaId,
        questId,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!makeRes.ok) {
      return NextResponse.json(
        { error: 'Make.com Webhook Fehler', details: await makeRes.text() },
        { status: 502 }
      );
    }

    makeResult = await makeRes.json();
  } catch (err: unknown) {
    // Timeout = kein Kommentar mit passendem Username gefunden → Filter hat alles geblockt
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    if (isTimeout) {
      return NextResponse.json(
        { error: 'Kein Kommentar gefunden. Hinterlasse zuerst einen positiven Kommentar unter dem Reel mit deinem Instagram-Account @' + profile.instagramHandle },
        { status: 404 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Make.com nicht erreichbar', details: msg },
      { status: 502 }
    );
  }

  const found = makeResult.found === true || makeResult.found === 'true';
  if (!found) {
    return NextResponse.json(
      { error: 'Kein Kommentar gefunden. Hinterlasse zuerst einen positiven Kommentar unter dem Reel mit deinem Instagram-Account @' + profile.instagramHandle },
      { status: 404 }
    );
  }

  // 6. Abschluss speichern
  const now = new Date().toISOString();
  await saveCompletion({
    questId,
    walletAddress: normalized,
    channelId: profile.instagramHandle,
    channelName: profile.instagramName ?? profile.instagramHandle,
    platform: 'instagram',
    commentId: 'comment',
    commentText: 'positive comment',
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
    completedAt: now,
  });

  // 7. Credits gutschreiben
  await addDfaithCredits(normalized, quest.rewardAmount);
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `Instagram Comment Quest: ${quest.videoTitle}`,
    questId,
    createdAt: now,
  });
  await addUserXp(normalized, quest.rewardAmount);
  await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);

  return NextResponse.json({
    success: true,
    rewardAmount: quest.rewardAmount,
    message: `Quest abgeschlossen! +${quest.rewardAmount} DFAITH Credits`,
  });
}
