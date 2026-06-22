/**
 * NFT-Media-Speicherung auf Arweave (permanenter dezentraler Speicher).
 *
 * Verwendet dynamische Imports, damit webpack das Modul nicht bündelt
 * (arweave nutzt Node.js-native APIs wie crypto und https).
 *
 * ENV: ARWEAVE_WALLET_KEY  — JSON-String eines Arweave JWK-Wallets
 */
import type { JWKInterface } from 'arweave/node/lib/wallet';

export interface UploadTag { name: string; value: string }

async function getArweave() {
  const { default: Arweave } = await import('arweave');
  return Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
}

function getWallet(): JWKInterface {
  const raw = process.env.ARWEAVE_WALLET_KEY;
  if (!raw) throw new Error('ARWEAVE_WALLET_KEY not configured. Generate a wallet via /api/admin/arweave-keygen');
  return JSON.parse(raw) as JWKInterface;
}

export async function uploadToArweave(
  data: Buffer | string,
  mimeType: string,
  tags: UploadTag[] = [],
): Promise<string> {
  const arweave = await getArweave();
  const wallet  = getWallet();
  const buf     = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  const tx      = await arweave.createTransaction({ data: buf }, wallet);

  tx.addTag('Content-Type', mimeType);
  for (const tag of tags) tx.addTag(tag.name, tag.value);

  await arweave.transactions.sign(tx, wallet);
  const res = await arweave.transactions.post(tx);

  if (res.status !== 200 && res.status !== 208) {
    throw new Error(`Arweave Upload fehlgeschlagen: ${res.status} ${res.statusText}`);
  }
  return `ar://${tx.id}`;
}

export async function fetchAndUploadToArweave(
  sourceUrl: string,
  mimeType: string,
  tags: UploadTag[] = [],
): Promise<string> {
  const res  = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Fetch fehlgeschlagen: ${sourceUrl} → ${res.status}`);
  const buf  = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type')?.split(';')[0] ?? mimeType;
  return uploadToArweave(buf, mime, tags);
}

export function resolveMediaUrl(uri: string): string {
  if (uri.startsWith('ar://'))   return `https://arweave.net/${uri.slice(5)}`;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}
