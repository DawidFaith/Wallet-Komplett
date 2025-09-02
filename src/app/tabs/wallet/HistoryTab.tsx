import { useCallback, useMemo } from "react";
import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { FaPaperPlane, FaArrowDown, FaExchangeAlt, FaCoins, FaFilter, FaSort } from "react-icons/fa";
import { useActiveAccount } from "thirdweb/react";

// Token-Adressen und Konfiguration
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";

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

export default function HistoryTab() {
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

  // Präzise Swap-Gruppierung und korrekte Claim-Erkennung
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
    
    // Präzise Swap-Gruppierung: Nur echte 2-Transaktions-Swaps
    const grouped: (Transaction | Transaction[])[] = [];
    const processed = new Set<string>();
    
    for (const tx of sorted) {
      if (processed.has(tx.id)) continue;
      
      // Sehr enge Zeittoleranz für echte Swaps
      const timeWindow = 60000; // 1 Minute für echte Swaps
      
      // Suche nach EXAKT einem Partner für echte Swaps ODER Claim+ETH Kombinationen
      const swapPartner = sorted.find(otherTx => {
        if (otherTx.id === tx.id || processed.has(otherTx.id)) return false;
        
        const timeDiff = Math.abs(otherTx.timestamp - tx.timestamp);
        
        // Gleicher Hash = definitiv gleiche Transaktion (Multi-Asset Transfer)
        if (tx.hash === otherTx.hash) {
          return (tx.amountRaw < 0 && otherTx.amountRaw > 0) || 
                 (tx.amountRaw > 0 && otherTx.amountRaw < 0);
        }
        
        // Social Media Claims + ETH Gruppierung (präzise Betragserkennung)
        const isClaimWithEth = (
          // ETH mit exaktem Claim-Betrag von Claim-Adresse
          ((tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && tx.token === "ETH" && tx.amountRaw === 0.0000010) &&
           (otherTx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && otherTx.token !== "ETH")) ||
          // Oder umgekehrt: Token-Claim mit nachfolgendem ETH
          ((otherTx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && otherTx.token === "ETH" && otherTx.amountRaw === 0.0000010) &&
           (tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && tx.token !== "ETH"))
        );
        
        // Pool-basierte Swaps mit sehr enger Zeit-Toleranz
        const isPoolSwap = (
          timeDiff <= timeWindow &&
          ((tx.address.toLowerCase() === DFAITH_POOL.toLowerCase() ||
            tx.address.toLowerCase() === DINVEST_POOL.toLowerCase()) &&
           (otherTx.address.toLowerCase() === DFAITH_POOL.toLowerCase() ||
            otherTx.address.toLowerCase() === DINVEST_POOL.toLowerCase())) &&
          // Einer muss negativ, einer positiv sein
          ((tx.amountRaw < 0 && otherTx.amountRaw > 0) || 
           (tx.amountRaw > 0 && otherTx.amountRaw < 0)) &&
          // ETH <-> Token Kombination
          ((tx.token === "ETH" && (otherTx.token === "D.FAITH" || otherTx.token === "D.INVEST")) ||
           ((tx.token === "D.FAITH" || tx.token === "D.INVEST") && otherTx.token === "ETH"))
        );
        
        return isClaimWithEth || isPoolSwap;
      });
      
      if (swapPartner) {
        // Bestimme ob es ein Swap oder eine Claim-Gruppe ist
        const isClaimGroup = (tx.type === 'claim' || swapPartner.type === 'claim') ||
                            (tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() || 
                             swapPartner.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase());
        
        // Erstelle Gruppe mit entsprechender Sortierung
        const group = [tx, swapPartner].sort((a, b) => {
          if (isClaimGroup) {
            // Bei Claims: Token zuerst, dann ETH
            if (a.token !== "ETH" && b.token === "ETH") return -1;
            if (a.token === "ETH" && b.token !== "ETH") return 1;
            return a.timestamp - b.timestamp;
          } else {
            // Bei Swaps: Verkaufte (negative) Beträge zuerst
            if (a.amountRaw < 0 && b.amountRaw > 0) return -1;
            if (a.amountRaw > 0 && b.amountRaw < 0) return 1;
            return a.timestamp - b.timestamp;
          }
        });
        
        grouped.push(group);
        processed.add(tx.id);
        processed.add(swapPartner.id);
        
        if (isClaimGroup) {
          console.log("🎁 Social Media Claim-Gruppe (Token + ETH):", group.map(t => ({
            type: t.type,
            token: t.token,
            amount: t.amount,
            time: t.time,
            timeDiff: Math.abs(group[0].timestamp - group[1].timestamp) + 'ms'
          })));
        } else {
          console.log("🔄 Echter Swap (2 Transaktionen):", group.map(t => ({
            type: t.type,
            token: t.token,
            amount: t.amount,
            hash: t.hash.slice(0, 10),
            address: t.address.slice(0, 10)
          })));
        }
      } else {
        // Einzelne Transaktion (inkl. Claims)
        grouped.push(tx);
        processed.add(tx.id);
        
        // Debug für Claims
        if (tx.type === 'claim') {
          console.log("🎁 Social Media Claim erkannt:", {
            token: tx.token,
            amount: tx.amount,
            address: tx.address,
            time: tx.time
          });
        }
      }
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
  };  /*
  🔧 SETUP-OPTIONEN FÜR ECHTE BLOCKCHAIN-DATEN:
  
  1. ALCHEMY (Empfohlen):
     - Registrierung: https://alchemy.com
     - API Key ersetzen in: API_OPTIONS.ALCHEMY
     - 300M CU/Monat kostenlos
  
  2. INFURA:
     - Registrierung: https://infura.io  
     - API Key ersetzen in: API_OPTIONS.INFURA
     - 100k Requests/Tag kostenlos
  
  3. QUICKNODE (Premium):
     - Registrierung: https://quicknode.com
     - Dedicated Base Chain Endpoint
     - Höchste Zuverlässigkeit
  
  4. THIRDWEB (Aktuell):
     - Bereits integriert
     - Limitierte kostenlose Nutzung
     - Für Entwicklung ausreichend
  */

  // Mehrere API-Optionen für echte Base Chain Daten
  const API_OPTIONS = {
    // Option 1: Alchemy mit dem bereitgestellten Key
    ALCHEMY: "https://base-mainnet.g.alchemy.com/v2/7zoUrdSYTUNPJ9rNEiOM8",
    
    // Option 2: Thirdweb RPC (bereits verfügbar)
    THIRDWEB_RPC: "https://8453.rpc.thirdweb.com",
    
    // Option 3: Öffentliche Base RPC
    BASE_RPC: "https://mainnet.base.org",
    
    // Option 4: Infura Base (benötigt eigenen Key)
    INFURA: "https://base-mainnet.infura.io/v3/YOUR_KEY",
    
    // Option 5: QuickNode (Premium)
    QUICKNODE: "https://base-mainnet.quiknode.pro/YOUR_KEY"
  };

  // Test-Wallet für Entwicklung
  const TEST_WALLET = "0xeF54a1003C7BcbC5706B96B2839A76D2A4C68bCF";

  // Alchemy API für Asset Transfers (bessere Methode)
  const getTransactionsFromAlchemy = async (address: string) => {
    try {
      const alchemyUrl = API_OPTIONS.ALCHEMY;
      
      // Hole ausgehende Transaktionen - ab August 2025 für aktuelle Daten
      const outgoingResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: "0x2000000", // Ab ca. August 2025 für aktuelle Transaktionen
            toBlock: "latest",
            fromAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"], // Erweiterte Kategorien
            withMetadata: true,
            excludeZeroValue: false, // Auch 0-Wert Transaktionen anzeigen
            maxCount: "0x64" // Mehr Transaktionen laden (100)
          }],
          id: 1
        })
      });

      // Hole eingehende Transaktionen - ab August 2025 für aktuelle Daten
      const incomingResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: "0x2000000", // Ab ca. August 2025 für aktuelle Transaktionen
            toBlock: "latest",
            toAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"], // Erweiterte Kategorien
            withMetadata: true,
            excludeZeroValue: false, // Auch 0-Wert Transaktionen anzeigen
            maxCount: "0x64" // Mehr Transaktionen laden (100)
          }],
          id: 2
        })
      });

      if (!outgoingResponse.ok || !incomingResponse.ok) {
        throw new Error(`Alchemy API HTTP Error: ${outgoingResponse.status} / ${incomingResponse.status}`);
      }

      const outgoingData = await outgoingResponse.json();
      const incomingData = await incomingResponse.json();

      // Debug: Log der API-Antworten
      console.log("🔍 Alchemy Outgoing:", outgoingData);
      console.log("🔍 Alchemy Incoming:", incomingData);

      if (outgoingData.error) {
        throw new Error(`Alchemy API Error (Outgoing): ${outgoingData.error.message}`);
      }
      
      if (incomingData.error) {
        throw new Error(`Alchemy API Error (Incoming): ${incomingData.error.message}`);
      }

      const outgoingTransfers = outgoingData.result?.transfers || [];
      const incomingTransfers = incomingData.result?.transfers || [];
      const allTransfers = [...outgoingTransfers, ...incomingTransfers];

      // Debug: Detaillierte Analyse der Transfers
      console.log("📊 Ausgehende Transfers Details:", outgoingTransfers.map((t: any) => ({
        hash: t.hash,
        from: t.from,
        to: t.to,
        asset: t.asset,
        value: t.value,
        timestamp: t.metadata?.blockTimestamp,
        category: t.category
      })));
      
      console.log("📊 Eingehende Transfers Details:", incomingTransfers.map((t: any) => ({
        hash: t.hash,
        from: t.from,
        to: t.to,
        asset: t.asset,
        value: t.value,
        timestamp: t.metadata?.blockTimestamp,
        category: t.category
      })));

      console.log(`📊 Gefundene Transfers: ${outgoingTransfers.length} ausgehend, ${incomingTransfers.length} eingehend, ${allTransfers.length} total`);

      return allTransfers;
      
    } catch (error) {
      console.error("❌ Alchemy Error:", error);
      throw error;
    }
  };

  // Funktion zum Neuladen der Transaktionen
  const refreshTransactions = useCallback(async () => {
    if (!userAddress) {
      setTransactions([]);
      setError("Bitte verbinden Sie Ihre Wallet um Transaktionen zu sehen.");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      // Teste Alchemy API mit der spezifischen Wallet-Adresse
      const testAddress = userAddress || TEST_WALLET;
      const alchemyTransactions = await getTransactionsFromAlchemy(testAddress);
      
      // Verarbeite die Transaktionen auch wenn wenige vorhanden sind
      if (alchemyTransactions.length === 0) {
        setTransactions([]);
        setError("Keine Transaktionen für diese Wallet gefunden.");
        setIsLoading(false);
        return;
      }

      // Verarbeite Alchemy Asset Transfers zu Transaktionen
      const mappedTransactions: Transaction[] = alchemyTransactions
        .map((transfer: any) => {
          // Zeitstempel von Alchemy Metadata
          let timestamp = new Date();
          if (transfer.metadata?.blockTimestamp) {
            timestamp = new Date(transfer.metadata.blockTimestamp);
          }
          
          const time = timestamp.toLocaleString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          });
          
          // Bestimme Transaktionsrichtung und -typ
          const isReceived = transfer.to?.toLowerCase() === testAddress.toLowerCase();
          const fromAddress = transfer.from?.toLowerCase();
          const toAddress = transfer.to?.toLowerCase();
          
          let type: "send" | "receive" | "buy" | "sell" | "shop" | "claim";
          let address = isReceived ? transfer.from : transfer.to;
          
          // Claim-Erkennung (höchste Priorität nach Shop) - auch für ETH
          if (fromAddress === CLAIM_ADDRESS.toLowerCase() && isReceived) {
            // Transaktion von Claim-Adresse = Social Media Claim
            type = "claim";
            address = CLAIM_ADDRESS;
            console.log("🎁 Social Media Claim erkannt in Verarbeitung:", {
              hash: transfer.hash,
              from: fromAddress,
              to: toAddress,
              asset: transfer.asset,
              value: transfer.value
            });
          }
          // Shop-Kauf Erkennung
          else if (toAddress === SHOP_ADDRESS.toLowerCase() && !isReceived) {
            // Transaktion an Shop = Kauf im Shop
            type = "shop";
            address = SHOP_ADDRESS;
          } 
          // Swap-Erkennung basierend auf Pool-Adressen
          else if (fromAddress === DFAITH_POOL.toLowerCase() && isReceived) {
            // D.FAITH von Pool erhalten = D.FAITH gekauft
            type = "buy";
            address = DFAITH_POOL;
          } else if (toAddress === DFAITH_POOL.toLowerCase() && !isReceived) {
            // D.FAITH an Pool gesendet = D.FAITH verkauft
            type = "sell";
            address = DFAITH_POOL;
          } else if (fromAddress === DINVEST_POOL.toLowerCase() && isReceived) {
            // D.INVEST von Pool erhalten = D.INVEST gekauft
            type = "buy";
            address = DINVEST_POOL;
          } else if (toAddress === DINVEST_POOL.toLowerCase() && !isReceived) {
            // D.INVEST an Pool gesendet = D.INVEST verkauft
            type = "sell";
            address = DINVEST_POOL;
          } else {
            // Normale Transaktion (nicht über Pools, Shop oder Claim)
            type = isReceived ? "receive" : "send";
          }
          
          // Token und Betrag formatieren
          let token = transfer.asset || "ETH";
          let amount = transfer.value || "0";
          let amountRaw = 0;
          
          // Spezielle Behandlung für unsere Token
          if (transfer.rawContract?.address) {
            if (transfer.rawContract.address.toLowerCase() === DFAITH_TOKEN.toLowerCase()) {
              token = "D.FAITH";
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              // Bei Käufen/Verkäufen/Shop/Claims andere Formatierung
              if (type === "buy" || type === "claim") {
                amount = "+" + value.toFixed(2);
              } else if (type === "sell" || type === "shop") {
                amount = "-" + value.toFixed(2);
              } else {
                amount = (type === "receive" ? "+" : "-") + value.toFixed(2);
              }
            } else if (transfer.rawContract.address.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
              const value = parseInt(transfer.value || "0");
              amountRaw = value;
              // Bei Käufen/Verkäufen/Shop/Claims andere Formatierung
              if (type === "buy" || type === "claim") {
                amount = "+" + value.toString();
              } else if (type === "sell" || type === "shop") {
                amount = "-" + value.toString();
              } else {
                amount = (type === "receive" ? "+" : "-") + value.toString();
              }
            } else {
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              if (type === "buy" || type === "claim") {
                amount = "+" + value.toFixed(6);
              } else if (type === "sell" || type === "shop") {
                amount = "-" + value.toFixed(6);
              } else {
                amount = (type === "receive" ? "+" : "-") + value.toFixed(6);
              }
            }
          } else {
            // ETH-Transaktion
            const value = parseFloat(transfer.value || "0");
            amountRaw = value;
            if (type === "buy" || type === "claim") {
              amount = "+" + value.toFixed(6);
            } else if (type === "sell" || type === "shop") {
              amount = "-" + value.toFixed(6);
            } else {
              amount = (type === "receive" ? "+" : "-") + value.toFixed(6);
            }
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
        .sort((a, b) => {
          // Verwende die originalen Metadaten für bessere Sortierung
          return b.timestamp - a.timestamp;
        })
        .slice(0, 50); // Zeige die neuesten 50 Transaktionen

      setTransactions(mappedTransactions);
      
      // Statistiken
      setStats({
        transactionCount: mappedTransactions.length,
        totalValue: mappedTransactions.reduce((sum, tx) => {
          return sum + Math.abs(tx.amountRaw);
        }, 0),
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

  // Hilfsfunktionen für Anzeige
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "send":
        return <FaPaperPlane className="text-white text-xs" />;
      case "receive":
        return <FaArrowDown className="text-white text-xs" />;
      case "buy":
        return <span className="text-white text-xs">🛒</span>;
      case "sell":
        return <span className="text-white text-xs">💰</span>;
      case "shop":
        return <span className="text-white text-xs">🛍️</span>;
      case "claim":
        return <span className="text-white text-xs">🎁</span>;
      default:
        return <FaCoins className="text-white text-xs" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "send":
        return "from-red-400 to-red-600";
      case "receive":
        return "from-green-400 to-green-600";
      case "buy":
        return "from-blue-400 to-blue-600";
      case "sell":
        return "from-orange-400 to-orange-600";
      case "shop":
        return "from-purple-400 to-purple-600";
      case "claim":
        return "from-cyan-400 to-cyan-600";
      default:
        return "from-zinc-400 to-zinc-600";
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
          Transaktionshistorie
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base">Live Transaktionsdaten vom Base Network</p>
        {userAddress && (
          <p className="text-xs text-zinc-500 mt-1">
            Wallet: {formatAddress(userAddress)}
          </p>
        )}
      </div>

      {/* Filter - moderne Button-UI */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 mb-4">
          <span className="text-sm text-zinc-400 mr-2 flex items-center">Filter:</span>
          
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === "all" 
                ? "bg-amber-500 text-black shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Alle
          </button>
          
          <button
            onClick={() => setFilter("buy")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "buy" 
                ? "bg-blue-500 text-white shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            🛒 Gekauft
          </button>
          
          <button
            onClick={() => setFilter("sell")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "sell" 
                ? "bg-orange-500 text-white shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            💰 Verkauft
          </button>
          
          <button
            onClick={() => setFilter("claim")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "claim" 
                ? "bg-cyan-500 text-white shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            🎁 Claim
          </button>
          
          <button
            onClick={() => setFilter("shop")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "shop" 
                ? "bg-purple-500 text-white shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            🛍️ Shop
          </button>
          
          <button
            onClick={() => setFilter("receive")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "receive" 
                ? "bg-green-500 text-white shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            ↓ Empfangen
          </button>
          
          <button
            onClick={() => setFilter("send")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "send" 
                ? "bg-red-500 text-white shadow-lg" 
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            ↑ Gesendet
          </button>
        </div>
      )}

      {/* Transaktionsliste - Mobile optimierte Darstellung */}
      {!isLoading && !error && filteredAndSortedTransactions.length > 0 && (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
          {filteredAndSortedTransactions.map((item, index) => {
            // Prüfe ob es eine Gruppe oder eine einzelne Transaktion ist
            if (Array.isArray(item)) {
              // Gruppierte Transaktionen - Swaps oder Claims
              const group = item as Transaction[];
              const mainTx = group[0]; // Für Zeitstempel
              
              // Bestimme ob es eine Claim-Gruppe oder Swap-Gruppe ist
              const isClaimGroup = group.some(tx => tx.type === 'claim') ||
                                  group.some(tx => tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase());
              
              if (isClaimGroup) {
                // CLAIM-GRUPPE: Token + ETH von Social Media
                const tokenTx = group.find(tx => tx.token !== "ETH");
                const ethTx = group.find(tx => tx.token === "ETH");
                
                return (
                  <div key={`group-${index}`} className="bg-gradient-to-br from-cyan-900/20 to-cyan-800/20 rounded-xl p-3 border border-cyan-500/30 hover:border-cyan-400/50 transition-all">
                    {/* Claim Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm">🎁</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-cyan-300 text-sm">
                            Social Media Claim
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{mainTx.time}</div>
                        </div>
                      </div>
                      {/* Haupt-Claim-Info rechts */}
                      {tokenTx && (
                        <div className="text-right flex-shrink-0">
                          <div className="font-semibold text-sm text-cyan-400">
                            +{Math.abs(tokenTx.amountRaw).toFixed(2)} {tokenTx.token}
                          </div>
                          {ethTx && (
                            <div className="text-xs text-zinc-400">
                              +{Math.abs(ethTx.amountRaw).toFixed(7)} ETH
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Claim Details */}
                    <div className="space-y-2">
                      {tokenTx && (
                        <div className="flex items-center justify-between bg-cyan-900/20 rounded-lg p-2 border border-cyan-500/20">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img 
                              src={tokenTx.tokenIcon} 
                              alt={tokenTx.token} 
                              className="w-6 h-6 rounded-full flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/ETH.png";
                              }}
                            />
                            <span className="text-xs text-cyan-300 truncate">Claim Belohnung</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-cyan-400 font-semibold text-sm">
                              {tokenTx.amount}
                            </div>
                            <div className="text-xs text-cyan-300">{tokenTx.token}</div>
                          </div>
                        </div>
                      )}
                      
                      {ethTx && (
                        <div className="flex items-center justify-between bg-cyan-900/20 rounded-lg p-2 border border-cyan-500/20">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img 
                              src={ethTx.tokenIcon} 
                              alt={ethTx.token} 
                              className="w-6 h-6 rounded-full flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/ETH.png";
                              }}
                            />
                            <span className="text-xs text-cyan-300 truncate">Gas Erstattung</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-cyan-400 font-semibold text-sm">
                              {ethTx.amount}
                            </div>
                            <div className="text-xs text-cyan-300">{ethTx.token}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Claim Source */}
                    <div className="mt-3 pt-2 border-t border-cyan-500/20">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Quelle:</span>
                        <span className="text-cyan-300 font-mono truncate ml-2">
                          Social Media Rewards
                        </span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // SWAP-GRUPPE: ETH ↔ Token
                const soldTx = group.find(tx => tx.amountRaw < 0); // Verkaufte Token (negative Beträge)
                const boughtTx = group.find(tx => tx.amountRaw > 0); // Gekaufte Token (positive Beträge)
                
                // Bestimme Haupt-Token (D.FAITH oder D.INVEST) und ETH-Gegenwert
                const tokenTx = group.find(tx => tx.token === "D.FAITH" || tx.token === "D.INVEST");
                const ethTx = group.find(tx => tx.token === "ETH");
                
                return (
                  <div key={`group-${index}`} className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-xl p-3 border border-purple-500/30 hover:border-purple-400/50 transition-all">
                    {/* Mobile Swap Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm">🔄</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-purple-300 text-sm">
                            {tokenTx?.token} Swap
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{mainTx.time}</div>
                        </div>
                      </div>
                      {/* Haupt-Swap-Info rechts */}
                      {tokenTx && ethTx && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-purple-300">
                            {tokenTx.amountRaw > 0 ? "Gekauft" : "Verkauft"}
                          </div>
                          <div className="font-semibold text-sm text-amber-400">
                            {Math.abs(tokenTx.amountRaw).toFixed(2)} {tokenTx.token}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {Math.abs(ethTx.amountRaw).toFixed(6)} ETH
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Mobile Swap Details - Kompakte 2-Token Darstellung */}
                    <div className="space-y-2">
                      {soldTx && (
                        <div className="flex items-center justify-between bg-red-900/20 rounded-lg p-2 border border-red-500/20">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img 
                              src={soldTx.tokenIcon} 
                              alt={soldTx.token} 
                              className="w-6 h-6 rounded-full flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/ETH.png";
                              }}
                            />
                            <span className="text-xs text-red-300 truncate">Verkauft</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-red-400 font-semibold text-sm">
                              {soldTx.amount}
                            </div>
                            <div className="text-xs text-red-300">{soldTx.token}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Swap Pfeil */}
                      <div className="flex justify-center">
                        <div className="text-purple-400 text-lg">↓</div>
                      </div>
                      
                      {boughtTx && (
                        <div className="flex items-center justify-between bg-green-900/20 rounded-lg p-2 border border-green-500/20">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img 
                              src={boughtTx.tokenIcon} 
                              alt={boughtTx.token} 
                              className="w-6 h-6 rounded-full flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/ETH.png";
                              }}
                            />
                            <span className="text-xs text-green-300 truncate">Gekauft</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-green-400 font-semibold text-sm">
                              {boughtTx.amount}
                            </div>
                            <div className="text-xs text-green-300">{boughtTx.token}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Kompakte Pool Info */}
                    <div className="mt-3 pt-2 border-t border-purple-500/20">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Pool:</span>
                        <span className="text-purple-300 font-mono truncate ml-2">
                          {mainTx.address.toLowerCase() === DFAITH_POOL.toLowerCase() ? "D.FAITH Pool" :
                           mainTx.address.toLowerCase() === DINVEST_POOL.toLowerCase() ? "D.INVEST Pool" :
                           formatAddress(mainTx.address)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            } else {
              // Einzelne Transaktion - Mobile optimiert
              const tx = item as Transaction;
              
              return (
                <div key={tx.id} className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-3 border border-zinc-700 hover:border-zinc-600 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Token Icon mit Type Overlay - Mobile kleiner */}
                      <div className="relative flex-shrink-0">
                        <img 
                          src={tx.tokenIcon} 
                          alt={tx.token} 
                          className="w-10 h-10 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/ETH.png";
                          }}
                        />
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r ${getTransactionColor(tx.type)} flex items-center justify-center text-xs border-2 border-zinc-800`}>
                          {getTransactionIcon(tx.type)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-amber-400 text-sm truncate">
                          {tx.type === "send" && "Gesendet"}
                          {tx.type === "receive" && "Empfangen"}
                          {tx.type === "buy" && "Gekauft"}
                          {tx.type === "sell" && "Verkauft"}
                          {tx.type === "shop" && "Shop-Kauf"}
                          {tx.type === "claim" && "Social Media Claim"}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">{tx.time}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-bold text-sm ${getAmountColor(tx.amount)}`}>
                        {tx.amount}
                      </div>
                      <div className="text-xs font-semibold text-zinc-400">{tx.token}</div>
                    </div>
                  </div>
                  
                  {/* Kompakte Adress-Info */}
                  <div className="text-xs text-zinc-400 bg-zinc-900/50 rounded-lg p-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 flex-shrink-0">
                        {tx.type === "send" ? "An:" : 
                         tx.type === "receive" ? "Von:" :
                         tx.type === "buy" ? "Pool:" :
                         tx.type === "sell" ? "Pool:" : 
                         tx.type === "shop" ? "Shop:" :
                         tx.type === "claim" ? "Von:" : "Adresse:"}
                      </span>
                      <span className="font-mono text-amber-400 ml-2 truncate">
                        {tx.type === "buy" || tx.type === "sell" ? 
                          (tx.address.toLowerCase() === DFAITH_POOL.toLowerCase() ? "D.FAITH Pool" :
                           tx.address.toLowerCase() === DINVEST_POOL.toLowerCase() ? "D.INVEST Pool" :
                           formatAddress(tx.address)) :
                         tx.type === "shop" ?
                          "Merch Shop" :
                         tx.type === "claim" ?
                          "Social Media Rewards" :
                          formatAddress(tx.address)
                        }
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Error Display - nur echte Fehler */}
      {error && (
        <div className="text-center py-6">
          <div className="bg-red-500/20 text-red-400 rounded-lg p-4 border border-red-500/30">
            <p className="font-semibold mb-1">Blockchain-Verbindung fehlgeschlagen</p>
            <p className="text-sm mb-2">{error}</p>
          </div>
        </div>
      )}

      {/* Refresh Button - Mobile optimiert */}
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
