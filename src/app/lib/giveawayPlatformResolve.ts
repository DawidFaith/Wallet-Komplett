import { extractTiktokVideoId, extractYoutubeVideoId } from './giveawayVerify';
import type { GiveawayPlatform } from './questDb';

/**
 * Löst Media-ID + Premiere-Zeitstempel für einen einzelnen Giveaway-Plattform-Eintrag auf —
 * gemeinsame Logik für "Kampagne erstellen" (mehrere Plattformen auf einmal) und
 * "Plattform nachträglich hinzufügen" (eine einzelne Plattform zu einer laufenden Kampagne).
 */
export async function resolveGiveawayPlatformEntry(
  origin: string,
  entry: { platform: GiveawayPlatform; postUrl: string; mediaId?: string | null; premiereStartsAt?: string | null },
): Promise<
  | { platform: GiveawayPlatform; postUrl: string; mediaId: string | null; premiereStartsAt: string | null }
  | { error: string }
> {
  const platform = entry.platform;
  const postUrl = entry.postUrl.trim();
  let mediaId: string | null = entry.mediaId?.trim() || null;

  if (!mediaId && (platform === 'tiktok' || platform === 'tiktok_polska')) {
    mediaId = extractTiktokVideoId(postUrl);
  } else if (!mediaId && platform === 'youtube') {
    mediaId = extractYoutubeVideoId(postUrl);
  } else if (!mediaId && (platform === 'instagram' || platform === 'instagram_polska')) {
    try {
      const res = await fetch(`${origin}/api/instagram-quests/resolve-reel?url=${encodeURIComponent(postUrl)}`);
      if (res.ok) {
        const data = await res.json();
        mediaId = data.mediaId ?? null;
      }
    } catch { /* Resolution fehlgeschlagen, mediaId bleibt null */ }
    if (!mediaId) {
      return { error: `Instagram-Link konnte nicht aufgelöst werden: ${postUrl}` };
    }
  }

  let premiereStartsAt: string | null = null;
  if (platform === 'youtube' && entry.premiereStartsAt?.trim()) {
    const parsed = new Date(entry.premiereStartsAt);
    if (isNaN(parsed.getTime())) {
      return { error: 'Ungültiger Premiere-Zeitstempel.' };
    }
    premiereStartsAt = parsed.toISOString();
  }

  return { platform, postUrl, mediaId, premiereStartsAt };
}
