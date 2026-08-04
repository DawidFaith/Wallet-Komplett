import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, createGiveawayCampaign, getGiveawayCampaignsByArtist, type GiveawayPlatform } from '../../../lib/questDb';
import { requireOwnWallet } from '../../../lib/apiAuth';
import { extractTiktokVideoId, extractYoutubeVideoId } from '../../../lib/giveawayVerify';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const VALID_PLATFORMS: GiveawayPlatform[] = ['instagram', 'tiktok', 'facebook', 'youtube'];

export async function GET(req: NextRequest) {
  const artistWallet = req.nextUrl.searchParams.get('artistWallet');
  if (!artistWallet) return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
  const authCheck = requireOwnWallet(artistWallet);
  if (!authCheck.ok) return authCheck.response;

  const campaigns = await getGiveawayCampaignsByArtist(artistWallet);
  return NextResponse.json({ campaigns }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  let body: {
    artistWallet?: string;
    title?: string;
    imageUrl?: string | null;
    mediaType?: string;
    requiredText?: string;
    creditReward?: number;
    maxWinners?: number;
    platforms?: { platform: string; postUrl: string; mediaId?: string | null }[];
    releaseAt?: string | null;
    presaveUrl?: string | null;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 }); }

  const { artistWallet, title, imageUrl, mediaType, requiredText, creditReward, maxWinners, platforms, releaseAt, presaveUrl } = body;
  if (!artistWallet || !title?.trim() || !creditReward || !maxWinners || !platforms?.length) {
    return NextResponse.json({ error: 'artistWallet, title, creditReward, maxWinners und platforms sind erforderlich.' }, { status: 400 });
  }
  const authCheck = requireOwnWallet(artistWallet);
  if (!authCheck.ok) return authCheck.response;

  const profile = await getUserProfile(artistWallet);
  if (!profile.isArtist) {
    return NextResponse.json({ error: 'Nur Künstler können Gewinnspiele erstellen.' }, { status: 403 });
  }

  const rewardNum = Math.max(1, Math.round(Number(creditReward)));
  const winnersNum = Math.max(1, Math.round(Number(maxWinners)));

  const resolvedPlatforms: { platform: GiveawayPlatform; postUrl: string; mediaId: string | null }[] = [];
  for (const p of platforms) {
    if (!VALID_PLATFORMS.includes(p.platform as GiveawayPlatform) || !p.postUrl?.trim()) continue;
    const platform = p.platform as GiveawayPlatform;
    const postUrl = p.postUrl.trim();
    // Der Video-Picker im Frontend liefert die Media-ID bereits direkt aus den
    // available-media Endpoints mit — nur wenn der Artist stattdessen einen Link
    // manuell eingefügt hat, wird sie hier serverseitig nachträglich aufgelöst.
    let mediaId: string | null = p.mediaId?.trim() || null;

    if (!mediaId && platform === 'tiktok') {
      mediaId = extractTiktokVideoId(postUrl);
    } else if (!mediaId && platform === 'youtube') {
      mediaId = extractYoutubeVideoId(postUrl);
    } else if (!mediaId && platform === 'instagram') {
      try {
        const res = await fetch(`${req.nextUrl.origin}/api/instagram-quests/resolve-reel?url=${encodeURIComponent(postUrl)}`);
        if (res.ok) {
          const data = await res.json();
          mediaId = data.mediaId ?? null;
        }
      } catch { /* Resolution fehlgeschlagen, mediaId bleibt null */ }
      if (!mediaId) {
        return NextResponse.json({ error: `Instagram-Link konnte nicht aufgelöst werden: ${postUrl}` }, { status: 400 });
      }
    }
    // facebook ohne mediaId: wird erst zur Verifikationszeit aufgelöst (Page-ID-Kombination nötig)
    resolvedPlatforms.push({ platform, postUrl, mediaId });
  }

  if (resolvedPlatforms.length === 0) {
    return NextResponse.json({ error: 'Keine gültige Plattform übergeben.' }, { status: 400 });
  }

  let releaseAtIso: string | null = null;
  if (releaseAt?.trim()) {
    const parsed = new Date(releaseAt);
    if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'Ungültiges Release-Datum.' }, { status: 400 });
    releaseAtIso = parsed.toISOString();
  }

  try {
    const result = await createGiveawayCampaign(
      artistWallet,
      title.trim(),
      imageUrl?.trim() || null,
      mediaType === 'video' ? 'video' : 'image',
      requiredText?.trim() || 'dfaith',
      rewardNum,
      winnersNum,
      resolvedPlatforms,
      releaseAtIso,
      presaveUrl?.trim() || null,
    );
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, campaignId: result.id });
  } catch (e) {
    console.error('[giveaways/campaigns POST]', e);
    return NextResponse.json({ error: 'Gewinnspiel konnte nicht erstellt werden.' }, { status: 500 });
  }
}
