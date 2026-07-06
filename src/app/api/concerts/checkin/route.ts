import { NextRequest, NextResponse } from 'next/server';
import { checkinConcert } from '@/app/lib/questDb';

/** POST /api/concerts/checkin */
export async function POST(req: NextRequest) {
  try {
    const { eventId, walletAddress } = await req.json();
    if (!eventId || !walletAddress) return NextResponse.json({ error: 'eventId und walletAddress erforderlich' }, { status: 400 });
    const result = await checkinConcert(eventId, walletAddress);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
