import { NextRequest, NextResponse } from 'next/server';
import {
  getUserProfile,
  upsertUserProfile,
  getUserXp,
  xpToLevel,
  getDfaithCredits,
  loadBindingByWallet,
} from '../../../lib/questDb';

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ error: 'wallet Parameter fehlt' }, { status: 400 });
  }
  try {
    const [profile, xp, credits, ytBinding] = await Promise.all([
      getUserProfile(wallet),
      getUserXp(wallet),
      getDfaithCredits(wallet),
      loadBindingByWallet(wallet),
    ]);
    const levelInfo = xpToLevel(xp);
    return NextResponse.json({
      profile: {
        ...profile,
        youtubeChannelId: ytBinding?.channelId ?? null,
        youtubeChannelName: ytBinding?.channelName ?? null,
        youtubeChannelThumbnail: ytBinding?.channelThumbnail ?? null,
        youtubeVerified: !!ytBinding,
      },
      xp,
      credits,
      ...levelInfo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    wallet?: string;
    displayName?: string | null;
    instagramHandle?: string | null;
    tiktokHandle?: string | null;
    facebookHandle?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }
  const { wallet, displayName, instagramHandle, tiktokHandle, facebookHandle } = body;
  if (!wallet) {
    return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });
  }
  try {
    await upsertUserProfile(wallet, { displayName, instagramHandle, tiktokHandle, facebookHandle });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
