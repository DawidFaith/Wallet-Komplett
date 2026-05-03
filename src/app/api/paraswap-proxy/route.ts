import { NextRequest, NextResponse } from 'next/server';

const PARASWAP_BASE = 'https://apiv5.paraswap.io';

/**
 * Proxy für ParaSwap API – löst CORS + Rate-Limit-Probleme.
 *
 * GET  /api/paraswap-proxy?path=prices&srcToken=...&...
 * POST /api/paraswap-proxy?path=transactions%2F8453   (Body wird durchgeleitet)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get('path') ?? 'prices';

  // "path" aus den Parametern entfernen, Rest weiterleiten
  const forward = new URLSearchParams(searchParams);
  forward.delete('path');

  const upstreamUrl = `${PARASWAP_BASE}/${path}?${forward.toString()}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'DawidFaithWallet/1.0' },
      // kein Cache – wir wollen frische Quotes
      cache: 'no-store',
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Proxy-Fehler' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get('path') ?? 'transactions/8453';

  const upstreamUrl = `${PARASWAP_BASE}/${path}`;

  try {
    const bodyText = await req.text();
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DawidFaithWallet/1.0',
      },
      body: bodyText,
      cache: 'no-store',
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Proxy-Fehler' }, { status: 502 });
  }
}
