import { NextRequest, NextResponse } from 'next/server';
import { startGiveawayEntry, getPublicGiveawayCampaign, markGiveawayEntryVerified, type GiveawayPlatform } from '../../../lib/questDb';
import { checkGiveawayEntryComment } from '../../../lib/giveawayEntryCheck';
import { sendGiveawayParticipationEmail } from '../../../lib/email';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { campaignId?: string; platform?: string; handle?: string; email?: string; consent?: boolean; lang?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body', errorCode: 'invalid_body' }, { status: 400 }); }

  const { campaignId, platform, handle, email, consent, lang } = body;
  if (!campaignId || !platform || !handle || !email) {
    return NextResponse.json({ error: 'campaignId, platform, handle und email sind erforderlich.', errorCode: 'missing_fields' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.', errorCode: 'invalid_email' }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ error: 'Zustimmung zu den Teilnahmebedingungen und Datenschutzhinweisen ist erforderlich.', errorCode: 'consent_required' }, { status: 400 });
  }
  const entryLang = lang === 'en' || lang === 'pl' ? lang : 'de';

  const result = await startGiveawayEntry(campaignId, platform as GiveawayPlatform, handle, email, entryLang);
  if ('error' in result) return NextResponse.json({ error: result.error, errorCode: result.code }, { status: 400 });
  const entry = result.entry;

  const campaign = await getPublicGiveawayCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden', errorCode: 'not_found' }, { status: 404 });

  // Bereits früher verifiziert/gutgeschrieben/abgelehnt (z.B. erneuter Aufruf) — direkt zurückgeben
  if (entry.status !== 'pending') {
    if (entry.status === 'rejected') {
      return NextResponse.json({ entryId: entry.id, verified: false, errorCode: 'already_participated', duplicateEmail: true }, { status: 400 });
    }
    return NextResponse.json({
      entryId: entry.id,
      verified: true,
      credited: entry.status === 'credited',
      alreadyProcessed: true,
      amount: entry.status === 'credited' ? campaign.creditReward : undefined,
    });
  }

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
    return NextResponse.json({ entryId: entry.id, verified: false, errorCode: 'already_participated', duplicateEmail: true }, { status: 400 });
  }

  // Wichtig: await'en statt fire-and-forget — Vercel kann die Serverless-Funktion
  // beenden, sobald die Response raus ist, und würde den Mailversand sonst abwürgen.
  // Geht an jede erfolgreich verifizierte Teilnahme, nicht nur an unregistrierte.
  try {
    await sendGiveawayParticipationEmail({
      toEmail: entry.email,
      campaignTitle: campaign.title,
      platform: entry.platform,
      handle: entry.handle,
      creditReward: campaign.creditReward,
      credited: markResult.status === 'credited',
      releaseAt: campaign.releaseAt,
      presaveUrl: campaign.presaveUrl,
      lang: entry.lang,
    });
  } catch (e) {
    console.error('[giveaways/enter] Mailversand fehlgeschlagen:', e);
  }

  return NextResponse.json({
    entryId: entry.id,
    verified: true,
    credited: markResult.status === 'credited',
    amount: markResult.status === 'credited' ? markResult.amount : undefined,
  });
}
