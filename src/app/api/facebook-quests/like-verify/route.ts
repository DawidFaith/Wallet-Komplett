/**
 * POST /api/facebook-quests/like-verify
 *
 * Verifiziert einen Facebook Like-Quest via Meta Graph API.
 *
 * Flow:
 *   action: 'start' → Baseline-Reaktionsanzahl via Graph API laden, 10-Min-Fenster öffnen
 *   action: 'check' → Aktuelle Reaktionsanzahl via Graph API prüfen → Quest abschließen
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
  upsertFacebookLikeVerification,
  getFacebookLikeVerification,
  deleteFacebookLikeVerification,
  QuestCompletion,
} from '../../../lib/questDb';
import { fetchFacebookPostCounts, extractFacebookPostId, resolvePostIdFromUrl } from '../../../lib/metaApi';
import { getDb } from '../../../lib/db';

export const maxDuration = 30;

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
    const handleDone = await hasChannelCompletedQuest(profile.facebookHandle, questId);
    if (handleDone) {
      return NextResponse.json({ error: 'Dieser Facebook-Account hat diesen Quest bereits abgeschlossen.' }, { status: 409 });
    }

    // Post-ID auflösen
    let postId = quest.videoId;
    console.log('[like-verify] Original videoId:', postId, '| videoUrl:', quest.videoUrl);

    // Schritt 1: videoUrl per Graph API auflösen
    const urlForLookup = quest.videoUrl || (postId.startsWith('http') ? postId : null)
      || (postId.startsWith('https') ? postId : null);
    if (urlForLookup && (!postId.includes('_') || postId.includes('http') || postId.includes('/'))) {
      const resolved = await resolvePostIdFromUrl(urlForLookup);
      if (resolved) {
        postId = resolved;
        console.log('[like-verify] Post-ID via Graph API aufgelöst:', postId);
      }
    }
    // Schritt 2: Regex-Extraktion (deckt Reels /reel/ID, /posts/ID, etc.)
    if (!postId.includes('_') || postId.includes('http') || postId.includes('/')) {
      const rawUrl = quest.videoUrl || quest.videoId || '';
      const extracted = extractFacebookPostId(rawUrl) || extractFacebookPostId(quest.videoId);
      if (extracted) {
        postId = extracted;
        console.log('[like-verify] Post-ID via Regex extrahiert:', postId);
      }
    }

    // Creator's facebook_page_id für Token-Lookup laden
    const sql = getDb();
    const creatorRows = await sql`SELECT facebook_page_id FROM user_profiles WHERE wallet_address = ${quest.creatorWallet.toLowerCase()} LIMIT 1`;
    const creatorFacebookPageId = (creatorRows[0]?.facebook_page_id as string | null) ?? null;
    console.log('[like-verify] creatorFacebookPageId:', creatorFacebookPageId);

    // Bare numerische ID (Reel-ID, Post-ID ohne Page-Prefix) mit Page-ID kombinieren
    if (!postId.includes('_') && /^\d+$/.test(postId) && creatorFacebookPageId) {
      postId = `${creatorFacebookPageId}_${postId}`;
      console.log('[like-verify] Post-ID mit Page-ID kombiniert:', postId);
    }
    console.log('[like-verify] Finale postId:', postId);

    // ── action: start ────────────────────────────────────────────────────────
    if (action === 'start') {
      const stats = await fetchFacebookPostCounts(postId, creatorFacebookPageId);
      if (!stats) {
        console.error('[facebook-like-verify] start: fetchFacebookPostCounts gab null zurück | videoId:', postId);
        return NextResponse.json(
          { error: 'Facebook-Stats nicht abrufbar. Bitte erneut versuchen.' },
          { status: 500 }
        );
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten
      await upsertFacebookLikeVerification(questId, normalized, postId, stats.likes, expiresAt);
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

      const current = await fetchFacebookPostCounts(postId, creatorFacebookPageId);
      if (!current) {
        console.error('[facebook-like-verify] check: fetchFacebookPostCounts gab null zurück | videoId:', postId);
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
      const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
      const creditBonus = await payQuestCreditBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
      await savePendingReward({
        walletAddress: normalized,
        amount: quest.rewardAmount,
        reason: `Facebook Like Quest: ${quest.videoTitle}`,
        questId,
        createdAt: now,
      });
      await addUserXp(normalized, quest.reputationReward);
      await addUserReputationWithBonus(normalized, quest.creatorWallet, quest.reputationReward);
      await deleteFacebookLikeVerification(questId, normalized);

      return NextResponse.json({
        success: true,
        rewardAmount: quest.rewardAmount + levelBonus + creditBonus,
        levelBonus: levelBonus > 0 ? levelBonus : undefined,
        creditBonus: creditBonus > 0 ? creditBonus : undefined,
        message: `Quest abgeschlossen! +${quest.rewardAmount + levelBonus + creditBonus} DFAITH Credits`,
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
