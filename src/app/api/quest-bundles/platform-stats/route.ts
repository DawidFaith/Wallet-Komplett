import { NextRequest, NextResponse } from 'next/server';
import { getPlatformUserCount, getTopFanBonusPcts } from '../../../lib/questDb';
import type { Platform } from '../../../lib/questDb';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook'];

// GET /api/quest-bundles/platform-stats?platform=tiktok&creatorWallet=0x...&limit=500
// Gibt Anzahl verifizierter Nutzer + Bonus-Prozentsätze der Top-N Fans zurück.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform      = searchParams.get('platform') as Platform | null;
  const creatorWallet = searchParams.get('creatorWallet') ?? '';
  const limit         = Math.min(1000, Math.max(1, Number(searchParams.get('limit')) || 500));

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Gültige Plattform erforderlich' }, { status: 400 });
  }

  try {
    const [userCount, topFanBonusPcts] = await Promise.all([
      getPlatformUserCount(platform),
      creatorWallet ? getTopFanBonusPcts(creatorWallet, limit) : Promise.resolve([] as number[]),
    ]);
    return NextResponse.json({ platform, userCount, topFanBonusPcts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
