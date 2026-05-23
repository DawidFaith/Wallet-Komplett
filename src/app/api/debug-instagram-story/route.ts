/**
 * GET  /api/debug-instagram-story
 *   → Zeigt alle aktiven instagram_dm_verifications + testet mentioned_media API
 *
 * POST /api/debug-instagram-story  { media_id: string }
 *   → Simuliert den Webhook manuell für eine gegebene media_id
 *     (ruft getUsernameFromMentionedMedia auf und verarbeitet Quest-Abschluss)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

const GRAPH = 'https://graph.facebook.com/v21.0';
const IG_USER_ID = '17841442682659672'; // dawidfaith IG Business Account

export async function GET(_req: NextRequest) {
  const sql = getDb();
  const token = process.env.META_SYSTEM_USER_TOKEN;

  // 1. Alle aktiven Verifikationen aus der DB
  const rows = await sql`
    SELECT quest_id, wallet_address, instagram_handle, click_verified, story_verified,
           baseline_shares, expires_at, started_at, clicked_at
    FROM instagram_dm_verifications
    ORDER BY started_at DESC
    LIMIT 20
  `;

  // 2. Test: mentioned_media API ohne media_id (nur Permissions prüfen)
  let apiTest = null;
  if (token) {
    const res = await fetch(
      `${GRAPH}/${IG_USER_ID}?fields=id,username,name&access_token=${token}`,
      { cache: 'no-store' },
    );
    apiTest = await res.json();
  }

  // 3. Subscription-Status prüfen
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  let subscriptions = null;
  if (appId && appSecret) {
    const res = await fetch(
      `${GRAPH}/${appId}/subscriptions?access_token=${appId}|${appSecret}`,
      { cache: 'no-store' },
    );
    subscriptions = await res.json();
  }

  return NextResponse.json({
    activeVerifications: rows,
    igAccountApiTest: apiTest,
    webhookSubscriptions: subscriptions,
    igUserId: IG_USER_ID,
    hasToken: !!token,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { media_id?: string; username?: string };
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return NextResponse.json({ error: 'META_SYSTEM_USER_TOKEN fehlt' }, { status: 500 });

  const log: string[] = [];

  // Schritt 1: username per mentioned_media API holen (oder direkt übergeben)
  let username = body.username ?? null;

  if (!username && body.media_id) {
    log.push(`Rufe mentioned_media API für media_id=${body.media_id} und igUserId=${IG_USER_ID} auf...`);
    const url = `${GRAPH}/${IG_USER_ID}/mentioned_media?media_id=${encodeURIComponent(body.media_id)}&fields=id,username,media_type,timestamp&access_token=${token}`;
    log.push(`URL: ${url.replace(token, 'TOKEN')}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json() as Record<string, unknown>;
    log.push(`API Response: ${JSON.stringify(json)}`);

    if (!res.ok) {
      return NextResponse.json({ error: 'mentioned_media API Fehler', details: json, log }, { status: 400 });
    }

    username = typeof json.username === 'string'
      ? json.username.toLowerCase().replace(/^@/, '')
      : null;
    log.push(`Erkannter Username: ${username ?? '(null)'}`);
  }

  if (!username) {
    return NextResponse.json({ error: 'Kein username ermittelt – media_id oder username Parameter erforderlich', log }, { status: 400 });
  }

  // Schritt 2: DB-Lookup
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM instagram_dm_verifications
    WHERE instagram_handle = ${username.toLowerCase()}
    ORDER BY started_at DESC
    LIMIT 1
  `;
  log.push(`DB-Lookup für handle="${username}": ${rows.length} Zeilen gefunden`);

  if (!rows.length) {
    return NextResponse.json({
      username,
      error: `Keine aktive Quest-Verifikation für @${username} gefunden`,
      log,
    }, { status: 404 });
  }

  const verif = rows[0];
  log.push(`Verifikation: quest_id=${verif.quest_id}, click_verified=${verif.click_verified}, expires_at=${verif.expires_at}`);

  if (verif.click_verified) {
    return NextResponse.json({ username, message: 'Quest bereits als click_verified markiert', verif, log });
  }

  // Schritt 3: click_verified setzen
  await sql`
    UPDATE instagram_dm_verifications
    SET click_verified = TRUE, clicked_at = NOW()
    WHERE quest_id = ${verif.quest_id} AND wallet_address = ${verif.wallet_address}
  `;
  log.push('click_verified = TRUE gesetzt');

  return NextResponse.json({
    success: true,
    username,
    message: `@${username} click_verified gesetzt. Status-Polling im Frontend wird Quest jetzt abschließen.`,
    verif,
    log,
  });
}
