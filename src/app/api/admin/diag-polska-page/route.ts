/**
 * Temporärer Diagnose-Endpoint: holt das Page-eigene Access-Token für
 * "Die Melodiker" (109093575481784) über die Business-Portfolio-Zuordnung
 * (wie getPageTokenByPageId in metaApi.ts) und prüft damit den verknüpften
 * Instagram-Business-Account. Wird nach der Prüfung wieder gelöscht.
 */
import { NextRequest, NextResponse } from 'next/server';

const GRAPH = 'https://graph.facebook.com/v21.0';
const PAGE_ID = '109093575481784';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const systemToken = process.env.META_SYSTEM_USER_TOKEN;
  const bizId = process.env.META_BUSINESS_ID;
  if (!systemToken || !bizId) {
    return NextResponse.json({ error: 'META_SYSTEM_USER_TOKEN oder META_BUSINESS_ID fehlt' }, { status: 500 });
  }

  const result: Record<string, unknown> = {};
  let pageToken: string | null = null;

  try {
    const res = await fetch(
      `${GRAPH}/${bizId}/client_pages?fields=id,access_token&limit=200&access_token=${systemToken}`,
      { cache: 'no-store' },
    );
    const data = await res.json() as { data?: Array<{ id: string; access_token?: string }>; error?: unknown };
    result.clientPagesTokens = { ok: res.ok, error: data.error, foundIds: (data.data ?? []).map(p => p.id) };
    const match = (data.data ?? []).find(p => p.id === PAGE_ID);
    pageToken = match?.access_token ?? null;
    result.pageTokenFound = !!pageToken;
  } catch (e) {
    result.clientPagesError = String(e);
  }

  if (!pageToken) {
    try {
      const res = await fetch(
        `${GRAPH}/${bizId}/owned_pages?fields=id,access_token&limit=200&access_token=${systemToken}`,
        { cache: 'no-store' },
      );
      const data = await res.json() as { data?: Array<{ id: string; access_token?: string }> };
      const match = (data.data ?? []).find(p => p.id === PAGE_ID);
      pageToken = match?.access_token ?? null;
      result.pageTokenFoundInOwned = !!pageToken;
    } catch (e) {
      result.ownedPagesError = String(e);
    }
  }

  if (pageToken) {
    try {
      const res = await fetch(
        `${GRAPH}/${PAGE_ID}?fields=id,name,instagram_business_account{id,username}&access_token=${pageToken}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      result.pageInfoViaPageToken = { ok: res.ok, data };
    } catch (e) {
      result.pageInfoError = String(e);
    }
  }

  return NextResponse.json(result);
}
