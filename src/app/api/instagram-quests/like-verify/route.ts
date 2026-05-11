/**
 * POST /api/instagram-quests/like-verify
 *
 * Verifiziert einen Instagram Like- oder Save-Quest via Make.com Webhook (Szenario 9179157).
 *
 * Flow:
 *   1. App sendet { walletAddress, questId }
 *   2. Wir laden Instagram-Handle aus user_profiles
 *   3. Wir laden Quest-Details (type: 'like' | 'save')
 *   4. Wir rufen den Make.com Webhook auf mit ALLEN Quest-Daten
 *   5. Make.com prüft via Instagram Graph API ob der User geliked/gesaved hat
 *   6. Make.com antwortet synchron mit { found: boolean, likeCount?: number, saveCount?: number }
 *   7. Bei Erfolg: Quest-Abschluss speichern + Credits vergeben
 *
 * Env-Variablen:
 *   MAKE_INSTAGRAM_LIKE_WEBHOOK_URL  – URL des Make.com Instant Webhook (Szenario 9179157)
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
} from '../../../lib/questDb';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const makeWebhookUrl = process.env.MAKE_INSTAGRAM_LIKE_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_INSTAGRAM_LIKE_WEBHOOK_URL nicht konfiguriert' },
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
  if (quest.type !== 'like' && quest.type !== 'save') {
    return NextResponse.json({ error: 'Kein Like- oder Save-Quest' }, { status: 400 });
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

  // 4. Make.com Webhook aufrufen – alle Quest-Daten senden für maximale Flexibilität
  let makeResult: { found: boolean | string; likeCount?: number; saveCount?: number; message?: string };
  try {
    const makeRes = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Quest-Aktion
        questType: quest.type,         // 'like' | 'save'
        questId,

        // Instagram-User der die Aktion ausgeführt haben soll
        username: profile.instagramHandle,
        instagramName: profile.instagramName ?? profile.instagramHandle,
        walletAddress: normalized,

        // Reel / Media-Info
        graphMediaId: quest.videoId,   // Instagram Media ID (pk) für Graph API
        videoUrl: quest.videoUrl,
        videoTitle: quest.videoTitle,
        videoThumbnail: quest.videoThumbnail,

        // Quest-Metadaten (für Make-seitige Logs / weitere Szenarien)
        platform: quest.platform,
        rewardAmount: quest.rewardAmount,
        creatorWallet: quest.creatorWallet,
        description: quest.description,
        completions: quest.completions,
        maxCompletions: quest.maxCompletions,
        expiresAt: quest.expiresAt,
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
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    if (isTimeout) {
      const actionLabel = quest.type === 'like' ? 'geliked' : 'gespeichert';
      return NextResponse.json(
        { error: `Keine Aktion gefunden. Stelle sicher, dass du das Reel mit @${profile.instagramHandle} ${actionLabel} hast.` },
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
    const actionLabel = quest.type === 'like' ? 'geliked' : 'gespeichert';
    return NextResponse.json(
      { error: `Aktion nicht bestätigt. Stelle sicher, dass du das Reel mit @${profile.instagramHandle} ${actionLabel} hast.` },
      { status: 404 }
    );
  }

  // 5. Abschluss speichern
  const now = new Date().toISOString();
  await saveCompletion({
    questId,
    walletAddress: normalized,
    channelId: profile.instagramHandle,
    channelName: profile.instagramName ?? profile.instagramHandle,
    platform: 'instagram',
    commentId: quest.type,            // 'like' oder 'save' als Identifier
    commentText: `instagram ${quest.type}`,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
    completedAt: now,
  });

  // 6. Credits gutschreiben
  await addDfaithCredits(normalized, quest.rewardAmount);
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `Instagram ${quest.type === 'like' ? 'Like' : 'Save'} Quest: ${quest.videoTitle}`,
    questId,
    createdAt: now,
  });
  await addUserXp(normalized, quest.rewardAmount);

  const actionDone = quest.type === 'like' ? 'geliked' : 'gespeichert';
  return NextResponse.json({
    success: true,
    rewardAmount: quest.rewardAmount,
    questType: quest.type,
    likeCount: makeResult.likeCount,
    saveCount: makeResult.saveCount,
    message: `Quest abgeschlossen! Du hast das Reel ${actionDone}. +${quest.rewardAmount} DFAITH Credits`,
  });
}
