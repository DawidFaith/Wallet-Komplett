/**
 * Öffentliche/leichtgewichtige Post-Metadaten-Lookups für UGC-Quests
 * ("erstelle einen eigenen Beitrag mit Hashtag X, reiche den Link ein").
 *
 * Bewusst KEINE Meta Hashtag-Search-API (braucht mehrwöchigen App-Review) —
 * stattdessen pro Plattform der leichtgewichtigste öffentlich/bereits
 * verfügbare Weg, um an Titel/Caption eines einzelnen, vom Fan selbst
 * verlinkten Posts zu kommen:
 *   - TikTok:     öffentlicher oembed.tiktok.com-Endpoint, kein Auth nötig
 *   - Instagram:  Graph API instagram_oembed mit vorhandenem META_SYSTEM_USER_TOKEN
 *   - Facebook:   Graph API oembed_post mit vorhandenem META_SYSTEM_USER_TOKEN
 *   - YouTube:    bereits vorhandene YouTube Data API (zuverlässiger als oEmbed)
 *
 * Liefert `null` bei jedem technischen Fehlschlag (Netzwerk, fehlende
 * Berechtigung, privates Konto, unbekanntes Format) — der Aufrufer muss
 * `null` als "konnte nicht automatisch geprüft werden" behandeln, nicht als
 * "Hashtag fehlt".
 */

import type { Platform } from './questDb/types';

export interface OEmbedResult {
  caption: string;
  authorHandle?: string | null;
  thumbnailUrl?: string | null;
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_DATA_API_KEY;
const META_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const GRAPH = 'https://graph.facebook.com/v21.0';

function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchYoutubeCaption(url: string): Promise<OEmbedResult | null> {
  if (!YOUTUBE_API_KEY) return null;
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { items?: { snippet?: { title?: string; description?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }[] };
    const snippet = data.items?.[0]?.snippet;
    if (!snippet) return null;
    return {
      caption: `${snippet.title ?? ''}\n${snippet.description ?? ''}`,
      authorHandle: snippet.channelTitle ?? null,
      thumbnailUrl: snippet.thumbnails?.medium?.url ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchTikTokCaption(url: string): Promise<OEmbedResult | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_url?: string; thumbnail_url?: string };
    if (!data.title) return null;
    const handleMatch = data.author_url?.match(/@([^/]+)/);
    return {
      caption: data.title,
      authorHandle: handleMatch?.[1] ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchInstagramCaption(url: string): Promise<OEmbedResult | null> {
  if (!META_TOKEN) return null;
  try {
    const res = await fetch(
      `${GRAPH}/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${META_TOKEN}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string };
    if (!data.title && !data.author_name) return null;
    return {
      caption: data.title ?? '',
      authorHandle: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchFacebookCaption(url: string): Promise<OEmbedResult | null> {
  if (!META_TOKEN) return null;
  try {
    const res = await fetch(
      `${GRAPH}/oembed_post?url=${encodeURIComponent(url)}&access_token=${META_TOKEN}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_name?: string; html?: string };
    // Facebooks oEmbed liefert für Posts oft keinen separaten Titel/Caption-Text,
    // nur ein einbettbares HTML-Snippet — als Fallback grob Text daraus extrahieren.
    const htmlText = data.html ? data.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const caption = data.title || htmlText;
    if (!caption && !data.author_name) return null;
    return {
      caption,
      authorHandle: data.author_name ?? null,
      thumbnailUrl: null,
    };
  } catch {
    return null;
  }
}

/** Holt Titel/Caption eines einzelnen, öffentlichen Posts. `null` = technischer Fehlschlag. */
export async function fetchPostCaption(platform: Platform, url: string): Promise<OEmbedResult | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;
  switch (platform) {
    case 'youtube':   return fetchYoutubeCaption(trimmed);
    case 'tiktok':    return fetchTikTokCaption(trimmed);
    case 'instagram': return fetchInstagramCaption(trimmed);
    case 'facebook':  return fetchFacebookCaption(trimmed);
    default:          return null;
  }
}

/** Case-/Whitespace-insensitiver Substring-Check (gleiches Muster wie Bio-Code-Prüfung). */
export function captionContainsTag(caption: string, requiredTag: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  return norm(caption).includes(norm(requiredTag));
}
