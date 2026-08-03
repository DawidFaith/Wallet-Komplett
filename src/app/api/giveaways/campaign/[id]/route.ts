import { NextRequest, NextResponse } from 'next/server';
import { getPublicGiveawayCampaign, getLatestGiveawayCampaignByArtist, getUserProfile } from '../../../../lib/questDb';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // Der öffentliche Link ist entweder eine konkrete Kampagnen-ID (gw_...) oder
  // die Wallet-Adresse eines Artists — dann wird dessen neuestes Gewinnspiel
  // angezeigt. So bleibt ein einmal geteilter Link (z.B. für automatisierte
  // Social-Media-Antworten) dauerhaft gültig, auch wenn Kampagnen wechseln.
  const campaign = (await getPublicGiveawayCampaign(params.id)) ?? (await getLatestGiveawayCampaignByArtist(params.id));
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
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
