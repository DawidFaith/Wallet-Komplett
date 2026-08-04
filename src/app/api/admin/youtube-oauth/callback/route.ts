import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeYoutubeOAuthCode,
  getAuthorizedYoutubeChannel,
  encryptYoutubeRefreshToken,
} from '../../../../lib/youtubeBot';
import { saveYoutubeBotRefreshToken } from '../../../../lib/questDb/youtubeBot';

/** GET /api/admin/youtube-oauth/callback — Google leitet hierher mit ?code=...&state=... zurück. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return htmlResponse(`Google hat die Anfrage abgelehnt: ${error}`, false);
  }
  if (!state || state !== process.env.MIGRATION_SECRET) {
    return htmlResponse('Ungültiger oder abgelaufener Autorisierungs-Link.', false);
  }
  if (!code) {
    return htmlResponse('Kein Autorisierungs-Code von Google erhalten.', false);
  }

  const tokens = await exchangeYoutubeOAuthCode(code, req.nextUrl.origin);
  if (!tokens) {
    return htmlResponse('Token-Austausch mit Google fehlgeschlagen. Prüfe YOUTUBE_OAUTH_CLIENT_ID/SECRET.', false);
  }
  if (!tokens.refreshToken) {
    return htmlResponse(
      'Kein Refresh-Token erhalten. Das passiert, wenn der Kanal bereits einmal zugestimmt hat — ' +
      'entferne den Zugriff unter https://myaccount.google.com/permissions und versuche es erneut.',
      false,
    );
  }

  const channel = await getAuthorizedYoutubeChannel(tokens.accessToken);
  const encrypted = encryptYoutubeRefreshToken(tokens.refreshToken);
  await saveYoutubeBotRefreshToken(encrypted, channel?.id ?? null, channel?.name ?? null);

  return htmlResponse(
    `Verbunden mit Kanal „${channel?.name ?? 'unbekannt'}". Der YouTube-Auto-Reply-Bot ist jetzt aktiv.`,
    true,
  );
}

function htmlResponse(message: string, success: boolean) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;background:#0e0c0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
      <div style="max-width:420px;text-align:center;padding:24px;">
        <p style="font-size:32px;">${success ? '✅' : '⚠️'}</p>
        <p>${message}</p>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
