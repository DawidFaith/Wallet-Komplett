/**
 * Meta Graph API Hilfsfunktionen
 * Nutzt META_SYSTEM_USER_TOKEN für alle Aufrufe
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

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
  requiredText: string,
): Promise<{ found: boolean; fromName?: string }> {
  // Neue Facebook-Seiten benötigen Page Access Token (nicht System User Token)
  const token = await getPageAccessToken() ?? process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return { found: false };

  const cleanText = requiredText.toLowerCase();
  let url: string | null =
    `${GRAPH}/${postId}/comments?fields=from{name,id},message&limit=200&access_token=${token}`;

  for (let page = 0; page < 5 && url; page++) {
    let data: { data?: Array<{ from?: { name?: string; id?: string }; message?: string }>; paging?: { next?: string } };
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }
    for (const comment of data.data ?? []) {
      if ((comment.message ?? '').toLowerCase().includes(cleanText)) {
        return { found: true, fromName: comment.from?.name ?? undefined };
      }
    }
    url = data.paging?.next ?? null;
  }
  return { found: false };
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
