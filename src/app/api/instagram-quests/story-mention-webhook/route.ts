/**
 * GET  /api/instagram-quests/story-mention-webhook
 *   → Meta Webhook-Verifikation (hub.challenge)
 *
 * POST /api/instagram-quests/story-mention-webhook
 *   → Empfängt Instagram "mentions"-Events von Meta.
 *   → Wenn ein Fan @dawidfaith in seiner Story markiert:
 *      1. media_id aus dem Webhook extrahieren
 *      2. GET /{ig-user-id}/mentioned_media?media_id=...&fields=username
 *         → Username des Taggers ermitteln
 *      3. Aktive dm_share-Quest-Verifikation für diesen Handle laden
 *      4. story_verified = TRUE setzen (Teil 1 der Story Quest)
 *
 * Erforderliche Env-Vars (bereits gesetzt):
 *   META_WEBHOOK_VERIFY_TOKEN   – für GET-Verifikation
 *   FACEBOOK_APP_SECRET         – für HMAC-Signaturprüfung
 *   META_SYSTEM_USER_TOKEN      – für Graph API Calls
 *
 * Meta Developer Console:
 *   App → Webhooks → Instagram → Abonnieren: "mentions"
 *   Callback URL: https://app.dawidfaith.de/api/instagram-quests/story-mention-webhook
 */

import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  getInstagramDmVerificationByHandle,
  markInstagramDmStoryVerifiedByHandle,
  markInstagramDmClickedByHandle,
  loadQuestDetail,
  getUserProfile,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
  addUserXp,
  addUserReputation,
  deleteInstagramDmVerification,
  type QuestCompletion,
} from '../../../lib/questDb';

export const maxDuration = 20;

const GRAPH = 'https://graph.facebook.com/v21.0';

// ── Signatur-Verifikation ────────────────────────────────────────────────────

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  // Konstantzeit-Vergleich (timing-safe)
  if (expected.length !== signature.length) return false;
  return createHmac('sha256', secret).update(expected).digest('hex') ===
         createHmac('sha256', secret).update(signature).digest('hex');
}

// ── Username via Graph API ermitteln ────────────────────────────────────────

async function getUsernameFromMentionedMedia(igUserId: string, mediaId: string): Promise<string | null> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `${GRAPH}/${igUserId}/mentioned_media?media_id=${encodeURIComponent(mediaId)}&fields=id,username,media_type&access_token=${token}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;
    const json = await res.json() as { username?: string };
    return json.username ? json.username.toLowerCase().replace(/^@/, '') : null;
  } catch {
    return null;
  }
}

// ── GET: Webhook-Verifikation durch Meta ────────────────────────────────────

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode      = params.get('hub.mode');
  const token     = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[story-mention-webhook] Webhook-Verifikation erfolgreich');
    return new NextResponse(challenge ?? '', { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST: Eingehende Instagram-Mention-Events ────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Signatur prüfen wenn App Secret gesetzt
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appSecret) {
    const sig = req.headers.get('x-hub-signature-256');
    if (!verifySignature(rawBody, sig, appSecret)) {
      console.warn('[story-mention-webhook] Ungültige Signatur');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: {
    object?: string;
    entry?: Array<{
      id: string;
      changes?: Array<{
        field: string;
        value?: { media_id?: string; comment_id?: string };
      }>;
    }>;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Nur Instagram-Events verarbeiten
  if (payload.object !== 'instagram') {
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      // Nur "mentions"-Events (Story-Tags und Kommentar-Erwähnungen)
      if (change.field !== 'mentions') continue;

      const mediaId = change.value?.media_id;
      if (!mediaId) continue;

      // Username des Taggers per Graph API ermitteln
      const username = await getUsernameFromMentionedMedia(entry.id, mediaId);
      if (!username) {
        console.warn('[story-mention-webhook] Kein Username für media_id:', mediaId);
        continue;
      }

      console.log('[story-mention-webhook] Story-Tag erkannt von:', username);

      // Aktive dm_share Quest-Verifikation prüfen
      try {
        const verif = await getInstagramDmVerificationByHandle(username);
        if (!verif) {
          console.log('[story-mention-webhook] Keine aktive Quest für:', username);
          continue;
        }

        if (verif.clickVerified) {
          console.log('[story-mention-webhook] Quest bereits komplett für:', username);
          continue;
        }

        // @-Tag erkannt → click_verified setzen und Quest sofort abschließen
        await markInstagramDmClickedByHandle(username, verif.baselineShares);
        console.log('[story-mention-webhook] @-Tag erkannt (click_verified) für:', username);
        const alreadyDone = await hasWalletCompletedQuest(verif.walletAddress, verif.questId);
        if (!alreadyDone) {
          const quest = await loadQuestDetail(verif.questId);
          const profile = await getUserProfile(verif.walletAddress);
          if (quest) {
            const now = new Date().toISOString();
            const completion: QuestCompletion = {
              questId: verif.questId,
              walletAddress: verif.walletAddress,
              channelId: username,
              channelName: profile?.instagramName ?? username,
              platform: 'instagram',
              commentId: `dm_share:${username}`,
              commentText: `dm_share|handle:${username}`,
              rewardAmount: quest.rewardAmount,
              rewardPaid: false,
              completedAt: now,
            };
            await saveCompletion(completion);
            await addDfaithCredits(verif.walletAddress, quest.rewardAmount);
            await savePendingReward({ walletAddress: verif.walletAddress, amount: quest.rewardAmount, reason: `Story Quest: ${quest.videoTitle}`, questId: verif.questId, createdAt: now });
            await addUserXp(verif.walletAddress, Math.round(quest.rewardAmount / 10));
            await addUserReputation(verif.walletAddress, quest.creatorWallet, quest.reputationReward);
            await deleteInstagramDmVerification(verif.questId, verif.walletAddress);
            console.log('[story-mention-webhook] Quest abgeschlossen für:', username, '+', quest.rewardAmount, 'Credits');
          }
        }
      } catch (err) {
        console.error('[story-mention-webhook] DB-Fehler für', username, err);
      }
    }
  }

  // Meta erwartet immer HTTP 200 zurück
  return NextResponse.json({ ok: true });
}
