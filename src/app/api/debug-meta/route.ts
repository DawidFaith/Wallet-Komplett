/**
 * GET /api/debug-meta
 * Zeigt, welche Meta Businesses & Pages der System-User-Token sehen kann.
 * Nur für lokale Entwicklung – in Produktion deaktivieren.
 */
import { NextRequest, NextResponse } from 'next/server';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function GET(_req: NextRequest) {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return NextResponse.json({ error: 'META_SYSTEM_USER_TOKEN fehlt' }, { status: 500 });

  const [meRes, businessRes] = await Promise.all([
    fetch(`${GRAPH}/me?fields=id,name&access_token=${token}`, { cache: 'no-store' }),
    fetch(`${GRAPH}/me/businesses?fields=id,name&access_token=${token}`, { cache: 'no-store' }),
  ]);

  const me       = await meRes.json();
  const business = await businessRes.json();

  // Wenn Businesses gefunden – Pages des ersten Business laden
  let pages = null;
  const firstBizId = business?.data?.[0]?.id;
  if (firstBizId) {
    const pRes = await fetch(
      `${GRAPH}/${firstBizId}/pages?fields=id,name,username&access_token=${token}`,
      { cache: 'no-store' },
    );
    pages = await pRes.json();
  }

  // Owned Instagram Accounts des ersten Business laden
  let igAccounts = null;
  if (firstBizId) {
    const igRes = await fetch(
      `${GRAPH}/${firstBizId}/instagram_accounts?fields=id,username&access_token=${token}`,
      { cache: 'no-store' },
    );
    igAccounts = await igRes.json();
  }

  return NextResponse.json({
    currentEnvBusinessId: process.env.META_BUSINESS_ID ?? '(leer)',
    facebookPageId: process.env.FACEBOOK_PAGE_ID ?? '(leer)',
    me,
    businesses: business,
    pagesOfFirstBusiness: pages,
    igAccountsOfFirstBusiness: igAccounts,
  });
}
