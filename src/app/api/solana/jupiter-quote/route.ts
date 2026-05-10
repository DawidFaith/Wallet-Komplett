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
    const res  = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return NextResponse.json({ error: data?.error ?? 'Jupiter API Fehler' }, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Netzwerkfehler' }, { status: 502 });
  }
}
