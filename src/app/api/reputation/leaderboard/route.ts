import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
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

    // Clerk-Namen für alle Einträge abrufen
    const ids = leaderboard.map((e) => e.walletAddress);
    const clerkNames: Record<string, string> = {};
    if (ids.length > 0) {
      const clerk = await clerkClient();
      const { data: users } = await clerk.users.getUserList({ userId: ids, limit: ids.length });
      for (const u of users) {
        const name = u.fullName ?? u.username ?? null;
        if (name) clerkNames[u.id] = name;
      }
    }

    const enriched = leaderboard.map((e) => ({
      ...e,
      displayName: clerkNames[e.walletAddress] ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
