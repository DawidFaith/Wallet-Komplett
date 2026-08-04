import { NextRequest, NextResponse } from 'next/server';
import { getPublicGiveawayCampaign, getLatestGiveawayCampaignByArtist, getArtistWalletBySlug, getUserProfile } from '../../../../lib/questDb';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // Der öffentliche Link ist entweder eine konkrete Kampagnen-ID (gw_...), der
  // Namens-Slug eines Artists (z.B. "dawid-faith") oder — als Altlast — direkt
  // dessen Wallet-Adresse. In jedem Fall wird sein neuestes Gewinnspiel gezeigt,
  // damit ein einmal geteilter Link (z.B. für automatisierte Social-Media-
  // Antworten) dauerhaft gültig bleibt, auch wenn Kampagnen wechseln.
  let campaign = await getPublicGiveawayCampaign(params.id);
  if (!campaign) {
    const artistWallet = (await getArtistWalletBySlug(params.id)) ?? params.id;
    campaign = await getLatestGiveawayCampaignByArtist(artistWallet);
  }
  if (!campaign) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden' }, { status: 404 });

  // Anzeigename des Veranstalters für Teilnahmebedingungen — keine Wallet-Adresse rausgeben
  const artistProfile = await getUserProfile(campaign.artistWallet);
  const artistName = artistProfile.displayName ?? artistProfile.clerkName ?? 'der Künstler';

  // Nur öffentlich relevante Felder rausgeben
  return NextResponse.json({
    campaign: {
      id: campaign.id,
      title: campaign.title,
      imageUrl: campaign.imageUrl,
      mediaType: campaign.mediaType,
      requiredText: campaign.requiredText,
      creditReward: campaign.creditReward,
      status: campaign.status,
      slotsLeft: Math.max(0, campaign.maxWinners - campaign.winnerCount),
      platforms: campaign.platforms.map(p => ({ platform: p.platform, postUrl: p.postUrl })),
      artistName,
      releaseAt: campaign.releaseAt,
      presaveUrl: campaign.presaveUrl,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
