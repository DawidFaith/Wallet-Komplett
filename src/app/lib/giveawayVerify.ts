/**
 * Plattform-übergreifende Kommentar-Verifikation für das Giveaway-Feature.
 * Reused die bestehenden Meta-/RapidAPI-/YouTube-Helfer, die auch das Quest-System nutzt.
 */
import { findInstagramComment, findFacebookComment, resolvePostIdFromUrl, extractFacebookPostId, sendFacebookPrivateReply, getMostRecentFacebookConversationName } from './metaApi';

// Direkt (nicht über Business-Partner-Freigabe) ausgestellter Page-Token für die
// "Dawid Faith"-Page — Business-Partner-Tokens haben laut Meta keinen
// zuverlässigen Messenger/Conversations-Zugriff, auch mit korrekt gesetzten
// Scopes/Tasks nicht. Nur für diese eine Page vorhanden, daher hart verdrahtet
// statt generisch pro Artist-Page.
const DAWID_FAITH_PAGE_ID = '528116477058109';
const DAWID_FAITH_PAGE_TOKEN = process.env.META_DAWID_FAITH_PAGE_TOKEN;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';
const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

export function extractTiktokVideoId(urlOrId: string): string {
  if (/^\d+$/.test(urlOrId)) return urlOrId;
  const slashMatch = urlOrId.match(/\/video\/(\d+)/);
  if (slashMatch) return slashMatch[1];
  const flatMatch = urlOrId.match(/video(\d{10,})/i);
  if (flatMatch) return flatMatch[1];
  return urlOrId;
}

export function extractYoutubeVideoId(urlOrId: string): string {
  if (/^[\w-]{11}$/.test(urlOrId)) return urlOrId;
  try {
    const url = new URL(urlOrId);
    const v = url.searchParams.get('v');
    if (v) return v;
    if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '');
    const shortsMatch = url.pathname.match(/\/shorts\/([\w-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    /* keine gültige URL */
  }
  return urlOrId;
}

/** Instagram: prüft ob @handle unter mediaId einen Kommentar mit `code` hinterlassen hat. */
export async function verifyInstagramEntry(mediaId: string, handle: string, code: string): Promise<boolean> {
  return findInstagramComment(mediaId, handle, code);
}

/** TikTok: durchsucht Kommentare des Videos nach uniqueId === handle und prüft ob der Code im Text steht. */
export async function verifyTiktokEntry(videoIdOrUrl: string, handle: string, code: string): Promise<boolean> {
  if (!RAPIDAPI_KEY) return false;
  const videoId = extractTiktokVideoId(videoIdOrUrl);
  const cleanHandle = handle.toLowerCase();
  let cursor = 0;
  for (let page = 0; page < 5; page++) {
    let data: { status_code?: number; comments?: { text?: string; user?: { unique_id?: string } }[]; has_more?: number | boolean; cursor?: number };
    try {
      const res = await fetch(
        `https://${RAPIDAPI_HOST}/api/post/comments?videoId=${encodeURIComponent(videoId)}&count=100&cursor=${cursor}`,
        { headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }, cache: 'no-store' },
      );
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }
    if (data.status_code !== 0) break;
    const comments = data.comments ?? [];
    if (comments.length === 0) break;
    for (const c of comments) {
      const authorId = (c.user?.unique_id ?? '').toLowerCase();
      if (authorId === cleanHandle && (c.text ?? '').toLowerCase().includes(code.toLowerCase())) {
        return true;
      }
    }
    if (!data.has_more) break;
    cursor = data.cursor ?? cursor + 100;
  }
  return false;
}

/** YouTube: durchsucht Kommentare nach authorDisplayName === handle und prüft ob der Code im Text steht. */
export async function verifyYoutubeEntry(videoIdOrUrl: string, handle: string, code: string): Promise<boolean> {
  if (!YT_API_KEY) return false;
  const videoId = extractYoutubeVideoId(videoIdOrUrl);
  const cleanHandle = handle.toLowerCase().replace(/^@/, '');
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('maxResults', '100');
    url.searchParams.set('order', 'time');
    url.searchParams.set('key', YT_API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    let data: {
      items?: { snippet: { topLevelComment: { snippet: { authorDisplayName?: string; textDisplay: string } } } }[];
      nextPageToken?: string;
      error?: { code?: number };
    };
    try {
      const res = await fetch(url.toString());
      data = await res.json();
    } catch {
      return false;
    }
    if (data.error || !data.items) break;
    for (const item of data.items) {
      const c = item.snippet.topLevelComment.snippet;
      const authorName = (c.authorDisplayName ?? '').toLowerCase().replace(/^@/, '');
      if (authorName === cleanHandle && c.textDisplay.toLowerCase().includes(code.toLowerCase())) {
        return true;
      }
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return false;
}

/**
 * Facebook: Autor-Abgleich ist auf Facebook-Seiten unzuverlässig (kein "from"-Feld),
 * daher wird ausschließlich der einmalige Code als Kommentartext geprüft — exakt
 * das gleiche Verfahren wie beim bestehenden Facebook-Quest-System.
 *
 * Für die "Dawid Faith"-Page zusätzlich: sobald der Code gefunden ist, wird per
 * privater Antwort auf genau diesen Kommentar (comment_id) automatisch eine
 * Messenger-Konversation ausgelöst — darüber liefert Meta den echten Namen der
 * Person, den wir sonst nirgends bekommen (die eigentliche Verifikation bleibt
 * aber weiterhin allein der Code, der Name ist nur zusätzliche, bestätigte Info).
 */
export async function verifyFacebookEntry(
  postUrl: string,
  code: string,
  pageIdHint: string | null,
): Promise<{ found: boolean; verifiedName?: string }> {
  let postId = postUrl;
  if (postUrl.startsWith('http')) {
    const resolved = await resolvePostIdFromUrl(postUrl);
    postId = resolved ?? (extractFacebookPostId(postUrl) ?? postUrl);
  }
  if (!postId.includes('_') && /^\d+$/.test(postId) && pageIdHint) {
    postId = `${pageIdHint}_${postId}`;
  }
  const result = await findFacebookComment(postId, code, null, pageIdHint);
  if (!result.found) return { found: false };

  if (pageIdHint === DAWID_FAITH_PAGE_ID && DAWID_FAITH_PAGE_TOKEN && result.commentId) {
    try {
      const replyText = 'Danke für deine Teilnahme am Gewinnspiel! 🎁';
      const sent = await sendFacebookPrivateReply(result.commentId, replyText, DAWID_FAITH_PAGE_TOKEN);
      if (sent) {
        const name = await getMostRecentFacebookConversationName(DAWID_FAITH_PAGE_ID, DAWID_FAITH_PAGE_TOKEN);
        if (name) return { found: true, verifiedName: name };
      }
    } catch (e) {
      console.error('[verifyFacebookEntry] Private-Reply-Namensauflösung fehlgeschlagen:', e);
      // Verifikation bleibt trotzdem gültig — der Code hat schon gematcht
    }
  }
  return { found: true };
}
