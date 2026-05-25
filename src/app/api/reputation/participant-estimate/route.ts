/**
 * GET /api/reputation/participant-estimate
 *   ?platform=youtube|tiktok|instagram|facebook
 *
 * Empfiehlt eine maximale Teilnehmeranzahl basierend auf:
 *  - Verifizierten Plattform-Nutzern in der App (user_profiles / youtube_bindings)
 *  - Gesamt-App-Nutzern als Fallback
 *  - Plattform-Engagement-Rate
 *  - Default fuer neue Plattformen ohne Daten
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

// Puffer für Neuzugänge: +20% auf die aktuell verifizierten Nutzer
const NEW_USER_BUFFER = 0.20;

// Default für Plattformen ohne jegliche Nutzer
const NEW_PLATFORM_DEFAULT: Record<string, number> = {
  youtube:   10,
  tiktok:    15,
  instagram: 12,
  facebook:  8,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') ?? 'youtube';

  const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: 'Ungueltige Plattform' }, { status: 400 });
  }

  const sql = getDb();

  const [totalRow] = await sql`SELECT COUNT(*)::int AS total_users FROM user_profiles`;
  const totalAppUsers: number = totalRow?.total_users ?? 0;

  let platformUsersRow;  if (platform === 'youtube') {
    [platformUsersRow] = await sql`SELECT COUNT(*)::int AS platform_users FROM youtube_bindings`;
  } else if (platform === 'instagram') {
    [platformUsersRow] = await sql`SELECT COUNT(*)::int AS platform_users FROM user_profiles WHERE instagram_handle IS NOT NULL AND instagram_verified = true`;
  } else if (platform === 'tiktok') {
    [platformUsersRow] = await sql`SELECT COUNT(*)::int AS platform_users FROM user_profiles WHERE tiktok_handle IS NOT NULL AND tiktok_verified = true`;
  } else {
    [platformUsersRow] = await sql`SELECT COUNT(*)::int AS platform_users FROM user_profiles WHERE facebook_handle IS NOT NULL AND facebook_verified = true`;
  }
  const platformUsers: number = platformUsersRow?.platform_users ?? 0;

  const fallback = NEW_PLATFORM_DEFAULT[platform] ?? 10;

  let recommended: number;
  let basis: 'platform_users' | 'default';

  if (platformUsers > 0) {
    // Verifizierte Nutzer dieser Plattform = aktuelles Maximum + 20% Puffer für Neuzugänge
    recommended = Math.round(platformUsers * (1 + NEW_USER_BUFFER));
    basis = 'platform_users';
  } else {
    // Noch keine Nutzer auf dieser Plattform
    recommended = fallback;
    basis = 'default';
  }

  recommended = Math.min(Math.max(recommended, 1), 500);

  return NextResponse.json({
    recommended,
    basis,
    totalAppUsers,
    platformUsers,
    newUserBuffer: Math.round(NEW_USER_BUFFER * 100),
    platform,
  });
}
