/**
 * NFT-Media-Speicherung auf Arweave (permanenter dezentraler Speicher).
 *
 * Verwendet dynamische Imports, damit webpack das Modul nicht bündelt
 * (arweave nutzt Node.js-native APIs wie crypto und https).
 *
 * ENV: ARWEAVE_WALLET_KEY  — JSON-String eines Arweave JWK-Wallets
 */

export interface UploadTag { name: string; value: string }

async function getArweave() {
  // Dynamic import prevents webpack from bundling arweave at build time.
  // At runtime on Vercel, Node.js resolves it from node_modules.
  const { default: Arweave } = await import('arweave') as { default: {
    init(cfg: { host: string; port: number; protocol: string }): ArweaveInstance;
  }};
  return Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
}

interface ArweaveInstance {
  wallets: {
    generate(): Promise<Record<string, string>>;
    jwkToAddress(jwk: Record<string, string>): Promise<string>;
  };
  transactions: {
    sign(tx: ArweaveTx, jwk?: Record<string, string>): Promise<void>;
    post(tx: ArweaveTx): Promise<{ status: number; statusText: string }>;
  };
  createTransaction(
    attrs: { data: Buffer | string },
    jwk?: Record<string, string>,
  ): Promise<ArweaveTx>;
}

interface ArweaveTx {
  id: string;
  addTag(name: string, value: string): void;
}

function getWallet(): Record<string, string> {
  const raw = process.env.ARWEAVE_WALLET_KEY;
  if (!raw) throw new Error('ARWEAVE_WALLET_KEY not configured. Generate a wallet via /api/admin/arweave-keygen');
  try { return JSON.parse(raw) as Record<string, string>; }
  catch { throw new Error('ARWEAVE_WALLET_KEY ist kein gültiges JSON'); }
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
