import { NextRequest, NextResponse } from 'next/server';
import { distributeLeaderboardRewards } from '@/app/lib/questDb';

export async function POST(req: NextRequest) {
  try {
    const { artistWallet, prizes } = await req.json();
    if (!artistWallet || !Array.isArray(prizes) || prizes.length === 0) {
      return NextResponse.json({ error: 'artistWallet und prizes erforderlich' }, { status: 400 });
    }
    const validPrizes = prizes.filter(
      (p: { rank: number; creditReward: number; shardReward?: number }) =>
        typeof p.rank === 'number' && (p.creditReward > 0 || (p.shardReward ?? 0) > 0),
    );
    if (validPrizes.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein Preis > 0 erforderlich' }, { status: 400 });
    }
    const distributed = await distributeLeaderboardRewards(artistWallet, validPrizes);
    return NextResponse.json({ distributed });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
