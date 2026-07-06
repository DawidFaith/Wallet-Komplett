import { NextRequest, NextResponse } from 'next/server';
import { confirmConcertAttendees } from '@/app/lib/questDb';

/** POST /api/concerts/confirm */
export async function POST(req: NextRequest) {
  try {
    const { eventId, artistWallet, walletAddresses } = await req.json();
    if (!eventId || !artistWallet || !Array.isArray(walletAddresses)) {
      return NextResponse.json({ error: 'eventId, artistWallet, walletAddresses erforderlich' }, { status: 400 });
    }
    const result = await confirmConcertAttendees(eventId, artistWallet, walletAddresses);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
