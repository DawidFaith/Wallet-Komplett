import { NextRequest, NextResponse } from 'next/server';
import { getPlatformUserCount } from '../../../lib/questDb';
import type { Platform } from '../../../lib/questDb';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook'];

// GET /api/quest-bundles/platform-stats?platform=tiktok
// Gibt die Anzahl verifizierter Nutzer für eine Plattform zurück.
// Wird für die Bonus-Budget-Berechnung beim Bundle-Erstellen verwendet.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') as Platform | null;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Gültige Plattform erforderlich' }, { status: 400 });
  }

  try {
    const userCount = await getPlatformUserCount(platform);
    return NextResponse.json({ platform, userCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
