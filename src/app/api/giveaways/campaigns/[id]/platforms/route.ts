import { NextRequest, NextResponse } from 'next/server';
import { addGiveawayCampaignPlatform, type GiveawayPlatform } from '../../../../../lib/questDb';
import { requireOwnWallet } from '../../../../../lib/apiAuth';
import { resolveGiveawayPlatformEntry } from '../../../../../lib/giveawayPlatformResolve';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS: GiveawayPlatform[] = ['instagram', 'tiktok', 'facebook', 'youtube', 'instagram_polska', 'tiktok_polska'];

/**
 * POST /api/giveaways/campaigns/[id]/platforms
 * Fügt einer bereits laufenden Kampagne nachträglich eine weitere Plattform hinzu
 * (siehe addGiveawayCampaignPlatform in lib/questDb/giveaways.ts).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: {
    artistWallet?: string;
    platform?: string;
    postUrl?: string;
    mediaId?: string | null;
    premiereStartsAt?: string | null;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 }); }

  const { artistWallet, platform, postUrl, mediaId, premiereStartsAt } = body;
  if (!artistWallet || !platform || !postUrl?.trim()) {
    return NextResponse.json({ error: 'artistWallet, platform und postUrl sind erforderlich.' }, { status: 400 });
  }
  const authCheck = requireOwnWallet(artistWallet);
  if (!authCheck.ok) return authCheck.response;
  if (!VALID_PLATFORMS.includes(platform as GiveawayPlatform)) {
    return NextResponse.json({ error: 'Ungültige Plattform' }, { status: 400 });
  }

  const resolved = await resolveGiveawayPlatformEntry(req.nextUrl.origin, {
    platform: platform as GiveawayPlatform,
    postUrl,
    mediaId: mediaId ?? null,
    premiereStartsAt: premiereStartsAt ?? null,
  });
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const result = await addGiveawayCampaignPlatform(
    params.id,
    artistWallet,
    resolved.platform,
    resolved.postUrl,
    resolved.mediaId,
    resolved.premiereStartsAt,
  );
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
