import { NextRequest, NextResponse } from 'next/server';
import { startGiveawayEntry, getPublicGiveawayCampaign, markGiveawayEntryVerified, type GiveawayPlatform } from '../../../lib/questDb';
import { checkGiveawayEntryComment } from '../../../lib/giveawayEntryCheck';
import { sendGiveawaySignupInviteEmail } from '../../../lib/email';

export const maxDuration = 30;

const DUPLICATE_EMAIL_MESSAGE = 'Mit dieser E-Mail-Adresse wurde bereits eine Belohnung für dieses Gewinnspiel beansprucht.';
const PENDING_SIGNUP_MESSAGE = 'Verifiziert! Melde dich im D.FAITH Ecosystem an und verknüpfe diesen Account, um deine Credits automatisch gutgeschrieben zu bekommen. Wir haben dir außerdem eine E-Mail mit den nächsten Schritten geschickt.';

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

  // Bereits früher verifiziert/gutgeschrieben/abgelehnt (z.B. erneuter Aufruf) — direkt zurückgeben
  if (entry.status !== 'pending') {
    if (entry.status === 'rejected') {
      return NextResponse.json({ entryId: entry.id, verified: false, error: DUPLICATE_EMAIL_MESSAGE, duplicateEmail: true }, { status: 400 });
    }
    return NextResponse.json({
      entryId: entry.id,
      verified: true,
      credited: entry.status === 'credited',
      alreadyProcessed: true,
      message: entry.status === 'credited'
        ? 'Du hast bereits Credits für diese Teilnahme erhalten.'
        : PENDING_SIGNUP_MESSAGE,
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

  if (markResult.status === 'duplicate_email') {
    return NextResponse.json({ entryId: entry.id, verified: false, error: DUPLICATE_EMAIL_MESSAGE, duplicateEmail: true }, { status: 400 });
  }

  if (markResult.status === 'verified') {
    // Wichtig: await'en statt fire-and-forget — Vercel kann die Serverless-Funktion
    // beenden, sobald die Response raus ist, und würde den Mailversand sonst abwürgen.
    try {
      await sendGiveawaySignupInviteEmail({
        toEmail: entry.email,
        campaignTitle: campaign.title,
        platform: entry.platform,
        handle: entry.handle,
        creditReward: campaign.creditReward,
      });
    } catch (e) {
      console.error('[giveaways/enter] Einladungsmail fehlgeschlagen:', e);
    }
  }

  return NextResponse.json({
    entryId: entry.id,
    verified: true,
    credited: markResult.status === 'credited',
    message: markResult.status === 'credited'
      ? `Verifiziert! Du hast ${markResult.amount} D.FAITH Credits erhalten.`
      : PENDING_SIGNUP_MESSAGE,
  });
}
