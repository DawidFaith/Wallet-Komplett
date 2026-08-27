/**
 * POST /api/quests/ugc-submit
 *
 * Verifiziert eine UGC-Quest ("erstelle einen eigenen Beitrag zum Thema des
 * Künstlers, inkl. Hashtag/Erwähnung"). Der Fan reicht den Link zu seinem
 * EIGENEN Post ein (auf YouTube/TikTok/Instagram/Facebook) — die App holt
 * sich Titel/Caption per öffentlichem oEmbed-Lookup (lib/oembed.ts) und
 * prüft, ob der geforderte Hashtag/Erwähnung enthalten ist.
 *
 * Body: { walletAddress, questId, postUrl }
 *
 * Antwort:
 *   { success: true, rewardAmount, ... }                     — sofort freigegeben
 *   { success: false, pending: true, message }                — automatischer Check fehlgeschlagen, wartet auf manuelle Prüfung
 *   { success: false, error }                                 — Hashtag nicht gefunden / sonstiger Fehler
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  payLevelBonus,
  payQuestCreditBonus,
  addUserReputationWithBonus,
  getUgcSubmission,
  createUgcSubmission,
} from '../../../lib/questDb';
import { fetchPostCaption, captionContainsTag } from '../../../lib/oembed';
import { requireOwnWallet } from '../../../lib/apiAuth';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; questId?: string; postUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { walletAddress, questId, postUrl } = body;
  if (!walletAddress || !questId || !postUrl?.trim()) {
    return NextResponse.json({ error: 'walletAddress, questId und postUrl sind erforderlich' }, { status: 400 });
  }
  const authCheck = requireOwnWallet(walletAddress);
  if (!authCheck.ok) return authCheck.response;

  const normalized = walletAddress.toLowerCase();
  const trimmedUrl = postUrl.trim();

  // 1. Quest laden + validieren
  const quest = await loadQuestDetail(questId);
  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }
  if (quest.type !== 'ugc') {
    return NextResponse.json({ error: 'Kein UGC-Quest' }, { status: 400 });
  }
  if (!quest.requiredTag) {
    return NextResponse.json({ error: 'Für diesen Quest ist kein Hashtag/Erwähnung hinterlegt.' }, { status: 500 });
  }
  if (!quest.isActive) {
    return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
  }
  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
  }
  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json({ error: 'Alle Plätze für diesen Quest sind vergeben' }, { status: 400 });
  }

  // 2. Doppelabschluss / Doppel-Einreichung prüfen
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json({ error: 'Du hast diesen Quest bereits abgeschlossen' }, { status: 409 });
  }
  const existingSubmission = await getUgcSubmission(questId, normalized);
  if (existingSubmission) {
    if (existingSubmission.status === 'pending') {
      return NextResponse.json({ success: false, pending: true, message: 'Deine Einreichung wird bereits geprüft.' });
    }
    if (existingSubmission.status === 'rejected') {
      return NextResponse.json({ error: existingSubmission.rejectionReason ?? 'Deine vorherige Einreichung wurde abgelehnt.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Du hast diesen Quest bereits eingereicht' }, { status: 409 });
  }

  // 3. Post-Metadaten holen + Hashtag prüfen
  const result = await fetchPostCaption(quest.platform, trimmedUrl);

  if (!result) {
    // Technischer Fehlschlag (nicht erreichbar, Berechtigung fehlt, privates Konto...) →
    // nicht den Fan bestrafen, sondern zur manuellen Prüfung vormerken.
    await createUgcSubmission({
      questId, walletAddress: normalized, platform: quest.platform,
      submittedUrl: trimmedUrl, detectedCaption: null, status: 'pending',
    });
    return NextResponse.json({
      success: false,
      pending: true,
      message: 'Dein Link konnte nicht automatisch geprüft werden und wartet jetzt auf manuelle Prüfung durch den Künstler.',
    });
  }

  const tagFound = captionContainsTag(result.caption, quest.requiredTag);
  if (!tagFound) {
    await createUgcSubmission({
      questId, walletAddress: normalized, platform: quest.platform,
      submittedUrl: trimmedUrl, detectedCaption: result.caption, status: 'rejected',
      rejectionReason: `"${quest.requiredTag}" wurde in deinem Beitrag nicht gefunden.`,
    });
    return NextResponse.json(
      { error: `"${quest.requiredTag}" wurde in deinem Beitrag nicht gefunden. Bitte stelle sicher, dass es enthalten ist, und versuche es erneut.` },
      { status: 400 },
    );
  }

  // 4. Freigabe + Auszahlung (gleicher Pfad wie alle anderen Quest-Typen)
  const channelId = result.authorHandle ?? normalized;
  const handleDone = await hasChannelCompletedQuest(channelId, questId);
  if (handleDone) {
    return NextResponse.json({ error: 'Dieser Account hat diesen Quest bereits abgeschlossen.' }, { status: 409 });
  }

  await createUgcSubmission({
    questId, walletAddress: normalized, platform: quest.platform,
    submittedUrl: trimmedUrl, detectedCaption: result.caption, status: 'approved',
  });

  const now = new Date().toISOString();
  await saveCompletion({
    questId,
    walletAddress: normalized,
    channelId,
    channelName: result.authorHandle ?? channelId,
    platform: quest.platform,
    commentId: `ugc-${normalized}-${questId}`,
    commentText: trimmedUrl,
    completedAt: now,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
  });

  await addDfaithCredits(normalized, quest.rewardAmount);
  const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
  const creditBonus = await payQuestCreditBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `UGC Quest abgeschlossen: ${quest.videoTitle}`,
    questId,
    createdAt: now,
  });
  await addUserReputationWithBonus(normalized, quest.creatorWallet, quest.reputationReward);

  return NextResponse.json({
    success: true,
    rewardAmount: quest.rewardAmount + levelBonus + creditBonus,
    levelBonus: levelBonus > 0 ? levelBonus : undefined,
    creditBonus: creditBonus > 0 ? creditBonus : undefined,
    message: `Quest abgeschlossen! +${quest.rewardAmount + levelBonus + creditBonus} DFAITH Credits`,
  });
}
