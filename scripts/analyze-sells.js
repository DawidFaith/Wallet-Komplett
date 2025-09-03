// Quick analyzer for D.FAITH sells: lists ETH+/WETH+ legs per tx hash
// Usage: node scripts/analyze-sells.js [ADDRESS]

const ALCHEMY_URL = "https://base-mainnet.g.alchemy.com/v2/7zoUrdSYTUNPJ9rNEiOM8";
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1".toLowerCase();
const WETH_TOKEN = "0x4200000000000000000000000000000000000006".toLowerCase();
const DFAITH_POOL = "0x59c7c832e96d2568bea6db468c1aadcbbda08a52".toLowerCase();

const ADDRESS = (process.argv[2] || process.env.ADDRESS || "0xeF54a1003C7BcbC5706B96B2839A76D2A4C68bCF").toLowerCase();

async function callAlchemy(method, params, id = 1) {
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'Alchemy error');
  return j.result;
}

async function getTransfers(address) {
  const baseParams = {
    fromBlock: "0x0",
    toBlock: "latest",
    withMetadata: true,
    excludeZeroValue: false,
    category: ["external", "erc20", "erc721", "erc1155"],
    maxCount: "0x1F4"
  };
  const [outgoing, incoming] = await Promise.all([
    callAlchemy('alchemy_getAssetTransfers', [{ ...baseParams, fromAddress: address }], 1),
    callAlchemy('alchemy_getAssetTransfers', [{ ...baseParams, toAddress: address }], 2)
  ]);
  const out = outgoing?.transfers || [];
  const inc = incoming?.transfers || [];
  return [...out, ...inc];
}

function lower(x) { return (x || '').toLowerCase(); }

function toNum(v) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  console.log(`Analyzing sells for address ${ADDRESS} on Base…`);
  const transfers = await getTransfers(ADDRESS);
  console.log(`Loaded ${transfers.length} transfers.`);

  const byHash = new Map();
  for (const t of transfers) {
    const h = t.hash;
    if (!h) continue;
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(t);
  }

  const sells = [];
  for (const [hash, txs] of byHash) {
    const dfMinus = txs.find(t => lower(t.rawContract?.address) === DFAITH_TOKEN && lower(t.from) === ADDRESS && lower(t.to) === DFAITH_POOL);
    if (!dfMinus) continue;
    const ethPlus = txs.filter(t => t.asset === 'ETH' && lower(t.to) === ADDRESS);
    const wethPlus = txs.filter(t => lower(t.rawContract?.address) === WETH_TOKEN && lower(t.to) === ADDRESS);
    sells.push({ hash, dfMinus, ethPlus, wethPlus, txs });
  }

  for (const s of sells.sort((a,b)=> (new Date(a.dfMinus?.metadata?.blockTimestamp||0)).getTime() - (new Date(b.dfMinus?.metadata?.blockTimestamp||0)).getTime())) {
    const ts = s.dfMinus?.metadata?.blockTimestamp;
    console.log(`\nSell @ ${ts} hash=${s.hash}`);
    console.log(`  D.FAITH - value=${s.dfMinus?.value} from=${s.dfMinus?.from} -> to=${s.dfMinus?.to}`);
    if (s.ethPlus.length) {
      for (const e of s.ethPlus) {
        console.log(`  ETH  + value=${e.value} from=${e.from} -> to=${e.to} category=${e.category}`);
      }
    } else {
      console.log(`  ETH  + none`);
    }
    if (s.wethPlus.length) {
      for (const w of s.wethPlus) {
        console.log(`  WETH + value=${w.value} from=${w.from} -> to=${w.to} category=${w.category}`);
      }
    } else {
      console.log(`  WETH + none`);
    }
  }

  const summary = {
    totalSells: sells.length,
    withEthPlus: sells.filter(s => s.ethPlus.length > 0).length,
    withWethPlus: sells.filter(s => s.wethPlus.length > 0).length,
    ethPlusFromPool: sells.filter(s => s.ethPlus.some(e => lower(e.from) === DFAITH_POOL)).length,
    wethPlusFromPool: sells.filter(s => s.wethPlus.some(w => lower(w.from) === DFAITH_POOL)).length,
  };
  console.log("\nSummary:")
  console.log(summary);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
