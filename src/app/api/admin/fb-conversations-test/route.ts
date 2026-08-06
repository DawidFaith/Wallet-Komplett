/**
 * GET /api/admin/fb-conversations-test
 * Header: x-admin-secret
 *
 * Diagnose-Route: prüft, ob wir über die Facebook Conversations API
 * (eigenes Messenger-Postfach der Page) die Namen von Leuten sehen können,
 * denen die Page eine DM geschickt hat — als Alternative dazu, dass der
 * Kommentar-Name bei Reels über die normale Comments-API fehlt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPageAccessToken, getPageTokenByPageId } from '@/app/lib/metaApi';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  // Optional: gezielt eine andere Artist-Page abfragen statt der Standard-Page
  const overridePageId = req.nextUrl.searchParams.get('pageId');
  const pageId = overridePageId ?? process.env.FACEBOOK_PAGE_ID;
  if (!pageId) {
    return NextResponse.json({ error: 'FACEBOOK_PAGE_ID nicht gesetzt' }, { status: 500 });
  }

  const pageToken = overridePageId
    ? await getPageTokenByPageId(overridePageId)
    : await getPageAccessToken();
  if (!pageToken) {
    return NextResponse.json({ error: 'Kein Page Access Token verfügbar' }, { status: 500 });
  }

  // Optional: nur die tatsächlichen Scopes des Page-Tokens prüfen, ohne Nachrichten zu lesen
  if (req.nextUrl.searchParams.get('debugToken') === '1') {
    const appId = process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'META_APP_ID/FACEBOOK_APP_ID oder FACEBOOK_APP_SECRET nicht gesetzt' }, { status: 500 });
    }
    const appToken = `${appId}|${appSecret}`;
    const res = await fetch(
      `${GRAPH}/debug_token?input_token=${pageToken}&access_token=${appToken}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  try {
    const res = await fetch(
      `${GRAPH}/${pageId}/conversations?fields=participants,updated_time,messages.limit(3){message,from,created_time}&limit=10&access_token=${pageToken}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
