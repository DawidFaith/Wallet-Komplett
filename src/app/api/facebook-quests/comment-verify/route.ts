/**
 * POST /api/facebook-quests/comment-verify
 *
 * Verifiziert einen Facebook-Kommentar-Quest via Meta Graph API.
 *
 * Strategie:
 *   Da die Facebook API für User-Kommentare kein `from` mehr liefert,
 *   bekommt jede Wallet pro Quest einen in der DB reservierten, eindeutigen
 *   Kommentartext (`reserveQuestCommentSlot`).
 *   Jeder Slot wird nur einmal vergeben → kein anderer User hat denselben Text.
 *   Matching: `message.includes(commentText)` ⇒ eindeutige Zuordnung Wallet ↔ Kommentar.
 *
 * Body:
 *   { walletAddress, questId, action: 'preview' | 'verify' }
 *
 * Antwort (preview): { commentText }
 * Antwort (verify):  { success: true, rewardAmount } | { notFound: true, message }
 *
 * Env-Variablen:
 *   META_SYSTEM_USER_TOKEN  – System User Token des dfaith_ecosystem
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
  payLevelBonus,
  getUserProfile,
  reserveQuestCommentSlot,
  getReservedQuestCommentSlot,
} from '../../../lib/questDb';
import { findFacebookComment, extractFacebookPostId } from '../../../lib/metaApi';
import { getDb } from '../../../lib/db';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!process.env.META_SYSTEM_USER_TOKEN) {
    return NextResponse.json(
      { error: 'META_SYSTEM_USER_TOKEN nicht konfiguriert' },
      { status: 500 }
    );
  }

  let body: { walletAddress?: string; questId?: string; action?: 'preview' | 'verify' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { walletAddress, questId, action = 'verify' } = body;
  if (!walletAddress || !questId) {
    return NextResponse.json(
      { error: 'walletAddress und questId sind erforderlich' },
      { status: 400 }
    );
  }

  const normalized = walletAddress.toLowerCase();

  // ── action: preview – Slot in DB reservieren und Text zurückgeben ───────
  if (action === 'preview') {
    try {
      const commentText = await reserveQuestCommentSlot(questId, normalized);
      return NextResponse.json({ commentText });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[comment-verify] preview/reserve error:', msg);
      return NextResponse.json({ error: 'Kommentar konnte nicht reserviert werden.' }, { status: 500 });
    }
  }

  // 1. Profil prüfen – Facebook muss verknüpft + verifiziert sein
  const profile = await getUserProfile(normalized);
  if (!profile?.facebookHandle || !profile.facebookVerified) {
    return NextResponse.json(
      { error: 'Kein verifiziertes Facebook-Konto verknüpft. Verknüpfe zuerst dein Facebook im Profil.' },
      { status: 400 }
    );
  }

  // 2. Quest laden
  const quest = await loadQuestDetail(questId);
  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }
  if (quest.platform !== 'facebook') {
    return NextResponse.json({ error: 'Kein Facebook-Quest' }, { status: 400 });
  }
  if (!quest.isActive) {
    return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
  }
  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
  }
  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json(
      { error: 'Alle Plätze für diesen Quest sind vergeben' },
      { status: 400 }
    );
  }

  // 3. Doppelabschluss prüfen (Wallet UND Facebook-Handle)
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json(
      { error: 'Du hast diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }
  const handleDone = await hasChannelCompletedQuest(profile.facebookHandle, questId);
  if (handleDone) {
    return NextResponse.json(
      { error: 'Dieser Facebook-Account hat diesen Quest bereits abgeschlossen.' },
      { status: 409 }
    );
  }

  // 4. Reservierten Kommentartext aus DB holen
  //    (falls preview noch nicht aufgerufen → Slot jetzt anlegen)
  const commentText = await reserveQuestCommentSlot(questId, normalized);

  // 5. Post-ID normalisieren (falls alte Quests fehlerhafte URLs als videoId haben)
  let postId = quest.videoId;
  if (postId.includes('http') || postId.includes('/')) {
    // Versuche aus videoId zu extrahieren
    const extracted = extractFacebookPostId(postId);
    if (extracted) {
      postId = extracted;
      console.log('[comment-verify] Post-ID normalisiert:', postId);
    } else if (quest.videoUrl) {
      // Fallback: aus videoUrl extrahieren
      const extractedFromUrl = extractFacebookPostId(quest.videoUrl);
      if (extractedFromUrl) {
        postId = extractedFromUrl;
        console.log('[comment-verify] Post-ID aus URL extrahiert:', postId);
      }
    }
  }

  // 6. Meta Graph API – sucht den exakten Kommentartext im Post
  // Creator-Profil laden um gespeicherte facebookPageId zu nutzen (kein Probe-Loop nötig)
  const sql = getDb();
  const creatorRows = await sql`
    SELECT facebook_page_id FROM user_profiles
    WHERE wallet_address = ${quest.creatorWallet.toLowerCase()} LIMIT 1
  `;
  const creatorFacebookPageId = (creatorRows[0]?.facebook_page_id as string | null) ?? null;

  // Falls postId nur die numerische Post-ID ohne Page-ID ist (alte Bundles mit Permalink-Format),
  // mit der bekannten Page-ID des Creators kombinieren
  if (!postId.includes('_') && /^\d+$/.test(postId) && creatorFacebookPageId) {
    postId = `${creatorFacebookPageId}_${postId}`;
    console.log('[comment-verify] Post-ID mit Page-ID kombiniert:', postId);
  }

  const result = await findFacebookComment(postId, commentText, null, creatorFacebookPageId);

  // 7. Ergebnis auswerten
  if (!result.found) {
    console.log('[comment-verify] DEBUG - Gesuchter Text:', commentText);
    console.log('[comment-verify] DEBUG - Gefundene Kommentare:', result.allComments?.length ?? 0);
    console.log('[comment-verify] DEBUG - Erste 5 Kommentare:', result.allComments?.slice(0, 5));
    
    return NextResponse.json({
      notFound: true,
      commentText,
      message: `Kein passender Kommentar gefunden. Stelle sicher, dass du genau diesen Text als Kommentar gepostet hast: "${commentText}"`,
      debug: {
        postId,
        totalComments: result.allComments?.length ?? 0,
        sampleComments: result.allComments?.slice(0, 3).map(c => ({
          from: c.from,
          message: c.message.substring(0, 100)
        }))
      }
    });
  }

  // 8. Quest-Abschluss speichern
  const now = new Date().toISOString();
  await saveCompletion({
    questId,
    walletAddress: normalized,
    channelId: profile.facebookHandle,
    channelName: profile.facebookName ?? profile.facebookHandle,
    platform: 'facebook',
    commentId: 'comment',
    commentText: 'positive comment',
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,
    completedAt: now,
  });

  // 9. Credits gutschreiben
  await addDfaithCredits(normalized, quest.rewardAmount);
  const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount, quest.id);
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `Facebook Comment Quest: ${quest.videoTitle}`,
    questId,
    createdAt: now,
  });
  await addUserXp(normalized, quest.reputationReward);
  await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);

  return NextResponse.json({
    success: true,
    rewardAmount: quest.rewardAmount + levelBonus,
    levelBonus: levelBonus > 0 ? levelBonus : undefined,
    message: `Quest abgeschlossen! +${quest.rewardAmount + levelBonus} DFAITH Credits`,
  });
}
