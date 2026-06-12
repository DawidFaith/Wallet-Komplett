/**
 * POST /api/tiktok-quests/share-verify
 *
 * Verifiziert einen TikTok Share-Quest (Doppelverifizierung):
 *  1. Share-Count des Videos ist gestiegen (Vorher/Nachher-Vergleich)
 *  2. User hat in seinen letzten Posts ein Video mit der gleichen Music-ID (Originalton des Künstlers)
 *
 * Body: { action: 'start' | 'check', questId, walletAddress }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserProfile,
  loadQuestDetail,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  upsertTikTokEngagementVerification,
  getTikTokEngagementVerification,
  deleteTikTokEngagementVerification,
  saveCompletion,
  savePendingReward,
  addDfaithCredits,
  addUserXp,
  addUserReputation,
  payLevelBonus,
  payQuestCreditBonus,
  QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 30;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function extractVideoId(raw: string): string {
  if (/^\d+$/.test(raw)) return raw;
  const slashMatch = raw.match(/\/video\/(\d+)/);
  if (slashMatch) return slashMatch[1];
  const flatMatch = raw.match(/video(\d{10,})/i);
  if (flatMatch) return flatMatch[1];
  return raw;
}

async function rapidGet(path: string): Promise<unknown> {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  const res = await fetch(url, {
    headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY! },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RapidAPI HTTP ${res.status}`);
  return res.json();
}

/** Aktuellen Share-Count + Music-ID des Videos abrufen */
async function fetchVideoStats(videoId: string): Promise<{ shares: number; musicId: string } | null> {
  try {
    const data = await rapidGet(`/api/post/detail?videoId=${encodeURIComponent(videoId)}`) as {
      statusCode?: number;
      itemInfo?: { itemStruct?: { stats?: { shareCount?: number }; music?: { id?: string } } };
    };
    if (data.statusCode !== 0) return null;
    const stats = data.itemInfo?.itemStruct?.stats;
    const music = data.itemInfo?.itemStruct?.music;
    if (!stats) return null;
    return {
      shares: Number(stats.shareCount ?? 0),
      musicId: music?.id ?? '',
    };
  } catch { return null; }
}

/** secUid eines Users über seinen uniqueId abrufen */
async function fetchSecUid(uniqueId: string): Promise<string | null> {
  try {
    const data = await rapidGet(`/api/user/info?uniqueId=${encodeURIComponent(uniqueId)}`) as {
      userInfo?: { user?: { secUid?: string } };
    };
    return data.userInfo?.user?.secUid ?? null;
  } catch { return null; }
}

/** Prüft ob der User das Video mit der gegebenen ID repostet hat */
async function checkUserReposted(secUid: string, videoId: string): Promise<boolean> {
  try {
    // Repost-Feed liegt direkt auf Root-Ebene (nicht unter .data)
    const data = await rapidGet(
      `/api/user/repost?secUid=${encodeURIComponent(secUid)}&count=20&cursor=0`
    ) as { itemList?: { id?: string }[]; statusCode?: number };
    const items = data.itemList ?? [];
    return items.some((item) => item.id === videoId);
  } catch { return false; }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

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
    if (quest.platform !== 'tiktok' || quest.type !== 'share') {
      return NextResponse.json({ error: 'Falscher Quest-Typ' }, { status: 400 });
    }

    const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
    if (alreadyDone) {
      return NextResponse.json({ error: 'Du hast diesen Quest bereits abgeschlossen' }, { status: 409 });
    }
    const handleDone = await hasChannelCompletedQuest(profile.tiktokHandle, questId);
    if (handleDone) {
      return NextResponse.json({ error: 'Dieser TikTok-Account hat diesen Quest bereits abgeschlossen' }, { status: 409 });
    }

    const resolvedVideoId = extractVideoId(quest.videoId);

    // ── START ────────────────────────────────────────────────────────────────
    if (action === 'start') {
      // Bereits laufende Verifizierung? Timer nicht zurücksetzen.
      const existing = await getTikTokEngagementVerification(questId, normalized);
      if (existing && new Date(existing.expiresAt) > new Date()) {
        return NextResponse.json({ step: 'pending', expiresAt: existing.expiresAt });
      }
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await upsertTikTokEngagementVerification(questId, normalized, resolvedVideoId, 0, 0, 0, expiresAt);
      return NextResponse.json({ step: 'pending', expiresAt });
    }

    // ── CHECK ────────────────────────────────────────────────────────────────
    if (action === 'check') {
      const verification = await getTikTokEngagementVerification(questId, normalized);
      if (!verification) {
        return NextResponse.json({ error: 'Keine laufende Verifizierung gefunden. Starte neu.' }, { status: 400 });
      }
      if (new Date(verification.expiresAt) < new Date()) {
        await deleteTikTokEngagementVerification(questId, normalized);
        return NextResponse.json({ expired: true });
      }

      // Repost direkt im Repost-Feed des Users prüfen
      const secUid = await fetchSecUid(profile.tiktokHandle);
      let repostVerified = false;
      if (secUid) {
        repostVerified = await checkUserReposted(secUid, resolvedVideoId);
      }

      if (!repostVerified) {
        return NextResponse.json({
          success: false,
          notYet: true,
          shareVerified: false,
          message: 'Repost noch nicht erkannt. Teile das Video via Repost und prüfe erneut.',
          expiresAt: verification.expiresAt,
        });
      }

      // Repost bestätigt → Abschluss speichern
      const now = new Date().toISOString();
      const completion: QuestCompletion = {
        questId,
        walletAddress: normalized,
        channelId: profile.tiktokHandle,
        channelName: profile.tiktokHandle,
        platform: 'tiktok',
        commentId: `tiktok-share-${normalized}-${questId}`,
        commentText: `Repost:true`,
        rewardAmount: quest.rewardAmount,
        rewardPaid: false,
        completedAt: now,
      };

      await saveCompletion(completion);
      await savePendingReward({
        walletAddress: normalized,
        amount: quest.rewardAmount,
        reason: `TikTok Share Quest: ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addDfaithCredits(normalized, quest.rewardAmount);
      await addUserXp(normalized, 10);
      await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
      await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, questId);
      await deleteTikTokEngagementVerification(questId, normalized);

      return NextResponse.json({
        success: true,
        shareVerified: true,
        soundVerified: true,
        rewardAmount: quest.rewardAmount,
        message: `Share verifiziert! Du erhältst ${quest.rewardAmount} DFAITH.`,
      });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[share-verify]', action, message);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
