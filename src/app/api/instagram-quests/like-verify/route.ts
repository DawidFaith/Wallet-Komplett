/**
 * POST /api/instagram-quests/like-verify
 *
 * Verifiziert einen Instagram Like- oder Save-Quest via Make.com (Szenario 9179157).
 *
 * Flow (wie YouTube/TikTok):
 *   action: 'start' → Baseline-Stats via Make.com laden, 10-Min-Fenster öffnen
 *   action: 'check' → Aktuelle Stats via Make.com laden, Delta prüfen → Quest abschließen
 *
 * Make.com gibt zurück: { found, likes, saved, comments, shares, views, reach, total_interactions }
 *
 * Env: MAKE_INSTAGRAM_LIKE_WEBHOOK_URL
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
  upsertInstagramLikeVerification,
  getInstagramLikeVerification,
  deleteInstagramLikeVerification,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

interface MakeInsightsResult {
  found: string;
  likes: number;
  saved: number;
  comments: number;
  shares: number;
  views: number;
  reach: number;
  total_interactions: number;
}

interface MakeMetric {
  name: string;
  values: Array<{ value: number }>;
}
interface MakeRawResponse {
  // Format 1: HTTP-Modul → Graph API gibt { data: [...] } zurück
  data?: MakeMetric[];
  // Format 2: Array Aggregator → { metrics: [...] }
  metrics?: MakeMetric[];
  // Format 3: Legacy Flach-Format
  found?: string;
  likes?: number;
  saved?: number;
  comments?: number;
  shares?: number;
  views?: number;
  reach?: number;
  total_interactions?: number;
}

function parseInsightsResponse(raw: MakeRawResponse): MakeInsightsResult | null {
  // Legacy Flach-Format
  if (raw.found !== undefined) {
    return {
      found: String(raw.found),
      likes: Number(raw.likes ?? 0),
      saved: Number(raw.saved ?? 0),
      comments: Number(raw.comments ?? 0),
      shares: Number(raw.shares ?? 0),
      views: Number(raw.views ?? 0),
      reach: Number(raw.reach ?? 0),
      total_interactions: Number(raw.total_interactions ?? 0),
    };
  }

  // Array-Format (HTTP-Modul: data=[...] oder Aggregator: metrics=[...])
  const arr = raw.data ?? raw.metrics;
  if (!arr || !Array.isArray(arr)) return null;

  const get = (...names: string[]) => {
    for (const name of names) {
      const m = arr.find((x) => x.name === name);
      const v = Number(m?.values?.[0]?.value ?? 0);
      if (v > 0) return v;
    }
    return 0;
  };

  return {
    found: 'true',
    likes: get('likes'),
    saved: get('saved'),
    comments: get('comments'),
    shares: get('shares'),
    views: get('video_views', 'plays', 'views'),
    reach: get('reach'),
    total_interactions: get('total_interactions'),
  };
}

// Make.com Array Aggregator gibt kein gültiges JSON-Array zurück, sondern:
// {"metrics": {obj1}, {obj2}, ...} → ungültiges JSON.
// Fallback: Regex-Extraktion der name+value Paare direkt aus dem Text.
function parseInsightsFromText(text: string): MakeInsightsResult | null {
  const metrics: Record<string, number> = {};
  const pattern = /"name":"([^"]+)"[^[]*"values":\[{"value":(\d+)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    metrics[match[1]] = Number(match[2]);
  }
  if (Object.keys(metrics).length === 0) return null;

  const get = (...names: string[]) => {
    for (const n of names) if (metrics[n] !== undefined) return metrics[n];
    return 0;
  };
  return {
    found: 'true',
    likes: get('likes'),
    saved: get('saved'),
    comments: get('comments'),
    shares: get('shares'),
    views: get('views', 'video_views', 'plays'),
    reach: get('reach'),
    total_interactions: get('total_interactions'),
  };
}

async function fetchInsights(
  webhookUrl: string,
  graphMediaId: string,
): Promise<MakeInsightsResult | null> {
  // ── Primär: direkt via Meta Graph API ─────────────────────────────────────
  const directResult = await fetchInsightsDirect(graphMediaId);
  if (directResult) return directResult;

  // ── Fallback: Make.com Webhook ─────────────────────────────────────────────
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphMediaId }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    if (!text || text.trim() === '') return null;

    try {
      const raw: MakeRawResponse = JSON.parse(text);
      const result = parseInsightsResponse(raw);
      if (result) return result;
    } catch { /* kein gültiges JSON */ }

    return parseInsightsFromText(text);
  } catch {
    return null;
  }
}

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Direkte Meta Graph API Abfrage — kein Make.com nötig */
async function fetchInsightsDirect(graphMediaId: string): Promise<MakeInsightsResult | null> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return null;
  try {
    // 1. Basis-Metriken (like_count, comments_count)
    const basicRes = await fetch(
      `${GRAPH}/${graphMediaId}?fields=like_count,comments_count&access_token=${token}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const basic = await basicRes.json() as {
      like_count?: number;
      comments_count?: number;
      error?: { message: string };
    };
    if (basic.error) return null;

    // 2. Insights (saved, reach, total_interactions) — kann fehlen für Reels
    let saved = 0, reach = 0, total_interactions = 0;
    try {
      const insRes = await fetch(
        `${GRAPH}/${graphMediaId}/insights?metric=saved,reach,total_interactions&period=lifetime&access_token=${token}`,
        { cache: 'no-store', signal: AbortSignal.timeout(10000) },
      );
      const ins = await insRes.json() as {
        data?: Array<{ name: string; values: Array<{ value: number }> }>;
        error?: unknown;
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
      found: 'true',
      likes,
      saved,
      comments,
      shares: 0,
      views: 0,
      reach,
      total_interactions: total_interactions || likes + comments + saved,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const makeWebhookUrl = process.env.MAKE_INSTAGRAM_LIKE_WEBHOOK_URL ?? '';
  // Kein Hard-Fail mehr — direkter Graph API Fallback übernimmt

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
      const stats = await fetchInsights(makeWebhookUrl, quest.videoId);
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

      const current = await fetchInsights(makeWebhookUrl, quest.videoId);
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
        await savePendingReward({
          walletAddress: normalized,
          amount: quest.rewardAmount,
          reason: `Instagram Repost Quest: ${quest.videoTitle}`,
          questId,
          createdAt: now,
        });
        await addUserXp(normalized, quest.rewardAmount);
        await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
        await deleteInstagramLikeVerification(questId, normalized);

        return NextResponse.json({
          success: true,
          rewardAmount: quest.rewardAmount,
          message: `Quest abgeschlossen! Du hast das Reel geteilt. +${quest.rewardAmount} DFAITH Credits`,
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
        await savePendingReward({
          walletAddress: normalized,
          amount: earnedReward,
          reason: `Instagram Engagement Quest: ${quest.videoTitle}`,
          questId,
          createdAt: now,
        });
        await addUserXp(normalized, earnedReward);
        await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);

        // Nicht verdiente Hälfte sofort an Creator zurückbuchen
        if (refundToCreator > 0) {
          await addDfaithCredits(quest.creatorWallet, refundToCreator);
        }

        await deleteInstagramLikeVerification(questId, normalized);

        return NextResponse.json({
          success: true,
          rewardAmount: earnedReward,
          likeVerified,
          saveVerified,
          partial: verifiedCount < 2,
          message: verifiedCount < 2
            ? `Teilbelohnung: +${earnedReward} DFAITH Credits (${verifiedCount}/2 Aktionen erkannt)`
            : `Quest abgeschlossen! Like & Speichern erkannt. +${earnedReward} DFAITH Credits`,
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
      await savePendingReward({
        walletAddress: normalized,
        amount: quest.rewardAmount,
        reason: `Instagram ${quest.type === 'like' ? 'Like' : 'Save'} Quest: ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addUserXp(normalized, quest.rewardAmount);
      await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
      await deleteInstagramLikeVerification(questId, normalized);

      const actionDone = quest.type === 'like' ? 'geliked' : 'gespeichert';
      return NextResponse.json({
        success: true,
        rewardAmount: quest.rewardAmount,
        message: `Quest abgeschlossen! Du hast das Reel ${actionDone}. +${quest.rewardAmount} DFAITH Credits`,
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
