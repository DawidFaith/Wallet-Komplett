/**
 * Temporärer Diagnose-Endpoint: zeigt Name/ID des Ziel-Business-Portfolios
 * (META_BUSINESS_ID), damit klar ist, welches Business "Die Melodiker"
 * per Partner-Freigabe erreichen muss. Wird danach wieder gelöscht.
 */
import { NextRequest, NextResponse } from 'next/server';

const GRAPH = 'https://graph.facebook.com/v21.0';

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

  try {
    const res = await fetch(`${GRAPH}/${bizId}?fields=id,name,primary_page&access_token=${systemToken}`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json({ businessId: bizId, businessInfo: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
