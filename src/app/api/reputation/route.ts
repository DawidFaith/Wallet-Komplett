import { NextRequest, NextResponse } from 'next/server';
import { getUserReputation, getUserReputationAll, getAllArtistsWithReputation } from '../../lib/questDb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  const artistWallet = searchParams.get('artistWallet');
  const all = searchParams.get('all');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }

  try {
    if (all === 'true') {
      const result = await getAllArtistsWithReputation(wallet);
      return NextResponse.json(result);
    } else if (artistWallet) {
      const rep = await getUserReputation(wallet, artistWallet);
      return NextResponse.json(rep);
    } else {
      const result = await getUserReputationAll(wallet);
      return NextResponse.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
