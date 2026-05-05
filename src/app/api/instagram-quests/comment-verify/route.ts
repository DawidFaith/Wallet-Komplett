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
 *   MAKE_INSTAGRAM_WEBHOOK_URL  – URL des Make.com Instant Webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  getUserProfile,
  getVerificationCode,
} from '../../../lib/questDb';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const makeWebhookUrl = process.env.MAKE_INSTAGRAM_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_INSTAGRAM_WEBHOOK_URL nicht konfiguriert' },
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

  // 4. Verifizierungscode berechnen
  const verificationCode = getVerificationCode(walletAddress);

  // 5. Make.com Webhook aufrufen (synchron – Make.com antwortet mit "Webhook Response" Modul)
  let makeResult: { found: boolean; commentId?: string };
  try {
    const makeRes = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.instagramHandle,
        verificationCode,
        mediaId: quest.videoId,   // Instagram Media-ID (pk) – wird beim Quest-Erstellen gesetzt
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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Make.com nicht erreichbar', details: msg },
      { status: 502 }
    );
  }

  if (!makeResult.found) {
    return NextResponse.json(
      {
        error: `Kommentar nicht gefunden. Stelle sicher dass du unter dem Reel genau "${verificationCode}" kommentiert hast.`,
        verificationCode,
      },
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
    commentId: makeResult.commentId ?? 'unknown',
    commentText: verificationCode,
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

  return NextResponse.json({
    success: true,
    rewardAmount: quest.rewardAmount,
    message: `Quest abgeschlossen! +${quest.rewardAmount} DFAITH Credits`,
  });
}
