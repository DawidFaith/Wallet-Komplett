/**
 * GET /api/hedera/balance?accountId=0.0.12345&tokenId=0.0.99999
 * Liest Balances über Hedera Mirror Node (kein API-Key nötig).
 */
import { NextRequest, NextResponse } from 'next/server';

const MIRROR = 'https://mainnet-public.mirrornode.hedera.com/api/v1';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const tokenId   = req.nextUrl.searchParams.get('tokenId');

  if (!accountId || !/^\d+\.\d+\.\d+$/.test(accountId)) {
    return NextResponse.json({ error: 'Ungültige accountId' }, { status: 400 });
  }

  try {
    // HBAR Balance
    const accRes = await fetch(`${MIRROR}/accounts/${accountId}`, {
      next: { revalidate: 10 },
    });
    if (!accRes.ok) {
      return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 });
    }
    const accData = await accRes.json();
    const hbarBalance = (accData.balance?.balance ?? 0) / 1e8; // tinybars → HBAR

    // Token Balance (optional)
    let tokenBalance: number | null = null;
    let tokenDecimals = 2;

    if (tokenId && /^\d+\.\d+\.\d+$/.test(tokenId)) {
      const tokRes = await fetch(`${MIRROR}/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`, {
        next: { revalidate: 10 },
      });
      if (tokRes.ok) {
        const tokData = await tokRes.json();
        const entry = tokData.tokens?.[0];
        if (entry) {
          tokenDecimals = entry.decimals ?? 2;
          tokenBalance  = (entry.balance ?? 0) / Math.pow(10, tokenDecimals);
        }
      }
    }

    return NextResponse.json({ hbarBalance, tokenBalance, tokenDecimals });
  } catch (err) {
    console.error('[hedera/balance]', err);
    return NextResponse.json({ error: 'Netzwerkfehler' }, { status: 502 });
  }
}
