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
    
    console.log("🔍 Starte Gruppierung mit", sorted.length, "Transaktionen");
    
    for (const tx of sorted) {
      if (processed.has(tx.id)) continue;
      
      console.log("📝 Analysiere Transaktion:", {
        token: tx.token,
        amount: tx.amount,
        type: tx.type,
        address: tx.address.slice(0, 10),
        timestamp: new Date(tx.timestamp).toLocaleTimeString()
      });
      
      // REGEL 1: SHOP-KÄUFE
      // Einzeltransaktion TO Shop-Adresse
      if (tx.address.toLowerCase() === SHOP_ADDRESS.toLowerCase() && tx.type === "shop") {
        console.log("🛍️ Shop-Kauf erkannt");
        grouped.push(tx);
        processed.add(tx.id);
        continue;
      }
      
      // REGEL 2: CLAIMS (Social Media) - VERBESSERTE ERKENNUNG
      // Token FROM Claim-Adresse + ETH (0.0000010) nach Claim-Eingang
      if (tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && tx.type === "claim") {
        console.log("🎁 Claim erkannt, suche nach ETH...");
        console.log("🎁 Claim Details:", {
          token: tx.token,
          amount: tx.amount,
          amountRaw: tx.amountRaw,
          address: tx.address,
          hash: tx.hash,
          timestamp: tx.timestamp
        });
        
        // Suche nach ETH-Transaktion (0.0000010) NACH dem Claim - ERWEITERTE SUCHE
        const ethAfterClaim = sorted.find(otherTx => {
          const isValidEth = (
            !processed.has(otherTx.id) &&
            otherTx.id !== tx.id &&
            otherTx.token === "ETH" &&
            otherTx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase() && // Auch ETH muss von Claim-Adresse kommen
            Math.abs(otherTx.amountRaw - 0.0000010) < 0.0000001 && // Exakter ETH-Betrag
            Math.abs(otherTx.timestamp - tx.timestamp) <= 300000 // Max 5 Minuten Differenz (vor oder nach)
          );
          
          if (isValidEth) {
            console.log("🎁 Passender ETH für Claim gefunden:", {
              ethAmount: otherTx.amount,
              ethAmountRaw: otherTx.amountRaw,
              timeDiff: otherTx.timestamp - tx.timestamp,
              address: otherTx.address
            });
          }
          
          return isValidEth;
        });
        
        if (ethAfterClaim) {
          console.log("✅ Claim-Gruppe erstellt:", {
            token: tx.token,
            tokenAmount: tx.amount,
            ethAmount: ethAfterClaim.amount,
            groupSize: 2
          });
          // Markiere als Claim-Gruppe für Filter
          const claimGroup = [tx, ethAfterClaim];
          (claimGroup as any).__groupType = 'claim';
          grouped.push(claimGroup);
          processed.add(tx.id);
          processed.add(ethAfterClaim.id);
        } else {
          console.log("❌ Kein passender ETH für Claim gefunden - als Einzeltransaktion");
          console.log("🔍 Verfügbare ETH-Transaktionen von Claim-Adresse:", 
            sorted.filter(t => t.token === "ETH" && t.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase())
              .map(t => ({
                amount: t.amount,
                amountRaw: t.amountRaw,
                timestamp: t.timestamp,
                timeDiff: t.timestamp - tx.timestamp
              }))
          );
          grouped.push(tx);
          processed.add(tx.id);
        }
        continue;
      }
      
      // REGEL 3: D.FAITH KAUF (Swap)
      // ETH → Pool, D.FAITH ← Pool (gleiche Zeit, verzögert möglich)
      if ((tx.token === "ETH" && tx.amountRaw < 0) || 
          (tx.token === "D.FAITH" && tx.amountRaw > 0 && tx.address.toLowerCase() === DFAITH_POOL.toLowerCase())) {
        
        console.log("🛒 Möglicher D.FAITH Kauf, suche nach Partner...");
        
        // Suche nach dem Partner (ETH raus oder D.FAITH rein vom Pool)
        const partner = sorted.find(otherTx => {
          if (otherTx.id === tx.id || processed.has(otherTx.id)) return false;
          
          const timeDiff = Math.abs(otherTx.timestamp - tx.timestamp);
          if (timeDiff > 120000) return false; // Max 2 Minuten
          
          // Fall 1: tx = ETH raus, partner = D.FAITH rein vom Pool
          if (tx.token === "ETH" && tx.amountRaw < 0) {
            return (
              otherTx.token === "D.FAITH" &&
              otherTx.amountRaw > 0 &&
              otherTx.address.toLowerCase() === DFAITH_POOL.toLowerCase()
            );
          }
          
          // Fall 2: tx = D.FAITH rein vom Pool, partner = ETH raus
          if (tx.token === "D.FAITH" && tx.amountRaw > 0) {
            return (
              otherTx.token === "ETH" &&
              otherTx.amountRaw < 0
            );
          }
          
          return false;
        });
        
        if (partner) {
          console.log("✅ D.FAITH Kauf-Gruppe:", {
            eth: tx.token === "ETH" ? tx.amount : partner.amount,
            dfaith: tx.token === "D.FAITH" ? tx.amount : partner.amount
          });
          // Markiere als D.FAITH Kauf-Gruppe für Filter
          const buyGroup = [tx, partner];
          (buyGroup as any).__groupType = 'buy';
          grouped.push(buyGroup);
          processed.add(tx.id);
          processed.add(partner.id);
          continue;
        }
      }
      
      // REGEL 4: D.FAITH VERKAUF (Swap)
      // D.FAITH → Pool, ETH ← Pool (gleicher Hash) + Gas ETH (nach Pool-Eingang)
      if (tx.token === "D.FAITH" && tx.amountRaw < 0 && tx.address.toLowerCase() === DFAITH_POOL.toLowerCase()) {
        
        console.log("💰 D.FAITH Verkauf erkannt, suche nach ETH vom Pool...");
        
        // 1. Suche ETH vom Pool (gleicher Hash = Multi-Asset Transfer)
        const ethFromPool = sorted.find(otherTx => {
          return (
            !processed.has(otherTx.id) &&
            otherTx.id !== tx.id &&
            otherTx.hash === tx.hash && // GLEICHER HASH!
            otherTx.token === "ETH" &&
            otherTx.amountRaw > 0 &&
            otherTx.address.toLowerCase() === DFAITH_POOL.toLowerCase()
          );
        });
        
        if (ethFromPool) {
          console.log("✅ ETH vom Pool gefunden (gleicher Hash)");
          
          // 2. Suche Gas ETH NACH dem Pool-Eingang
          const gasEth = sorted.find(otherTx => {
            return (
              !processed.has(otherTx.id) &&
              otherTx.id !== tx.id &&
              otherTx.id !== ethFromPool.id &&
              otherTx.token === "ETH" &&
              otherTx.amountRaw < 0 && // Gas ist immer minus
              otherTx.timestamp >= ethFromPool.timestamp && // NACH Pool-ETH
              otherTx.timestamp - ethFromPool.timestamp <= 300000 // Max 5 Minuten später
            );
          });
          
          if (gasEth) {
            console.log("✅ D.FAITH Verkauf-Gruppe (3 Transaktionen):", {
              dfaithOut: tx.amount,
              ethIn: ethFromPool.amount,
              gasEth: gasEth.amount
            });
            // Markiere als D.FAITH Verkauf-Gruppe für Filter
            const sellGroup = [tx, ethFromPool, gasEth];
            (sellGroup as any).__groupType = 'sell';
            grouped.push(sellGroup);
            processed.add(tx.id);
            processed.add(ethFromPool.id);
            processed.add(gasEth.id);
          } else {
            console.log("⚠️ Kein Gas ETH gefunden, nur 2er Gruppe");
            // Markiere als D.FAITH Verkauf-Gruppe für Filter
            const sellGroup = [tx, ethFromPool];
            (sellGroup as any).__groupType = 'sell';
            grouped.push(sellGroup);
            processed.add(tx.id);
            processed.add(ethFromPool.id);
          }
          continue;
        }
      }
      
      // REGEL 5 & 6: EMPFANGEN & SENDEN
      // Einzeltransaktionen ohne Gruppierung
      console.log("📄 Einzeltransaktion:", tx.type);
      grouped.push(tx);
      processed.add(tx.id);
    }
    
    console.log("� Gruppierung abgeschlossen:", grouped.length, "Gruppen");
    
    // Filter anwenden NACH Gruppierung
    if (filter !== 'all') {
      const filteredGroups = grouped.filter(item => {
        if (Array.isArray(item)) {
          // Gruppierte Transaktionen - prüfe Gruppentyp
          const groupType = (item as any).__groupType;
          
          if (filter === 'buy') {
            return groupType === 'buy'; // Nur D.FAITH Kauf-Swaps
          } else if (filter === 'sell') {
            return groupType === 'sell'; // Nur D.FAITH Verkauf-Swaps
          } else if (filter === 'claim') {
            return groupType === 'claim'; // Nur Claim-Gruppen
          }
          
          return false; // Andere Gruppen nicht anzeigen bei spezifischen Filtern
        } else {
          // Einzeltransaktionen
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
          
          // Token bestimmen (früh, für besseres Debugging)
          let token = transfer.asset || "ETH";
          if (transfer.rawContract?.address) {
            if (transfer.rawContract.address.toLowerCase() === DFAITH_TOKEN.toLowerCase()) {
              token = "D.FAITH";
            } else if (transfer.rawContract.address.toLowerCase() === DINVEST_TOKEN.toLowerCase()) {
              token = "D.INVEST";
            }
          }
          
          // Claim-Erkennung (höchste Priorität nach Shop) - VERBESSERTE ERKENNUNG
          if (fromAddress === CLAIM_ADDRESS.toLowerCase() && isReceived) {
            // Transaktion von Claim-Adresse = Social Media Claim
            type = "claim";
            address = CLAIM_ADDRESS;
            console.log("🎁 Social Media Claim erkannt in Verarbeitung:", {
              hash: transfer.hash,
              from: fromAddress,
              to: toAddress,
              asset: transfer.asset,
              value: transfer.value,
              token: token,
              isETH: !transfer.rawContract?.address
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
          
          // Token und Betrag formatieren (token bereits oben definiert)
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
      
      // DEBUG: Zeige alle Claims
      const allClaims = mappedTransactions.filter(tx => tx.type === "claim");
      console.log("🎁 ALLE ERKANNTEN CLAIMS:", allClaims.length);
      allClaims.forEach((claim, index) => {
        console.log(`🎁 Claim ${index + 1}:`, {
          token: claim.token,
          amount: claim.amount,
          amountRaw: claim.amountRaw,
          time: claim.time,
          address: claim.address,
          hash: claim.hash.slice(0, 10)
        });
      });
      
      // DEBUG: Zeige alle ETH-Transaktionen von Claim-Adresse
      const claimEthTxs = mappedTransactions.filter(tx => 
        tx.token === "ETH" && 
        tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase()
      );
      console.log("💰 ETH-Transaktionen von Claim-Adresse:", claimEthTxs.length);
      claimEthTxs.forEach((ethTx, index) => {
        console.log(`💰 ETH ${index + 1}:`, {
          amount: ethTx.amount,
          amountRaw: ethTx.amountRaw,
          time: ethTx.time,
          type: ethTx.type
        });
      });
      
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

      {/* KOMPLETT NEUES HISTORIE-DESIGN */}
      {!isLoading && !error && filteredAndSortedTransactions.length > 0 && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          {filteredAndSortedTransactions.map((item, index) => {
            
            // ===== GRUPPIERTE TRANSAKTIONEN =====
            if (Array.isArray(item)) {
              const group = item as Transaction[];
              console.log("🎨 Rendering Gruppe:", group.length, "Transaktionen");
              
              // Bestimme Gruppentyp
              const isClaimGroup = group.some(tx => tx.address.toLowerCase() === CLAIM_ADDRESS.toLowerCase());
              const hasTokenTx = group.some(tx => tx.token === "D.FAITH" || tx.token === "D.INVEST");
              
              if (isClaimGroup) {
                // ===== CLAIM-GRUPPE =====
                const tokenTx = group.find(tx => tx.token !== "ETH");
                const ethTx = group.find(tx => tx.token === "ETH");
                
                return (
                  <div key={`claim-group-${index}`} className="border-l-4 border-cyan-400 bg-gradient-to-r from-cyan-950/30 to-cyan-900/20 rounded-r-xl p-4">
                    {/* Claim Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center">
                          <span className="text-white text-lg">🎁</span>
                        </div>
                        <div>
                          <h3 className="text-cyan-300 font-bold text-lg">SOCIAL MEDIA CLAIM</h3>
                          <p className="text-zinc-400 text-sm">{group[0].time} • {group.length} Transaktionen</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-cyan-400 font-bold text-xl">GROUPED</div>
                        <div className="text-zinc-400 text-sm">Gruppiert</div>
                      </div>
                    </div>
                    
                    {/* Claim Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-cyan-950/20 rounded-lg p-3">
                      {tokenTx && (
                        <div className="flex items-center gap-3 bg-green-900/30 rounded-lg p-3">
                          <img src={tokenTx.tokenIcon} alt={tokenTx.token} className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <div className="text-green-400 font-bold">{tokenTx.amount}</div>
                            <div className="text-green-300 text-sm">{tokenTx.token} Belohnung</div>
                          </div>
                        </div>
                      )}
                      {ethTx && (
                        <div className="flex items-center gap-3 bg-blue-900/30 rounded-lg p-3">
                          <img src={ethTx.tokenIcon} alt="ETH" className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <div className="text-blue-400 font-bold">{ethTx.amount}</div>
                            <div className="text-blue-300 text-sm">ETH Gas Erstattung</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else if (hasTokenTx) {
                // ===== SWAP-GRUPPE =====
                const tokenTxs = group.filter(tx => tx.token === "D.FAITH" || tx.token === "D.INVEST");
                const ethTxs = group.filter(tx => tx.token === "ETH");
                const isVerkauf = tokenTxs.some(tx => tx.amountRaw < 0);
                const isKauf = tokenTxs.some(tx => tx.amountRaw > 0);
                const mainToken = tokenTxs[0]?.token || "TOKEN";
                
                return (
                  <div key={`swap-group-${index}`} className={`border-l-4 ${isVerkauf ? 'border-orange-400 bg-gradient-to-r from-orange-950/30 to-orange-900/20' : 'border-blue-400 bg-gradient-to-r from-blue-950/30 to-blue-900/20'} rounded-r-xl p-4`}>
                    {/* Swap Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full ${isVerkauf ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center`}>
                          <span className="text-white text-lg">{isVerkauf ? '💰' : '🛒'}</span>
                        </div>
                        <div>
                          <h3 className={`${isVerkauf ? 'text-orange-300' : 'text-blue-300'} font-bold text-lg`}>
                            {mainToken} {isVerkauf ? 'VERKAUF' : 'KAUF'}
                          </h3>
                          <p className="text-zinc-400 text-sm">{group[0].time} • {group.length} Transaktionen</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`${isVerkauf ? 'text-orange-400' : 'text-blue-400'} font-bold text-xl`}>GROUPED</div>
                        <div className="text-zinc-400 text-sm">Swap</div>
                      </div>
                    </div>
                    
                    {/* Swap Content */}
                    <div className="space-y-2">
                      {/* Token Transaktionen */}
                      {tokenTxs.map((tx, idx) => (
                        <div key={tx.id} className={`flex items-center gap-3 ${tx.amountRaw < 0 ? 'bg-red-900/30' : 'bg-green-900/30'} rounded-lg p-3`}>
                          <img src={tx.tokenIcon} alt={tx.token} className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <div className={`${tx.amountRaw < 0 ? 'text-red-400' : 'text-green-400'} font-bold`}>{tx.amount}</div>
                            <div className={`${tx.amountRaw < 0 ? 'text-red-300' : 'text-green-300'} text-sm`}>
                              {tx.token} {tx.amountRaw < 0 ? 'verkauft' : 'gekauft'}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* ETH Transaktionen */}
                      {ethTxs.map((tx, idx) => (
                        <div key={tx.id} className={`flex items-center gap-3 ${tx.amountRaw < 0 ? 'bg-yellow-900/30' : 'bg-green-900/30'} rounded-lg p-3`}>
                          <img src={tx.tokenIcon} alt="ETH" className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <div className={`${tx.amountRaw < 0 ? 'text-yellow-400' : 'text-green-400'} font-bold`}>{tx.amount}</div>
                            <div className={`${tx.amountRaw < 0 ? 'text-yellow-300' : 'text-green-300'} text-sm`}>
                              ETH {tx.amountRaw < 0 ? 'Gas' : 'erhalten'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            } else {
              // ===== EINZELNE TRANSAKTION =====
              const tx = item as Transaction;
              console.log("🎨 Rendering Einzeltransaktion:", tx.type, tx.token);
              
              let borderColor = "border-zinc-600";
              let bgColor = "from-zinc-800/90 to-zinc-900/90";
              let iconBg = "bg-zinc-600";
              let textColor = "text-zinc-300";
              
              switch (tx.type) {
                case "shop":
                  borderColor = "border-purple-400";
                  bgColor = "from-purple-950/30 to-purple-900/20";
                  iconBg = "bg-purple-500";
                  textColor = "text-purple-300";
                  break;
                case "claim":
                  borderColor = "border-cyan-400";
                  bgColor = "from-cyan-950/30 to-cyan-900/20";
                  iconBg = "bg-cyan-500";
                  textColor = "text-cyan-300";
                  break;
                case "buy":
                  borderColor = "border-blue-400";
                  bgColor = "from-blue-950/30 to-blue-900/20";
                  iconBg = "bg-blue-500";
                  textColor = "text-blue-300";
                  break;
                case "sell":
                  borderColor = "border-orange-400";
                  bgColor = "from-orange-950/30 to-orange-900/20";
                  iconBg = "bg-orange-500";
                  textColor = "text-orange-300";
                  break;
                case "receive":
                  borderColor = "border-green-400";
                  bgColor = "from-green-950/30 to-green-900/20";
                  iconBg = "bg-green-500";
                  textColor = "text-green-300";
                  break;
                case "send":
                  borderColor = "border-red-400";
                  bgColor = "from-red-950/30 to-red-900/20";
                  iconBg = "bg-red-500";
                  textColor = "text-red-300";
                  break;
              }
              
              return (
                <div key={tx.id} className={`border-l-4 ${borderColor} bg-gradient-to-r ${bgColor} rounded-r-xl p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center`}>
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <h3 className={`${textColor} font-bold text-lg`}>
                          {tx.type === "send" && "GESENDET"}
                          {tx.type === "receive" && "EMPFANGEN"}
                          {tx.type === "buy" && "GEKAUFT"}
                          {tx.type === "sell" && "VERKAUFT"}
                          {tx.type === "shop" && "SHOP-KAUF"}
                          {tx.type === "claim" && "CLAIM"}
                        </h3>
                        <p className="text-zinc-400 text-sm">{tx.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-xl ${getAmountColor(tx.amount)}`}>{tx.amount}</div>
                      <div className="text-zinc-400 text-sm">{tx.token}</div>
                    </div>
                  </div>
                  
                  {/* Adresse */}
                  <div className="mt-3 pt-3 border-t border-zinc-700/50">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">
                        {tx.type === "send" ? "An:" : 
                         tx.type === "receive" ? "Von:" :
                         tx.type === "buy" || tx.type === "sell" ? "Pool:" :
                         tx.type === "shop" ? "Shop:" :
                         tx.type === "claim" ? "Von:" : "Adresse:"}
                      </span>
                      <span className="text-amber-400 font-mono">
                        {tx.type === "buy" || tx.type === "sell" ? 
                          (tx.address.toLowerCase() === DFAITH_POOL.toLowerCase() ? "D.FAITH Pool" :
                           tx.address.toLowerCase() === DINVEST_POOL.toLowerCase() ? "D.INVEST Pool" :
                           formatAddress(tx.address)) :
                         tx.type === "shop" ? "Merch Shop" :
                         tx.type === "claim" ? "Social Media" :
                         formatAddress(tx.address)}
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
