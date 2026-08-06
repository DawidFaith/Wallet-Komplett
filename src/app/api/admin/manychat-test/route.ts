/**
 * GET /api/admin/manychat-test
 * Header: x-admin-secret
 *
 * Diagnose-Route: prüft, ob wir über den ManyChat API Key an Infos zu
 * Subscribern (Namen etc.) der Dawid-Faith-Page kommen — als Alternative
 * zum Meta Graph API Conversations-Zugriff, der aktuell nicht funktioniert.
 *
 * ?subscriberId=... testet gezielt einen bekannten Subscriber.
 * Ohne Parameter: nur ein Sanity-Check über /fb/page/getInfo.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MANYCHAT_API = 'https://api.manychat.com';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'MANYCHAT_API_KEY nicht gesetzt' }, { status: 500 });
  }

  const subscriberId = req.nextUrl.searchParams.get('subscriberId');
  const url = subscriberId
    ? `${MANYCHAT_API}/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`
    : `${MANYCHAT_API}/fb/page/getInfo`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
