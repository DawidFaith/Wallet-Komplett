/**
 * POST /api/facebook-quests/like-verify
 *
 * Verifiziert einen Facebook Like-Quest via Make.com Webhook.
 *
 * Flow (analog zu Instagram/TikTok Like-Verify):
 *   action: 'start' → Baseline-Like-Count via Make.com laden, 5-Min-Fenster öffnen
 *   action: 'check' → Aktuelle Like-Count via Make.com laden, Delta prüfen → Quest abschließen
 *
 * Make.com Webhook (MAKE_FACEBOOK_LIKE_WEBHOOK_URL) Request:
 *   { post_id: string }
 *
 * Make.com Response Body (Webhook-Response Modul, Content-Type: application/json):
 *   {
 *     "found": true,
 *     "likes": {{post.reactions.summary.total_count}},
 *     "comments": {{post.comments.summary.total_count}},
 *     "shares": {{ifempty(post.shares.count; 0)}}
 *   }
 *
 *   Mindestens das Feld `likes` (oder als Alternative `total_count`) muss vorhanden sein.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  getUserProfile,
  upsertFacebookLikeVerification,
  getFacebookLikeVerification,
  deleteFacebookLikeVerification,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

interface FacebookCounts {
  likes: number;
  comments: number;
  shares: number;
  total_interactions: number;
}

interface MakeRawResponse {
  found?: boolean | string;
  likes?: number | string;
  reactions?: number | string;
  total_count?: number | string;
  comments?: number | string;
  shares?: number | string;
  total_interactions?: number | string;
}

function parseCounts(raw: MakeRawResponse | null): FacebookCounts | null {
  if (!raw || typeof raw !== 'object') return null;
  const likes = Number(raw.likes ?? raw.reactions ?? raw.total_count ?? 0);
  if (!Number.isFinite(likes)) return null;
  const comments = Number(raw.comments ?? 0);
  const shares = Number(raw.shares ?? 0);
  const total_interactions = Number(raw.total_interactions ?? (likes + comments + shares));
  return { likes, comments, shares, total_interactions };
}

async function fetchCounts(webhookUrl: string, postId: string): Promise<FacebookCounts | null> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    if (!text || !text.trim()) return null;
    try {
      const raw = JSON.parse(text) as MakeRawResponse;
      return parseCounts(raw);
    } catch {
      // Fallback: Zahlen aus Text extrahieren
      const m = text.match(/"likes"\s*:\s*(\d+)/i);
      if (m) return parseCounts({ likes: Number(m[1]) });
      return null;
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const makeWebhookUrl = process.env.MAKE_FACEBOOK_LIKE_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_FACEBOOK_LIKE_WEBHOOK_URL nicht konfiguriert' },
      { status: 500 }
    );
  }

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
    // ── Gemeinsame Vorab-Prüfungen ───────────────────────────────────────────
    const [profile, quest] = await Promise.all([
      getUserProfile(normalized),
      loadQuestDetail(questId),
    ]);

    if (!profile?.facebookHandle || !profile.facebookVerified) {
      return NextResponse.json(
        { error: 'Kein verifiziertes Facebook-Konto verknüpft. Verknüpfe zuerst dein Facebook im Profil.' },
        { status: 400 }
      );
    }
    if (!quest) {
      return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
    }
    if (quest.platform !== 'facebook') {
      return NextResponse.json({ error: 'Kein Facebook-Quest' }, { status: 400 });
    }
    if (quest.type !== 'like') {
      return NextResponse.json({ error: 'Kein Like-Quest' }, { status: 400 });
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

    // ── action: start ────────────────────────────────────────────────────────
    if (action === 'start') {
      const stats = await fetchCounts(makeWebhookUrl, quest.videoId);
      if (!stats) {
        return NextResponse.json(
          { error: 'Facebook-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten
      await upsertFacebookLikeVerification(questId, normalized, quest.videoId, stats.likes, expiresAt);
      return NextResponse.json({
        step: 'pending',
        expiresAt,
        message: `Öffne jetzt den Post und like ihn mit deinem Account ${profile.facebookHandle}. Du hast 10 Minuten.`,
      });
    }

    // ── action: check ────────────────────────────────────────────────────────
    if (action === 'check') {
      const verification = await getFacebookLikeVerification(questId, normalized);
      if (!verification) {
        return NextResponse.json(
          { error: 'Keine laufende Verifizierung gefunden. Starte neu.' },
          { status: 400 }
        );
      }

      if (new Date(verification.expiresAt) < new Date()) {
        await deleteFacebookLikeVerification(questId, normalized);
        return NextResponse.json({ expired: true });
      }

      const current = await fetchCounts(makeWebhookUrl, quest.videoId);
      if (!current) {
        return NextResponse.json(
          { error: 'Facebook-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }

      const likeVerified = current.likes > verification.baselineLikes;
      if (!likeVerified) {
        return NextResponse.json({
          success: false,
          notYet: true,
          message: `Noch kein neuer Like erkannt. Stelle sicher, dass du den Post mit ${profile.facebookHandle} geliked hast.`,
          expiresAt: verification.expiresAt,
        });
      }

      // ✅ Like verifiziert → Quest abschließen
      const now = new Date().toISOString();
      const completion: QuestCompletion = {
        questId,
        walletAddress: normalized,
        channelId: profile.facebookHandle,
        channelName: profile.facebookName ?? profile.facebookHandle,
        platform: 'facebook',
        commentId: `facebook-like-${normalized}-${questId}`,
        commentText: 'facebook like',
        rewardAmount: quest.rewardAmount,
        rewardPaid: false,
        completedAt: now,
      };
      await saveCompletion(completion);
      await addDfaithCredits(normalized, quest.rewardAmount);
      await savePendingReward({
        walletAddress: normalized,
        amount: quest.rewardAmount,
        reason: `Facebook Like Quest: ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addUserXp(normalized, quest.rewardAmount);
      await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
      await deleteFacebookLikeVerification(questId, normalized);

      return NextResponse.json({
        success: true,
        rewardAmount: quest.rewardAmount,
        message: `Quest abgeschlossen! +${quest.rewardAmount} DFAITH Credits`,
      });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[facebook-like-verify]', action, message);
    if (message.includes('facebook_like_verifications') || message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Datenbank nicht initialisiert. Bitte /api/youtube-quests/setup-db aufrufen.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
}
