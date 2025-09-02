import { useCallback } from "react";
import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { FaPaperPlane, FaArrowDown, FaExchangeAlt, FaCoins } from "react-icons/fa";
import { useActiveAccount } from "thirdweb/react";

// Token-Adressen
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";

type Transaction = {
  id: string;
  type: "send" | "receive";
  token: string;
  amount: string;
  address: string;
  hash: string;
  time: string;
  status: "success" | "pending" | "failed";
};

export default function HistoryTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<{
    transactionCount: number;
    totalValue: number;
    avgGas: number;
  } | null>(null);
  const account = useActiveAccount();

  // Nur verbundene Wallet verwenden - keine Demo-Daten
  const userAddress = account?.address;

  // Basescan API für Base Chain Transaktionen (kostenlos)
  const BASESCAN_API_KEY = "YourApiKeyToken"; // Optional, funktioniert auch ohne
  const BASESCAN_BASE_URL = "https://api.basescan.org/api";

  // Basescan API für Base Chain Transaktionen
  const getTransactionsFromBasescan = async (address: string) => {
    try {
      // Hole normale ETH Transaktionen
      const ethResponse = await fetch(
        `${BASESCAN_BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${BASESCAN_API_KEY}`
      );
      
      // Hole ERC20 Token Transaktionen
      const tokenResponse = await fetch(
        `${BASESCAN_BASE_URL}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${BASESCAN_API_KEY}`
      );

      if (!ethResponse.ok || !tokenResponse.ok) {
        throw new Error(`Basescan API Fehler`);
      }

      const ethData = await ethResponse.json();
      const tokenData = await tokenResponse.json();
      
      if (ethData.status !== "1" && ethData.message !== "No transactions found") {
        throw new Error(`Basescan API Error: ${ethData.message}`);
      }
      
      if (tokenData.status !== "1" && tokenData.message !== "No transactions found") {
        throw new Error(`Basescan API Error: ${tokenData.message}`);
      }

      // Kombiniere ETH und Token Transaktionen
      const ethTransactions = ethData.result || [];
      const tokenTransactions = tokenData.result || [];
      const allTransactions = [...ethTransactions, ...tokenTransactions];
      
      return allTransactions;
    } catch (error) {
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
      // Hole Transaktionen über Basescan API
      const basescanTransactions = await getTransactionsFromBasescan(userAddress);
      
      if (basescanTransactions.length === 0) {
        setTransactions([]);
        setError("Keine Transaktionen für diese Wallet gefunden.");
        setIsLoading(false);
        return;
      }

      // Transaktionen verarbeiten und sortieren
      const mappedTransactions: Transaction[] = basescanTransactions
        .map((tx: any) => {
          // Zeitstempel-Verarbeitung (Basescan gibt Unix-Timestamp)
          const timestamp = new Date(parseInt(tx.timeStamp) * 1000);
          const time = timestamp.toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit", 
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });

          let type: "send" | "receive" = "send";
          let token = "ETH";
          let amount = "0";
          let address = "";

          // Bestimme Transaktionsrichtung
          const isReceived = tx.to?.toLowerCase() === userAddress.toLowerCase();
          const isFromUser = tx.from?.toLowerCase() === userAddress.toLowerCase();
          
          if (isReceived && !isFromUser) {
            type = "receive";
            address = tx.from || "";
          } else if (isFromUser) {
            type = "send";
            address = tx.to || "";
          }

          // Unterscheide zwischen ETH und Token-Transaktionen
          if (tx.contractAddress) {
            // Token-Transaktion
            if (tx.contractAddress.toLowerCase() === DFAITH_TOKEN.toLowerCase()) {
              token = "D.FAITH";
              const value = parseInt(tx.value) / 100; // D.FAITH hat 2 Dezimalstellen
              amount = type === "receive" ? "+" + value.toFixed(2) : "-" + value.toFixed(2);
            } else if (tx.contractAddress.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
              const value = parseInt(tx.value); // D.INVEST hat 0 Dezimalstellen
              amount = type === "receive" ? "+" + value.toString() : "-" + value.toString();
            } else {
              token = tx.tokenSymbol || "TOKEN";
              const decimals = parseInt(tx.tokenDecimal) || 18;
              const value = parseInt(tx.value) / Math.pow(10, decimals);
              amount = type === "receive" ? "+" + value.toFixed(decimals > 6 ? 6 : decimals) : "-" + value.toFixed(decimals > 6 ? 6 : decimals);
            }
          } else {
            // ETH-Transaktion
            token = "ETH";
            const ethValue = parseInt(tx.value) / Math.pow(10, 18); // ETH hat 18 Dezimalstellen
            amount = type === "receive" ? "+" + ethValue.toFixed(6) : "-" + ethValue.toFixed(6);
          }

          return {
            id: tx.hash || Math.random().toString(),
            type,
            token,
            amount,
            address,
            hash: tx.hash || "",
            time,
            status: "success" as const,
          };
        })
        .filter((tx: Transaction) => tx.hash && tx.address)
        .sort((a: Transaction, b: Transaction) => {
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        })
        .slice(0, 50);

      setTransactions(mappedTransactions);
      
      // Statistiken
      setStats({
        transactionCount: mappedTransactions.length,
        totalValue: mappedTransactions.reduce((sum, tx) => {
          const value = parseFloat(tx.amount.replace(/[+-]/g, ''));
          return sum + (isNaN(value) ? 0 : value);
        }, 0),
        avgGas: 0.001,
      });
      
    } catch (err) {
      setError("Fehler beim Laden der Transaktionsdaten. Bitte versuchen Sie es erneut.");
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

      {/* Kompaktes Status Panel */}
      <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/50 mb-4">
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <div className="flex items-center gap-4">
            <span>API: Basescan ✓ Aktiv</span>
            <span>Wallet: {userAddress ? formatAddress(userAddress) : 'Nicht verbunden'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Status: {isLoading ? 'Lädt...' : error ? 'Fehler' : 'Bereit'}</span>
            <span>Transaktionen: {transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
          <span className="ml-3 text-zinc-400">Lade Transaktionen...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !userAddress && (
        <div className="text-center py-8">
          <p className="text-zinc-400">Bitte verbinden Sie Ihre Wallet um Transaktionen zu sehen.</p>
        </div>
      )}

      {/* No Transactions */}
      {!isLoading && !error && userAddress && transactions.length === 0 && (
        <div className="text-center py-8">
          <div className="bg-zinc-800/50 rounded-lg p-6 border border-zinc-700">
            <FaCoins className="text-4xl text-zinc-500 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg mb-2">Keine Transaktionen gefunden</p>
            <p className="text-zinc-500 text-sm">
              Diese Wallet-Adresse hat noch keine aufgezeichneten Transaktionen auf Base Network.
            </p>
          </div>
        </div>
      )}

      {/* Transaktionsliste */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 hover:border-zinc-600 transition-all hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getTransactionColor(tx.type)} flex items-center justify-center shadow-lg`}>
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div>
                    <div className="font-medium text-amber-400 capitalize text-lg">
                      {tx.type === "send" && "Gesendet"}
                      {tx.type === "receive" && "Empfangen"}
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
                    {tx.type === "send" ? "An:" : "Von:"}
                  </span>
                  <span className="font-mono text-amber-400">
                    {formatAddress(tx.address)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tx Hash:</span>
                  <span className="font-mono text-blue-400">
                    {formatAddress(tx.hash)}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center mt-4">
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  tx.status === "success" 
                    ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                    : tx.status === "pending"
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {tx.status === "success" && "✓ Erfolgreich"}
                  {tx.status === "pending" && "⏳ Ausstehend"}
                  {tx.status === "failed" && "✗ Fehlgeschlagen"}
                </span>
                <a
                  href={`https://basescan.org/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-400 hover:text-amber-300 transition underline font-medium bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 hover:border-amber-500/40"
                >
                  Basescan ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-center py-6">
          <div className="bg-red-500/20 text-red-400 rounded-lg p-4 border border-red-500/30">
            <p className="font-semibold mb-1">Fehler beim Laden</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 text-center">
            <div className="text-2xl font-bold text-amber-400 mb-1">
              {transactions.length}
            </div>
            <div className="text-xs text-zinc-500">Transaktionen</div>
          </div>
          <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {transactions.filter(tx => tx.status === "success").length}
            </div>
            <div className="text-xs text-zinc-500">Erfolgreich</div>
          </div>
          <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 text-center">
            <div className="text-2xl font-bold text-red-400 mb-1">
              {transactions.filter(tx => tx.status === "failed").length}
            </div>
            <div className="text-xs text-zinc-500">Fehlgeschlagen</div>
          </div>
          {stats && (
            <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {stats.transactionCount}
              </div>
              <div className="text-xs text-zinc-500">Total (API)</div>
            </div>
          )}
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
