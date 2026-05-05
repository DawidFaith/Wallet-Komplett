/**
 * POST /api/instagram-quests/trigger-sync
 *
 * Löst in Make.com einen Sync aus: Make.com ruft GET /me/media ab
 * und schickt jedes Video einzeln an POST /api/instagram-quests/save-media.
 *
 * Make.com Szenario "Instagram Media Sync":
 *   [1] Custom Webhook (eingehend von hier)
 *   [2] HTTP: GET https://graph.facebook.com/v21.0/me/media
 *             ?fields=id,shortcode,caption,thumbnail_url,permalink,timestamp
 *             &limit=100&access_token={{TOKEN}}
 *   [3] Array Iterator über data[]
 *   [4] HTTP: POST https://app.dawidfaith.de/api/instagram-quests/save-media
 *             { graphMediaId: {{id}}, shortcode: {{shortcode}}, caption: {{caption}},
 *               thumbnailUrl: {{thumbnail_url}}, permalink: {{permalink}},
 *               postedAt: {{timestamp}} }
 *             Header: X-Make-Secret: {{MAKE_WEBHOOK_SECRET}}
 *
 * Env: MAKE_INSTAGRAM_SYNC_URL
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const syncUrl = process.env.MAKE_INSTAGRAM_SYNC_URL;
  if (!syncUrl) {
    return NextResponse.json(
      { error: 'MAKE_INSTAGRAM_SYNC_URL nicht konfiguriert' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'sync', source: 'dashboard' }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Make.com Sync Fehler', details: await res.text() },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'Sync gestartet – Videos werden geladen…' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Make.com nicht erreichbar', details: msg }, { status: 502 });
  }
}
