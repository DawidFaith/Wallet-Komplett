/**
 * POST /api/instagram-quests/dm-share
 *
 * Zweistufiger DM-Share-Quest – ABLAUF:
 *
 *  Teil 1 – SHARE   : User teilt Beitrag in seiner Story
 *                     → System prüft Share-Delta via MAKE_INSTAGRAM_LIKE_WEBHOOK_URL
 *  Teil 2 – DM-KLICK: Nach Share-Bestätigung sendet Link DM den universellen Link
 *                     → User klickt → /api/instagram-quests/dm-click?name=handle
 *                     → Quest wird auf dm-click Seite abgeschlossen
 *
 * action: 'start'
 *   Lädt Baseline-Shares, legt Verifikation an, gibt linkTemplate zurück
 *
 * action: 'check'
 *   Prüft Share-Delta. Bei Erfolg: gibt linkTemplate zurück (keine DM via Make.com)
 *
 * action: 'status'
 *   Gibt aktuellen Stand zurück inkl. linkTemplate wenn shareVerified
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserProfile,
  loadQuestDetail,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  upsertInstagramDmVerification,
  getInstagramDmVerification,
  markInstagramDmStoryVerified,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  deleteInstagramDmVerification,
  type QuestCompletion,
} from '../../../lib/questDb';
import { getDb } from '../../../lib/db';

export const maxDuration = 30;

// ─── Allgemeiner Quest-Link (kein {name} Platzhalter) ─────────────────────────
// Artist trägt diesen Link in Instagram Link DM ein – alle User landen auf /dm-quest

function buildLinkTemplate(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://wallet-komplett.vercel.app').replace(/\/$/, '');
  return `${appUrl}/dm-quest`;
}

// ─── Meta Graph API — Shares-Abfrage via /insights?metric=shares ──────────────

const GRAPH = 'https://graph.facebook.com/v21.0';

async function fetchCurrentShares(graphMediaId: string): Promise<number> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token || !graphMediaId) return 0;
  try {
    const url = `${GRAPH}/${graphMediaId}/insights?metric=shares&period=lifetime&access_token=${token}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const json = await res.json() as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
      error?: { message: string; code: number };
    };
    if (json.error) {
      console.error('[dm-share] Shares-API Fehler:', json.error.message, '(code:', json.error.code, ') für mediaId:', graphMediaId);
      return 0;
    }
    const item = (json.data ?? []).find(d => d.name === 'shares');
    const count = Number(item?.values?.[0]?.value ?? 0);
    console.log('[dm-share] fetchCurrentShares mediaId:', graphMediaId, '→', count);
    return count;
  } catch (e) {
    console.error('[dm-share] fetchCurrentShares Exception:', e);
    return 0;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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
    shareVerified: true,
    tagVerified: true,
    rewardAmount: quest.rewardAmount,
    message: `Quest abgeschlossen! +${quest.rewardAmount} DFAITH Credits gutgeschrieben.`,
  });
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
    return NextResponse.json({ error: 'action, walletAddress und questId sind erforderlich' }, { status: 400 });
  }

  const normalized = walletAddress.toLowerCase();
  const linkTemplate = buildLinkTemplate();

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

    // Creator-Handle für Mention-Hinweis laden
    const creatorProfile = await getUserProfile(quest.creatorWallet);
    const creatorHandle = creatorProfile?.instagramHandle ?? null;

    // ── START: Baseline-Shares laden, Verifikation anlegen ───────────────────
    if (action === 'start') {
      const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
      if (alreadyDone) {
        return NextResponse.json({ error: 'Du hast diese Quest bereits abgeschlossen.' }, { status: 400 });
      }
      const handleDone = await hasChannelCompletedQuest(profile.instagramHandle, questId);
      if (handleDone) {
        return NextResponse.json({ error: 'Dieser Instagram-Account hat diese Quest bereits abgeschlossen.' }, { status: 409 });
      }

      const baselineShares = quest.videoId ? await fetchCurrentShares(quest.videoId) : 0;

      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      // click_token muss UNIQUE sein → handle alleine kollidiert wenn der User
      // mehrere DM-Share Quests parallel hat. Daher kombinieren mit questId.
      const clickToken = `${profile.instagramHandle.toLowerCase()}:${questId}`;

      await upsertInstagramDmVerification(questId, normalized, profile.instagramHandle, clickToken, expiresAt);
      // Baseline direkt setzen ohne click_verified zu ändern
      const sql = getDb();
      await sql`
        UPDATE instagram_dm_verifications
        SET baseline_shares = ${baselineShares}
        WHERE quest_id = ${questId} AND wallet_address = ${normalized}
      `;

      return NextResponse.json({
        success: true,
        expiresAt,
        baselineShares,
        videoUrl: quest.videoUrl,
        instagramHandle: profile.instagramHandle,
        creatorHandle,
        linkTemplate,
        message: 'Teile jetzt den Beitrag in deiner Story. Komm dann zurück und klicke "Share prüfen".',
      });
    }

    // ── CHECK: Share-Delta prüfen ─────────────────────────────────────────────
    if (action === 'check') {
      const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
      if (alreadyDone) {
        return NextResponse.json({ error: 'Quest bereits abgeschlossen.' }, { status: 400 });
      }

      const verif = await getInstagramDmVerification(questId, normalized);
      if (!verif) {
        return NextResponse.json({ error: 'Quest nicht gestartet. Bitte zuerst starten.' }, { status: 400 });
      }

      if (new Date(verif.expiresAt) < new Date()) {
        return NextResponse.json({ expired: true, shareVerified: verif.storyVerified, clickVerified: verif.clickVerified });
      }

      // Beide Schritte bereits erledigt → Quest abschließen
      if (verif.clickVerified && verif.storyVerified) {
        const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
        if (alreadyDone) return NextResponse.json({ success: true, alreadyCompleted: true });
        return await completeStoryQuest({ quest, questId, normalized, profile });
      }

      // Schritt 1 (Share) bereits erkannt, warte auf @-Tag (Schritt 2)
      if (verif.storyVerified) {
        return NextResponse.json({
          shareVerified: true,
          tagVerified: false,
          expiresAt: verif.expiresAt,
          message: `Share erkannt! Stelle sicher, dass du @${creatorHandle ?? 'den Creator'} in der Story markiert hast. Die Quest wird automatisch abgeschlossen sobald der Tag erkannt wird.`,
        });
      }

      // Share-Delta prüfen (Schritt 1)
      const currentShares = await fetchCurrentShares(quest.videoId);
      if (currentShares <= verif.baselineShares) {
        return NextResponse.json({
          notYet: true,
          shareVerified: false,
          currentShares,
          baselineShares: verif.baselineShares,
          expiresAt: verif.expiresAt,
          message: `Noch kein neuer Share erkannt (aktuell: ${currentShares}, Baseline: ${verif.baselineShares}). Teile den Beitrag in deiner Story und prüfe erneut.`,
        });
      }

      // ── Schritt 1 abgeschlossen: story_verified setzen ───────────────────
      await markInstagramDmStoryVerified(questId, normalized);

      // Falls @-Tag (Schritt 2) per Webhook bereits früher ankam → direkt abschließen
      if (verif.clickVerified) {
        const alreadyDone2 = await hasWalletCompletedQuest(normalized, questId);
        if (alreadyDone2) return NextResponse.json({ success: true, alreadyCompleted: true });
        return await completeStoryQuest({ quest, questId, normalized, profile });
      }

      return NextResponse.json({
        shareVerified: true,
        tagVerified: false,
        expiresAt: verif.expiresAt,
        message: `Share erkannt! Stelle sicher, dass du @${creatorHandle ?? 'den Creator'} in der Story markiert hast. Die Quest wird automatisch abgeschlossen sobald der Tag erkannt wird.`,
      });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (action === 'status') {
      const verif = await getInstagramDmVerification(questId, normalized);
      if (!verif) return NextResponse.json({ started: false });
      return NextResponse.json({
        started: true,
        shareVerified: verif.storyVerified,
        tagVerified: verif.clickVerified,
        expiresAt: verif.expiresAt,
        expired: new Date(verif.expiresAt) < new Date(),
        instagramHandle: profile.instagramHandle,
      });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dm-share]', err);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
}
