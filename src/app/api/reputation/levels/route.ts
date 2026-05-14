import { NextRequest, NextResponse } from 'next/server';
import { getReputationLevels, saveReputationLevels, ReputationLevel } from '../../../lib/questDb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');

  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet parameter required' }, { status: 400 });
  }

  try {
    const levels = await getReputationLevels(artistWallet);
    return NextResponse.json(levels);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: { artistWallet?: string; levels?: ReputationLevel[] } = await req.json();
    const { artistWallet, levels } = body;

    if (!artistWallet || !Array.isArray(levels)) {
      return NextResponse.json({ error: 'artistWallet and levels required' }, { status: 400 });
    }

    await saveReputationLevels(artistWallet, levels);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
