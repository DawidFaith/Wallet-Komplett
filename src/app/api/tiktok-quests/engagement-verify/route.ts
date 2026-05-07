/**
 * POST /api/tiktok-quests/engagement-verify
 *
 * Verifiziert TikTok Like + Share + Save für einen Engagement-Quest.
 * Jede Aktion ist 1/3 des Rewards wert – partielle Belohnung möglich.
 *
 * Body: { action: 'start' | 'check', questId, walletAddress }
 *
 * Ablauf:
 *   start → Baseline-Stats (likes/shares/saves) speichern, 10-Min-Fenster öffnen
 *   check → Aktuelle Stats laden, Delta prüfen, partielle Rewards vergeben
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserProfile,
  loadQuestDetail,
  hasWalletCompletedQuest,
  upsertTikTokEngagementVerification,
  getTikTokEngagementVerification,
  deleteTikTokEngagementVerification,
  saveCompletion,
  savePendingReward,
  addDfaithCredits,
  addUserXp,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

interface VideoStats {
  likes: number;
  shares: number;
  saves: number;
}

async function fetchVideoStats(videoId: string): Promise<VideoStats | null> {
  if (!RAPIDAPI_KEY) return null;
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/api/post/detail?videoId=${encodeURIComponent(videoId)}`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      statusCode?: number;
      itemInfo?: { itemStruct?: { stats?: { diggCount?: number; shareCount?: number; collectCount?: number } } };
    };
    if (data.statusCode !== 0) return null;
    const stats = data?.itemInfo?.itemStruct?.stats;
    if (!stats) return null;
    return {
      likes: Number(stats.diggCount ?? 0),
      shares: Number(stats.shareCount ?? 0),
      saves: Number(stats.collectCount ?? 0),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY nicht konfiguriert' }, { status: 500 });
  }

  let body: { action?: string; questId?: string; walletAddress?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 }); }

  const { action, questId, walletAddress } = body;
  if (!action || !questId || !walletAddress) {
    return NextResponse.json(
      { error: 'action, questId und walletAddress sind erforderlich' },
      { status: 400 }
    );
  }

  const normalized = walletAddress.toLowerCase();

  try {
    // ── Gemeinsame Vorab-Prüfungen ───────────────────────────────────────────
    const [profile, quest] = await Promise.all([
      getUserProfile(normalized),
      loadQuestDetail(questId),
    ]);

    if (!profile.tiktokHandle || !profile.tiktokVerified) {
      return NextResponse.json(
        { error: 'Kein verifizierter TikTok-Account verknüpft. Verifiziere zuerst deinen Account.' },
        { status: 400 }
      );
    }
    if (!quest) return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
    if (!quest.isActive) return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
    if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
    }
    if (quest.completions >= quest.maxCompletions) {
      return NextResponse.json({ error: 'Alle Plätze für diesen Quest sind vergeben' }, { status: 400 });
    }
    if (quest.platform !== 'tiktok' || quest.type !== 'engagement') {
      return NextResponse.json({ error: 'Falscher Quest-Typ' }, { status: 400 });
    }

    const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
    if (alreadyDone) {
      return NextResponse.json({ error: 'Du hast diesen Quest bereits abgeschlossen' }, { status: 409 });
    }

    // ── action: start ────────────────────────────────────────────────────────
    if (action === 'start') {
      const stats = await fetchVideoStats(quest.videoId);
      if (!stats) {
        return NextResponse.json(
          { error: 'Video-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten
      await upsertTikTokEngagementVerification(
        questId, normalized, quest.videoId,
        stats.likes, stats.shares, stats.saves, expiresAt
      );
      return NextResponse.json({ step: 'pending', expiresAt });
    }

    // ── action: check ────────────────────────────────────────────────────────
    if (action === 'check') {
      const verification = await getTikTokEngagementVerification(questId, normalized);
      if (!verification) {
        return NextResponse.json(
          { error: 'Keine laufende Verifizierung gefunden. Starte neu.' },
          { status: 400 }
        );
      }

      // Fenster abgelaufen?
      if (new Date(verification.expiresAt) < new Date()) {
        await deleteTikTokEngagementVerification(questId, normalized);
        return NextResponse.json({ expired: true });
      }

      const current = await fetchVideoStats(quest.videoId);
      if (!current) {
        return NextResponse.json(
          { error: 'Video-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }

      const likeVerified = current.likes > verification.baselineLikes;
      const shareVerified = current.shares > verification.baselineShares;
      const saveVerified = current.saves > verification.baselineSaves;
      const verifiedCount = [likeVerified, shareVerified, saveVerified].filter(Boolean).length;

      if (verifiedCount === 0) {
        return NextResponse.json({
          success: false,
          notYet: true,
          message: 'Keine neuen Aktionen erkannt. Like, share und speichere das Video, dann prüfe erneut.',
          expiresAt: verification.expiresAt,
          likeVerified, shareVerified, saveVerified,
        });
      }

      // ✅ Mindestens eine Aktion verifiziert → Partial-Reward berechnen
      const totalReward = quest.rewardAmount;
      const rewardPerAction = Math.round((totalReward / 3) * 100) / 100;
      const earnedReward = Math.round(rewardPerAction * verifiedCount * 100) / 100;

      const now = new Date().toISOString();
      const completion: QuestCompletion = {
        questId,
        walletAddress: normalized,
        channelId: profile.tiktokHandle,
        channelName: profile.tiktokHandle,
        platform: 'tiktok',
        commentId: `tiktok-engagement-${normalized}-${questId}`,
        commentText: `Like:${likeVerified} Share:${shareVerified} Save:${saveVerified}`,
        rewardAmount: earnedReward,
        rewardPaid: false,
        completedAt: now,
      };

      await saveCompletion(completion);
      await savePendingReward({
        walletAddress: normalized,
        amount: earnedReward,
        reason: `TikTok Engagement Quest (${verifiedCount}/3 Aktionen): ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addDfaithCredits(normalized, earnedReward);
      await addUserXp(normalized, verifiedCount * 5);
      await deleteTikTokEngagementVerification(questId, normalized);

      return NextResponse.json({
        success: true,
        verifiedCount,
        likeVerified, shareVerified, saveVerified,
        rewardAmount: earnedReward,
        message: `${verifiedCount}/3 Aktionen verifiziert! Du erhältst ${earnedReward} DFAITH.`,
      });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[engagement-verify]', action, message);
    if (message.includes('tiktok_engagement_verifications') || message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Datenbank nicht initialisiert. Bitte /api/youtube-quests/setup-db aufrufen.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
