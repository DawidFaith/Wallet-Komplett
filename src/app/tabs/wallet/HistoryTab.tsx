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
  type: "send" | "receive" | "buy" | "sell";
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

type FilterType = "all" | "send" | "receive" | "buy" | "sell";
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
  } | null>(null);
  const account = useActiveAccount();

  // Nur verbundene Wallet verwenden - keine Demo-Daten
  const userAddress = account?.address;

  // Gefilterte und sortierte Transaktionen
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
    
    return sorted;
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
            category: ["external", "erc20"],
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
            category: ["external", "erc20"],
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
          
          let type: "send" | "receive" | "buy" | "sell";
          let address = isReceived ? transfer.from : transfer.to;
          
          // Swap-Erkennung basierend auf Pool-Adressen
          if (fromAddress === DFAITH_POOL.toLowerCase() && isReceived) {
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
            // Normale Transaktion (nicht über Pools)
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
              // Bei Käufen/Verkäufen andere Formatierung
              if (type === "buy") {
                amount = "+" + value.toFixed(2);
              } else if (type === "sell") {
                amount = "-" + value.toFixed(2);
              } else {
                amount = (type === "receive" ? "+" : "-") + value.toFixed(2);
              }
            } else if (transfer.rawContract.address.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
              const value = parseInt(transfer.value || "0");
              amountRaw = value;
              // Bei Käufen/Verkäufen andere Formatierung
              if (type === "buy") {
                amount = "+" + value.toString();
              } else if (type === "sell") {
                amount = "-" + value.toString();
              } else {
                amount = (type === "receive" ? "+" : "-") + value.toString();
              }
            } else {
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              if (type === "buy") {
                amount = "+" + value.toFixed(6);
              } else if (type === "sell") {
                amount = "-" + value.toFixed(6);
              } else {
                amount = (type === "receive" ? "+" : "-") + value.toFixed(6);
              }
            }
          } else {
            // ETH-Transaktion
            const value = parseFloat(transfer.value || "0");
            amountRaw = value;
            if (type === "buy") {
              amount = "+" + value.toFixed(6);
            } else if (type === "sell") {
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
    <div className="flex flex-col gap-6 p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          Transaktionshistorie
        </h2>
        <p className="text-zinc-400">Live Transaktionsdaten vom Base Network</p>
        {userAddress && (
          <p className="text-xs text-zinc-500 mt-1">
            Wallet: {formatAddress(userAddress)}
          </p>
        )}
      </div>

      {/* Filter - nur Transaktionstyp */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="flex gap-2 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50 mb-4">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 bg-zinc-700 border border-zinc-600 rounded text-sm text-white"
          >
            <option value="all">Alle</option>
            <option value="buy">Gekauft</option>
            <option value="sell">Verkauft</option>
            <option value="receive">Empfangen</option>
            <option value="send">Gesendet</option>
          </select>
        </div>
      )}

      {/* Transaktionsliste */}
      {!isLoading && !error && filteredAndSortedTransactions.length > 0 && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredAndSortedTransactions.map((tx) => (
            <div key={tx.id} className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 hover:border-zinc-600 transition-all hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Token Icon mit Type Overlay */}
                  <div className="relative">
                    <img 
                      src={tx.tokenIcon} 
                      alt={tx.token} 
                      className="w-12 h-12 rounded-full border-2 border-zinc-600"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/ETH.png";
                      }}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r ${getTransactionColor(tx.type)} flex items-center justify-center text-xs border-2 border-zinc-800`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-amber-400 capitalize text-lg">
                      {tx.type === "send" && "Gesendet"}
                      {tx.type === "receive" && "Empfangen"}
                      {tx.type === "buy" && "Gekauft"}
                      {tx.type === "sell" && "Verkauft"}
                    </div>
                    <div className="text-xs text-zinc-500">{tx.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-lg ${getAmountColor(tx.amount)}`}>
                    {tx.amount}
                  </div>
                  <div className="text-sm font-semibold text-zinc-400">{tx.token}</div>
                </div>
              </div>
              
              <div className="text-sm text-zinc-400 space-y-2 bg-zinc-900/50 rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">
                    {tx.type === "send" ? "An:" : 
                     tx.type === "receive" ? "Von:" :
                     tx.type === "buy" ? "Über Pool:" :
                     tx.type === "sell" ? "An Pool:" : "Adresse:"}
                  </span>
                  <span className="font-mono text-amber-400">
                    {tx.type === "buy" || tx.type === "sell" ? 
                      (tx.address.toLowerCase() === DFAITH_POOL.toLowerCase() ? "D.FAITH Pool" :
                       tx.address.toLowerCase() === DINVEST_POOL.toLowerCase() ? "D.INVEST Pool" :
                       formatAddress(tx.address)) :
                      formatAddress(tx.address)
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tx Hash:</span>
                  <span className="font-mono text-blue-400">
                    {formatAddress(tx.hash)}
                  </span>
                </div>
              </div>
            </div>
          ))}
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

      {/* Refresh Button */}
      <div className="flex justify-center mt-6">
        <Button
          onClick={refreshTransactions}
          className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold px-6 py-2 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
              Lädt...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FaExchangeAlt className="text-black" />
              Transaktionen neu laden
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
