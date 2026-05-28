/**
 * Meta Graph API Hilfsfunktionen
 * Nutzt META_SYSTEM_USER_TOKEN für alle Aufrufe
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

// ─── Facebook URL zu Post-ID konvertieren ─────────────────────────────────────
/**
 * Extrahiert die Facebook Post-ID aus verschiedenen URL-Formaten.
 * Unterstützt:
 * - https://www.facebook.com/{pageId}/posts/{postId}
 * - https://facebook.com/{pageId}/posts/{postId}
 * - https://www.facebook.com/permalink.php?story_fbid={postId}&id={pageId}
 * - Direkte Post-ID (pageId_postId)
 * - Beschädigte URLs ohne Protokoll-Trenner
 * @returns Post-ID im Format "pageId_postId" oder null bei Fehler
 */
export function extractFacebookPostId(urlOrId: string): string | null {
  // Bereits im korrekten Format
  if (urlOrId.includes('_') && !urlOrId.includes('/') && !urlOrId.includes('http')) {
    return urlOrId;
  }

  try {
    // URL bereinigen (falls ohne Protokoll oder beschädigt)
    let url = urlOrId;
    if (!url.startsWith('http')) {
      // Beschädigte URLs wie "httpswwwfacebookcom..." reparieren
      if (url.startsWith('httpswww')) {
        url = url.replace('httpswww', 'https://www.');
      } else if (url.startsWith('https')) {
        url = url.replace('https', 'https://');
      } else if (url.startsWith('http')) {
        url = url.replace('http', 'http://');
      } else {
        url = 'https://' + url;
      }
    }

    const parsed = new URL(url);
    
    // Format: /pageId/posts/postId
    const pathMatch = parsed.pathname.match(/\/(\d+)\/posts\/(\d+)/);
    if (pathMatch) {
      return `${pathMatch[1]}_${pathMatch[2]}`;
    }

    // Format: /permalink.php?story_fbid=postId&id=pageId
    if (parsed.pathname.includes('permalink.php')) {
      const storyFbid = parsed.searchParams.get('story_fbid');
      const pageId = parsed.searchParams.get('id');
      if (storyFbid && pageId) {
        return `${pageId}_${storyFbid}`;
      }
    }

    // Format: /watch/?v=videoId (für Videos)
    if (parsed.pathname.includes('watch')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        return videoId; // Video-IDs sind standalone
      }
    }
  } catch {
    // URL-Parsing fehlgeschlagen - versuche Regex auf Rohstring
    const directMatch = urlOrId.match(/(\d+)[\/\-_]posts[\/\-_](\d+)/);
    if (directMatch) {
      return `${directMatch[1]}_${directMatch[2]}`;
    }
  }

  return null;
}

// ─── Page Access Token holen (neue Facebook-Seiten erfordern Page Token) ─────
let cachedPageToken: string | null = null;
export async function getPageAccessToken(): Promise<string | null> {
  if (cachedPageToken) return cachedPageToken;
  const systemToken = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!systemToken || !pageId) return null;
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}?fields=access_token&access_token=${systemToken}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string };
    const token = data?.access_token ?? null;
    if (token) cachedPageToken = token;
    return token;
  } catch {
    return null;
  }
}

// ─── Page Access Token für eine Artist-Page holen (über Business) ─────────────
/**
 * Holt den Page Access Token für eine Artist-Page via META_BUSINESS_ID.
 * Sucht sowohl in owned_pages (eigene Pages) als auch client_pages (Partner-Pages).
 * Alle Künstler sind als System Admin registriert → Token muss hier abrufbar sein.
 */
export async function getPageTokenByPageId(pageId: string): Promise<string | null> {
  const systemToken = process.env.META_SYSTEM_USER_TOKEN;
  const bizId = process.env.META_BUSINESS_ID;
  if (!systemToken || !bizId) {
    console.error('[getPageTokenByPageId] META_SYSTEM_USER_TOKEN oder META_BUSINESS_ID nicht gesetzt');
    return null;
  }

  // owned_pages: Pages die das Business selbst verwaltet
  try {
    const res = await fetch(
      `${GRAPH}/${bizId}/owned_pages?fields=id,access_token&limit=200&access_token=${systemToken}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const data = await res.json() as { data?: Array<{ id: string; access_token?: string }>; error?: { message: string } };
    if (data.error) {
      console.error('[getPageTokenByPageId] owned_pages Fehler:', data.error.message);
    } else {
      const match = data.data?.find((p) => p.id === pageId);
      if (match?.access_token) {
        console.log('[getPageTokenByPageId] Token via owned_pages gefunden für pageId:', pageId);
        return match.access_token;
      }
      console.log('[getPageTokenByPageId] pageId nicht in owned_pages gefunden. Gefundene IDs:', data.data?.map(p => p.id));
    }
  } catch (e) {
    console.error('[getPageTokenByPageId] owned_pages Fetch-Fehler:', e);
  }

  // client_pages: Pages von Business-Partnern/Clients
  try {
    const res = await fetch(
      `${GRAPH}/${bizId}/client_pages?fields=id,access_token&limit=200&access_token=${systemToken}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const data = await res.json() as { data?: Array<{ id: string; access_token?: string }>; error?: { message: string } };
    if (data.error) {
      console.error('[getPageTokenByPageId] client_pages Fehler:', data.error.message);
    } else {
      const match = data.data?.find((p) => p.id === pageId);
      if (match?.access_token) {
        console.log('[getPageTokenByPageId] Token via client_pages gefunden für pageId:', pageId);
        return match.access_token;
      }
      console.log('[getPageTokenByPageId] pageId nicht in client_pages gefunden. Gefundene IDs:', data.data?.map(p => p.id));
    }
  } catch (e) {
    console.error('[getPageTokenByPageId] client_pages Fetch-Fehler:', e);
  }

  // Direkter Zugriff: System User wurde manuell als Page Admin hinzugefügt
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}?fields=access_token&access_token=${systemToken}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    const data = await res.json() as { access_token?: string; error?: { message: string } };
    if (data.access_token) {
      console.log('[getPageTokenByPageId] Token via direkten Page-Admin-Zugriff gefunden für pageId:', pageId);
      return data.access_token;
    }
    if (data.error) {
      console.error('[getPageTokenByPageId] Direkter Zugriff Fehler:', data.error.message, '– System User ist kein Page Admin für', pageId);
    }
  } catch (e) {
    console.error('[getPageTokenByPageId] Direkter Zugriff Fetch-Fehler:', e);
  }

  return null;
}

// ─── Kommentare auf Instagram-Media prüfen ────────────────────────────────────
export async function findInstagramComment(
  mediaId: string,
  username: string,
  requiredText?: string,
): Promise<boolean> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return false;

  const cleanUsername = username.toLowerCase().replace(/^@/, '');
  let url: string | null =
    `${GRAPH}/${mediaId}/comments?fields=username,text&limit=200&access_token=${token}`;

  for (let page = 0; page < 5 && url; page++) {
    let data: { data?: Array<{ username?: string; text?: string }>; paging?: { next?: string } };
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }
    for (const comment of data.data ?? []) {
      const commentUser = (comment.username ?? '').toLowerCase();
      if (commentUser !== cleanUsername) continue;
      if (requiredText) {
        if ((comment.text ?? '').toLowerCase().includes(requiredText.toLowerCase())) return true;
      } else {
        return true;
      }
    }
    url = data.paging?.next ?? null;
  }
  return false;
}

// ─── Kommentare auf Facebook-Post prüfen ─────────────────────────────────────
export async function findFacebookComment(
  postId: string,
  requiredText: string | null,
  fromName?: string | null,
): Promise<{ found: boolean; fromName?: string; allComments?: Array<{ from?: string; message: string }> }> {
  // Page-ID aus Post-ID extrahieren um das spezifische Page Access Token zu holen.
  // Damit können Artist-Posts gelesen werden, nicht nur die dfaith-eigene Page.
  const systemToken = process.env.META_SYSTEM_USER_TOKEN;
  if (!systemToken) return { found: false };

  const pageId = postId.includes('_') ? postId.split('_')[0] : null;
  if (!pageId) return { found: false, allComments: [] };

  const token = await getPageTokenByPageId(pageId);
  if (!token) {
    console.error('[findFacebookComment] Kein Page Token für pageId:', pageId, '– Artist-Page nicht in owned_pages/client_pages?');
    return { found: false, allComments: [] };
  }
  console.log('[findFacebookComment] Page Token erfolgreich geholt für pageId:', pageId);

  const cleanText = requiredText?.toLowerCase().normalize('NFC') ?? null;
  const cleanName = fromName?.toLowerCase().trim() ?? null;

  // Hinweis: "from{name,id}" funktioniert nicht bei der neuen Facebook-Seiten-API.
  // Stattdessen "from" ohne Unterfelder verwenden.
  let url: string | null =
    `${GRAPH}/${postId}/comments?fields=from,message&limit=200&access_token=${token}`;

  console.log('[findFacebookComment] DEBUG - Suche nach:', { postId, requiredText, fromName, cleanText, cleanName });

  const allComments: Array<{ from?: string; message: string }> = [];

  for (let page = 0; page < 5 && url; page++) {
    let data: { data?: Array<{ from?: { name?: string; id?: string }; message?: string }>; paging?: { next?: string }; error?: { message: string } };
    try {
      const res = await fetch(url, { cache: 'no-store' });
      data = await res.json();
    } catch {
      break;
    }
    if (data.error) {
      console.error('[findFacebookComment] Graph API Fehler:', data.error.message, '| postId:', postId);
      break;
    }
    console.log(`[findFacebookComment] DEBUG - Page ${page}: Gefunden ${data.data?.length ?? 0} Kommentare`);
    for (const comment of data.data ?? []) {
      const authorName = (comment.from?.name ?? '').toLowerCase().trim();
      const commentMessage = (comment.message ?? '').normalize('NFC');
      
      // Debug: Sammle alle Kommentare
      allComments.push({
        from: comment.from?.name ?? 'Unknown',
        message: commentMessage
      });
      
      console.log('[findFacebookComment] DEBUG - Kommentar:', {
        authorName,
        message: commentMessage,
        messageLength: commentMessage.length,
        cleanTextLength: cleanText?.length ?? 0,
        includes: cleanText ? commentMessage.toLowerCase().includes(cleanText) : 'N/A'
      });
      // Autor-Check (für comment-verify)
      const authorMatch = cleanName ? authorName === cleanName : true;
      // Textinhalt-Check (für social-verify / secret-code Quests)
      const textMatch = cleanText ? commentMessage.toLowerCase().includes(cleanText) : true;
      if (authorMatch && textMatch) {
        console.log('[findFacebookComment] DEBUG - MATCH GEFUNDEN!', { authorName, fromName: comment.from?.name });
        return { found: true, fromName: comment.from?.name ?? undefined, allComments };
      }
    }
    url = data.paging?.next ?? null;
  }
  console.log('[findFacebookComment] DEBUG - Kein Match gefunden');
  return { found: false, allComments };
}

// ─── IG-Account-ID aus Facebook-Page ermitteln ───────────────────────────────
let cachedIgAccountId: string | null = null;
export async function getIgAccountId(): Promise<string | null> {
  if (cachedIgAccountId) return cachedIgAccountId;
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) return null;
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${token}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { instagram_business_account?: { id?: string } };
    const id = data?.instagram_business_account?.id ?? null;
    if (id) cachedIgAccountId = id;
    return id;
  } catch {
    return null;
  }
}

// ─── IG-Media von dfaith_ecosystem abrufen ────────────────────────────────────
export interface IgMediaItem {
  id: string;
  shortcode: string;
  caption: string;
  media_url: string;
  thumbnail_url: string;
  permalink: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  media_type: string;
  media_product_type: string;
}

export async function fetchPlatformIgMedia(limit = 20): Promise<IgMediaItem[]> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return [];

  const igAccountId = await getIgAccountId();
  if (!igAccountId) return [];

  try {
    const res = await fetch(
      `${GRAPH}/${igAccountId}/media?fields=id,shortcode,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,media_type,media_product_type&limit=${limit}&access_token=${token}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = await res.json() as { data?: Array<Record<string, unknown>> };
    return (data.data ?? []).map((item) => ({
      id: String(item.id ?? ''),
      shortcode: String(item.shortcode ?? item.id ?? ''),
      caption: String(item.caption ?? ''),
      media_url: String(item.media_url ?? ''),
      thumbnail_url: String(item.thumbnail_url ?? item.media_url ?? ''),
      permalink: String(item.permalink ?? ''),
      timestamp: String(item.timestamp ?? ''),
      like_count: Number(item.like_count ?? 0),
      comments_count: Number(item.comments_count ?? 0),
      media_type: String(item.media_type ?? ''),
      media_product_type: String(item.media_product_type ?? ''),
    }));
  } catch {
    return [];
  }
}

// ─── Neueste Facebook-Posts von dfaith_ecosystem Page abrufen ────────────────
export async function fetchPlatformFbPosts(limit = 5): Promise<string[]> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!pageId) return [];
  // Neue Facebook-Seiten benötigen Page Access Token
  const token = await getPageAccessToken() ?? process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}/posts?fields=id&limit=${limit}&access_token=${token}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = await res.json() as { data?: Array<{ id?: string }> };
    return (data.data ?? []).map((p) => String(p.id ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Reaktionen/Likes eines Facebook-Posts abrufen ───────────────────────────
export interface FbPostCounts {
  likes: number;
  comments: number;
  shares: number;
}

export async function fetchFacebookPostCounts(postId: string): Promise<FbPostCounts | null> {
  const systemToken = process.env.META_SYSTEM_USER_TOKEN;
  if (!systemToken) {
    console.error('[fetchFacebookPostCounts] META_SYSTEM_USER_TOKEN nicht gesetzt');
    return null;
  }

  // Page-ID aus Post-ID extrahieren (Format: {pageId}_{postId})
  // Damit holen wir das Page Access Token der jeweiligen Artist-Page,
  // das pages_read_engagement hat – alle Künstler sind als Business Partner registriert.
  const pageId = postId.includes('_') ? postId.split('_')[0] : null;
  let token = systemToken;

  if (pageId) {
    const pageToken = await getPageTokenByPageId(pageId);
    if (pageToken) token = pageToken;
    else console.warn('[fetchFacebookPostCounts] Kein Page Token für pageId:', pageId);
  }

  try {
    const url = `${GRAPH}/${postId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${token}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const data = await res.json() as {
      reactions?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
      error?: { message: string; code?: number };
    };
    if (data.error) {
      console.error('[fetchFacebookPostCounts] Graph API Fehler:', data.error.message, '| postId:', postId);
      return null;
    }
    const likes = Number(data.reactions?.summary?.total_count ?? 0);
    const comments = Number(data.comments?.summary?.total_count ?? 0);
    const shares = Number(data.shares?.count ?? 0);
    return { likes, comments, shares };
  } catch (e) {
    console.error('[fetchFacebookPostCounts] Fetch-Fehler:', e);
    return null;
  }
}
