import { useCallback, useMemo } from "react";
import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { FaPaperPlane, FaArrowDown, FaExchangeAlt, FaCoins, FaFilter, FaSort, FaBitcoin } from "react-icons/fa";
import { useActiveAccount } from "thirdweb/react";

// Token-Adressen und Konfiguration
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";
// Canonical WETH (Base)
const WETH_TOKEN = "0x4200000000000000000000000000000000000006";

// Swap Pool Adressen
const DFAITH_POOL = "0x59c7c832e96d2568bea6db468c1aadcbbda08a52"; // D.FAITH/ETH Pool
const DINVEST_POOL = "0xc0c3b18cdb9ee490ecda6e4a294c3499790aa0cb"; // D.INVEST/ETH Pool

// Shop Adresse
const SHOP_ADDRESS = "0xb53aBFC43355af7b4f8EcB14E0bB7651E6Ea5A55"; // Shop-Kauf Adresse

// Social Media Claim Adresse
const CLAIM_ADDRESS = "0xFe5F6cE95efB135b93899AF70B12727F93FEE6E2"; // Social Media Claim Adresse

// Token-Icons Mapping
const TOKEN_ICONS: { [key: string]: string } = {
  "D.FAITH": "/D.FAITH.png",
  "D.INVEST": "/D.INVEST.png", 
  "ETH": "/ETH.png",
  "WETH": "/ETH.png",
  "USDC": "/vercel.svg", // Placeholder
  "DEFAULT": "/thirdweb.svg"
};

type Transaction = {
  id: string;
  type: "send" | "receive" | "buy" | "sell" | "shop" | "claim";
  token: string;
  tokenIcon: string;
  amount: string;
  amountRaw: number;
  address: string;
  hash: string;
  time: string;
  timestamp: number;
  status: "success" | "pending" | "failed";
  blockNumber: string;
};

type FilterType = "all" | "send" | "receive" | "buy" | "sell" | "shop" | "claim";
type SortType = "newest" | "oldest" | "amount";

export default function HistoryTabOld() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [stats, setStats] = useState<{
    transactionCount: number;
    totalValue: number;
    sends: number;
    receives: number;
    buys: number;
    sells: number;
    shops: number;
    claims: number;
  } | null>(null);
  const account = useActiveAccount();

  // Nur verbundene Wallet verwenden - keine Demo-Daten
  const userAddress = account?.address;

  // Präzise Swap-Gruppierung und korrekte Claim-Erkennung - KOMPLETT NEU
  const filteredAndSortedTransactions = useMemo(() => {
  let filtered = transactions;
    
    // Filter anwenden
    if (filter !== 'all') {
      filtered = filtered.filter(tx => tx.type === filter);
    }
    
    // Sortierung anwenden
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a.timestamp - b.timestamp;
        case 'amount':
          return Math.abs(b.amountRaw) - Math.abs(a.amountRaw);
        case 'newest':
        default:
          return b.timestamp - a.timestamp;
      }
    });
    
    // NEUE GRUPPIERUNGSLOGIK - Schritt für Schritt
  const grouped: (Transaction | Transaction[])[] = [];
    const processed = new Set<string>();
  // Für Partner-Suche immer vollständige Liste (zeitlich sortiert) verwenden
  const allSorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  const WINDOW_MS = 10 * 60 * 1000; // ±10 Minuten
  const isPool = (addr?: string) => (addr || "").toLowerCase() === DFAITH_POOL.toLowerCase();
  const isEthOrWeth = (t?: string) => (t === "ETH" || t === "WETH");
    
    for (const tx of sorted) {
      if (processed.has(tx.id)) continue;
      
      // REGEL 1: SHOP-KÄUFE
      if (tx.address.toLowerCase() === SHOP_ADDRESS.toLowerCase() && tx.type === "shop") {
        grouped.push(tx);
        processed.add(tx.id);
        continue;
      }
      
      // REGEL 2: CLAIMS (Social Media)
      if (tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && tx.type === "claim") {
        const ethAfterClaim = sorted.find(otherTx => {
          return (
            !processed.has(otherTx.id) &&
            otherTx.id !== tx.id &&
            otherTx.token === "ETH" &&
            otherTx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() &&
            Math.abs(otherTx.timestamp - tx.timestamp) <= 300000
          );
        });
        
        if (ethAfterClaim) {
          const claimGroup = [tx, ethAfterClaim];
          (claimGroup as any).__groupType = 'claim';
          grouped.push(claimGroup);
          processed.add(tx.id);
          processed.add(ethAfterClaim.id);
        } else {
          grouped.push(tx);
          processed.add(tx.id);
        }
        continue;
      }

      // REGEL 3: VERKAUF (D.FAITH -> ETH)
      // 3-Teilige Gruppe: D.FAITH minus (an Pool) + ETH Gas (Fee) + ETH plus (vom Pool)
      if (
        tx.token === "D.FAITH" &&
        tx.type === "send" &&
        isPool(tx.address)
      ) {
        // ETH Plus vom Pool – bevorzugt gleicher Hash, alternativ Zeitfenster ±10min
        const sameHashPlus = allSorted.find(o =>
          !processed.has(o.id) &&
          o.id !== tx.id &&
          o.hash && o.hash === tx.hash &&
          isEthOrWeth(o.token) &&
          o.type === "receive" &&
          isPool(o.address)
        );

        const timeWinPlus = sameHashPlus || allSorted.find(o =>
          !processed.has(o.id) &&
          o.id !== tx.id &&
          isEthOrWeth(o.token) &&
          o.type === "receive" &&
          isPool(o.address) &&
          Math.abs(o.timestamp - tx.timestamp) <= WINDOW_MS
        );

        // Gas ETH – wir erkennen synthetische Gas-Einträge an gleicher Hash und token ETH
        const gasTx = allSorted.find(o =>
          !processed.has(o.id) &&
          o.id !== tx.id &&
          o.hash && o.hash === tx.hash &&
          o.token === "ETH" &&
          o.type === "send" &&
          (o.address === "Gas Fee" || o.address === "GAS" || o.address === "Gas")
        );

        const group: Transaction[] = [tx];
        if (gasTx) group.push(gasTx);
        if (timeWinPlus) group.push(timeWinPlus);

        if (group.length > 1) {
          (group as any).__groupType = 'sell';
          grouped.push(group);
          for (const g of group) processed.add(g.id);
          continue;
        }
        // Falls keine Partner gefunden: als Einzeltransaktion weiter unten behandeln
      }
      
      // REGEL 3-6 etc: Rest als Einzeltransaktionen
      grouped.push(tx);
      processed.add(tx.id);
    }
    
    // Filter nach Gruppierung anwenden
  if (filter !== 'all') {
      const filteredGroups = grouped.filter(item => {
        if (Array.isArray(item)) {
          const groupType = (item as any).__groupType;
      if (filter === 'claim') return groupType === 'claim';
      if (filter === 'sell') return groupType === 'sell';
          return false;
        } else {
          const tx = item as Transaction;
          return tx.type === filter;
        }
      });
      return filteredGroups;
    }
    
    return grouped;
  }, [transactions, filter, sortBy]);

  // Token-Icon Hilfsfunktion
  const getTokenIcon = (token: string) => {
    switch (token.toUpperCase()) {
      case "D.FAITH":
        return "/D.FAITH.png";
      case "D.INVEST":
        return "/D.INVEST.png";
      case "ETH":
        return "/ETH.png";
      case "WETH":
        return "/ETH.png"; // Verwende ETH Icon für WETH
      default:
        return "/ETH.png"; // Fallback auf ETH Icon
    }
  };

  const API_OPTIONS = {
    ALCHEMY: "https://base-mainnet.g.alchemy.com/v2/7zoUrdSYTUNPJ9rNEiOM8",
    THIRDWEB_RPC: "https://8453.rpc.thirdweb.com",
    BASE_RPC: "https://mainnet.base.org",
    INFURA: "https://base-mainnet.infura.io/v3/YOUR_KEY",
    QUICKNODE: "https://base-mainnet.quiknode.pro/YOUR_KEY"
  };

  const TEST_WALLET = "0xeF54a1003C7BcbC5706B96B2839A76D2A4C68bCF";

  const getTransactionsFromAlchemy = async (address: string) => {
    try {
      const alchemyUrl = API_OPTIONS.ALCHEMY;
  const outgoingResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
    fromBlock: "0x0",
            toBlock: "latest",
            fromAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"],
            withMetadata: true,
            excludeZeroValue: false,
    maxCount: "0x1F4"
          }],
          id: 1
        })
      });

  const incomingResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
    fromBlock: "0x0",
            toBlock: "latest",
            toAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"],
            withMetadata: true,
            excludeZeroValue: false,
    maxCount: "0x1F4"
          }],
          id: 2
        })
      });

      if (!outgoingResponse.ok || !incomingResponse.ok) {
        throw new Error(`Alchemy API HTTP Error: ${outgoingResponse.status} / ${incomingResponse.status}`);
      }

      const outgoingData = await outgoingResponse.json();
      const incomingData = await incomingResponse.json();

      if (outgoingData.error) {
        throw new Error(`Alchemy API Error (Outgoing): ${outgoingData.error.message}`);
      }
      if (incomingData.error) {
        throw new Error(`Alchemy API Error (Incoming): ${incomingData.error.message}`);
      }

      const outgoingTransfers = outgoingData.result?.transfers || [];
      const incomingTransfers = incomingData.result?.transfers || [];
      const allTransfers = [...outgoingTransfers, ...incomingTransfers];
      return allTransfers;
    } catch (error) {
      console.error("❌ Alchemy Error:", error);
      throw error;
    }
  };

  const refreshTransactions = useCallback(async () => {
    if (!userAddress) {
      setTransactions([]);
      setError("Bitte verbinden Sie Ihre Wallet um Transaktionen zu sehen.");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      const testAddress = userAddress || TEST_WALLET;
      const alchemyTransactions = await getTransactionsFromAlchemy(testAddress);
      
      if (alchemyTransactions.length === 0) {
        setTransactions([]);
        setError("Keine Transaktionen für diese Wallet gefunden.");
        setIsLoading(false);
        return;
      }

  const mappedTransactions: Transaction[] = alchemyTransactions
        .map((transfer: any) => {
          let timestamp = new Date();
          if (transfer.metadata?.blockTimestamp) {
            timestamp = new Date(transfer.metadata.blockTimestamp);
          }
          
          const time = timestamp.toLocaleString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          });
          
          const isReceived = transfer.to?.toLowerCase() === testAddress.toLowerCase();
          const fromAddress = transfer.from?.toLowerCase();
          const toAddress = transfer.to?.toLowerCase();
          
          let type: "send" | "receive" | "buy" | "sell" | "shop" | "claim";
          let address = isReceived ? transfer.from : transfer.to;
          
          let token = transfer.asset || "ETH";
          if (transfer.rawContract?.address) {
            if (transfer.rawContract.address.toLowerCase() === DFAITH_TOKEN.toLowerCase()) {
              token = "D.FAITH";
            } else if (transfer.rawContract.address.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
            } else if (transfer.rawContract.address.toLowerCase() === WETH_TOKEN.toLowerCase()) {
              token = "WETH";
            }
          }
          
          if (fromAddress === CLAIM_ADDRESS.toLowerCase() && isReceived) {
            type = "claim";
            address = CLAIM_ADDRESS;
          } else if (toAddress === SHOP_ADDRESS.toLowerCase() && !isReceived) {
            type = "shop";
            address = SHOP_ADDRESS;
          } else {
            type = isReceived ? "receive" : "send";
          }
          
          let amount = transfer.value || "0";
          let amountRaw = 0;
          
          if (transfer.rawContract?.address) {
            if (transfer.rawContract.address.toLowerCase() === DFAITH_TOKEN.toLowerCase()) {
              token = "D.FAITH";
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              amount = (type === "receive" || type === "claim" ? "+" : "-") + value.toFixed(2);
            } else if (transfer.rawContract.address.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
              const value = parseInt(transfer.value || "0");
              amountRaw = value;
              amount = (type === "receive" || type === "claim" ? "+" : "-") + value.toString();
            } else if (transfer.rawContract.address.toLowerCase() === WETH_TOKEN.toLowerCase()) {
              token = "WETH";
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              amount = (type === "receive" || type === "claim" ? "+" : "-") + value.toFixed(6);
            } else {
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              amount = (type === "receive" || type === "claim" ? "+" : "-") + value.toFixed(6);
            }
          } else {
            const value = parseFloat(transfer.value || "0");
            amountRaw = value;
            amount = (type === "receive" || type === "claim" ? "+" : "-") + value.toFixed(6);
          }
          
          return {
            id: transfer.uniqueId || transfer.hash || Math.random().toString(),
            type,
            token,
            tokenIcon: getTokenIcon(token),
            amount,
            amountRaw,
            address: address || "",
            hash: transfer.hash || "",
            time,
            timestamp: timestamp.getTime(),
            status: "success" as const,
            blockNumber: transfer.blockNum || "",
          };
        })
  .filter((tx) => tx.hash && tx.address)
  .sort((a, b) => b.timestamp - a.timestamp);

      // Zusätzliche: Gas-Fee-Einträge für D.FAITH-Verkäufe (synthetische ETH-Transaktionen)
      const sellHashes = Array.from(new Set(
        mappedTransactions
          .filter(t => t.token === "D.FAITH" && t.type === "send" && t.address.toLowerCase() === DFAITH_POOL.toLowerCase() && t.hash)
          .map(t => t.hash)
      ));

      const gasTxs: Transaction[] = [];

      const hexToBigInt = (h: string) => BigInt(h || '0x0');
      const weiToEth = (wei: bigint) => Number(wei) / 1e18;

      for (const h of sellHashes) {
        try {
          const [receiptResp] = await Promise.all([
            fetch(API_OPTIONS.ALCHEMY, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 100, method: 'eth_getTransactionReceipt', params: [h] })
            })
          ]);

          if (!receiptResp.ok) continue;
          const receipt = await receiptResp.json();
          const r = receipt?.result;
          if (!r) continue;
          const gasUsed = hexToBigInt(r.gasUsed || '0x0');
          const effGasPrice = hexToBigInt(r.effectiveGasPrice || r.gasPrice || '0x0');
          const feeWei = gasUsed * effGasPrice;
          const feeEth = weiToEth(feeWei);

          // Hole Zeitstempel vom existierenden Transfer mit gleichem Hash
          const anchor = mappedTransactions.find(t => t.hash === h);
          if (!anchor) continue;
          const feeAmount = Math.max(feeEth, 0);
          const gasTx: Transaction = {
            id: `gas-${h}`,
            type: "send",
            token: "ETH",
            tokenIcon: getTokenIcon("ETH"),
            amount: `-${feeAmount.toFixed(6)}`,
            amountRaw: feeAmount,
            address: "Gas Fee",
            hash: h,
            time: anchor.time,
            timestamp: anchor.timestamp,
            status: "success",
            blockNumber: r.blockNumber || anchor.blockNumber,
          };
          gasTxs.push(gasTx);
        } catch (e) {
          // Ignoriere Gasfehler pro Hash
        }
      }

      const merged = [...mappedTransactions, ...gasTxs].sort((a,b)=> b.timestamp - a.timestamp);
      setTransactions(merged);
      
      setStats({
        transactionCount: mappedTransactions.length,
        totalValue: mappedTransactions.reduce((sum, tx) => sum + Math.abs(tx.amountRaw), 0),
        sends: mappedTransactions.filter(tx => tx.type === "send").length,
        receives: mappedTransactions.filter(tx => tx.type === "receive").length,
        buys: mappedTransactions.filter(tx => tx.type === "buy").length,
        sells: mappedTransactions.filter(tx => tx.type === "sell").length,
        shops: mappedTransactions.filter(tx => tx.type === "shop").length,
        claims: mappedTransactions.filter(tx => tx.type === "claim").length,
      });
      
    } catch (err: any) {
      console.error("Blockchain data loading error:", err);
      setError(`Fehler beim Laden der Blockchain-Daten: ${err.message}`);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refreshTransactions();
  }, [userAddress, refreshTransactions]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "send":
        return <FaPaperPlane className="text-white text-xs" />;
      case "receive":
        return <FaArrowDown className="text-white text-xs" />;
      case "buy":
  return <FaBitcoin className="text-white text-xs" />;
      case "sell":
  return <span className="text-white text-xs">�</span>;
      case "shop":
        return <span className="text-white text-xs">🛍️</span>;
      case "claim":
        return <span className="text-white text-xs">🎁</span>;
      default:
        return <FaCoins className="text-white text-xs" />;
    }
  };

  const getAmountColor = (amount: string) => {
    if (amount.startsWith("+")) return "text-green-400";
    if (amount.startsWith("-")) return "text-red-400";
    return "text-amber-400";
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-6">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          Transaktionshistorie (Alt)
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base">Legacy Ansicht</p>
        {userAddress && (
          <p className="text-xs text-zinc-500 mt-1">
            Wallet: {formatAddress(userAddress)}
          </p>
        )}
      </div>

      {!isLoading && !error && (filteredAndSortedTransactions as any).length > 0 && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          {/* Legacy Rendering aus alter Version beibehalten */}
          {filteredAndSortedTransactions.map((item, index) => (
            Array.isArray(item) ? (() => {
              const group = item as Transaction[];
              const gType = (group as any).__groupType as string | undefined;
              if (gType === 'sell') {
                const dfMinus = group.find(t => t.token === 'D.FAITH' && t.amount.startsWith('-'));
                const gas = group.find(t => t.address === 'Gas Fee');
                const ethPlus = group.find(t => (t.token === 'ETH' || t.token === 'WETH') && t.amount.startsWith('+'));
                return (
                  <div key={`group-${index}`} className="border-l-4 border-rose-400 bg-gradient-to-r from-rose-950/30 to-rose-900/20 rounded-r-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center">
                          <span className="text-white text-lg">📉</span>
                        </div>
                        <div>
                          <h3 className="text-rose-300 font-bold text-lg">Verkauf</h3>
                          <p className="text-zinc-400 text-sm">{group[0]?.time} • {group.length} Transaktionen</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {dfMinus && (
                        <div className="flex items-center gap-2 rounded-md border border-red-700/40 bg-red-900/20 px-2 py-1.5">
                          <img src={dfMinus.tokenIcon} alt={dfMinus.token} className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="text-red-300 text-sm font-semibold">{dfMinus.amount} {dfMinus.token}</div>
                            <div className="text-red-400/80 text-[11px]">Abgegeben</div>
                          </div>
                        </div>
                      )}
                      {gas && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-900/20 px-2 py-1.5">
                          <img src={gas.tokenIcon} alt="ETH" className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="text-amber-300 text-sm font-semibold">{gas.amount} ETH</div>
                            <div className="text-amber-400/80 text-[11px]">Gas</div>
                          </div>
                        </div>
                      )}
                      {ethPlus && (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-700/40 bg-emerald-900/20 px-2 py-1.5">
                          <img src={ethPlus.tokenIcon} alt="ETH" className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="text-emerald-300 text-sm font-semibold">{ethPlus.amount} {(ethPlus.token === 'WETH' ? 'WETH' : 'ETH')}</div>
                            <div className="text-emerald-400/80 text-[11px]">Erhalten</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Standard-Gruppenkarte
              return (
                <div key={`group-${index}`} className="border-l-4 border-cyan-400 bg-gradient-to-r from-cyan-950/30 to-cyan-900/20 rounded-r-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center">
                        <span className="text-white text-lg">🎁</span>
                      </div>
                      <div>
                        <h3 className="text-cyan-300 font-bold text-lg">Gruppiert</h3>
                        <p className="text-zinc-400 text-sm">{(item as any)[0]?.time} • {(item as any).length} Transaktionen</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div key={(item as any).id} className={`border-l-4 border-zinc-600 bg-gradient-to-r from-zinc-800/90 to-zinc-900/90 rounded-r-xl p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-zinc-600 flex items-center justify-center`}>
                      {getTransactionIcon((item as any).type)}
                    </div>
                    <div>
                      <h3 className={`text-zinc-300 font-bold text-lg`}>
                        {(item as any).type?.toUpperCase?.()}
                      </h3>
                      <p className="text-zinc-400 text-sm">{(item as any).time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-xl ${getAmountColor((item as any).amount)}`}>{(item as any).amount}</div>
                    <div className="text-zinc-400 text-sm">{(item as any).token}</div>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-6">
          <div className="bg-red-500/20 text-red-400 rounded-lg p-4 border border-red-500/30">
            <p className="font-semibold mb-1">Blockchain-Verbindung fehlgeschlagen</p>
            <p className="text-sm mb-2">{error}</p>
          </div>
        </div>
      )}

      <div className="flex justify-center mt-4 sm:mt-6">
        <Button
          onClick={refreshTransactions}
          className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold px-4 py-2 sm:px-6 sm:py-2 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
              <span className="hidden sm:inline">Lädt...</span>
              <span className="sm:hidden">...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FaExchangeAlt className="text-black" />
              <span className="hidden sm:inline">Transaktionen neu laden</span>
              <span className="sm:hidden">Neu laden</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
