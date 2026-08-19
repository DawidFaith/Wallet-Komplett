import { NextRequest, NextResponse } from 'next/server';
import {
  getAllUndistributedContests,
  getArtistsWithQuarterlyConfig,
  distributeReputationContest,
  distributeLeaderboardQuarterly,
} from '../../../lib/questDb';

export const maxDuration = 60;

/**
 * GET /api/cron/reputation-distribute (täglich)
 *
 * Sicherheitsnetz zusätzlich zum Lazy-Auto-Distribute in den GET-Routen von
 * /api/reputation/contest und /api/reputation/leaderboard-quarterly: falls
 * nach Ablauf eines Contests/Quartals niemand (weder Artist noch Fan) die
 * jeweilige Seite öffnet, greift hier spätestens einmal täglich die
 * Verteilung. distributeReputationContest/distributeLeaderboardQuarterly
 * prüfen selbst, ob das jeweilige Ende schon erreicht bzw. schon verteilt
 * wurde — hier wird einfach für jeden Kandidaten versucht und "läuft
 * noch"/"bereits verteilt" stillschweigend übersprungen.
 */
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = req.nextUrl.searchParams.get('secret');
  return !!secret && secret === process.env.MIGRATION_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const contestsDistributed: string[] = [];
  const contestErrors: string[] = [];
  const contests = await getAllUndistributedContests();
  for (const c of contests) {
    try {
      await distributeReputationContest(c.id, c.artistWallet);
      contestsDistributed.push(c.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'Contest läuft noch' && msg !== 'Bereits verteilt') contestErrors.push(`${c.id}: ${msg}`);
    }
  }

  const quarterlyDistributed: string[] = [];
  const quarterlyErrors: string[] = [];
  const artists = await getArtistsWithQuarterlyConfig();
  for (const artistWallet of artists) {
    try {
      const result = await distributeLeaderboardQuarterly(artistWallet);
      quarterlyDistributed.push(`${artistWallet}:${result.quarter}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('läuft noch') && !msg.includes('bereits verteilt')) quarterlyErrors.push(`${artistWallet}: ${msg}`);
    }
  }

  if (contestErrors.length > 0) console.error('[cron/reputation-distribute] Contest-Fehler:', contestErrors);
  if (quarterlyErrors.length > 0) console.error('[cron/reputation-distribute] Quartals-Fehler:', quarterlyErrors);

  return NextResponse.json({
    contestsDistributed,
    quarterlyDistributed,
    contestErrors,
    quarterlyErrors,
  });
}
