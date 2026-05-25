/**
 * POST /api/facebook-quests/comment-verify
 *
 * Verifiziert einen Facebook-Kommentar-Quest direkt via Meta Graph API.
 *
 * Env-Variablen:
 *   META_SYSTEM_USER_TOKEN  – System User Token des dfaith_ecosystem
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
  payLevelBonus,
  getUserProfile,
} from '../../../lib/questDb';
import { findFacebookComment } from '../../../lib/metaApi';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!process.env.META_SYSTEM_USER_TOKEN) {
    return NextResponse.json(
      { error: 'META_SYSTEM_USER_TOKEN nicht konfiguriert' },
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

  // 4. Meta Graph API – prüft ob Kommentar im Facebook-Post existiert
  const result = await findFacebookComment(quest.videoId, profile.facebookHandle);

  // 5. Ergebnis auswerten
  if (!result.found) {
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
  const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
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
    rewardAmount: quest.rewardAmount + levelBonus,
    levelBonus: levelBonus > 0 ? levelBonus : undefined,
    message: `Quest abgeschlossen! +${quest.rewardAmount + levelBonus} DFAITH Credits`,
  });
}
