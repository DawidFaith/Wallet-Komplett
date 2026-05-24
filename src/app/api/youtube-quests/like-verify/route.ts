import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  loadBindingByWallet,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  upsertLikeVerification,
  getLikeVerification,
  advanceLikeVerificationToAwaitLike,
  deleteLikeVerification,
  saveCompletion,
  addDfaithCredits,
  addUserXp,
  addUserReputation,
  payLevelBonus,
  QuestCompletion,
} from '../../../lib/questDb';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

/** YouTube-API: Anzahl der Likes eines Videos abrufen */
async function fetchLikeCount(videoId: string): Promise<number | null> {
  if (!YT_API_KEY) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${YT_API_KEY}`
    );
    const data = await res.json();
    if (data?.error) {
      console.error('[fetchLikeCount] YouTube API error:', data.error.message);
      return null;
    }
    if (!data?.items?.length) return null;
    const stats = data.items[0].statistics;
    // likeCount ist undefined wenn Creator Statistiken versteckt hat
    if (stats?.likeCount === undefined) return null;
    return Number(stats.likeCount);
  } catch (err) {
    console.error('[fetchLikeCount]', err);
    return null;
  }
}

/**
 * POST /api/youtube-quests/like-verify
 *
 * Body: {
 *   action: 'start' | 'check-removal' | 'check-like'
 *   questId: string
 *   walletAddress: string
 * }
 *
 * Ablauf:
 *   start          → Baseline-Like-Count laden, Fan auffordern Likes zu entfernen
 *   check-removal  → Prüft ob Likes entfernt wurden (Snapshot), öffnet 5-Min-Fenster
 *   check-like     → Prüft ob Like hinzugefügt wurde (innerhalb 5 Min) → Quest abschließen
 */
export async function POST(req: NextRequest) {
  let body: { action?: string; questId?: string; walletAddress?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

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
  const [binding, quest] = await Promise.all([
    loadBindingByWallet(normalized),
    loadQuestDetail(questId),
  ]);

  if (!binding) {
    return NextResponse.json(
      { error: 'Kein YouTube-Kanal verknüpft. Verknüpfe zuerst deinen Kanal.' },
      { status: 400 }
    );
  }
  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }
  if (!quest.isActive) {
    return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
  }
  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
  }
  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json(
      { error: 'Alle Plätze dieses Quests sind vergeben' },
      { status: 400 }
    );
  }

  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json(
      { error: 'Du hast diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }
  const channelDone = await hasChannelCompletedQuest(binding.channelId, questId);
  if (channelDone) {
    return NextResponse.json(
      { error: 'Dein Kanal hat diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }

  // ── action: start ────────────────────────────────────────────────────────
  if (action === 'start') {
    const likes = await fetchLikeCount(quest.videoId);
    if (likes === null) {
      return NextResponse.json(
        { error: 'Like-Anzahl nicht abrufbar. Das Video hat möglicherweise versteckte Statistiken oder der YOUTUBE_DATA_API_KEY fehlt.' },
        { status: 500 }
      );
    }
    await upsertLikeVerification(questId, normalized, quest.videoId, likes);
    // Direkt 5-Min-Fenster öffnen – User muss nur liken, kein Entfernen nötig
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await advanceLikeVerificationToAwaitLike(questId, normalized, likes, expiresAt);
    return NextResponse.json({ step: 'await_like', baselineLikes: likes, expiresAt });
  }

  // ── action: check-removal (Rückwärtskompatibilität – nicht mehr nötig) ──
  if (action === 'check-removal') {
    // Direkt zum await_like Schritt weiterleiten
    const verification = await getLikeVerification(questId, normalized);
    if (!verification) {
      return NextResponse.json(
        { error: 'Keine laufende Verifizierung gefunden. Starte neu.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ step: 'await_like', expiresAt: verification.expiresAt });
  }

  // ── action: check-like ───────────────────────────────────────────────────
  if (action === 'check-like') {
    const verification = await getLikeVerification(questId, normalized);
    if (!verification || verification.step !== 'await_like') {
      return NextResponse.json(
        { error: 'Keine laufende Verifizierung in Schritt 2 gefunden. Starte neu.' },
        { status: 400 }
      );
    }

    // 5-Minuten-Fenster abgelaufen?
    if (verification.expiresAt && new Date(verification.expiresAt) < new Date()) {
      await deleteLikeVerification(questId, normalized);
      return NextResponse.json({ expired: true });
    }

    const currentLikes = await fetchLikeCount(quest.videoId);
    if (currentLikes === null) {
      return NextResponse.json(
        { error: 'Like-Anzahl nicht abrufbar. Bitte erneut versuchen.' },
        { status: 500 }
      );
    }

    const removedLikes = verification.removedLikes ?? verification.baselineLikes;
    if (currentLikes <= removedLikes) {
      return NextResponse.json({
        success: false,
        notYet: true,
        message: 'Kein neuer Like festgestellt. Bitte like das Video und versuche es erneut.',
        expiresAt: verification.expiresAt,
      });
    }

    // ✅ Like verifiziert → Quest abschließen
    const now = new Date().toISOString();
    const completion: QuestCompletion = {
      walletAddress: normalized,
      channelId: binding.channelId,
      channelName: binding.channelName,
      questId,
      platform: 'youtube',
      commentId: '',      // kein Kommentar bei Like-Quest
      commentText: '',
      rewardAmount: quest.rewardAmount,
      rewardPaid: false,
      completedAt: now,
    };

    await saveCompletion(completion);
    await addDfaithCredits(normalized, quest.rewardAmount);
    const levelBonus = await payLevelBonus(normalized, quest.creatorWallet, quest.rewardAmount);
    await addUserXp(normalized, quest.rewardAmount * 10);
    await addUserReputation(normalized, quest.creatorWallet, quest.reputationReward);
    await deleteLikeVerification(questId, normalized);

    return NextResponse.json({ success: true, rewardAmount: quest.rewardAmount + levelBonus, levelBonus: levelBonus > 0 ? levelBonus : undefined });
  }


  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[like-verify]', action, message);

    // Häufige Ursache: like_verifications Tabelle existiert noch nicht
    if (message.includes('like_verifications') || message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Datenbank nicht initialisiert. Bitte setup-db ausführen (like_verifications Tabelle fehlt).' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
