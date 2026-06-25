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

  // 200 = success, 202 = accepted/pending, 208 = already processed
  if (res.status !== 200 && res.status !== 202 && res.status !== 208) {
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

/**
 * Wartet, bis eine frisch hochgeladene Arweave-URL über das Gateway erreichbar ist (HTTP 200).
 *
 * Hintergrund: Eine rohe Arweave-Tx ist nach dem Post zunächst "pending" — das Gateway
 * liefert dann eine CDN-Error-Seite (302). Indexer (Helius/Solscan/ORB) holen die json_uri
 * sofort nach dem Mint und cachen diesen Fehlschlag als "no media available".
 * Diese Prüfung verzögert das On-chain-Asset, bis die Metadaten wirklich ausgeliefert werden.
 *
 * Best-effort: gibt nach maxWaitMs `false` zurück statt zu werfen — der Mint läuft dann
 * trotzdem weiter (alle Daten liegen ohnehin redundant im on-chain Attributes-Plugin).
 *
 * @returns true wenn erreichbar, false bei Timeout
 */
export async function waitForArweaveAvailability(
  uri: string,
  opts: { maxWaitMs?: number; intervalMs?: number; expectContentType?: string } = {},
): Promise<boolean> {
  const { maxWaitMs = 30000, intervalMs = 3000, expectContentType } = opts;
  const url      = resolveMediaUrl(uri);
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
      if (res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        // 200 + (optional) erwarteter Content-Type → propagiert & ausgeliefert
        if (!expectContentType || ct.includes(expectContentType)) return true;
      }
    } catch {
      // Netzwerk-/Gateway-Fehler ignorieren und erneut versuchen
    }
    if (Date.now() + intervalMs >= deadline) break;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}
