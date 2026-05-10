import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.MIGRATION_SECRET ?? 'admin123';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const tokenId    = process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID;
  if (!operatorId) return NextResponse.json({ error: 'HEDERA_OPERATOR_ID fehlt' }, { status: 503 });

  try {
    const res = await fetch(
      `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${operatorId}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    const hbar = (data?.balance?.balance ?? 0) / 1e8;

    let tokenBalance = null;
    let tokenDecimals = 2;
    if (tokenId) {
      const tok = (data?.balance?.tokens ?? []).find((t: { token_id: string }) => t.token_id === tokenId);
      if (tok) {
        // decimals holen
        const tdRes = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/tokens/${tokenId}`, { cache: 'no-store' });
        const tdData = await tdRes.json();
        tokenDecimals = parseInt(tdData.decimals ?? '2');
        tokenBalance = tok.balance / Math.pow(10, tokenDecimals);
      }
    }

    return NextResponse.json({ hbar, tokenBalance, tokenDecimals, operatorId, tokenId: tokenId || null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 });
  }
}
