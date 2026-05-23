/**
 * POST /api/instagram-quests/dm-share
 *
 * Story Quest – der User erstellt eine Story und markiert den Artist (@-Tag).
 * Verifizierung erfolgt ausschließlich via Meta Mentions-Webhook.
 *
 * action: 'start'  → Verifikation anlegen, creatorHandle zurückgeben
 * action: 'status' → Aktuellen Stand zurückgeben (tagVerified = Quest abgeschlossen)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserProfile,
  loadQuestDetail,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  upsertInstagramDmVerification,
  getInstagramDmVerification,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  deleteInstagramDmVerification,
  type QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

// ─── Quest-Abschluss-Helper ───────────────────────────────────────────────────

async function completeStoryQuest({
  quest, questId, normalized, profile,
}: {
  quest: Awaited<ReturnType<typeof loadQuestDetail>>;
  questId: string;
  normalized: string;
  profile: Awaited<ReturnType<typeof getUserProfile>>;
}): Promise<NextResponse> {
  if (!quest) return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  const handle = profile?.instagramHandle ?? normalized;
  const now = new Date().toISOString();
  const completion: QuestCompletion = {
    questId,
    walletAddress: normalized,
    channelId: handle,
    channelName: profile?.instagramName ?? handle,
    platform: 'instagram',
    commentId: `dm_share:${handle}`,
    commentText: `dm_share|handle:${handle}`,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
    completedAt: now,
  };
  await saveCompletion(completion);
  await addDfaithCredits(normalized, quest.rewardAmount);
  await savePendingReward({ walletAddress: normalized, amount: quest.rewardAmount, reason: `Story Quest: ${quest.videoTitle}`, questId, createdAt: now });
  await addUserXp(normalized, Math.round(quest.rewardAmount / 10));
  await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
  await deleteInstagramDmVerification(questId, normalized);
  return NextResponse.json({
    success: true,
    tagVerified: true,
    rewardAmount: quest.rewardAmount,
    message: `Quest abgeschlossen! +${quest.rewardAmount} DFAITH Credits gutgeschrieben.`,
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { action?: string; walletAddress?: string; questId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { action, walletAddress, questId } = body;
  if (!action || !walletAddress || !questId) {
    return NextResponse.json({ error: 'action, walletAddress und questId sind erforderlich' }, { status: 400 });
  }

  const normalized = walletAddress.toLowerCase();

  try {
    const [profile, quest] = await Promise.all([
      getUserProfile(normalized),
      loadQuestDetail(questId),
    ]);

    if (!profile?.instagramHandle || !profile.instagramVerified) {
      return NextResponse.json(
        { error: 'Kein verifiziertes Instagram-Konto verknüpft. Verknüpfe zuerst dein Instagram im Profil.' },
        { status: 400 },
      );
    }
    if (!quest || quest.platform !== 'instagram' || quest.type !== 'dm_share') {
      return NextResponse.json({ error: 'Quest nicht gefunden.' }, { status: 404 });
    }
    if (!quest.isActive) {
      return NextResponse.json({ error: 'Quest ist nicht mehr aktiv.' }, { status: 400 });
    }
    if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Quest ist abgelaufen.' }, { status: 400 });
    }

    // Creator-Handle für Anleitung laden
    const creatorProfile = await getUserProfile(quest.creatorWallet);
    const creatorHandle = creatorProfile?.instagramHandle ?? null;

    // ── START ─────────────────────────────────────────────────────────────────
    if (action === 'start') {
      const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
      if (alreadyDone) {
        return NextResponse.json({ error: 'Du hast diese Quest bereits abgeschlossen.' }, { status: 400 });
      }
      const handleDone = await hasChannelCompletedQuest(profile.instagramHandle, questId);
      if (handleDone) {
        return NextResponse.json({ error: 'Dieser Instagram-Account hat diese Quest bereits abgeschlossen.' }, { status: 409 });
      }

      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const clickToken = `${profile.instagramHandle.toLowerCase()}:${questId}`;
      await upsertInstagramDmVerification(questId, normalized, profile.instagramHandle, clickToken, expiresAt);

      return NextResponse.json({
        success: true,
        expiresAt,
        videoUrl: quest.videoUrl,
        instagramHandle: profile.instagramHandle,
        creatorHandle,
        message: `Erstelle eine Story und markiere @${creatorHandle ?? 'den Creator'} darin. Die Quest wird automatisch erkannt.`,
      });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (action === 'status') {
      const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
      if (alreadyDone) return NextResponse.json({ alreadyCompleted: true, tagVerified: true });

      const verif = await getInstagramDmVerification(questId, normalized);
      if (!verif) return NextResponse.json({ started: false });

      // click_verified = @-Tag per Webhook erkannt → User muss noch bestätigen
      if (verif.clickVerified) {
        return NextResponse.json({
          started: true,
          readyToComplete: true,
          tagVerified: false,
          expiresAt: verif.expiresAt,
          instagramHandle: profile.instagramHandle,
          creatorHandle,
        });
      }

      return NextResponse.json({
        started: true,
        tagVerified: false,
        expiresAt: verif.expiresAt,
        expired: new Date(verif.expiresAt) < new Date(),
        instagramHandle: profile.instagramHandle,
        creatorHandle,
      });
    }

    // ── COMPLETE ──────────────────────────────────────────────────────────────
    if (action === 'complete') {
      const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
      if (alreadyDone) return NextResponse.json({ alreadyCompleted: true, tagVerified: true });

      const verif = await getInstagramDmVerification(questId, normalized);
      if (!verif) return NextResponse.json({ error: 'Keine aktive Quest-Verifikation gefunden.' }, { status: 400 });
      if (!verif.clickVerified) {
        return NextResponse.json({ error: 'Story-Tag wurde noch nicht erkannt.' }, { status: 400 });
      }

      return await completeStoryQuest({ quest, questId, normalized, profile });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dm-share]', err);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
}
