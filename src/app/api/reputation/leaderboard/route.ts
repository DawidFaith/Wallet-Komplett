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

    // Clerk-Namen + Bilder für alle Einträge abrufen.
    // DB speichert wallet_address als lowercase, Clerk-IDs können aber Großbuchstaben
    // enthalten → getUserList({ userId: lowercaseIds }) findet nichts.
    // Lösung: alle User paginiert laden und per lowercase-Vergleich matchen.
    const ids = leaderboard.map((e) => e.walletAddress);
    const clerkData: Record<string, { name: string; imageUrl: string }> = {};
    if (ids.length > 0) {
      const clerk = await clerkClient();
      const idSet = new Set(ids);
      let offset = 0;
      const pageSize = 100;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: batch, totalCount } = await clerk.users.getUserList({ limit: pageSize, offset });
        for (const u of batch) {
          const lcId = u.id.toLowerCase();
          if (idSet.has(lcId)) {
            const name =
              u.fullName ??
              u.username ??
              u.firstName ??
              u.emailAddresses[0]?.emailAddress?.split('@')[0] ??
              null;
            clerkData[lcId] = { name, imageUrl: u.imageUrl };
          }
        }
        if (batch.length < pageSize || offset + batch.length >= totalCount) break;
        offset += pageSize;
      }
    }

    const enriched = leaderboard.map((e) => ({
      ...e,
      // Priorität: Clerk-Name → DB-Profilname (Instagram etc.) → null (UI zeigt shortenWallet)
      displayName: clerkData[e.walletAddress]?.name ?? e.displayName ?? null,
      imageUrl: clerkData[e.walletAddress]?.imageUrl ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
