/**
 * NFT-Media-Speicherung via Vercel Blob.
 *
 * Vercel Blob ist dauerhaft öffentlich zugänglich und sofort einsatzbereit.
 * Die gleiche Schnittstelle erlaubt später einen Wechsel zu Arweave.
 *
 * ENV: BLOB_READ_WRITE_TOKEN  (wird von Vercel automatisch gesetzt)
 */
import { put } from '@vercel/blob';

export interface UploadTag { name: string; value: string }

/**
 * Lädt eine Datei auf Vercel Blob hoch und gibt die öffentliche HTTPS-URL zurück.
 */
export async function uploadToArweave(
  data: Buffer | string,
  mimeType: string,
  tags: UploadTag[] = [],
): Promise<string> {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

  const ext = mimeType
    .split('/')[1]
    ?.replace('mpeg', 'mp3')
    .replace('jpeg', 'jpg')
    .replace('plain', 'txt') ?? 'bin';

  const nameTag = tags.find(t => t.name === 'Collection' || t.name === 'Type');
  const slug    = nameTag ? `-${nameTag.value.toLowerCase().replace(/\s+/g, '-')}` : '';
  const path    = `nft${slug}-${Date.now()}.${ext}`;

  const { url } = await put(path, buf, {
    access:      'public',
    contentType: mimeType,
  });

  return url;
}

/**
 * Holt eine Datei von einer URL und lädt sie auf Vercel Blob hoch.
 */
export async function fetchAndUploadToArweave(
  sourceUrl: string,
  mimeType: string,
  tags: UploadTag[] = [],
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Fetch fehlgeschlagen: ${sourceUrl} → ${res.status}`);
  const buf          = Buffer.from(await res.arrayBuffer());
  const detectedMime = res.headers.get('content-type')?.split(';')[0] ?? mimeType;
  return uploadToArweave(buf, detectedMime, tags);
}

/**
 * Gibt die HTTP-URL für NFT-Media-URIs zurück.
 * ar://xxx → https://arweave.net/xxx (falls irgendwann migriert wird)
 * ipfs://xxx → https://ipfs.io/ipfs/xxx
 * https://... → unverändert
 */
export function resolveMediaUrl(uri: string): string {
  if (uri.startsWith('ar://'))   return `https://arweave.net/${uri.slice(5)}`;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}
