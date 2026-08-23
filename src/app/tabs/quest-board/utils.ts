// ─── Gemeinsame Hilfsfunktionen für das Quest Board ──────────────────────────

export function shortenWallet(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function getProgressPercent(completions: number, max: number): number {
  return Math.min(100, Math.round((completions / max) * 100));
}

export function formatExpiry(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}T ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** DFAITH Credits mit 2 Nachkommastellen formatieren (DFAITH-Token-Decimals). */
export function formatCredits(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

const ANDROID_APP_PACKAGES: { pattern: RegExp; appPackage: string }[] = [
  { pattern: /tiktok\.com/i, appPackage: 'com.zhiliaoapp.musically' },
  { pattern: /instagram\.com/i, appPackage: 'com.instagram.android' },
];

/**
 * Für TikTok-/Instagram-Links auf Android: liefert einen intent://-Link statt der
 * normalen https://-URL, damit Android die jeweilige App (oder als Fallback den
 * Standard-Browser) öffnet — auch wenn die Seite gerade in einem eingebetteten
 * In-App-Browser (z.B. Instagram, Facebook) läuft, der normale Links sonst bei
 * sich festhält bzw. auf die eingeschränkte Web-Version führt (z.B. "Story
 * hinzufügen" fehlt dort bei Instagram-Posts).
 * Auf iOS/Desktop bzw. für andere Plattformen wird die URL unverändert zurückgegeben.
 */
export function getExternalLinkHref(url: string): string {
  if (typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent)) return url;
  const match = ANDROID_APP_PACKAGES.find((p) => p.pattern.test(url));
  if (!match) return url;
  try {
    const u = new URL(url);
    const rest = `${u.host}${u.pathname}${u.search}`;
    return `intent://${rest}#Intent;scheme=https;package=${match.appPackage};S.browser_fallback_url=${encodeURIComponent(url)};end`;
  } catch {
    return url;
  }
}
