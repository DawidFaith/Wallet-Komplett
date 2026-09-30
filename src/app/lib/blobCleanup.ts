/**
 * Räumt Vercel-Blob-Dateien auf, wenn der dazugehörige Datenbank-Eintrag
 * endgültig gelöscht oder ein Feld (Bild/Audio/Video) überschrieben wird.
 * Vorher wurde nie etwas gelöscht — Speicherverbrauch wuchs nur, nie zurück.
 *
 * Best-effort: eine fehlschlagende Blob-Löschung (z.B. Datei schon weg,
 * Netzwerkfehler) bricht den aufrufenden Vorgang nicht ab — der DB-Zustand
 * ist bereits korrekt, ein verwaistes Blob ist der unkritischere Fehlerfall.
 */
import { del } from '@vercel/blob';

/** Nur echte Vercel-Blob-URLs löschen — nie fremde/externe URLs anfassen. */
function isOwnBlobUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length > 0 && url.includes('blob.vercel-storage.com');
}

export async function deleteBlobUrls(urls: Array<string | null | undefined>): Promise<void> {
  const targets = [...new Set(urls.filter(isOwnBlobUrl))];
  if (!targets.length) return;
  try {
    await del(targets);
  } catch (err) {
    console.warn('[blobCleanup] Löschen fehlgeschlagen (nicht kritisch):', err instanceof Error ? err.message : err);
  }
}
