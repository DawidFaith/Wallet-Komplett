/**
 * GET /api/solana/balance?solanaAddress=...
 * Gibt SOL-Guthaben + alle SPL-Token-Balances inkl. On-Chain-Metadata zurück.
 */
import { NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, fetchMetadataFromSeeds } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey as umiPubkey } from '@metaplex-foundation/umi';

const RPC_URL       = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT   = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';
const PINATA_GW     = process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud';

export interface TokenEntry {
  mint:     string;
  balance:  number;
  decimals: number;
  name:     string;
  symbol:   string;
  image:    string | null;
  valueUsd: number | null;
  priceChange24h: number | null;
}

function resolveUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return `${PINATA_GW}/ipfs/${uri.slice(7)}`;
  return uri;
}

async function fetchTokenMeta(umi: ReturnType<typeof createUmi>, mint: string): Promise<{ name: string; symbol: string; image: string | null }> {
  let name   = mint.slice(0, 4) + '…' + mint.slice(-4);
  let symbol = 'SPL';
  let image: string | null = null;
  try {
    const meta = await fetchMetadataFromSeeds(umi, { mint: umiPubkey(mint) });
    name   = meta.name.replace(/\0/g, '').trim()   || name;
    symbol = meta.symbol.replace(/\0/g, '').trim() || symbol;
    const uri = meta.uri.replace(/\0/g, '').trim();
    if (uri) {
      try {
        const r = await fetch(resolveUri(uri), { signal: AbortSignal.timeout(4000) });
        if (r.ok) {
          const j = await r.json() as Record<string, unknown>;
          if (typeof j.image === 'string') image = resolveUri(j.image);
        }
      } catch { /* no image */ }
    }
  } catch { /* no on-chain metadata */ }
  return { name, symbol, image };
}

async function fetchSolMarket(): Promise<{ priceUsd: number | null; change24h: number | null }> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return { priceUsd: null, change24h: null };
    const d = await r.json() as { solana?: { usd?: number; usd_24h_change?: number } };
    return {
      priceUsd: typeof d.solana?.usd === 'number' ? d.solana.usd : null,
      change24h: typeof d.solana?.usd_24h_change === 'number' ? d.solana.usd_24h_change : null,
    };
  } catch {
    return { priceUsd: null, change24h: null };
  }
}

async function fetchSplMarket(mints: string[]): Promise<Record<string, { usd: number | null; change24h: number | null }>> {
  if (mints.length === 0) return {};

  const out: Record<string, { usd: number | null; change24h: number | null }> = {};
  for (const m of mints) out[m] = { usd: null, change24h: null };

  try {
    // Jupiter Price API v2 – kennt alle Tokens mit Liquiditätspool
    const ids = mints.join(',');
    const r = await fetch(
      `https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=false`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return out;

    const raw = await r.json() as { data?: Record<string, { price?: string | number } | null> };
    if (!raw.data) return out;

    for (const mint of mints) {
      const row = raw.data[mint];
      if (row?.price !== undefined && row.price !== null) {
        out[mint].usd = typeof row.price === 'string' ? parseFloat(row.price) : row.price;
      }
    }
  } catch { /* Jupiter nicht erreichbar – Preise bleiben null */ }

  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('solanaAddress');
  if (!address) return NextResponse.json({ error: 'solanaAddress fehlt' }, { status: 400 });

  let pubkey: PublicKey;
  try { pubkey = new PublicKey(address); }
  catch { return NextResponse.json({ error: 'Ungültige Solana-Adresse' }, { status: 400 }); }

  const connection = new Connection(RPC_URL, 'confirmed');
  const umi = createUmi(RPC_URL).use(mplTokenMetadata());

  // SOL Balance
  const lamports  = await connection.getBalance(pubkey);
  const solBalance = lamports / LAMPORTS_PER_SOL;

  // All SPL token accounts (non-zero)
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
  const nonEmpty = tokenAccounts.value.filter(
    ({ account }) => (account.data.parsed.info.tokenAmount.uiAmount ?? 0) > 0
  );
  const uniqueMints = [...new Set(nonEmpty.map(({ account }) => account.data.parsed.info.mint as string))];

  const [splMarket, solMarket] = await Promise.all([
    fetchSplMarket(uniqueMints),
    fetchSolMarket(),
  ]);

  // Fetch metadata in parallel
  const tokens: TokenEntry[] = await Promise.all(
    nonEmpty.map(async ({ account }) => {
      const info     = account.data.parsed.info;
      const mint: string   = info.mint;
      const decimals: number = info.tokenAmount.decimals;
      const balance: number  = info.tokenAmount.uiAmount ?? 0;
      const { name, symbol, image } = await fetchTokenMeta(umi, mint);
      const market = splMarket[mint];
      const priceUsd = market?.usd ?? null;
      return {
        mint,
        balance,
        decimals,
        name,
        symbol,
        image,
        valueUsd: priceUsd !== null ? balance * priceUsd : null,
        priceChange24h: market?.change24h ?? null,
      };
    })
  );

  // Sort: DFAITH first, then by balance desc
  tokens.sort((a, b) => {
    if (a.mint === DFAITH_MINT) return -1;
    if (b.mint === DFAITH_MINT) return 1;
    return b.balance - a.balance;
  });

  const dfaithBalance = tokens.find(t => t.mint === DFAITH_MINT)?.balance ?? null;
  const solPriceUsd = solMarket.priceUsd;
  const solValueUsd = solPriceUsd !== null ? solBalance * solPriceUsd : null;
  const solChange24h = solMarket.change24h;

  return NextResponse.json({
    solBalance,
    solPriceUsd,
    solValueUsd,
    solChange24h,
    dfaithBalance,
    tokens,
  });
}
