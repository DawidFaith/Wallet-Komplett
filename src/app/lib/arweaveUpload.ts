/**
 * Permanente NFT-Media-Speicherung.
 *
 * Phase 1: Pinata IPFS (bereits integriert, sofort einsatzbereit)
 * Phase 2: Arweave via Irys — swap nur diese Datei aus, alle anderen bleiben gleich.
 *
 * IPFS-Hinweis: Content ist durch CID (Content-Hash) adressiert und kann von
 * beliebigen IPFS-Nodes gepinnt werden. Für langfristige Permanenz kann der
 * CID jederzeit auf Arweave gespiegelt werden.
 *
 * ENV: PINATA_JWT
 */

export interface UploadTag { name: string; value: string }

const PINATA_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const GATEWAY    = 'https://ipfs.io/ipfs';

async function pinToPinata(buf: Buffer, filename: string, mimeType: string): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT nicht konfiguriert');

  const formData = new FormData();
  formData.append('file', new Blob([buf], { type: mimeType }), filename);
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(PINATA_API, {
    method:  'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body:    formData,
  });

  if (!res.ok) throw new Error(`Pinata Upload fehlgeschlagen: ${await res.text()}`);
  const data = await res.json() as { IpfsHash: string };
  return data.IpfsHash;
}

/**
 * Lädt eine Datei auf IPFS (via Pinata) hoch.
 * Gibt die öffentliche Gateway-URL zurück: https://ipfs.io/ipfs/<CID>
 * Auch als ipfs://<CID> nutzbar in NFT-Metadaten (von Wallets wie Phantom unterstützt).
 */
export async function uploadToArweave(
  data: Buffer | string,
  mimeType: string,
  tags: UploadTag[] = [],
): Promise<string> {
  const buf      = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  const ext      = mimeType.split('/')[1]?.split('+')[0] ?? 'bin';
  const title    = tags.find(t => t.name === 'Title')?.value ?? 'nft-file';
  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}.${ext}`;

  const cid = await pinToPinata(buf, filename, mimeType);
  // ipfs:// wird von Phantom, Magic Eden, Tensor nativ aufgelöst
  return `ipfs://${cid}`;
}

/**
 * Holt eine Datei von einer URL und lädt sie auf IPFS hoch.
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

/** Gibt die HTTP-Gateway-URL für einen IPFS/Arweave URI zurück (für Previews im Browser). */
export function resolveMediaUrl(uri: string): string {
  if (uri.startsWith('ipfs://')) return `${GATEWAY}/${uri.slice(7)}`;
  if (uri.startsWith('ar://'))   return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}
