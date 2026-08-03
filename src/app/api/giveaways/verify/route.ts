import { NextRequest, NextResponse } from 'next/server';
import { getGiveawayEntry, getPublicGiveawayCampaign, markGiveawayEntryVerified } from '../../../lib/questDb';
import { checkGiveawayEntryComment } from '../../../lib/giveawayEntryCheck';

export const maxDuration = 30;

/**
 * Erneute Prüfung einer bestehenden Teilnahme (z.B. nachdem der Fan den
 * Facebook-Code kommentiert hat, oder ein "Erneut prüfen"-Klick bei
 * Instagram/TikTok/YouTube, falls der Kommentar beim ersten Versuch noch
 * nicht gefunden wurde).
 */
export async function POST(req: NextRequest) {
  let body: { entryId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 }); }

  const { entryId } = body;
  if (!entryId) return NextResponse.json({ error: 'entryId erforderlich' }, { status: 400 });

  const entry = await getGiveawayEntry(entryId);
  if (!entry) return NextResponse.json({ error: 'Teilnahme nicht gefunden' }, { status: 404 });
  if (entry.status !== 'pending') {
    return NextResponse.json({ error: 'Diese Teilnahme wurde bereits verifiziert.' }, { status: 400 });
  }

  const campaign = await getPublicGiveawayCampaign(entry.campaignId);
  if (!campaign) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden' }, { status: 404 });
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Dieses Gewinnspiel ist bereits beendet.' }, { status: 400 });
  }

  let found = false;
  try {
    found = await checkGiveawayEntryComment(campaign, entry);
  } catch (e) {
    console.error('[giveaways/verify]', e);
    return NextResponse.json({ error: 'Verifikation momentan nicht möglich. Bitte später erneut versuchen.' }, { status: 502 });
  }

  if (!found) {
    return NextResponse.json({
      verified: false,
      code: entry.platform === 'facebook' ? entry.code : undefined,
      requiredText: entry.platform === 'facebook' ? undefined : campaign.requiredText,
    });
  }

  const result = await markGiveawayEntryVerified(entryId);
  return NextResponse.json({
    verified: true,
    credited: result.status === 'credited',
    message: result.status === 'credited'
      ? `Verifiziert! Du hast ${result.amount} D.FAITH Credits erhalten.`
      : 'Verifiziert! Melde dich im D.FAITH Ecosystem an und verknüpfe diesen Account, um deine Credits automatisch gutgeschrieben zu bekommen.',
  });
}
