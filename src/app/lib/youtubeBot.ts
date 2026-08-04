/**
 * YouTube Auto-Reply Bot — Single-Tenant (nur ein Kanal, siehe questDb/youtubeBot.ts).
 * Nutzt OAuth2 (Authorization Code + Refresh Token) um im Namen des Kanal-Inhabers
 * automatisch auf Kommentare zu antworten. Lesen von Kommentaren läuft weiterhin
 * über den normalen YOUTUBE_DATA_API_KEY (kein OAuth nötig), nur das Posten einer
 * Antwort (comments.insert) erfordert den OAuth-Access-Token.
 */
import { encryptKey, decryptKey } from './solanaCrypto';
import { getYoutubeBotRefreshToken } from './questDb/youtubeBot';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export function getYoutubeOAuthRedirectUri(origin: string): string {
  return `${origin}/api/admin/youtube-oauth/callback`;
}

export function buildYoutubeOAuthAuthorizeUrl(origin: string, state: string): string | null {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  if (!clientId) return null;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', getYoutubeOAuthRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.force-ssl');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

/** Tauscht den Authorization Code aus dem OAuth-Callback gegen Access- + Refresh-Token. */
export async function exchangeYoutubeOAuthCode(code: string, origin: string): Promise<{ accessToken: string; refreshToken: string | null } | null> {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getYoutubeOAuthRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json() as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    console.error('[youtubeBot] Code-Exchange fehlgeschlagen:', data.error, data.error_description);
    return null;
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
}

/** Holt einen frischen Access-Token anhand des gespeicherten (verschlüsselten) Refresh-Tokens. */
export async function getYoutubeBotAccessToken(): Promise<string | null> {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const stored = await getYoutubeBotRefreshToken();
  if (!stored) return null;

  let refreshToken: string;
  try {
    refreshToken = decryptKey(stored.encryptedToken);
  } catch (e) {
    console.error('[youtubeBot] Refresh-Token konnte nicht entschlüsselt werden:', e);
    return null;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    console.error('[youtubeBot] Access-Token-Refresh fehlgeschlagen:', data.error);
    return null;
  }
  return data.access_token;
}

export function encryptYoutubeRefreshToken(token: string): string {
  return encryptKey(token);
}

/** Holt Name/ID des via OAuth verbundenen Kanals (zur Bestätigung im Callback). */
export async function getAuthorizedYoutubeChannel(accessToken: string): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as { items?: { id: string; snippet?: { title?: string } }[] };
    const channel = data.items?.[0];
    if (!channel) return null;
    return { id: channel.id, name: channel.snippet?.title ?? channel.id };
  } catch {
    return null;
  }
}

export interface YoutubeTopLevelComment {
  commentId: string;
  text: string;
}

/** Liest die neuesten Top-Level-Kommentare eines Videos (öffentlicher API-Key reicht zum Lesen). */
export async function fetchLatestYoutubeComments(videoId: string, maxPages = 2): Promise<YoutubeTopLevelComment[]> {
  if (!YT_API_KEY) return [];
  const results: YoutubeTopLevelComment[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('maxResults', '100');
    url.searchParams.set('order', 'time');
    url.searchParams.set('key', YT_API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    let data: {
      items?: { snippet: { topLevelComment: { id: string; snippet: { textDisplay: string } } } }[];
      nextPageToken?: string;
      error?: { message: string };
    };
    try {
      const res = await fetch(url.toString(), { cache: 'no-store' });
      data = await res.json();
    } catch {
      break;
    }
    if (data.error || !data.items) break;

    for (const item of data.items) {
      results.push({
        commentId: item.snippet.topLevelComment.id,
        text: item.snippet.topLevelComment.snippet.textDisplay,
      });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return results;
}

/** Postet eine Antwort auf einen bestehenden Kommentar (benötigt OAuth-Access-Token mit Schreibrecht). */
export async function postYoutubeCommentReply(parentCommentId: string, text: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snippet: { parentId: parentCommentId, textOriginal: text } }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[youtubeBot] Antwort posten fehlgeschlagen:', res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[youtubeBot] Antwort posten fehlgeschlagen:', e);
    return false;
  }
}
