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

// ── Username via mentioned_media (changes-Webhook) ──────────────────────────

async function getUsernameFromMentionedMedia(igUserId: string, mediaId: string): Promise<string | null> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) { console.error('[story-mention-webhook] META_SYSTEM_USER_TOKEN fehlt'); return null; }
  try {
    const url = `${GRAPH}/${igUserId}/mentioned_media?media_id=${encodeURIComponent(mediaId)}&fields=id,username,media_type&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json() as { username?: string; error?: { message: string; code: number } };
    if (!res.ok || json.error) {
      console.error(`[story-mention-webhook] mentioned_media Fehler igUserId=${igUserId} mediaId=${mediaId}:`, json.error?.message ?? res.status);
      return null;
    }
    console.log(`[story-mention-webhook] mentioned_media Antwort:`, JSON.stringify(json));
    return json.username ? json.username.toLowerCase().replace(/^@/, '') : null;
  } catch (e) {
    console.error(`[story-mention-webhook] mentioned_media Exception:`, e);
    return null;
  }
}

// ── Username via Message-ID (messaging-Webhook / story_mention DM) ───────────

async function getUsernameFromMessageId(igUserId: string, mid: string): Promise<string | null> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return null;
  try {
    const url = `${GRAPH}/${mid}?fields=from&access_token=${token}&user_id=${igUserId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json() as { from?: { id: string; username?: string }; error?: { message: string } };
    if (!res.ok || json.error) {
      console.error(`[story-mention-webhook] message lookup Fehler mid=${mid}:`, json.error?.message ?? res.status);
      return null;
    }
    console.log(`[story-mention-webhook] message from:`, JSON.stringify(json.from));
    return json.from?.username ? json.from.username.toLowerCase().replace(/^@/, '') : null;
  } catch (e) {
    console.error(`[story-mention-webhook] message lookup Exception:`, e);
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
        value?: { media_id?: string; comment_id?: string; post_id?: string };
      }>;
      messaging?: Array<{
        sender: { id: string };
        recipient: { id: string };
        message?: {
          mid: string;
          attachments?: Array<{ type: string; payload?: { url?: string } }>;
        };
      }>;
    }>;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Payload-Struktur immer loggen
  console.log('[story-mention-webhook] Payload object:', payload.object,
    '| raw (500):', rawBody.slice(0, 500));

  if (payload.object !== 'instagram' && payload.object !== 'page') {
    console.log('[story-mention-webhook] Unbekanntes object:', payload.object, '– ignoriert');
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {

    // ── Format 1: entry.changes[] mit field=mentions (klassischer Webhook) ──
    for (const change of entry.changes ?? []) {
      if (change.field !== 'mentions' && change.field !== 'mention') continue;
      const mediaId = change.value?.media_id ?? change.value?.post_id;
      if (!mediaId) {
        console.log('[story-mention-webhook] changes: kein media_id:', JSON.stringify(change.value));
        continue;
      }
      const username = await getUsernameFromMentionedMedia(entry.id, mediaId);
      if (!username) {
        console.warn('[story-mention-webhook] changes: kein Username für media_id:', mediaId);
        continue;
      }
      await processStoryMention(username);
    }

    // ── Format 2: entry.messaging[] mit type=story_mention (DM-Webhook) ─────
    for (const msg of entry.messaging ?? []) {
      const isStoryMention = msg.message?.attachments?.some(a => a.type === 'story_mention');
      if (!isStoryMention) continue;
      const mid = msg.message?.mid;
      if (!mid) {
        console.log('[story-mention-webhook] messaging: kein mid');
        continue;
      }
      const username = await getUsernameFromMessageId(entry.id, mid);
      if (!username) {
        console.warn('[story-mention-webhook] messaging: kein Username für mid:', mid, 'sender.id:', msg.sender.id);
        continue;
      }
      await processStoryMention(username);
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Quest-Verarbeitung nach erkanntem Story-Tag ───────────────────────────────

async function processStoryMention(username: string): Promise<void> {
  console.log('[story-mention-webhook] Story-Tag erkannt von:', username);
  try {
    const verif = await getInstagramDmVerificationByHandle(username);
    if (!verif) {
      console.log('[story-mention-webhook] Keine aktive Quest für:', username);
      return;
    }
    if (verif.clickVerified) {
      console.log('[story-mention-webhook] Quest bereits komplett für:', username);
      return;
    }
    await markInstagramDmClickedByHandle(username, verif.baselineShares);
    console.log('[story-mention-webhook] click_verified gesetzt für:', username);
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
    console.error('[story-mention-webhook] Fehler für', username, err);
  }
}
