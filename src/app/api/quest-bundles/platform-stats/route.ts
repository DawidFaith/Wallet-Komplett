import { NextRequest, NextResponse } from 'next/server';
import { getPlatformUserCount, getMaxFanBonusPct } from '../../../lib/questDb';
import type { Platform } from '../../../lib/questDb';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook'];

// GET /api/quest-bundles/platform-stats?platform=tiktok&creatorWallet=0x...
// Gibt die Anzahl verifizierter Nutzer + den höchsten aktuellen Fan-Bonus-Prozentsatz zurück.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform      = searchParams.get('platform') as Platform | null;
  const creatorWallet = searchParams.get('creatorWallet') ?? '';

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Gültige Plattform erforderlich' }, { status: 400 });
  }

  try {
    const [userCount, maxFanBonusPct] = await Promise.all([
      getPlatformUserCount(platform),
      creatorWallet ? getMaxFanBonusPct(creatorWallet) : Promise.resolve(0),
    ]);
    return NextResponse.json({ platform, userCount, maxFanBonusPct });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
