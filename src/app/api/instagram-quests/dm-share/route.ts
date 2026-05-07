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
  upsertInstagramDmVerification,
  getInstagramDmVerification,
  markInstagramDmStoryVerified,
} from '../../../lib/questDb';
import { getDb } from '../../../lib/db';

export const maxDuration = 30;

// ─── Universeller Link-Template mit {name} als Platzhalter ───────────────────
// Einmalig in Link DM eintragen – das Tool setzt {name} automatisch mit dem Handle

function buildLinkTemplate(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://wallet-komplett.vercel.app').replace(/\/$/, '');
  return `${appUrl}/api/instagram-quests/dm-click?name={name}`;
}

// ─── Make.com Shares-Abfrage (identisch zu like-verify) ──────────────────────

/** Extrahiert die "shares"-Metrik aus einem Insights-Array (Instagram Graph API Format). */
function extractSharesFromMetricsArray(arr: any[]): number | null {
  for (const item of arr) {
    if (item && typeof item === 'object' && item.name === 'shares') {
      const v = item?.values?.[0]?.value;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

async function fetchCurrentShares(webhookUrl: string, graphMediaId: string): Promise<number> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphMediaId }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (!text) return 0;

    // 1) Versuche reguläres JSON.parse
    try {
      const json = JSON.parse(text);
      // Direktes Feld
      if (typeof json?.shares === 'number') return json.shares;
      // metrics: [...]
      if (Array.isArray(json?.metrics)) {
        const n = extractSharesFromMetricsArray(json.metrics);
        if (n !== null) return n;
      }
      // data: [...] (klassisches Insights Format)
      if (Array.isArray(json?.data)) {
        const n = extractSharesFromMetricsArray(json.data);
        if (n !== null) return n;
      }
      // Top-Level Array
      if (Array.isArray(json)) {
        const n = extractSharesFromMetricsArray(json);
        if (n !== null) return n;
      }
    } catch {
      // Make.com schickt manchmal ungültiges JSON (mehrere Keys mit gleichem Namen).
      // Fallback: regex-basiert nach `"name":"shares" ... "value":N` suchen.
    }

    // 2) Robust-Fallback: Suche nach `"name":"shares"` Block und extrahiere ersten "value":N
    const block = text.match(/"name"\s*:\s*"shares"[\s\S]{0,300}?"value"\s*:\s*(\d+)/);
    if (block) return Number(block[1]);

    // 3) Letzter Fallback: einfaches "shares":N (kein url-Substring)
    const direct = text.match(/(?<!\/)"shares"\s*:\s*(\d+)/);
    if (direct) return Number(direct[1]);

    return 0;
  } catch {
    return 0;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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

      const makeWebhookUrl = process.env.MAKE_INSTAGRAM_LIKE_WEBHOOK_URL;
      let baselineShares = 0;
      if (makeWebhookUrl && quest.videoId) {
        baselineShares = await fetchCurrentShares(makeWebhookUrl, quest.videoId);
      }

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

      // DM-Klick bereits abgeschlossen (über dm-click Seite)
      if (verif.clickVerified) {
        return NextResponse.json({ shareVerified: true, clickVerified: true, alreadyCompleted: true, linkTemplate });
      }

      // Share bereits verifiziert → warte auf DM-Klick
      if (verif.storyVerified) {
        return NextResponse.json({
          shareVerified: true,
          clickVerified: false,
          expiresAt: verif.expiresAt,
          linkTemplate,
          message: 'Story-Share bereits bestätigt. Warte auf den DM-Link und klicke ihn.',
        });
      }

      // Share-Delta prüfen
      const makeWebhookUrl = process.env.MAKE_INSTAGRAM_LIKE_WEBHOOK_URL;
      if (!makeWebhookUrl) {
        return NextResponse.json({ error: 'MAKE_INSTAGRAM_LIKE_WEBHOOK_URL nicht konfiguriert.' }, { status: 500 });
      }

      const currentShares = await fetchCurrentShares(makeWebhookUrl, quest.videoId);
      if (currentShares <= verif.baselineShares) {
        return NextResponse.json({
          notYet: true,
          shareVerified: false,
          clickVerified: false,
          currentShares,
          baselineShares: verif.baselineShares,
          expiresAt: verif.expiresAt,
          message: `Noch kein neuer Share erkannt (aktuell: ${currentShares}, Baseline: ${verif.baselineShares}). Teile den Beitrag in deiner Story und prüfe erneut.`,
        });
      }

      // ── Share erkannt → story_verified markieren ──────────────────────────
      await markInstagramDmStoryVerified(questId, normalized);

      return NextResponse.json({
        shareVerified: true,
        clickVerified: false,
        expiresAt: verif.expiresAt,
        linkTemplate,
        message: 'Story-Share bestätigt! Du bekommst gleich einen DM-Link – klicke ihn um die Quest abzuschließen.',
      });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (action === 'status') {
      const verif = await getInstagramDmVerification(questId, normalized);
      if (!verif) return NextResponse.json({ started: false });
      return NextResponse.json({
        started: true,
        shareVerified: verif.storyVerified,
        clickVerified: verif.clickVerified,
        expiresAt: verif.expiresAt,
        expired: new Date(verif.expiresAt) < new Date(),
        linkTemplate: verif.storyVerified ? linkTemplate : null,
      });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dm-share]', err);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
}
