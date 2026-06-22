import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const rawKey = process.env.ARWEAVE_WALLET_KEY;
  if (!rawKey) {
    return NextResponse.json({ configured: false });
  }

  try {
    const { default: Arweave } = await import('arweave');
    const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
    const jwk     = JSON.parse(rawKey) as Parameters<typeof arweave.wallets.jwkToAddress>[0];
    const address = await arweave.wallets.jwkToAddress(jwk);
    const winston = await arweave.wallets.getBalance(address);
    const balanceAr = parseFloat(arweave.ar.winstonToAr(winston));
    return NextResponse.json({ configured: true, address, balanceAr });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String(e) }, { status: 500 });
  }
}
