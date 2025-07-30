import { useCallback } from "react";
import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { FaPaperPlane, FaArrowDown, FaExchangeAlt, FaCoins, FaLock } from "react-icons/fa";

// Token-Adressen (aktualisiert Juli 2025)
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";

import { useActiveAccount } from "thirdweb/react";

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

  // Demo-Daten für den Fall, dass kein API-Key verfügbar ist
  const demoTransactions: Transaction[] = [
    {
      id: "demo1",
      type: "receive",
      token: "ETH", 
      amount: "+0.5",
      address: "0x1234...5678",
      hash: "0xdemo1234567890abcdef",
      time: "15.01.2024, 14:30",
      status: "success"
    },
    {
      id: "demo2", 
      type: "send",
      token: "USDC",
      amount: "-100.0",
      address: "0xabcd...efgh",
      hash: "0xdemo2345678901bcdef0",
      time: "14.01.2024, 09:15",
      status: "success"
    }
  ];

  // Feste Wallet-Adresse für das Modal
  const targetAddress = "0x651BACc1A1579f2FaaeDA2450CE59bB5E7D26e7d";
  
  // Verwende entweder die verbundene Wallet oder die feste Adresse
  const userAddress = account?.address || targetAddress;

  // Alchemy API Key für Base Chain
  const ALCHEMY_API_KEY = "7zoUrdSYTUNPJ9rNEiOM8";
  const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

  // Alchemy API für Base Chain Transaktionen
  const getTransactionsFromAlchemy = async (address: string) => {
    try {
      console.log("🚀 Verwende Alchemy API für Base Chain Transaktionen");
      console.log("📍 Wallet Adresse:", address);
      
      // Hole ausgehende Transaktionen
      console.log("🔄 Lade ausgehende Transaktionen...");
      const response = await fetch(ALCHEMY_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              fromAddress: address,
              category: ["external", "erc20", "erc721", "erc1155"], // "internal" entfernt für Base Chain
              withMetadata: true, // Aktiviert für bessere Zeitstempel
              excludeZeroValue: true,
              maxCount: "0x32" // 50 Transaktionen
            }
          ],
          id: 1
        })
      });

      if (!response.ok) {
        throw new Error(`Alchemy API Fehler: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Prüfe auf API-Fehler
      if (data.error) {
        console.error("❌ Alchemy API Error (Outgoing):", data.error);
        throw new Error(`Alchemy API Error: ${data.error.message}`);
      }
      
      console.log("✅ Alchemy API Response (FROM):", data);
      
      // Hole eingehende Transaktionen
      console.log("🔄 Lade eingehende Transaktionen...");
      const responseIncoming = await fetch(ALCHEMY_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              toAddress: address,
              category: ["external", "erc20", "erc721", "erc1155"], // "internal" entfernt für Base Chain
              withMetadata: true, // Aktiviert für bessere Zeitstempel
              excludeZeroValue: true,
              maxCount: "0x32" // 50 Transaktionen
            }
          ],
          id: 2
        })
      });

      if (!responseIncoming.ok) {
        throw new Error(`Alchemy API Fehler (Incoming): ${responseIncoming.status} ${responseIncoming.statusText}`);
      }

      const dataIncoming = await responseIncoming.json();
      
      // Prüfe auf API-Fehler
      if (dataIncoming.error) {
        console.error("❌ Alchemy API Error (Incoming):", dataIncoming.error);
        throw new Error(`Alchemy API Error (Incoming): ${dataIncoming.error.message}`);
      }

      console.log("✅ Alchemy API Response (TO):", dataIncoming);
      
      // Kombiniere ausgehende und eingehende Transaktionen
      const outgoingTransfers = data.result?.transfers || [];
      const incomingTransfers = dataIncoming.result?.transfers || [];
      const allTransfers = [...outgoingTransfers, ...incomingTransfers];
      
      console.log(`📊 Transaktionen gefunden: ${outgoingTransfers.length} ausgehend, ${incomingTransfers.length} eingehend, ${allTransfers.length} total`);
      
      return allTransfers;
    } catch (error) {
      console.error("❌ Alchemy API Error:", error);
      throw error;
    }
  };



  // Funktion zum Neuladen der Transaktionen
  const refreshTransactions = useCallback(async () => {
    if (!userAddress) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      console.log("🔄 Lade Transaktionen neu mit Alchemy API...");
      
      // Hole Transaktionen über Alchemy API
      const alchemyTransfers = await getTransactionsFromAlchemy(userAddress);
      console.log("Alchemy Transfers:", alchemyTransfers);
      
      if (alchemyTransfers.length === 0) {
        console.log("Keine Transaktionen gefunden, verwende Demo-Daten");
        setTransactions(demoTransactions);
        setIsLoading(false);
        return;
      }

      // Transaktionen verarbeiten und sortieren
      const mappedTransactions: Transaction[] = alchemyTransfers
        .map((transfer: any) => {
          // Verbesserte Zeitstempel-Verarbeitung
          let timestamp: Date;
          if (transfer.metadata?.blockTimestamp) {
            timestamp = new Date(transfer.metadata.blockTimestamp);
          } else if (transfer.blockNum) {
            // Fallback: Schätze Zeit basierend auf Block-Nummer (ungefähr)
            const currentTime = Date.now();
            const estimatedTime = currentTime - (transfer.blockNum * 2000); // Ungefähr 2s pro Block
            timestamp = new Date(estimatedTime);
          } else {
            timestamp = new Date();
          }
          
          const time = timestamp.toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit", 
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });

          let type: "send" | "receive" = "send";
          let token = transfer.asset || "ETH";
          let amount = "0";
          let address = "";

          // Bestimme Transaktionsrichtung
          const isReceived = transfer.to?.toLowerCase() === userAddress.toLowerCase();
          const isFromUser = transfer.from?.toLowerCase() === userAddress.toLowerCase();
          
          if (isReceived && !isFromUser) {
            type = "receive";
            address = transfer.from || "";
            amount = "+" + (transfer.value || "0");
          } else if (isFromUser) {
            type = "send";
            address = transfer.to || "";
            amount = "-" + (transfer.value || "0");
          }

          // Token-Symbol und Dezimalstellen richtig verarbeiten
          if (transfer.category === "erc20") {
            token = transfer.asset || "TOKEN";
            // Formatiere den Betrag basierend auf Dezimalstellen
            if (transfer.rawContract?.decimals && transfer.rawContract.value) {
              const decimals = parseInt(transfer.rawContract.decimals);
              const rawValue = transfer.rawContract.value;
              const formattedValue = (parseInt(rawValue) / Math.pow(10, decimals)).toFixed(decimals > 6 ? 6 : decimals);
              amount = type === "receive" ? "+" + formattedValue : "-" + formattedValue;
            }
          } else if (transfer.category === "external") {
            token = "ETH";
            // ETH hat 18 Dezimalstellen
            if (transfer.value) {
              const ethValue = parseFloat(transfer.value).toFixed(6);
              amount = type === "receive" ? "+" + ethValue : "-" + ethValue;
            }
          }

          return {
            id: transfer.uniqueId || transfer.hash || Math.random().toString(),
            type,
            token,
            amount,
            address,
            hash: transfer.hash || "",
            time,
            status: "success" as const, // Alchemy gibt nur bestätigte Transaktionen zurück
          };
        })
        .filter((tx: Transaction) => tx.hash && tx.address) // Nur vollständige Transaktionen
        .sort((a: Transaction, b: Transaction) => {
          // Sortiere nach Zeit (neueste zuerst)
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        })
        .slice(0, 50); // Limitiere auf 50 Transaktionen

      console.log(`📋 Verarbeitete Transaktionen: ${mappedTransactions.length}`);
      setTransactions(mappedTransactions);
      
      // Statistiken basierend auf geladenen Transaktionen
      setStats({
        transactionCount: mappedTransactions.length,
        totalValue: mappedTransactions.reduce((sum, tx) => {
          const value = parseFloat(tx.amount.replace(/[+-]/g, ''));
          return sum + (isNaN(value) ? 0 : value);
        }, 0),
        avgGas: 0.001, // Durchschnittliche Gas-Gebühr für Base Chain
      });
      
    } catch (err) {
      console.error("Fehler beim Laden der Transaktionen:", err);
      setError("Fehler beim Laden der Transaktionsdaten von Alchemy. Verwende Demo-Daten.");
      setTransactions(demoTransactions);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <p className="text-zinc-400">Live Transaktionsdaten vom Base Network via Alchemy API</p>
        {userAddress && (
          <p className="text-xs text-zinc-500 mt-1">
            Wallet: {formatAddress(userAddress)}
          </p>
        )}
      </div>

      {/* Debug Info - nur in Development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 mb-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Debug Info</h3>
          <div className="text-xs text-zinc-400 space-y-1">
            <div>Alchemy API Key: {ALCHEMY_API_KEY ? '✓ Konfiguriert' : '✗ Fehlt'}</div>
            <div>API: Alchemy Enhanced API (Base Chain - ohne &apos;internal&apos; Kategorie)</div>
            <div>Base URL: {ALCHEMY_BASE_URL.substring(0, 50)}...</div>
            <div>Chain ID: 8453 (Base)</div>
            <div>Wallet: {userAddress || 'Nicht verbunden'}</div>
            <div>Loading: {isLoading ? 'Ja' : 'Nein'}</div>
            <div>Error: {error || 'Keine'}</div>
            <div>Transactions: {transactions.length}</div>
            <div>Kategorien: external, erc20, erc721, erc1155 (internal entfernt)</div>
            {stats && <div>Stats: {stats.transactionCount} total, {stats.totalValue.toFixed(6)} ETH, Ø {stats.avgGas.toFixed(6)} gas</div>}
          </div>
        </div>
      )}

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
          <p className="text-zinc-400">Keine Wallet-Adresse verfügbar.</p>
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

      {/* Enhanced Summary Stats mit Thirdweb Insight Daten */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl p-4 border border-zinc-700 text-center">
            <div className="text-2xl font-bold text-amber-400 mb-1">
              {transactions.length}
            </div>
            <div className="text-xs text-zinc-500">Gezeigt</div>
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
