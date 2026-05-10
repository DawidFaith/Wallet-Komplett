/**
 * GET /api/solana/jupiter-quote
 * Query: inputMint, outputMint, amount (in human units), decimals
 * Proxy zu Jupiter Quote API v6 – vermeidet CORS vom Client
 */
import { NextResponse } from 'next/server';

const JUPITER_QUOTE  = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const inputMint  = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount     = searchParams.get('amount');      // raw lamports / base units
  const slippage   = searchParams.get('slippage') ?? '50'; // bps (0.5%)

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json({ error: 'inputMint, outputMint, amount benötigt' }, { status: 400 });
  }

  const url = `${JUPITER_QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage}&onlyDirectRoutes=false`;

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (JUPITER_API_KEY) headers['Authorization'] = `Bearer ${JUPITER_API_KEY}`;

    console.log('[jupiter-quote] →', url);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });

    // Versuche immer JSON zu parsen, auch bei Fehler-Responses
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { data = { rawBody: text }; }

    console.log('[jupiter-quote] ← status:', res.status, '| body:', text.slice(0, 300));

    // Jupiter gibt 400 zurück wenn keine Route gefunden wurde
    if (res.status === 400) {
      const errCode = (data?.errorCode as string) ?? '';
      if (errCode === 'TOKEN_NOT_TRADABLE' || errCode === 'COULD_NOT_FIND_ANY_ROUTE') {
        return NextResponse.json(
          { error: 'Kein Liquiditätspool gefunden. D.FAITH muss erst auf Raydium gelistet werden.', errorCode: errCode },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: (data?.error as string) ?? 'Kein Swap-Route gefunden', errorCode: errCode, detail: text.slice(0, 500) }, { status: 404 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: (data?.error as string) ?? 'Jupiter API Fehler', status: res.status, detail: text.slice(0, 500) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Netzwerkfehler';
    console.error('[jupiter-quote] catch:', msg);
    return NextResponse.json({ error: `Jupiter nicht erreichbar: ${msg}` }, { status: 502 });
  }
}
