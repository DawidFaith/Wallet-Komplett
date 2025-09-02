import { useCallback, useMemo, useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { FaExchangeAlt, FaBitcoin } from "react-icons/fa";
import { useActiveAccount } from "thirdweb/react";

// Token-Adressen und Konfiguration
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";
// D.FAITH/ETH Pool (für Käufe)
const DFAITH_POOL = "0x59c7c832e96d2568bea6db468c1aadcbbda08a52";
// WETH (Base canonical)
const WETH_TOKEN = "0x4200000000000000000000000000000000000006";

// Social Media Claim Adresse
const CLAIM_ADDRESS = "0xFe5F6cE95efB135b93899AF70B12727F93FEE6E2"; // Social Media Claim Adresse
// Konstanter ETH-Bonus für Claims (falls bekannt); wird bevorzugt gematcht
const CLAIM_ETH_VALUE = 0.0000010;
const CLAIM_ETH_EPS = 0.0000002; // Toleranz

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
  type: "claim" | "buy" | "other";
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

type FilterType = "all" | "claim" | "buy" | "sell";
type SortType = "newest" | "oldest";

export default function HistoryTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Hinweis: gefilterte Liste wird per useMemo berechnet
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [stats, setStats] = useState<{
    transactionCount: number;
    claims: number;
  } | null>(null);
  const account = useActiveAccount();

  // Nur verbundene Wallet verwenden - keine Demo-Daten
  const userAddress = account?.address;

  const filteredAndSortedTransactions = useMemo(() => {
    // Filter anwenden (unterstützt Claim und Buy)
    let baseList: Transaction[];
    if (filter === "claim") baseList = transactions.filter((t) => t.type === "claim");
    else if (filter === "buy") baseList = transactions.filter((t) => t.type === "buy");
    else baseList = transactions;

  // Sortieren
  const sorted = [...baseList].sort((a, b) =>
      sortBy === "oldest" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  // Unabhängig vom Filter: kompletter, sortierter Suchraum für Partnerzuordnung
  const allSorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

    const groups: (Transaction | Transaction[])[] = [];
    const processed = new Set<string>();
  const usedHashes = new Set<string>();
    const baseTxHash = (t: Transaction) => {
      if (t.hash) return t.hash.toLowerCase();
      const id = t.id || "";
      const m = id.match(/(0x[a-f0-9]{64})/i);
      return m ? m[1].toLowerCase() : "";
    };

    // Hash-basierte Vor-Gruppierung für Käufe: pro Hash D.FAITH(+ vom Pool) + ETH/WETH(−)
    const byHash = new Map<string, Transaction[]>();
    for (const t of allSorted) {
      const h = baseTxHash(t);
      if (!h) continue;
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h)!.push(t);
    }
    for (const [h, txs] of byHash) {
      if (usedHashes.has(h)) continue;
      // Kauf-Anker innerhalb desselben Hashes
      const anchor = txs.find(
        (t) =>
          t.token === "D.FAITH" &&
          t.amount.startsWith("+") &&
          t.address.toLowerCase() === DFAITH_POOL.toLowerCase()
      );
      if (!anchor) continue;
      const ethCandidates = txs.filter(
        (t) => (t.token === "ETH" || t.token === "WETH") && t.amount.startsWith("-")
      );
      if (ethCandidates.length === 0) continue;
      // Pool bevorzugen, sonst größten Betrag
      let partner = ethCandidates.find((t) => t.address.toLowerCase() === DFAITH_POOL.toLowerCase());
      if (!partner) {
        partner = [...ethCandidates].sort((a, b) => Math.abs(b.amountRaw) - Math.abs(a.amountRaw))[0];
      }
      if (partner) {
        const pair: Transaction[] = [anchor, partner];
        (pair as any).__groupType = "buy";
        groups.push(pair);
        processed.add(anchor.id);
        processed.add(partner.id);
        usedHashes.add(h);
      }
    }

    // SELL-Gruppierung per Hash: D.FAITH(- an Pool) + optional Gas(ETH -) + ETH/WETH(+ vom Pool)
    for (const [h, txs] of byHash) {
      if (usedHashes.has(h)) continue; // bereits als Buy verwendet
      const dfMinus = txs.find(
        (t) => t.token === "D.FAITH" && t.amount.startsWith("-") && t.address.toLowerCase() === DFAITH_POOL.toLowerCase()
      );
      if (!dfMinus) continue;
      const ethPlus = txs.find(
        (t) => (t.token === "ETH" || t.token === "WETH") && t.amount.startsWith("+") && t.address.toLowerCase() === DFAITH_POOL.toLowerCase()
      );
      // Gas-Entry (synthetisch) hat Adresse "Gas Fee" und ETH minus
      const gas = txs.find(
        (t) => t.token === "ETH" && t.amount.startsWith("-") && (t.address === "Gas Fee" || t.address === "Gas" || t.address === "GAS")
      );
      const group: Transaction[] = [dfMinus];
      if (gas) group.push(gas);
      if (ethPlus) group.push(ethPlus);
      if (group.length > 1) {
        (group as any).__groupType = "sell";
        groups.push(group);
        for (const g of group) processed.add(g.id);
        usedHashes.add(h);
      }
    }

    for (const tx of sorted) {
      if (processed.has(tx.id)) continue;
      if (usedHashes.has(baseTxHash(tx))) continue;

  // 1) Claim-Gruppierung: D.FAITH von CLAIM_ADDRESS + nahe ETH von CLAIM_ADDRESS
      const isTokenFromClaim =
        tx.type === "claim" &&
        tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() &&
        tx.token === "D.FAITH";

      if (isTokenFromClaim) {
        let ethPartner = allSorted.find(
          (other) =>
            !processed.has(other.id) &&
            other.id !== tx.id &&
            other.type === "claim" &&
            other.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() &&
            other.token === "ETH" &&
            Math.abs(other.amountRaw - CLAIM_ETH_VALUE) <= CLAIM_ETH_EPS &&
            Math.abs(other.timestamp - tx.timestamp) <= 600000
        );

        if (!ethPartner) {
          ethPartner = allSorted.find(
            (other) =>
              !processed.has(other.id) &&
              other.id !== tx.id &&
              other.type === "claim" &&
              other.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() &&
              other.token === "ETH" &&
              Math.abs(other.timestamp - tx.timestamp) <= 600000
          );
        }

        if (ethPartner) {
          const pair: Transaction[] = [tx, ethPartner];
          (pair as any).__groupType = "claim";
          groups.push(pair);
          processed.add(tx.id);
          processed.add(ethPartner.id);
          continue;
        } else {
          groups.push(tx);
          processed.add(tx.id);
          continue;
        }
      }

  // 2) Kauf-Gruppierung: D.FAITH vom Pool (eingehend) + nahe ETH an Pool (ausgehend)
      const isBuyAnchor = (
        (tx.type === "buy") ||
        // Fallback: erkenne Kauf auch, wenn Typ falsch eingestuft wurde
        (tx.token === "D.FAITH" && tx.amount.startsWith("+") && tx.address.toLowerCase() === DFAITH_POOL.toLowerCase())
      ) && tx.token === "D.FAITH" && tx.amount.startsWith("+");

      if (isBuyAnchor) {
        // Partner suchen: 1) gleicher Tx-Hash, 2) Bevorzugt ETH/WETH an den Pool, 3) größter ETH/WETH-Abfluss im Zeitfenster
        const inWindow = (other: Transaction) => Math.abs(other.timestamp - tx.timestamp) <= 600000;
        const isOutflow = (other: Transaction) => other.amount.startsWith("-");
        const isEthLike = (tkn: string) => tkn === "ETH" || tkn === "WETH";

        // 1) Gleicher Hash (robusteste Methode)
    let sameHash = allSorted.find(
          (other) =>
            !processed.has(other.id) &&
            other.id !== tx.id &&
            isEthLike(other.token) &&
            isOutflow(other) &&
      baseTxHash(other) && baseTxHash(tx) && baseTxHash(other) === baseTxHash(tx)
        );
        if (sameHash) {
          const pair: Transaction[] = [tx, sameHash];
          (pair as any).__groupType = "buy";
          groups.push(pair);
          processed.add(tx.id);
          processed.add(sameHash.id);
          continue;
        }

        // 1) Präferenz: an Pool
        let partnerCandidates = allSorted.filter((other) =>
          !processed.has(other.id) &&
          other.id !== tx.id &&
          isEthLike(other.token) &&
          other.address.toLowerCase() === DFAITH_POOL.toLowerCase() &&
          isOutflow(other) &&
          inWindow(other) &&
          other.amountRaw > 0
        );

        // 2) Fallback: beliebiger ETH/WETH-Abfluss im Zeitfenster, wähle größten Betrag
        if (partnerCandidates.length === 0) {
          partnerCandidates = allSorted.filter((other) =>
            !processed.has(other.id) &&
            other.id !== tx.id &&
            isEthLike(other.token) &&
            isOutflow(other) &&
            inWindow(other) &&
            other.amountRaw > 0
          );
          // sortiere nach absolutem Betrag desc
          partnerCandidates.sort((a, b) => Math.abs(b.amountRaw) - Math.abs(a.amountRaw));
        }

        const ethPartner = partnerCandidates[0];

        if (ethPartner) {
          const pair: Transaction[] = [tx, ethPartner];
          (pair as any).__groupType = "buy";
          groups.push(pair);
          processed.add(tx.id);
          processed.add(ethPartner.id);
          continue;
        } else {
          // Falls kein Partner gefunden wurde, trotzdem Kauf (Token) anzeigen
          (tx as any).__groupType = "buy";
          groups.push(tx);
          processed.add(tx.id);
          continue;
        }
      }

      // Nicht relevante Einträge in dieser Phase unterdrücken
      continue;
    }

    // Nach Gruppierung optional nach Filter filtern
    if (filter !== "all") {
      const filteredGroups = groups.filter((item) => {
        if (Array.isArray(item)) {
          const gt = (item as any).__groupType;
          if (filter === "buy" || filter === "sell" || filter === "claim") return gt === filter;
          return false;
        } else {
          const t = item as Transaction;
          return (t.type as any) === filter;
        }
      });
      return filteredGroups;
    }
    return groups;
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
        return "/ETH.png";
      default:
        return "/ETH.png";
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
    fromBlock: "0x0", // so früh wie möglich, um alle historischen Transfers zu erfassen
            toBlock: "latest",
            fromAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"], // Erweiterte Kategorien
            withMetadata: true,
            excludeZeroValue: false, // Auch 0-Wert Transaktionen anzeigen
  maxCount: "0x1F4" // bis zu 500 Transfers
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
    fromBlock: "0x0", // so früh wie möglich, um alle historischen Transfers zu erfassen
            toBlock: "latest",
            toAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"], // Erweiterte Kategorien
            withMetadata: true,
            excludeZeroValue: false, // Auch 0-Wert Transaktionen anzeigen
  maxCount: "0x1F4" // bis zu 500 Transfers
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

  // Funktion zum Neuladen der Transaktionen (Claims + Käufe extrahieren)
  const refreshTransactions = useCallback(async () => {
    if (!userAddress) {
      setTransactions([]);
      setError("Bitte Wallet verbinden, um Transaktionen zu sehen.");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      // Teste Alchemy API mit der spezifischen Wallet-Adresse
      const testAddress = userAddress || TEST_WALLET;
      const alchemyTransactions = await getTransactionsFromAlchemy(testAddress);
  console.log("[HistoryTab] Transfers geladen:", alchemyTransactions?.length || 0);
      
      // Verarbeite die Transaktionen auch wenn wenige vorhanden sind
      if (alchemyTransactions.length === 0) {
        setTransactions([]);
        setError("Keine Transaktionen für diese Wallet gefunden.");
        setIsLoading(false);
        return;
      }

  // Verarbeite nur relevante Transfers zu Claim- und Kauf-Transaktionen
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
          
          let type: "claim" | "buy" | "other" = "other";
          let address = isReceived ? transfer.from : transfer.to;
          
          // Token bestimmen (früh, für besseres Debugging)
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
          
          // Claim-Erkennung: FROM Claim-Adresse an unsere Wallet
          if (fromAddress === CLAIM_ADDRESS.toLowerCase() && isReceived) {
            // Transaktion von Claim-Adresse = Social Media Claim
            type = "claim";
            address = CLAIM_ADDRESS;
          } else if (
            // Kauf-Anker: D.FAITH kommt vom Pool an unsere Wallet
            transfer.rawContract?.address?.toLowerCase() === DFAITH_TOKEN.toLowerCase() &&
            isReceived &&
            fromAddress === DFAITH_POOL.toLowerCase()
          ) {
            type = "buy";
            address = DFAITH_POOL;
          } else if (
            // Kauf-ETH/WETH-Seite: ETH (extern) oder WETH (ERC20) geht von uns ab
            !isReceived &&
            (
              (transfer.asset === "ETH" && toAddress === DFAITH_POOL.toLowerCase()) ||
              (transfer.rawContract?.address?.toLowerCase() === WETH_TOKEN.toLowerCase())
            )
          ) {
            type = "buy";
            // wenn Pool erkennbar, setze Pool, sonst belasse default address
            if (toAddress === DFAITH_POOL.toLowerCase()) address = DFAITH_POOL;
          }
          // Alles andere als "other" kennzeichnen und später rausfiltern
          
          // Token und Betrag formatieren (token bereits oben definiert)
          let amount = transfer.value || "0";
          let amountRaw = 0;
          
          // Beträge formatieren
          if (transfer.rawContract?.address) {
            if (transfer.rawContract.address.toLowerCase() === DFAITH_TOKEN.toLowerCase()) {
              token = "D.FAITH";
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              amount = (isReceived ? "+" : "-") + value.toFixed(2);
            } else if (transfer.rawContract.address.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
              const value = parseInt(transfer.value || "0");
              amountRaw = value;
              amount = (isReceived ? "+" : "-") + value.toString();
            } else {
              const value = parseFloat(transfer.value || "0");
              amountRaw = value;
              amount = (isReceived ? "+" : "-") + value.toFixed(6);
            }
          } else {
            // ETH-Transaktion
            const value = parseFloat(transfer.value || "0");
            amountRaw = value;
            amount = (isReceived ? "+" : "-") + value.toFixed(6);
          }
          
          return {
            // id enthält möglichst den echten tx hash (für späteres Same-Hash Matching)
            id: transfer.hash || transfer.uniqueId || Math.random().toString(),
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
          .filter(
            (t) =>
              t.token === "D.FAITH" &&
              t.amount.startsWith("-") &&
              t.address.toLowerCase() === DFAITH_POOL.toLowerCase() &&
              t.hash
          )
          .map((t) => t.hash)
      ));

      const gasTxs: Transaction[] = [];
      const hexToBigInt = (h: string) => BigInt(h || "0x0");
      const weiToEth = (wei: bigint) => Number(wei) / 1e18;

      for (const h of sellHashes) {
        try {
          const resp = await fetch(API_OPTIONS.ALCHEMY, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 100, method: "eth_getTransactionReceipt", params: [h] }),
          });
          if (!resp.ok) continue;
          const receipt = await resp.json();
          const r = receipt?.result;
          if (!r) continue;
          const gasUsed = hexToBigInt(r.gasUsed || "0x0");
          const effGasPrice = hexToBigInt(r.effectiveGasPrice || r.gasPrice || "0x0");
          const feeWei = gasUsed * effGasPrice;
          const feeEth = weiToEth(feeWei);
          const anchor = mappedTransactions.find((t) => t.hash === h);
          if (!anchor) continue;
          const feeAmount = Math.max(feeEth, 0);
          const gasTx: Transaction = {
            id: `gas-${h}`,
            type: "other",
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
        } catch {}
      }

      const merged = [...mappedTransactions, ...gasTxs].sort((a, b) => b.timestamp - a.timestamp);

      // WICHTIG: Alle Transaktionen behalten, damit Partner-Matching (ETH/WETH) nicht durch Filter verloren geht
      const claimsCount = merged.filter((t) => t.type === "claim").length;
      const buysCount = merged.filter((t) => t.type === "buy").length;
      console.log("[HistoryTab] Claims erkannt:", claimsCount, "| Käufe erkannt:", buysCount);
      setTransactions(merged);
      setStats({
        transactionCount: merged.length,
        claims: claimsCount,
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

  const getAmountColor = (amount: string) =>
    amount.startsWith("+") ? "text-green-400" : amount.startsWith("-") ? "text-red-400" : "text-amber-400";

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

  {/* Filter: Claims, Käufe & Verkäufe */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 mb-4">
          <span className="text-sm text-zinc-400 mr-2 flex items-center">Filter:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === "all" ? "bg-amber-500 text-black shadow-lg" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Alle
          </button>
          <button
            onClick={() => setFilter("claim")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "claim" ? "bg-cyan-500 text-white shadow-lg" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            🎁 Claim
          </button>
          <button
            onClick={() => setFilter("buy")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "buy" ? "bg-emerald-500 text-white shadow-lg" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            <FaBitcoin /> Kaufen
          </button>
          <button
            onClick={() => setFilter("sell")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              filter === "sell" ? "bg-rose-500 text-white shadow-lg" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            💰 Verkaufen
          </button>
        </div>
      )}

      {/* Historie: Social Media Claims und D.FAITH Käufe (gruppiert) */}
      {!isLoading && !error && filteredAndSortedTransactions.length > 0 && (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
          {filteredAndSortedTransactions.map((item, index) => {
            if (Array.isArray(item)) {
              const group = item as Transaction[];
              const tokenTx = group.find((t) => t.token !== "ETH");
              const ethTx = group.find((t) => t.token === "ETH");
              const groupType = (group as any).__groupType as "claim" | "buy" | "sell" | undefined;
        if (groupType === "buy") {
                return (
                  <div key={`buy-group-${index}`} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 text-xs font-semibold">
                          <FaBitcoin className="inline" /> Kaufen
                        </span>
            <span className="text-zinc-500 text-xs">Gruppiert</span>
                      </div>
                      <span className="text-zinc-400 text-xs">{group[0].time}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {tokenTx && (
                        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-emerald-700/40 bg-emerald-900/20 px-2 py-1.5">
                          <img src={tokenTx.tokenIcon} alt={tokenTx.token} className="w-6 h-6 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <div className="text-emerald-300 text-sm font-semibold truncate">{tokenTx.amount} {tokenTx.token}</div>
                            <div className="text-emerald-400/80 text-[11px]">Erhalten</div>
                          </div>
                        </div>
                      )}
                      {ethTx && (
                        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-red-700/40 bg-red-900/20 px-2 py-1.5">
                          <img src={ethTx.tokenIcon} alt="ETH" className="w-6 h-6 rounded-full" />
                          <div className="flex-1 min-w-0">
              <div className="text-red-300 text-sm font-semibold truncate">{ethTx.amount} {(ethTx.token === 'WETH' ? 'WETH' : 'ETH')}</div>
                            <div className="text-red-400/80 text-[11px]">Bezahlt</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              if (groupType === "sell") {
                const dfMinus = group.find((t) => t.token === "D.FAITH" && t.amount.startsWith("-"));
                const gas = group.find((t) => t.address === "Gas Fee");
                const ethPlus = group.find((t) => (t.token === "ETH" || t.token === "WETH") && t.amount.startsWith("+"));
                return (
                  <div key={`sell-group-${index}`} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/20 text-rose-300 text-xs font-semibold">
                          <span>💰</span> Verkaufen
                        </span>
                        <span className="text-zinc-500 text-xs">Gruppiert</span>
                      </div>
                      <span className="text-zinc-400 text-xs">{group[0].time}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {dfMinus && (
                        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-red-700/40 bg-red-900/20 px-2 py-1.5">
                          <img src={dfMinus.tokenIcon} alt={dfMinus.token} className="w-6 h-6 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <div className="text-red-300 text-sm font-semibold truncate">{dfMinus.amount} {dfMinus.token}</div>
                            <div className="text-red-400/80 text-[11px]">Abgegeben</div>
                          </div>
                        </div>
                      )}
                      {gas && (
                        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-amber-700/40 bg-amber-900/20 px-2 py-1.5">
                          <img src={gas.tokenIcon} alt="ETH" className="w-6 h-6 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <div className="text-amber-300 text-sm font-semibold truncate">{gas.amount} ETH</div>
                            <div className="text-amber-400/80 text-[11px]">Gas</div>
                          </div>
                        </div>
                      )}
                      {ethPlus && (
                        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-emerald-700/40 bg-emerald-900/20 px-2 py-1.5">
                          <img src={ethPlus.tokenIcon} alt="ETH" className="w-6 h-6 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <div className="text-emerald-300 text-sm font-semibold truncate">{ethPlus.amount} {(ethPlus.token === 'WETH' ? 'WETH' : 'ETH')}</div>
                            <div className="text-emerald-400/80 text-[11px]">Erhalten</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Default: Claim-Rendering
              return (
                <div key={`claim-group-${index}`} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-600/20 text-cyan-300 text-xs font-semibold">
                        <span>🎁</span> Claim
                      </span>
                      <span className="text-zinc-500 text-xs">Gruppiert</span>
                    </div>
                    <span className="text-zinc-400 text-xs">{group[0].time}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {tokenTx && (
                      <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-green-700/40 bg-green-900/20 px-2 py-1.5">
                        <img src={tokenTx.tokenIcon} alt={tokenTx.token} className="w-6 h-6 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="text-green-300 text-sm font-semibold truncate">{tokenTx.amount} {tokenTx.token}</div>
                          <div className="text-green-400/80 text-[11px]">Belohnung</div>
                        </div>
                      </div>
                    )}
                    {ethTx && (
                      <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md border border-blue-700/40 bg-blue-900/20 px-2 py-1.5">
                        <img src={ethTx.tokenIcon} alt="ETH" className="w-6 h-6 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="text-blue-300 text-sm font-semibold truncate">{ethTx.amount} ETH</div>
                          <div className="text-blue-400/80 text-[11px]">Bonus</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const tx = item as Transaction;
            // Einzelner Claim oder Buy (ohne Partner)
            const groupType = (tx as any).__groupType as "buy" | undefined;
            if (tx.type === "buy" || groupType === "buy") {
              return (
                <div key={tx.id} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 text-xs font-semibold">
                        <FaBitcoin className="inline" /> Kaufen
                      </span>
                      <span className="text-zinc-500 text-xs">Einzeltransfer</span>
                    </div>
                    <span className="text-zinc-400 text-xs">{tx.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={tx.tokenIcon} alt={tx.token} className="w-6 h-6 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${getAmountColor(tx.amount)}`}>{tx.amount} {tx.token}</div>
                      <div className="text-[11px] text-zinc-400">ETH-Zahlung wird separat verbucht</div>
                    </div>
                  </div>
                </div>
              );
            }
            // Einzelner Claim
            return (
              <div key={tx.id} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-600/20 text-cyan-300 text-xs font-semibold">
                      <span>🎁</span> Claim
                    </span>
                    <span className="text-zinc-500 text-xs">Einzeltransfer</span>
                  </div>
                  <span className="text-zinc-400 text-xs">{tx.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={tx.tokenIcon} alt={tx.token} className="w-6 h-6 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${getAmountColor(tx.amount)}`}>{tx.amount} {tx.token}</div>
                    <div className="text-[11px] text-zinc-400">ETH-Bonus wird separat verbucht</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
  {!isLoading && !error && filteredAndSortedTransactions.length === 0 && (
        <div className="text-center py-10 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 mb-4">
    <span className="text-2xl">{filter === "buy" ? "₿" : filter === "sell" ? "💰" : "🎁"}</span>
          </div>
          <h3 className="text-lg font-semibold text-amber-400 mb-1">
    {filter === "buy" ? "Keine Käufe gefunden" : filter === "sell" ? "Keine Verkäufe gefunden" : "Keine Claims gefunden"}
          </h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
    {filter === "buy"
      ? "Hier erscheinen D.FAITH-Käufe (D.FAITH + vom Pool, ETH/WETH − an den Pool)."
      : filter === "sell"
      ? "Hier erscheinen D.FAITH-Verkäufe (D.FAITH − an den Pool, Gas −ETH, ETH/WETH + vom Pool)."
      : "Hier erscheinen Social Media Claims, sobald ein D.FAITH-Transfer von der Claim-Adresse eingeht."}
          </p>
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
