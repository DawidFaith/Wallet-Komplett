import { NextRequest, NextResponse } from 'next/server';
import { startGiveawayEntry, getPublicGiveawayCampaign, markGiveawayEntryVerified, type GiveawayPlatform } from '../../../lib/questDb';
import { checkGiveawayEntryComment } from '../../../lib/giveawayEntryCheck';

export const maxDuration = 30;

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
  const entry = result.entry;

  // Bereits früher verifiziert/gutgeschrieben (z.B. erneuter Aufruf) — direkt zurückgeben
  if (entry.status !== 'pending') {
    return NextResponse.json({
      entryId: entry.id,
      verified: true,
      credited: entry.status === 'credited',
      alreadyProcessed: true,
      message: entry.status === 'credited'
        ? 'Du hast bereits Credits für diese Teilnahme erhalten.'
        : 'Verifiziert! Melde dich im D.FAITH Ecosystem an und verknüpfe diesen Account, um deine Credits automatisch gutgeschrieben zu bekommen.',
    });
  }

  const campaign = await getPublicGiveawayCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden' }, { status: 404 });

  let found = false;
  try {
    found = await checkGiveawayEntryComment(campaign, entry);
  } catch (e) {
    console.error('[giveaways/enter] Verifikations-Fehler:', e);
  }

  if (!found) {
    // Instagram/TikTok/YouTube: reicht das Kommentar-Wort der Kampagne — kein eigener Code nötig.
    // Facebook: Autor:in nicht zuverlässig prüfbar, daher eigener Code pro Teilnahme.
    return NextResponse.json({
      entryId: entry.id,
      verified: false,
      code: entry.platform === 'facebook' ? entry.code : undefined,
      requiredText: entry.platform === 'facebook' ? undefined : campaign.requiredText,
    });
  }

  const markResult = await markGiveawayEntryVerified(entry.id);
  return NextResponse.json({
    entryId: entry.id,
    verified: true,
    credited: markResult.status === 'credited',
    message: markResult.status === 'credited'
      ? `Verifiziert! Du hast ${markResult.amount} D.FAITH Credits erhalten.`
      : 'Verifiziert! Melde dich im D.FAITH Ecosystem an und verknüpfe diesen Account, um deine Credits automatisch gutgeschrieben zu bekommen.',
  });
}
