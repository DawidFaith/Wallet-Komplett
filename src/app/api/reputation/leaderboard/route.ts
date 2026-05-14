import { NextRequest, NextResponse } from 'next/server';
import { getReputationLeaderboard } from '../../../lib/questDb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');
  const limit = Number(searchParams.get('limit') || '50');

  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet parameter required' }, { status: 400 });
  }

  try {
    const leaderboard = await getReputationLeaderboard(artistWallet, limit);
    return NextResponse.json(leaderboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
