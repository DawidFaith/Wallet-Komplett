import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import {
  getActiveReputationContest,
  upsertReputationContest,
  distributeReputationContest,
  getContestLeaderboard,
} from '../../../lib/questDb';

/** GET /api/reputation/contest?artistWallet=... */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');
  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet required' }, { status: 400 });
  }
  try {
    const contest = await getActiveReputationContest(artistWallet);
    if (!contest) return NextResponse.json(null);
    const contestLeaderboard = await getContestLeaderboard(contest.id, artistWallet, 50);

    // Clerk-Profilbilder + Namen anreichern (wie reguläre Leaderboard-Route)
    const clerkData: Record<string, { name: string; imageUrl: string }> = {};
    const ids = contestLeaderboard.map(e => e.walletAddress);
    if (ids.length > 0) {
      try {
        const clerk = await clerkClient();
        const idSet = new Set(ids);
        let offset = 0;
        const pageSize = 100;
        while (true) {
          const { data: batch, totalCount } = await clerk.users.getUserList({ limit: pageSize, offset });
          for (const u of batch) {
            const lcId = u.id.toLowerCase();
            if (idSet.has(lcId)) {
              const name = u.fullName ?? u.username ?? u.firstName ?? u.emailAddresses[0]?.emailAddress?.split('@')[0] ?? null;
              clerkData[lcId] = { name: name ?? u.id, imageUrl: u.imageUrl };
            }
          }
          if (batch.length < pageSize || offset + batch.length >= totalCount) break;
          offset += pageSize;
        }
      } catch { /* Clerk optional */ }
    }

    const enrichedLeaderboard = contestLeaderboard.map(e => ({
      ...e,
      displayName: clerkData[e.walletAddress]?.name ?? e.displayName,
      imageUrl: clerkData[e.walletAddress]?.imageUrl ?? null,
    }));

    return NextResponse.json({ ...contest, contestLeaderboard: enrichedLeaderboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/reputation/contest – Contest erstellen */
export async function POST(req: NextRequest) {
  try {
    const body: {
      artistWallet?: string;
      endDate?: string;
      prizes?: { rank: number; creditReward: number; shardReward?: number }[];
      title?: string;
      imageUrl?: string;
    } = await req.json();

    const { artistWallet, endDate, prizes, title, imageUrl } = body;
    if (!artistWallet || !endDate || !Array.isArray(prizes)) {
      return NextResponse.json({ error: 'artistWallet, endDate und prizes sind erforderlich' }, { status: 400 });
    }

    const end = new Date(endDate);
    if (isNaN(end.getTime()) || end <= new Date()) {
      return NextResponse.json({ error: 'endDate muss in der Zukunft liegen' }, { status: 400 });
    }

    const validPrizes = prizes
      .filter(p => p.rank >= 1 && (p.creditReward >= 0 || (p.shardReward ?? 0) >= 0))
      .map(p => ({ rank: Math.round(p.rank), creditReward: Math.max(0, Math.round(p.creditReward)), shardReward: Math.max(0, Math.round(p.shardReward ?? 0)) }));

    const contestId = await upsertReputationContest(artistWallet, end, validPrizes, title?.trim() || null, imageUrl || null);
    return NextResponse.json({ success: true, contestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/reputation/contest/distribute – Rewards verteilen */
export async function PUT(req: NextRequest) {
  try {
    const body: { contestId?: string; artistWallet?: string; force?: boolean } = await req.json();
    const { contestId, artistWallet, force } = body;
    if (!contestId || !artistWallet) {
      return NextResponse.json({ error: 'contestId und artistWallet erforderlich' }, { status: 400 });
    }

    const results = await distributeReputationContest(contestId, artistWallet, force === true);
    return NextResponse.json({ success: true, distributed: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
