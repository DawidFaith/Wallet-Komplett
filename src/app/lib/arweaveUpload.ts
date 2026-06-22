/**
 * Permanente NFT-Media-Speicherung via Arweave.
 *
 * Nutzt das native `arweave` npm-Paket mit einem Arweave JWK-Wallet.
 * Zahlt einmalig in AR-Token — Dateien bleiben für 200+ Jahre gespeichert.
 *
 * Setup (einmalig):
 *   1. Arweave-Wallet generieren (GET /api/admin/arweave-keygen)
 *   2. Wallet-Adresse mit AR-Token aufladen (z.B. über Binance → Arweave)
 *   3. ARWEAVE_WALLET_KEY=<JSON-String> in Vercel Environment Variables eintragen
 *
 * ENV: ARWEAVE_WALLET_KEY  (stringified JWK, z.B. {"kty":"RSA","n":"...","e":"...","d":"...",...})
 */
import Arweave from 'arweave';

const arweave = Arweave.init({
  host:     'arweave.net',
  port:     443,
  protocol: 'https',
});

export interface UploadTag { name: string; value: string }

function getWallet(): object {
  const raw = process.env.ARWEAVE_WALLET_KEY;
  if (!raw) throw new Error('ARWEAVE_WALLET_KEY nicht konfiguriert. Bitte Arweave-Wallet generieren und in Vercel eintragen.');
  try {
    return JSON.parse(raw) as object;
  } catch {
    throw new Error('ARWEAVE_WALLET_KEY ist kein gültiges JSON (JWK-Format erwartet).');
  }
}

/**
 * Lädt eine Datei permanent auf Arweave hoch.
 * Gibt den permanenten Arweave-URI zurück: ar://<txId>
 * (Phantom, Magic Eden, Tensor lösen ar:// nativ auf)
 */
export async function uploadToArweave(
  data: Buffer | string,
  mimeType: string,
  tags: UploadTag[] = [],
): Promise<string> {
  const wallet = getWallet();
  const buf    = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

  const tx = await arweave.createTransaction({ data: buf }, wallet);
  tx.addTag('Content-Type', mimeType);
  for (const tag of tags) {
    tx.addTag(tag.name, tag.value);
  }

  await arweave.transactions.sign(tx, wallet);
  const response = await arweave.transactions.post(tx);

  if (response.status !== 200 && response.status !== 208) {
    throw new Error(`Arweave Upload fehlgeschlagen: Status ${response.status} – ${response.statusText}`);
  }

  return `ar://${tx.id}`;
}

/**
 * Holt eine Datei von einer URL und lädt sie permanent auf Arweave hoch.
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
 * Gibt die HTTP-Gateway-URL für NFT-Media URIs zurück (für Browser-Previews).
 * ar://xxx → https://arweave.net/xxx
 * ipfs://xxx → https://ipfs.io/ipfs/xxx
 */
export function resolveMediaUrl(uri: string): string {
  if (uri.startsWith('ar://'))   return `https://arweave.net/${uri.slice(5)}`;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}
