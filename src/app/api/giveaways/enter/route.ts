import { NextRequest, NextResponse } from 'next/server';
import { startGiveawayEntry, type GiveawayPlatform } from '../../../lib/questDb';

export async function POST(req: NextRequest) {
  let body: { campaignId?: string; platform?: string; handle?: string; email?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 }); }

  const { campaignId, platform, handle, email } = body;
  if (!campaignId || !platform || !handle || !email) {
    return NextResponse.json({ error: 'campaignId, platform, handle und email sind erforderlich.' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  }

  const result = await startGiveawayEntry(campaignId, platform as GiveawayPlatform, handle, email);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    entryId: result.entry.id,
    code: result.entry.code,
    status: result.entry.status,
  });
}
