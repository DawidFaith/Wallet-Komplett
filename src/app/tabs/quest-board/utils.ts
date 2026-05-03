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
