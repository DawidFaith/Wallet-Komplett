import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getGiveawayEntry, getPublicGiveawayCampaign, markGiveawayEntryVerified } from '../../../lib/questDb';
import { verifyInstagramEntry, verifyTiktokEntry, verifyYoutubeEntry, verifyFacebookEntry } from '../../../lib/giveawayVerify';

export const maxDuration = 30;

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
  const platformCfg = campaign.platforms.find(p => p.platform === entry.platform);
  if (!platformCfg) return NextResponse.json({ error: 'Plattform nicht konfiguriert' }, { status: 400 });

  let found = false;
  try {
    if (entry.platform === 'instagram') {
      const mediaId = platformCfg.mediaId;
      if (!mediaId) return NextResponse.json({ error: 'Instagram-Post nicht auflösbar.' }, { status: 500 });
      found = await verifyInstagramEntry(mediaId, entry.handle, entry.code);
    } else if (entry.platform === 'tiktok') {
      found = await verifyTiktokEntry(platformCfg.mediaId ?? platformCfg.postUrl, entry.handle, entry.code);
    } else if (entry.platform === 'youtube') {
      found = await verifyYoutubeEntry(platformCfg.mediaId ?? platformCfg.postUrl, entry.handle, entry.code);
    } else if (entry.platform === 'facebook') {
      const sql = getDb();
      const rows = await sql`SELECT facebook_page_id FROM user_profiles WHERE wallet_address = ${campaign.artistWallet.toLowerCase()} LIMIT 1`;
      const pageIdHint = (rows[0]?.facebook_page_id as string | null) ?? null;
      found = await verifyFacebookEntry(platformCfg.postUrl, entry.code, pageIdHint);
    }
  } catch (e) {
    console.error('[giveaways/verify]', e);
    return NextResponse.json({ error: 'Verifikation momentan nicht möglich. Bitte später erneut versuchen.' }, { status: 502 });
  }

  if (!found) {
    return NextResponse.json({
      verified: false,
      message: `Kein Kommentar mit dem Code "${entry.code}" von @${entry.handle} gefunden. Kommentiere den Code unter dem Beitrag und versuche es erneut (kann 1-2 Minuten dauern).`,
    });
  }

  const result = await markGiveawayEntryVerified(entryId);
  if (result.status === 'credited') {
    return NextResponse.json({
      verified: true,
      credited: true,
      message: `Verifiziert! Du hast ${result.amount} D.FAITH Credits erhalten.`,
    });
  }
  return NextResponse.json({
    verified: true,
    credited: false,
    message: 'Verifiziert! Melde dich im D.FAITH Ecosystem an und verknüpfe diesen Account, um deine Credits automatisch gutgeschrieben zu bekommen.',
  });
}
