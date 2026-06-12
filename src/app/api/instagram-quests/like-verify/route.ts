/**
 * POST /api/instagram-quests/like-verify
 *
 * Verifiziert einen Instagram Like- oder Save-Quest via Meta Graph API.
 *
 * Flow:
 *   action: 'start' → Baseline-Stats via Graph API laden, 10-Min-Fenster öffnen
 *   action: 'check' → Aktuelle Stats via Graph API laden, Delta prüfen → Quest abschließen
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
  addUserReputationWithBonus,
  payLevelBonus,
  payQuestCreditBonus,
  getUserProfile,
  upsertInstagramLikeVerification,
  getInstagramLikeVerification,
  deleteInstagramLikeVerification,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

interface InsightsResult {
  likes: number;
  saved: number;
  comments: number;
  shares: number;
  reach: number;
  total_interactions: number;
}

const GRAPH = 'https://graph.facebook.com/v21.0';

async function fetchInsights(graphMediaId: string): Promise<InsightsResult | null> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return null;
  try {
    // 1. Basis-Metriken
    const basicRes = await fetch(
      `${GRAPH}/${graphMediaId}?fields=like_count,comments_count&access_token=${token}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const basic = await basicRes.json() as {
      like_count?: number;
      comments_count?: number;
      error?: { message: string };
    };
    if (basic.error) {
      console.error('[like-verify] Graph API Fehler:', basic.error.message);
      return null;
    }

    // 2. Insights (saved, reach, total_interactions)
    let saved = 0, reach = 0, total_interactions = 0;
    try {
      const insRes = await fetch(
        `${GRAPH}/${graphMediaId}/insights?metric=saved,reach,total_interactions&period=lifetime&access_token=${token}`,
        { cache: 'no-store', signal: AbortSignal.timeout(10000) },
      );
      const ins = await insRes.json() as {
        data?: Array<{ name: string; values: Array<{ value: number }> }>;
        error?: { message: string };
      };
      if (!ins.error && Array.isArray(ins.data)) {
        for (const m of ins.data) {
          const v = Number(m.values?.[0]?.value ?? 0);
          if (m.name === 'saved') saved = v;
          else if (m.name === 'reach') reach = v;
          else if (m.name === 'total_interactions') total_interactions = v;
        }
      }
    } catch { /* Insights optional */ }

    const likes = basic.like_count ?? 0;
    const comments = basic.comments_count ?? 0;
    return {
      likes,
      saved,
      comments,
      shares: 0,
      reach,
      total_interactions: total_interactions || likes + comments + saved,
    };
  } catch (e) {
    console.error('[like-verify] fetchInsights Fehler:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {

  let body: { action?: string; walletAddress?: string; questId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { action, walletAddress, questId } = body;
  if (!action || !walletAddress || !questId) {
    return NextResponse.json(
      { error: 'action, walletAddress und questId sind erforderlich' },
      { status: 400 }
    );
  }

  const normalized = walletAddress.toLowerCase();

  try {
    // ── Gemeinsame Vorab-Prüfungen ──────────────────────────────────────────
    const [profile, quest] = await Promise.all([
      getUserProfile(normalized),
      loadQuestDetail(questId),
    ]);

    if (!profile?.instagramHandle || !profile.instagramVerified) {
      return NextResponse.json(
        { error: 'Kein verifiziertes Instagram-Konto verknüpft. Verknüpfe zuerst dein Instagram im Profil.' },
        { status: 400 }
      );
    }
    if (!quest) {
      return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
    }
    if (quest.platform !== 'instagram') {
      return NextResponse.json({ error: 'Kein Instagram-Quest' }, { status: 400 });
    }
    if (quest.type !== 'like' && (quest.type as string) !== 'save' && (quest.type as string) !== 'engagement' && (quest.type as string) !== 'repost') {
      return NextResponse.json({ error: 'Kein Like-, Save-, Engagement- oder Repost-Quest' }, { status: 400 });
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

    const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
    if (alreadyDone) {
      return NextResponse.json({ error: 'Du hast diesen Quest bereits abgeschlossen' }, { status: 409 });
    }

    // ── action: start ───────────────────────────────────────────────────────
    if (action === 'start') {
      const stats = await fetchInsights(quest.videoId);
      if (!stats) {
        return NextResponse.json(
          { error: 'Instagram-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten
      // Repost-Baseline = total_interactions - likes - comments - shares - saved
      const repostBaseline = (quest.type as string) === 'repost'
        ? Math.max(0, Number(stats.total_interactions ?? 0) - Number(stats.likes ?? 0) - Number(stats.comments ?? 0) - Number(stats.shares ?? 0) - Number(stats.saved ?? 0))
        : 0;

      await upsertInstagramLikeVerification(
        questId, normalized, quest.videoId,
        quest.type as 'like' | 'save' | 'engagement' | 'repost',
        (quest.type as string) === 'repost' ? repostBaseline : Number(stats.likes ?? 0),
        (quest.type as string) === 'repost' ? Number(stats.total_interactions ?? 0) : Number(stats.saved ?? 0),
        expiresAt,
      );

      const actionLabel =
        (quest.type as string) === 'engagement' ? 'like und speichere'
        : (quest.type as string) === 'repost' ? 'teile (reposte)'
        : quest.type === 'like' ? 'like' : 'speichere';
      return NextResponse.json({
        step: 'pending',
        expiresAt,
        message: `Öffne jetzt das Reel und ${actionLabel} es mit deinem Account @${profile.instagramHandle}. Du hast 10 Minuten.`,
      });
    }

    // ── action: check ───────────────────────────────────────────────────────
    if (action === 'check') {
      const verification = await getInstagramLikeVerification(questId, normalized);
      if (!verification) {
        return NextResponse.json(
          { error: 'Keine laufende Verifizierung gefunden. Starte neu.' },
          { status: 400 }
        );
      }

      if (new Date(verification.expiresAt) < new Date()) {
        await deleteInstagramLikeVerification(questId, normalized);
        return NextResponse.json({ expired: true });
      }

      const current = await fetchInsights(quest.videoId);
      if (!current) {
        return NextResponse.json(
          { error: 'Instagram-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }

      const likeVerified = Number(current.likes ?? 0) > verification.baselineLikes;
      const saveVerified = Number(current.saved ?? 0) > verification.baselineSaves;

      // ── Repost ──────────────────────────────────────────────────────────
      if ((quest.type as string) === 'repost') {
        // baselineLikes = repost-Baseline, baselineSaves = total_interactions-Baseline
        const currentReposts = Math.max(0,
          Number(current.total_interactions ?? 0) - Number(current.likes ?? 0) - Number(current.comments ?? 0) - Number(current.shares ?? 0) - Number(current.saved ?? 0)
        );
        const repostVerified = currentReposts > verification.baselineLikes;

        if (!repostVerified) {
          return NextResponse.json({
            success: false,
            notYet: true,
            message: `Noch nicht erkannt. Stelle sicher, dass du das Reel mit @${profile.instagramHandle} geteilt (repostet) hast.`,
            expiresAt: verification.expiresAt,
          });
        }

        const now = new Date().toISOString();
        const completion: QuestCompletion = {
          questId,
          walletAddress: normalized,
          channelId: profile.instagramHandle,
          channelName: profile.instagramName ?? profile.instagramHandle,
          platform: 'instagram',
          commentId: `instagram-repost-${normalized}-${questId}`,
          commentText: 'instagram repost',
          rewardAmount: quest.rewardAmount,
          rewardPaid: false,
          completedAt: now,
        };
        await saveCompletion(completion);
        await addDfaithCredits(normalized, quest.rewardAmount);
        const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
        const creditBonus = await payQuestCreditBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
        await savePendingReward({
          walletAddress: normalized,
          amount: quest.rewardAmount,
          reason: `Instagram Repost Quest: ${quest.videoTitle}`,
          questId,
          createdAt: now,
        });
        await addUserXp(normalized, quest.reputationReward);
        await addUserReputationWithBonus(normalized, quest.creatorWallet, quest.reputationReward);
        await deleteInstagramLikeVerification(questId, normalized);

        return NextResponse.json({
          success: true,
          rewardAmount: quest.rewardAmount + levelBonus + creditBonus,
          levelBonus: levelBonus > 0 ? levelBonus : undefined,
          message: `Quest abgeschlossen! Du hast das Reel geteilt. +${quest.rewardAmount + levelBonus + creditBonus} DFAITH Credits`,
        });
      }

      // ── Engagement (Like + Save) mit Teilbelohnung ──────────────────────
      if ((quest.type as string) === 'engagement') {
        const verifiedCount = [likeVerified, saveVerified].filter(Boolean).length;

        if (verifiedCount === 0) {
          return NextResponse.json({
            success: false,
            notYet: true,
            likeVerified: false,
            saveVerified: false,
            message: `Noch keine Aktion erkannt. Like und/oder speichere das Reel mit @${profile.instagramHandle}.`,
            expiresAt: verification.expiresAt,
          });
        }

        const halfReward = Math.round((quest.rewardAmount / 2) * 100) / 100;
        const earnedReward = Math.round(halfReward * verifiedCount * 100) / 100;
        const refundToCreator = Math.round((quest.rewardAmount - earnedReward) * 100) / 100; // nicht verdiente Hälfte zurück
        const now = new Date().toISOString();
        const completion: QuestCompletion = {
          questId,
          walletAddress: normalized,
          channelId: profile.instagramHandle,
          channelName: profile.instagramName ?? profile.instagramHandle,
          platform: 'instagram',
          commentId: `instagram-engagement-${normalized}-${questId}`,
          commentText: `instagram engagement (like:${likeVerified}, save:${saveVerified})`,
          rewardAmount: earnedReward,
          rewardPaid: false,
          completedAt: now,
        };
        await saveCompletion(completion);
        await addDfaithCredits(normalized, earnedReward);
        const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, earnedReward, quest.id);
        const creditBonus = await payQuestCreditBonus(normalized, quest.creatorWallet, earnedReward, quest.id);
        await savePendingReward({
          walletAddress: normalized,
          amount: earnedReward,
          reason: `Instagram Engagement Quest: ${quest.videoTitle}`,
          questId,
          createdAt: now,
        });
        await addUserXp(normalized, verifiedCount < 2 ? Math.round(quest.reputationReward / 2) : quest.reputationReward);
        await addUserReputationWithBonus(normalized, quest.creatorWallet, verifiedCount < 2 ? Math.round(quest.reputationReward / 2) : quest.reputationReward);

        // Nicht verdiente Hälfte sofort an Creator zurückbuchen
        if (refundToCreator > 0) {
          await addDfaithCredits(quest.creatorWallet, refundToCreator);
        }

        await deleteInstagramLikeVerification(questId, normalized);

        return NextResponse.json({
          success: true,
          rewardAmount: earnedReward + levelBonus + creditBonus,
          levelBonus: levelBonus > 0 ? levelBonus : undefined,
          likeVerified,
          saveVerified,
          partial: verifiedCount < 2,
          message: verifiedCount < 2
            ? `Teilbelohnung: +${earnedReward + levelBonus + creditBonus} DFAITH Credits (${verifiedCount}/2 Aktionen erkannt)`
            : `Quest abgeschlossen! Like & Speichern erkannt. +${earnedReward + levelBonus + creditBonus} DFAITH Credits`,
        });
      }

      // ── Einzelaktion (Like oder Save) ────────────────────────────────────
      const verified = quest.type === 'like' ? likeVerified : saveVerified;

      if (!verified) {
        const actionLabel = quest.type === 'like' ? 'geliked' : 'gespeichert';
        return NextResponse.json({
          success: false,
          notYet: true,
          message: `Noch nicht erkannt. Stelle sicher, dass du das Reel mit @${profile.instagramHandle} ${actionLabel} hast.`,
          expiresAt: verification.expiresAt,
        });
      }

      // ✅ Verifiziert → Quest abschließen
      const now = new Date().toISOString();
      const completion: QuestCompletion = {
        questId,
        walletAddress: normalized,
        channelId: profile.instagramHandle,
        channelName: profile.instagramName ?? profile.instagramHandle,
        platform: 'instagram',
        commentId: `instagram-${quest.type}-${normalized}-${questId}`,
        commentText: `instagram ${quest.type}`,
        rewardAmount: quest.rewardAmount,
        rewardPaid: false,
        completedAt: now,
      };

      await saveCompletion(completion);
      await addDfaithCredits(normalized, quest.rewardAmount);
      const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
      const creditBonus = await payQuestCreditBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
      await savePendingReward({
        walletAddress: normalized,
        amount: quest.rewardAmount,
        reason: `Instagram ${quest.type === 'like' ? 'Like' : 'Save'} Quest: ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addUserXp(normalized, quest.reputationReward);
      await addUserReputationWithBonus(normalized, quest.creatorWallet, quest.reputationReward);
      await deleteInstagramLikeVerification(questId, normalized);

      const actionDone = quest.type === 'like' ? 'geliked' : 'gespeichert';
      return NextResponse.json({
        success: true,
        rewardAmount: quest.rewardAmount + levelBonus + creditBonus,
        levelBonus: levelBonus > 0 ? levelBonus : undefined,
        message: `Quest abgeschlossen! Du hast das Reel ${actionDone}. +${quest.rewardAmount + levelBonus + creditBonus} DFAITH Credits`,
      });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[instagram/like-verify]', action, message);
    if (message.includes('instagram_like_verifications') || message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Datenbank nicht initialisiert. instagram_like_verifications Tabelle fehlt.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
