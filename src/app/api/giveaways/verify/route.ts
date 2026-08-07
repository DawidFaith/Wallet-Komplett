import { NextRequest, NextResponse } from 'next/server';
import { getGiveawayEntry, getPublicGiveawayCampaign, markGiveawayEntryVerified } from '../../../lib/questDb';
import { checkGiveawayEntryComment } from '../../../lib/giveawayEntryCheck';
import { sendGiveawayParticipationEmail } from '../../../lib/email';

// Für die Dawid-Faith-Page läuft Facebook wie die anderen Plattformen (nur
// Stichwort, kein individueller Code) — siehe giveawayVerify.ts.
const DAWID_FAITH_ARTIST_WALLET = 'user_3dfvunr7ziaywue8bhzdqw2blsw';

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
  catch { return NextResponse.json({ error: 'Ungültiger Request Body', errorCode: 'invalid_body' }, { status: 400 }); }

  const { entryId } = body;
  if (!entryId) return NextResponse.json({ error: 'entryId erforderlich', errorCode: 'missing_fields' }, { status: 400 });

  const entry = await getGiveawayEntry(entryId);
  if (!entry) return NextResponse.json({ error: 'Teilnahme nicht gefunden', errorCode: 'not_found' }, { status: 404 });
  if (entry.status === 'rejected') {
    return NextResponse.json({ verified: false, errorCode: 'already_participated', duplicateEmail: true }, { status: 400 });
  }
  if (entry.status !== 'pending') {
    return NextResponse.json({ error: 'Diese Teilnahme wurde bereits verifiziert.', errorCode: 'already_credited' }, { status: 400 });
  }

  const campaign = await getPublicGiveawayCampaign(entry.campaignId);
  if (!campaign) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden', errorCode: 'not_found' }, { status: 404 });
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Dieses Gewinnspiel ist bereits beendet.', errorCode: 'ended' }, { status: 400 });
  }

  let found = false;
  let verifiedName: string | undefined;
  try {
    const checkResult = await checkGiveawayEntryComment(campaign, entry);
    found = checkResult.found;
    verifiedName = checkResult.verifiedName;
  } catch (e) {
    console.error('[giveaways/verify]', e);
    return NextResponse.json({ error: 'Verifikation momentan nicht möglich. Bitte später erneut versuchen.', errorCode: 'verification_unavailable' }, { status: 502 });
  }

  if (!found) {
    const needsCode = entry.platform === 'facebook' && campaign.artistWallet.toLowerCase() !== DAWID_FAITH_ARTIST_WALLET;
    return NextResponse.json({
      verified: false,
      code: needsCode ? entry.code : undefined,
      requiredText: needsCode ? undefined : campaign.requiredText,
    });
  }

  const result = await markGiveawayEntryVerified(entryId, verifiedName);

  if (result.status === 'duplicate_email') {
    return NextResponse.json({ verified: false, errorCode: 'already_participated', duplicateEmail: true }, { status: 400 });
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
      credited: result.status === 'credited',
      releaseAt: campaign.releaseAt,
      presaveUrl: campaign.presaveUrl,
      lang: entry.lang,
    });
  } catch (e) {
    console.error('[giveaways/verify] Mailversand fehlgeschlagen:', e);
  }

  return NextResponse.json({
    verified: true,
    credited: result.status === 'credited',
    amount: result.status === 'credited' ? result.amount : undefined,
  });
}
