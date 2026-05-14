import { NextRequest, NextResponse } from 'next/server';
import {
  getLeaderboardQuarterlyConfig,
  upsertLeaderboardQuarterlyConfig,
  getLeaderboardQuarterlyHistory,
  distributeLeaderboardQuarterly,
  getQuarterInfo,
} from '@/app/lib/questDb';

// GET: Config + aktuelles Quartal + Historie laden
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');
  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
  }
  try {
    const [config, history] = await Promise.all([
      getLeaderboardQuarterlyConfig(artistWallet),
      getLeaderboardQuarterlyHistory(artistWallet),
    ]);
    const quarterInfo = getQuarterInfo();
    return NextResponse.json({ config, history, quarterInfo: { quarter: quarterInfo.quarter, start: quarterInfo.start.toISOString(), end: quarterInfo.end.toISOString() } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}

// POST: Konfiguration speichern
export async function POST(req: NextRequest) {
  try {
    const { artistWallet, prizes } = await req.json();
    if (!artistWallet || !Array.isArray(prizes)) {
      return NextResponse.json({ error: 'artistWallet und prizes erforderlich' }, { status: 400 });
    }
    await upsertLeaderboardQuarterlyConfig(artistWallet, prizes);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}

// PUT: Quartal verteilen
export async function PUT(req: NextRequest) {
  try {
    const { artistWallet, force } = await req.json();
    if (!artistWallet) {
      return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
    }
    const result = await distributeLeaderboardQuarterly(artistWallet, force === true);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
