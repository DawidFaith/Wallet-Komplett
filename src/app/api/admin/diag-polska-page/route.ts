/**
 * Temporärer Diagnose-Endpoint: prüft ob die Page "Die Melodiker" (109093575481784)
 * über das bestehende Meta-Business-Portfolio erreichbar ist und welchen
 * Instagram-Business-Account sie aktuell verknüpft hat.
 * Wird nach der Prüfung wieder gelöscht.
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

  try {
    const [ownedRes, clientRes] = await Promise.all([
      fetch(`${GRAPH}/${bizId}/owned_pages?fields=id,name&limit=200&access_token=${systemToken}`, { cache: 'no-store' }),
      fetch(`${GRAPH}/${bizId}/client_pages?fields=id,name&limit=200&access_token=${systemToken}`, { cache: 'no-store' }),
    ]);
    const owned = await ownedRes.json();
    const client = await clientRes.json();
    result.ownedPages = owned;
    result.clientPages = client;
    const inOwned = (owned.data ?? []).some((p: { id: string }) => p.id === PAGE_ID);
    const inClient = (client.data ?? []).some((p: { id: string }) => p.id === PAGE_ID);
    result.pageFoundInPortfolio = inOwned || inClient;
  } catch (e) {
    result.portfolioCheckError = String(e);
  }

  try {
    const res = await fetch(
      `${GRAPH}/${PAGE_ID}?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${systemToken}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    result.pageDirectAccess = { ok: res.ok, data };
  } catch (e) {
    result.pageDirectAccessError = String(e);
  }

  return NextResponse.json(result);
}
