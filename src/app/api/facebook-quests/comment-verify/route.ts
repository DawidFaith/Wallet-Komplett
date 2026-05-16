/**
 * POST /api/facebook-quests/comment-verify
 *
 * Verifiziert einen Facebook-Kommentar-Quest via Make.com Webhook.
 *
 * Flow:
 *   1. App sendet { walletAddress, questId }
 *   2. Wir laden Facebook-Handle aus user_profiles
 *   3. Wir rufen MAKE_FACEBOOK_COMMENT_WEBHOOK_URL auf
 *   4. Make.com prüft ob der Username in den Kommentaren des Posts vorkommt
 *   5. Make.com antwortet synchron mit { found: boolean }
 *   6. Bei Erfolg: Quest-Abschluss speichern + Credits vergeben
 *
 * Env-Variablen:
 *   MAKE_FACEBOOK_COMMENT_WEBHOOK_URL  – URL des Make.com Instant Webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  getUserProfile,
} from '../../../lib/questDb';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const makeWebhookUrl = process.env.MAKE_FACEBOOK_COMMENT_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_FACEBOOK_COMMENT_WEBHOOK_URL nicht konfiguriert' },
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

  // 1. Profil prüfen – Facebook muss verknüpft + verifiziert sein
  const profile = await getUserProfile(normalized);
  if (!profile?.facebookHandle || !profile.facebookVerified) {
    return NextResponse.json(
      { error: 'Kein verifiziertes Facebook-Konto verknüpft. Verknüpfe zuerst dein Facebook im Profil.' },
      { status: 400 }
    );
  }

  // 2. Quest laden
  const quest = await loadQuestDetail(questId);
  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }
  if (quest.platform !== 'facebook') {
    return NextResponse.json({ error: 'Kein Facebook-Quest' }, { status: 400 });
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

  // 3. Doppelabschluss prüfen (Wallet UND Facebook-Handle)
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json(
      { error: 'Du hast diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }
  const handleDone = await hasChannelCompletedQuest(profile.facebookHandle, questId);
  if (handleDone) {
    return NextResponse.json(
      { error: 'Dieser Facebook-Account hat diesen Quest bereits abgeschlossen.' },
      { status: 409 }
    );
  }

  // 4. Make.com Webhook aufrufen – prüft ob username in den Kommentaren des Posts vorkommt
  let makeResult: { found: boolean | string };
  try {
    const makeRes = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.facebookHandle,
        post_id: quest.videoId,
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
  } catch (err) {
    return NextResponse.json(
      { error: `Make.com nicht erreichbar: ${err instanceof Error ? err.message : 'Timeout'}` },
      { status: 502 }
    );
  }

  // 5. Ergebnis auswerten
  const found = makeResult.found === true || makeResult.found === 'true';
  if (!found) {
    return NextResponse.json({
      notFound: true,
      message: `Kein Kommentar von ${profile.facebookHandle} gefunden. Stelle sicher, dass du unter dem Post kommentiert hast, und versuche es erneut.`,
    });
  }

  // 6. Quest-Abschluss speichern
  const now = new Date().toISOString();
  await saveCompletion({
    questId,
    walletAddress: normalized,
    channelId: profile.facebookHandle,
    channelName: profile.facebookName ?? profile.facebookHandle,
    platform: 'facebook',
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
    reason: `Facebook Comment Quest: ${quest.videoTitle}`,
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
