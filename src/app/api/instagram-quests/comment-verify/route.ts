/**
 * POST /api/instagram-quests/comment-verify
 *
 * Verifiziert einen Instagram-Kommentar-Quest direkt via Meta Graph API.
 *
 * Flow:
 *   1. App sendet { walletAddress, questId }
 *   2. Wir laden Instagram-Handle aus user_profiles
 *   3. Wir rufen Meta Graph API auf: GET /{mediaId}/comments?fields=username
 *   4. Suchen ob der Username in den Kommentaren vorkommt
 *   5. Bei Erfolg: Quest-Abschluss speichern + Credits vergeben
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
  payQuestCreditBonus,
  getUserProfile,
} from '../../../lib/questDb';
import { findInstagramComment } from '../../../lib/metaApi';

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

  // 3. Doppelabschluss prüfen (Wallet UND Instagram-Handle)
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json(
      { error: 'Du hast diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }
  const handleDone = await hasChannelCompletedQuest(profile.instagramHandle, questId);
  if (handleDone) {
    return NextResponse.json(
      { error: 'Dieser Instagram-Account hat diesen Quest bereits abgeschlossen.' },
      { status: 409 }
    );
  }

  // 4. Meta Graph API – prüft ob username in den Kommentaren des Reels vorkommt
  const graphMediaId = quest.videoId;
  const found = await findInstagramComment(graphMediaId, profile.instagramHandle);

  if (!found) {
    return NextResponse.json(
      { error: `Kein Kommentar gefunden. Hinterlasse zuerst einen positiven Kommentar unter dem Reel mit deinem Instagram-Account @${profile.instagramHandle}` },
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
  const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
  const creditBonus = await payQuestCreditBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `Instagram Comment Quest: ${quest.videoTitle}`,
    questId,
    createdAt: now,
  });
  await addUserXp(normalized, quest.reputationReward);
  await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);

  return NextResponse.json({
    success: true,
    rewardAmount: quest.rewardAmount + levelBonus,
    levelBonus: levelBonus > 0 ? levelBonus : undefined,
    message: `Quest abgeschlossen! +${quest.rewardAmount + levelBonus} DFAITH Credits`,
  });
}
