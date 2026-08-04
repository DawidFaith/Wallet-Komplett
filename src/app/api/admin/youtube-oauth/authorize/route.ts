import { NextRequest, NextResponse } from 'next/server';
import { buildYoutubeOAuthAuthorizeUrl } from '../../../../lib/youtubeBot';

/**
 * GET /api/admin/youtube-oauth/authorize?secret=...
 * Einmalig im Browser aufrufen, um den YouTube-Kanal für Auto-Replies zu autorisieren.
 * Leitet zur Google-Consent-Seite weiter; der Callback speichert den Refresh-Token.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const authorizeUrl = buildYoutubeOAuthAuthorizeUrl(req.nextUrl.origin, secret);
  if (!authorizeUrl) {
    return NextResponse.json({ error: 'YOUTUBE_OAUTH_CLIENT_ID nicht konfiguriert' }, { status: 500 });
  }

  return NextResponse.redirect(authorizeUrl);
}
