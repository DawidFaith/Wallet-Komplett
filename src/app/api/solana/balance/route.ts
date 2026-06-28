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
const DFAITH_POOL   = '9Ei1AhVghZJxH1hsxP2rdakqBFN9sYsqH2hmTCgzC7yK';

export interface TokenEntry {
  mint:     string;
  balance:  number;
  decimals: number;
  name:     string;
  symbol:   string;
  image:    string | null;
  valueUsd: number | null;
  unitPriceUsd: number | null;  // Preis pro einzelnem Token in USD
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

// GeckoTerminal hat DFAITH indexiert (DEXscreener nicht)
async function fetchDfaithFromGeckoTerminal(): Promise<{ priceUsd: number | null; change24h: number | null }> {
  try {
    const r = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${DFAITH_MINT}/pools?page=1`,
      { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return { priceUsd: null, change24h: null };
    const d = await r.json() as { data?: Array<{ attributes?: { base_token_price_usd?: string; price_change_percentage?: { h24?: number | string } } }> };
    const pool = d?.data?.[0]?.attributes;
    const rawChange = pool?.price_change_percentage?.h24;
    return {
      priceUsd:  pool?.base_token_price_usd  ? parseFloat(pool.base_token_price_usd) : null,
      change24h: rawChange != null ? parseFloat(String(rawChange)) : null,
    };
  } catch {
    return { priceUsd: null, change24h: null };
  }
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
    // Jupiter Price API v2 – kennt bekannte Tokens mit Liquiditätspool
    const ids = mints.join(',');
    const r = await fetch(
      `https://api.jup.ag/price/v2?ids=${ids}`,
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

/**
 * Ableitung des D.FAITH-Preises via Jupiter Quote API:
 * 1 DFAITH → WSOL Quote → Umrechnung mit aktuellem SOL-Preis.
 * Fallback wenn Price API den Token nicht kennt.
 */
const WSOL_MINT     = 'So11111111111111111111111111111111111111112';
const JUPITER_QUOTE = 'https://api.jup.ag/swap/v1/quote';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? '';

async function fetchDfaithPriceFromQuote(
  dfaithMint: string,
  dfaithDecimals: number,
  solPriceUsd: number,
): Promise<number | null> {
  try {
    const amount = Math.pow(10, dfaithDecimals); // = 1 DFAITH in Basiseinheiten
    const url = `${JUPITER_QUOTE}?inputMint=${dfaithMint}&outputMint=${WSOL_MINT}&amount=${amount}&slippageBps=100&onlyDirectRoutes=false`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (JUPITER_API_KEY) headers['Authorization'] = `Bearer ${JUPITER_API_KEY}`;

    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;

    const q = await r.json() as { outAmount?: string; outputAmount?: string } | null;
    const outRaw = q?.outAmount ?? q?.outputAmount;
    if (!outRaw) return null;

    const solOut      = parseInt(outRaw, 10) / 1e9; // WSOL hat 9 Dezimalstellen
    return solOut * solPriceUsd;
  } catch {
    return null;
  }
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

  // All SPL token accounts (non-zero, keine NFTs — NFTs haben immer decimals=0)
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
  const nonEmpty = tokenAccounts.value.filter(({ account }) => {
    const amt = account.data.parsed.info.tokenAmount;
    return (amt.uiAmount ?? 0) > 0 && (amt.decimals as number) > 0;
  });
  const uniqueMints = [...new Set(nonEmpty.map(({ account }) => account.data.parsed.info.mint as string))];

  const [splMarket, solMarket, dfaithDex] = await Promise.all([
    fetchSplMarket(uniqueMints),
    fetchSolMarket(),
    fetchDfaithFromGeckoTerminal(),  // immer DFAITH Preis+Change via GeckoTerminal
  ]);

  // DFAITH Preis: DEXscreener ist primäre Quelle, Jupiter Quote als Fallback
  if (DFAITH_MINT) {
    const hasJupiterPrice = splMarket[DFAITH_MINT]?.usd !== null && splMarket[DFAITH_MINT]?.usd !== undefined;
    if (!hasJupiterPrice) {
      if (dfaithDex.priceUsd !== null) {
        splMarket[DFAITH_MINT] = { usd: dfaithDex.priceUsd, change24h: dfaithDex.change24h };
      } else if (uniqueMints.includes(DFAITH_MINT) && solMarket.priceUsd !== null) {
        const dfaithAccount = nonEmpty.find(({ account }) => account.data.parsed.info.mint === DFAITH_MINT);
        const dfaithDecimals: number = dfaithAccount?.account.data.parsed.info.tokenAmount.decimals ?? 2;
        const derivedPrice = await fetchDfaithPriceFromQuote(DFAITH_MINT, dfaithDecimals, solMarket.priceUsd);
        if (derivedPrice !== null) {
          splMarket[DFAITH_MINT] = { usd: derivedPrice, change24h: null };
        }
      }
    } else if (splMarket[DFAITH_MINT]?.change24h === null && dfaithDex.change24h !== null) {
      // Jupiter hat Preis aber kein Change → DEXscreener Change übernehmen
      splMarket[DFAITH_MINT] = { usd: splMarket[DFAITH_MINT].usd, change24h: dfaithDex.change24h };
    }
  }

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
        unitPriceUsd: priceUsd,
        priceChange24h: market?.change24h ?? null,
      };
    })
  );

  // DFAITH immer in der Liste — auch wenn kein ATA angelegt ist
  if (DFAITH_MINT && !tokens.some(t => t.mint === DFAITH_MINT)) {
    const dfaithMarket = splMarket[DFAITH_MINT];
    const dfaithMeta = await fetchTokenMeta(umi, DFAITH_MINT);
    tokens.push({
      mint: DFAITH_MINT,
      balance: 0,
      decimals: 2,
      name: dfaithMeta.name || 'D.FAITH',
      symbol: dfaithMeta.symbol || 'DFAITH',
      image: dfaithMeta.image || null,
      valueUsd: 0,
      unitPriceUsd: dfaithMarket?.usd ?? null,
      priceChange24h: dfaithMarket?.change24h ?? null,
    });
  }

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
