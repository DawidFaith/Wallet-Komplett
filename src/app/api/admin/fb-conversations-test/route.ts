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

  // Optional: nur prüfen, über welche Quelle (me/accounts = direkte Page-Rolle,
  // owned_pages/client_pages = Business Manager) diese eine pageId erreichbar ist —
  // ohne andere Pages oder Tokens preiszugeben.
  if (req.nextUrl.searchParams.get('checkSource') === '1') {
    const systemToken = process.env.META_SYSTEM_USER_TOKEN;
    const bizId = process.env.META_BUSINESS_ID;
    if (!systemToken) return NextResponse.json({ error: 'META_SYSTEM_USER_TOKEN nicht gesetzt' }, { status: 500 });

    const checkOne = async (url: string): Promise<boolean> => {
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        const data = await res.json() as { data?: Array<{ id: string }>; error?: unknown };
        return !!data.data?.some(p => p.id === pageId);
      } catch { return false; }
    };

    const foundInMeAccounts = await checkOne(`${GRAPH}/me/accounts?fields=id&limit=200&access_token=${systemToken}`);
    let foundInOwnedPages = false;
    let foundInClientPages = false;
    if (bizId) {
      foundInOwnedPages = await checkOne(`${GRAPH}/${bizId}/owned_pages?fields=id&limit=200&access_token=${systemToken}`);
      foundInClientPages = await checkOne(`${GRAPH}/${bizId}/client_pages?fields=id&limit=200&access_token=${systemToken}`);
    }

    // Tatsächlich gewährte Page-Tasks (z.B. MESSAGING) für diese eine Page laut Meta
    let tasks: string[] | null = null;
    try {
      const res = await fetch(`${GRAPH}/me/accounts?fields=id,tasks&limit=200&access_token=${systemToken}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const data = await res.json() as { data?: Array<{ id: string; tasks?: string[] }> };
      tasks = data.data?.find(p => p.id === pageId)?.tasks ?? null;
    } catch { /* tasks bleibt null */ }

    return NextResponse.json({ pageId, foundInMeAccounts, foundInOwnedPages, foundInClientPages, tasks });
  }

  // Optional: NUR die Berechtigungs-Metadaten (kein Nachrichteninhalt!) von zwei
  // verschiedenen Tokens für dieselbe Page vergleichen — dem Business-Partner-Token
  // (client_pages, was die App normalerweise nutzt) und dem direkten Page-Rollen-
  // Token (/me/accounts) — um zu sehen, ob sie unterschiedliche Scopes tragen.
  if (req.nextUrl.searchParams.get('compareScopes') === '1') {
    const systemToken = process.env.META_SYSTEM_USER_TOKEN;
    const appId = process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!systemToken) return NextResponse.json({ error: 'META_SYSTEM_USER_TOKEN nicht gesetzt' }, { status: 500 });
    if (!appId || !appSecret) return NextResponse.json({ error: 'META_APP_ID/FACEBOOK_APP_ID oder FACEBOOK_APP_SECRET nicht gesetzt' }, { status: 500 });
    const appToken = `${appId}|${appSecret}`;

    const scopesOf = async (token: string): Promise<string[] | { error: string }> => {
      try {
        const res = await fetch(`${GRAPH}/debug_token?input_token=${token}&access_token=${appToken}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        const data = await res.json() as { data?: { scopes?: string[] }; error?: { message: string } };
        if (data.error) return { error: data.error.message };
        return data.data?.scopes ?? [];
      } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
    };

    const businessPartnerToken = await getPageTokenByPageId(pageId);
    const meAccountsRes = await fetch(`${GRAPH}/me/accounts?fields=id,access_token&limit=200&access_token=${systemToken}`, { cache: 'no-store' });
    const meAccountsData = await meAccountsRes.json() as { data?: Array<{ id: string; access_token?: string }> };
    const meAccountsToken = meAccountsData.data?.find(p => p.id === pageId)?.access_token ?? null;

    return NextResponse.json({
      pageId,
      businessPartnerTokenScopes: businessPartnerToken ? await scopesOf(businessPartnerToken) : null,
      meAccountsTokenScopes: meAccountsToken ? await scopesOf(meAccountsToken) : null,
    });
  }

  const pageToken = overridePageId
    ? await getPageTokenByPageId(overridePageId)
    : await getPageAccessToken();
  if (!pageToken) {
    return NextResponse.json({ error: 'Kein Page Access Token verfügbar' }, { status: 500 });
  }

  // Optional: Posts/Fan-Count derselben Page mit demselben Token abrufen —
  // Vergleich, ob nur die Conversations-API für diese Page fehlschlägt oder
  // grundsätzlich alles.
  if (req.nextUrl.searchParams.get('testPosts') === '1') {
    try {
      const res = await fetch(
        `${GRAPH}/${pageId}?fields=name,fan_count,posts.limit(5){message,created_time,permalink_url}&access_token=${pageToken}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
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
