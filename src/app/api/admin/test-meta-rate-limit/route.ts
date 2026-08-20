/**
 * TEMPORÄR — Diagnose-Route zum Testen der Meta Page-Level-Rate-Limit-Formel
 * (4800 × Engaged Users / 24h). Liest die von Meta selbst zurückgegebenen
 * x-page-usage / x-business-use-case-usage / x-app-usage Header aus einem
 * echten Graph-API-Call plus den aktuellen page_engaged_users-Insight-Wert,
 * damit man beide Zahlen live gegeneinander prüfen kann. Nach dem Test
 * wieder löschen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPageAccessToken } from '../../../lib/metaApi';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!pageId) {
    return NextResponse.json({ error: 'FACEBOOK_PAGE_ID nicht gesetzt' }, { status: 500 });
  }

  const pageToken = await getPageAccessToken();
  if (!pageToken) {
    return NextResponse.json({ error: 'Kein Page-Access-Token verfügbar' }, { status: 500 });
  }

  // 1) Echter Graph-API-Call gegen die Page → Usage-Header auslesen
  const usageRes = await fetch(
    `${GRAPH}/${pageId}?fields=id,name&access_token=${pageToken}`,
    { cache: 'no-store' },
  );
  const usageJson = await usageRes.json().catch(() => null);
  const headers = {
    xPageUsage: usageRes.headers.get('x-page-usage'),
    xAppUsage: usageRes.headers.get('x-app-usage'),
    xBusinessUseCaseUsage: usageRes.headers.get('x-business-use-case-usage'),
  };

  // 2) Aktuelle Engaged-Users-Zahl (Insights) für den Formel-Abgleich
  const insightsRes = await fetch(
    `${GRAPH}/${pageId}/insights?metric=page_engaged_users&period=day&access_token=${pageToken}`,
    { cache: 'no-store' },
  );
  const insightsJson = await insightsRes.json().catch(() => null);

  return NextResponse.json({
    pageId,
    graphCallResult: usageJson,
    usageHeaders: headers,
    engagedUsersInsight: insightsJson,
    hinweis: 'x-page-usage.call_count ist der % genutzte Anteil des 4800×EngagedUsers-Budgets der letzten 24h. Vergleiche das mit dem engagedUsersInsight-Wert.',
  });
}
