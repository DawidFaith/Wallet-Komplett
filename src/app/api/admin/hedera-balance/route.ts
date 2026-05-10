import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.MIGRATION_SECRET ?? 'admin123';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  if (!operatorId) return NextResponse.json({ error: 'HEDERA_OPERATOR_ID fehlt' }, { status: 503 });

  const configuredTokenIds = [
    process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID,
  ].filter(Boolean) as string[];

  try {
    const res = await fetch(
      `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${operatorId}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    const hbar = (data?.balance?.balance ?? 0) / 1e8;
    const balanceTokens: { token_id: string; balance: number }[] = data?.balance?.tokens ?? [];

    const tokens = await Promise.all(
      configuredTokenIds.map(async (tid) => {
        const tok = balanceTokens.find(t => t.token_id === tid);
        const tRes = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/tokens/${tid}`, { cache: 'no-store' });
        const tData = await tRes.json();
        const decimals = parseInt(tData.decimals ?? '2');
        const balance = tok ? tok.balance / Math.pow(10, decimals) : 0;
        return { tokenId: tid, balance, name: tData.name ?? tid, symbol: tData.symbol ?? 'TOKEN', decimals };
      }),
    );

    return NextResponse.json({
      hbar,
      tokens,
      // backwards-compat
      tokenBalance: tokens[0]?.balance ?? null,
      tokenDecimals: tokens[0]?.decimals ?? 2,
      tokenId: tokens[0]?.tokenId ?? null,
      operatorId,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 });
  }
}
