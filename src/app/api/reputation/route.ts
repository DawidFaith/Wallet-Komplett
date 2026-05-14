import { NextRequest, NextResponse } from 'next/server';
import { getUserReputation, getUserReputationAll } from '../../lib/questDb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  const artistWallet = searchParams.get('artistWallet');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }

  try {
    if (artistWallet) {
      const rep = await getUserReputation(wallet, artistWallet);
      return NextResponse.json(rep);
    } else {
      const all = await getUserReputationAll(wallet);
      return NextResponse.json(all);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
