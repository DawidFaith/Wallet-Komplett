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

    // Clerk-Namen + Bilder für alle Einträge abrufen
    const ids = leaderboard.map((e) => e.walletAddress);
    const clerkData: Record<string, { name: string; imageUrl: string }> = {};
    if (ids.length > 0) {
      const clerk = await clerkClient();
      const { data: users } = await clerk.users.getUserList({ userId: ids, limit: ids.length });
      for (const u of users) {
        const name =
          u.fullName ??
          u.username ??
          u.firstName ??
          u.emailAddresses[0]?.emailAddress?.split('@')[0] ??
          null;
        // Key als lowercase speichern damit er mit der DB-gespeicherten walletAddress übereinstimmt
        clerkData[u.id.toLowerCase()] = { name: name ?? u.id, imageUrl: u.imageUrl };
      }
    }

    const enriched = leaderboard.map((e) => ({
      ...e,
      displayName: clerkData[e.walletAddress]?.name ?? e.walletAddress,
      imageUrl: clerkData[e.walletAddress]?.imageUrl ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
