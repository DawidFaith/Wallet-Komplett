/**
 * POST /api/tiktok-quests/like-verify
 *
 * Verifiziert einen TikTok Like-Quest.
 * Body: { action: 'start' | 'check', questId, walletAddress }
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
  addUserReputation,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

function extractVideoId(raw: string): string {
  if (/^\d+$/.test(raw)) return raw;
  const slashMatch = raw.match(/\/video\/(\d+)/);
  if (slashMatch) return slashMatch[1];
  const flatMatch = raw.match(/video(\d{10,})/i);
  if (flatMatch) return flatMatch[1];
  return raw;
}

async function fetchVideoStats(videoId: string): Promise<{ likes: number; shares: number; saves: number } | null> {
  if (!RAPIDAPI_KEY) return null;
  const resolvedId = extractVideoId(videoId);
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/api/post/detail?videoId=${encodeURIComponent(resolvedId)}`,
      {
        headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY },
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
  } catch { return null; }
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
    return NextResponse.json({ error: 'action, questId und walletAddress sind erforderlich' }, { status: 400 });
  }

  const normalized = walletAddress.toLowerCase();

  try {
    const [profile, quest] = await Promise.all([
      getUserProfile(normalized),
      loadQuestDetail(questId),
    ]);

    if (!profile.tiktokHandle || !profile.tiktokVerified) {
      return NextResponse.json({ error: 'Kein verifizierter TikTok-Account verknüpft.' }, { status: 400 });
    }
    if (!quest) return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
    if (!quest.isActive) return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
    if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
    }
    if (quest.completions >= quest.maxCompletions) {
      return NextResponse.json({ error: 'Alle Plätze für diesen Quest sind vergeben' }, { status: 400 });
    }
    if (quest.platform !== 'tiktok' || quest.type !== 'like') {
      return NextResponse.json({ error: 'Falscher Quest-Typ' }, { status: 400 });
    }

    const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
    if (alreadyDone) {
      return NextResponse.json({ error: 'Du hast diesen Quest bereits abgeschlossen' }, { status: 409 });
    }

    if (action === 'start') {
      const stats = await fetchVideoStats(quest.videoId);
      if (!stats) {
        return NextResponse.json({ error: 'Video-Stats nicht abrufbar. Bitte erneut versuchen.' }, { status: 500 });
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await upsertTikTokEngagementVerification(questId, normalized, quest.videoId, stats.likes, stats.shares, stats.saves, expiresAt);
      return NextResponse.json({ step: 'pending', expiresAt });
    }

    if (action === 'check') {
      const verification = await getTikTokEngagementVerification(questId, normalized);
      if (!verification) {
        return NextResponse.json({ error: 'Keine laufende Verifizierung gefunden. Starte neu.' }, { status: 400 });
      }
      if (new Date(verification.expiresAt) < new Date()) {
        await deleteTikTokEngagementVerification(questId, normalized);
        return NextResponse.json({ expired: true });
      }

      const current = await fetchVideoStats(quest.videoId);
      if (!current) {
        return NextResponse.json({ error: 'Video-Stats nicht abrufbar. Bitte erneut versuchen.' }, { status: 500 });
      }

      const likeVerified = current.likes > verification.baselineLikes;

      if (!likeVerified) {
        return NextResponse.json({
          success: false,
          notYet: true,
          likeVerified: false,
          message: 'Like noch nicht erkannt. Like das Video und prüfe erneut.',
          expiresAt: verification.expiresAt,
        });
      }

      const now = new Date().toISOString();
      const completion: QuestCompletion = {
        questId,
        walletAddress: normalized,
        channelId: profile.tiktokHandle,
        channelName: profile.tiktokHandle,
        platform: 'tiktok',
        commentId: `tiktok-like-${normalized}-${questId}`,
        commentText: 'Like:true',
        rewardAmount: quest.rewardAmount,
        rewardPaid: false,
        completedAt: now,
      };

      await saveCompletion(completion);
      await savePendingReward({
        walletAddress: normalized,
        amount: quest.rewardAmount,
        reason: `TikTok Like Quest: ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addDfaithCredits(normalized, quest.rewardAmount);
      await addUserXp(normalized, 5);
      await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
      await deleteTikTokEngagementVerification(questId, normalized);

      return NextResponse.json({
        success: true,
        likeVerified: true,
        rewardAmount: quest.rewardAmount,
        message: `Like verifiziert! Du erhältst ${quest.rewardAmount} DFAITH.`,
      });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[like-verify]', action, message);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
