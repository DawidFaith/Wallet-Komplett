"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { useActiveAccount, useActiveWalletConnectionStatus, useSendTransaction, useWalletBalance, useReadContract } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { FaRegCopy, FaCoins, FaArrowDown, FaArrowUp, FaPaperPlane, FaLock, FaHistory, FaTimes, FaSync } from "react-icons/fa";
import { balanceOf } from "thirdweb/extensions/erc20";
import type { SupportedLanguage } from "../utils/deepLTranslation";
import { TranslatedText } from "../components/TranslatedText";

// Import Subtabs
import BuyTab from "./wallet/BuyTab";
import SellTab from "./wallet/SellTab";
import SendTab from "./wallet/SendTab";
import HistoryTab from "./wallet/HistoryTab";
import StakeTab from "./wallet/StakeTab";

// Mobile-optimierte Modal Komponente ohne Swipe-to-close
function Modal({ open, onClose, title, children }: { open: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!open) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-8 sm:pt-12"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-zinc-900 rounded-xl w-full sm:min-w-[340px] sm:max-w-4xl sm:w-auto sm:mx-4 max-h-[90vh] overflow-y-auto shadow-2xl relative border border-zinc-700 transition-all duration-300 m-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-700 sticky top-0 bg-zinc-900 z-10">
          <h3 className="font-bold text-lg sm:text-xl text-amber-400 truncate pr-4">{title}</h3>
          <button 
            className="p-2 text-amber-400 hover:text-yellow-300 hover:bg-zinc-800 rounded-lg transition-all flex-shrink-0 touch-manipulation"
            onClick={onClose}
          >
            <FaTimes size={16} />
          </button>
        </div>
        
        {/* Content - Kein zusätzliches Padding für StakeTab */}
        <div className={`${title === "Staking" ? "" : "p-4 sm:p-6 pb-8"} overflow-y-auto`}>
          {children}
        </div>
      </div>
    </div>
  );
}

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID!,
});

// Token Adressen (gleich wie im SendTab)
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DFAITH_DECIMALS = 2;
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";
const DINVEST_DECIMALS = 0;
const ETH_DECIMALS = 18;

const wallets = [
  inAppWallet({
    auth: {
      options: ["email", "google", "facebook"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

interface WalletTabProps {
  language: SupportedLanguage;
}

export default function WalletTab({ language }: WalletTabProps) {
  const account = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const { mutate: sendTransaction, data: transactionResult, isPending: isTransactionPending } = useSendTransaction();

  // Thirdweb Hooks für Balance (wie im SendTab)
  const { data: ethBalanceData } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
  });

  const { data: dfaithBalanceData } = useReadContract({
    contract: getContract({
      client,
      chain: base,
      address: DFAITH_TOKEN
    }),
    method: "function balanceOf(address) view returns (uint256)",
    params: [account?.address || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!account?.address,
      refetchInterval: 5000, // Alle 5 Sekunden aktualisieren
    }
  });

  const { data: dinvestBalanceData } = useReadContract({
    contract: getContract({
      client,
      chain: base,
      address: DINVEST_TOKEN
    }),
    method: "function balanceOf(address) view returns (uint256)",
    params: [account?.address || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!account?.address,
      refetchInterval: 5000, // Alle 5 Sekunden aktualisieren
    }
  });

  // Formatierte Balances berechnen (wie im SendTab)
  const ethBalance = ethBalanceData 
    ? (Number(ethBalanceData.value) / Math.pow(10, ETH_DECIMALS)).toFixed(4)
    : "0.0000";

  const dfaithBalance = dfaithBalanceData 
    ? (Number(dfaithBalanceData) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS)
    : "0.00";

  const dinvestBalance = dinvestBalanceData 
    ? (Number(dinvestBalanceData) / Math.pow(10, DINVEST_DECIMALS)).toString()
    : "0";

  // Alte State-Variablen entfernt, da wir jetzt direkt die berechneten Werte verwenden
  const [stakedBalance, setStakedBalance] = useState<string>("0");
  const [availableRewards, setAvailableRewards] = useState<string>("0.00");

  const [dfaithEurValue, setDfaithEurValue] = useState<string>("0.00");
  const [dfaithPriceEur, setDfaithPriceEur] = useState<number>(0);
  const [polPriceEur, setPolPriceEur] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [lastKnownPrices, setLastKnownPrices] = useState<{
    dfaith?: number;
    dfaithEur?: number;
    ethEur?: number;
    timestamp?: number;
    dfaithEur24h?: number; // Für 24h Vergleich
  }>({});
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pricesLoaded, setPricesLoaded] = useState<boolean>(false);
  // State für Loading und Refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  // Tracking-ID für die aktuelle Abfrage
  const requestIdRef = useRef(0);
  
  // State für Kopieren-Feedback
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Modal States
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  
  // Staking Contract Adresse
  const STAKING_CONTRACT = {
    address: "0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940", // Korrekte Staking Contract Adresse (NEU)
    name: "D.INVEST Staking"
  };

  // Funktion zum Abrufen der gestakten Balance
  const fetchStakedBalance = async () => {
    if (!account?.address) {
      setStakedBalance("0");
      return;
    }

    try {
      console.log("🔍 Lade gestakte Balance für Wallet:", account.address);
      console.log("🔍 Staking Contract:", STAKING_CONTRACT.address);
      
      const stakingContract = getContract({ 
        client, 
        chain: base, 
        address: STAKING_CONTRACT.address
      });

      // Versuche zuerst getUserInfo (gleiche Methode wie in StakeTab)
      try {
        const userInfo = await readContract({
          contract: stakingContract,
          method: "function getUserInfo(address) view returns (uint256,uint256,uint256,bool,bool)",
          params: [account.address]
        });
        // [stakedAmount, claimableReward, stakeTimestamp, canUnstake, canClaim]
        console.log("✅ getUserInfo Ergebnis (WalletTab):", userInfo);
        setStakedBalance(userInfo[0].toString());
        return;
      } catch (userInfoError) {
        console.log("❌ getUserInfo fehlgeschlagen (WalletTab), versuche stakes mapping:", userInfoError);
      }

      // Fallback: Versuche direkt das stakes mapping
      try {
        const stakedAmount = await readContract({
          contract: stakingContract,
          method: "function stakes(address) view returns (uint256)",
          params: [account.address]
        });
        console.log("✅ stakes mapping Ergebnis (WalletTab):", stakedAmount.toString());
        setStakedBalance(stakedAmount.toString());
        return;
      } catch (stakesError) {
        console.log("❌ stakes mapping fehlgeschlagen (WalletTab):", stakesError);
      }

      // Weitere Fallback-Methoden
      try {
        const userInfo = await readContract({
          contract: stakingContract,
          method: "function getUserStakeInfo(address) view returns (uint256, uint256, uint256, uint256, bool, uint256, bool)",
          params: [account.address]
        });
        console.log("✅ getUserStakeInfo Ergebnis (WalletTab):", userInfo[0].toString());
        setStakedBalance(userInfo[0].toString());
        return;
      } catch (fallbackError) {
        console.error("❌ Alle Fallback-Methoden fehlgeschlagen (WalletTab):", fallbackError);
      }

      // Wenn alle Methoden fehlschlagen, setze auf 0
      setStakedBalance("0");
      
    } catch (error) {
      console.error("❌ Schwerwiegender Fehler beim Abrufen der gestakten Balance:", error);
      setStakedBalance("0");
    }
  };

  // Funktion zum Abrufen der verfügbaren Rewards im Smart Contract
  const fetchAvailableRewards = async () => {
    try {
      console.log("💰 Lade verfügbare Rewards aus Smart Contract...");
      
      const stakingContract = getContract({ 
        client, 
        chain: base, 
        address: STAKING_CONTRACT.address
      });

      // Versuche getContractInfo für rewardBalance
      try {
        const contractInfo = await readContract({
          contract: stakingContract,
          method: "function getContractInfo() view returns (uint256,uint256,uint8,uint256)",
          params: []
        });
        // [totalStakedTokens, rewardBalance, currentStage, currentRate]
        const rewardBalance = contractInfo[1];
        const formattedRewards = (Number(rewardBalance) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS);
        console.log("✅ Verfügbare Rewards (WalletTab):", formattedRewards);
        setAvailableRewards(formattedRewards);
        return;
      } catch (contractInfoError) {
        console.log("❌ getContractInfo fehlgeschlagen (WalletTab), versuche D.FAITH Balance vom Contract:", contractInfoError);
      }

      // Fallback: D.FAITH Balance des Staking Contracts direkt abfragen
      try {
        const dfaithContract = getContract({ 
          client, 
          chain: base, 
          address: DFAITH_TOKEN
        });
        
        const contractBalance = await readContract({
          contract: dfaithContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [STAKING_CONTRACT.address]
        });
        
        const formattedBalance = (Number(contractBalance) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS);
        console.log("✅ Contract D.FAITH Balance (Fallback):", formattedBalance);
        setAvailableRewards(formattedBalance);
        return;
      } catch (balanceError) {
        console.log("❌ Fallback Balance-Abfrage fehlgeschlagen:", balanceError);
      }

      // Wenn alle Methoden fehlschlagen, setze auf 0
      setAvailableRewards("0.00");
      
    } catch (error) {
      console.error("❌ Schwerwiegender Fehler beim Abrufen der verfügbaren Rewards:", error);
      setAvailableRewards("0.00");
    }
  };

  // Funktion für manuelle Aktualisierung der Balance mit Animation
  const refreshBalances = async () => {
    if (!account?.address || isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      await fetchDfaithPrice();
      await fetchStakedBalance(); // Gestakte Balance auch beim manuellen Refresh aktualisieren
      await fetchAvailableRewards(); // Verfügbare Rewards auch beim manuellen Refresh aktualisieren
      // Die thirdweb Hooks aktualisieren sich automatisch durch refetchInterval
    } finally {
      // Nach einer kurzen Verzögerung den Refresh-Status zurücksetzen (Animation)
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  // UseEffect für initiales Laden und periodische Aktualisierung (alle 30 Sekunden)
  useEffect(() => {
    let isMounted = true;
    let priceIntervalId: NodeJS.Timeout | null = null;
    
    const loadPrices = async () => {
      if (!account?.address || !isMounted) return;
      
      console.log("💰 Starte Preis-Aktualisierung...");
      await fetchDfaithPrice();
    };
    
    const loadDataWithPrices = async () => {
      if (!account?.address || !isMounted) return;
      
      console.log("🔄 Starte vollständige Aktualisierung (mit Preisen)...");
      await fetchDfaithPrice();
      await fetchStakedBalance();
      await fetchAvailableRewards(); // Auch Rewards beim initialen Laden
    };
    
    // Initiales Laden mit Preisen
    loadDataWithPrices();
    
    // Die Token-Balances werden automatisch durch thirdweb Hooks aktualisiert (refetchInterval: 5000)
    // Nur Preise alle 60 Sekunden aktualisieren
    
    // Separate Preis-Aktualisierung alle 5 Minuten
    priceIntervalId = setInterval(() => {
      if (isMounted && account?.address) {
        console.log("💰 5-Minuten-Intervall: Lade Preise neu...");
        loadPrices();
      }
    }, 5 * 60 * 1000); // 5 Minuten
    
    return () => {
      isMounted = false;
      if (priceIntervalId) {
        clearInterval(priceIntervalId);
        console.log("🛑 Preis-Aktualisierung gestoppt");
      }
    };
  }, [account?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // D.FAITH EUR-Preis holen mit mehreren Anbietern für ETH/EUR und Fallback System
  const fetchDfaithPrice = async () => {
    // Rate Limiting für alle APIs (max. 1 Request alle 30 Sekunden pro Anbieter)
    const now = Date.now();
    const cooldownPeriod = 30 * 1000; // 30 Sekunden
    
    const getLastRequest = (provider: string) => {
      const lastRequest = localStorage.getItem(`last_${provider}_request`);
      return lastRequest ? parseInt(lastRequest) : 0;
    };
    
    const shouldSkipProvider = (provider: string) => {
      return (now - getLastRequest(provider)) < cooldownPeriod;
    };

    try {
      // Lade gespeicherte Preise beim Start
      const loadStoredPrices = () => {
        try {
          const stored = localStorage.getItem('dawid_faith_prices');
          if (stored) {
            const parsed = JSON.parse(stored);
            const now = Date.now();
            // Verwende gespeicherte Preise wenn sie weniger als 6 Stunden alt sind
            if (parsed.timestamp && (now - parsed.timestamp) < 6 * 60 * 60 * 1000) {
              setLastKnownPrices(parsed);
              if (parsed.dfaithEur) setDfaithPriceEur(parsed.dfaithEur);
              if (parsed.ethEur) setPolPriceEur(parsed.ethEur); // Rename internal state later
              
              // Berechne 24h Preisänderung wenn 24h-Daten vorhanden sind
              if (parsed.dfaithEur && parsed.dfaithEur24h) {
                const change = ((parsed.dfaithEur - parsed.dfaithEur24h) / parsed.dfaithEur24h) * 100;
                setPriceChange24h(change);
              }
              return true;
            }
          }
        } catch (e) {
          console.log('Fehler beim Laden gespeicherter Preise:', e);
        }
        return false;
      };

      // Verwende gespeicherte Preise falls verfügbar
      const hasStoredPrices = loadStoredPrices();

      let ethEur: number | null = null;
      let dfaithPriceEur: number | null = null;
      let dfaithAmount: number | null = null; // Wie viele D.FAITH für 1 ETH
      let errorMsg = "";

      // Mehrere Anbieter für ETH/EUR Preis versuchen
      const ethProviders = [
        {
          name: 'coingecko',
          fetch: async () => {
            if (shouldSkipProvider('coingecko')) {
              console.log('CoinGecko Request übersprungen (Rate Limiting)');
              return null;
            }
            localStorage.setItem('last_coingecko_request', now.toString());
            
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur');
            if (!response.ok) {
              if (response.status === 429) {
                console.log('CoinGecko Rate Limit erreicht (429)');
              }
              throw new Error(`CoinGecko: ${response.status}`);
            }
            const data = await response.json();
            return data['ethereum']?.eur;
          }
        },
        {
          name: 'cryptocompare',
          fetch: async () => {
            if (shouldSkipProvider('cryptocompare')) {
              console.log('CryptoCompare Request übersprungen (Rate Limiting)');
              return null;
            }
            localStorage.setItem('last_cryptocompare_request', now.toString());
            
            const response = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=EUR');
            if (!response.ok) {
              if (response.status === 429) {
                console.log('CryptoCompare Rate Limit erreicht (429)');
              }
              throw new Error(`CryptoCompare: ${response.status}`);
            }
            const data = await response.json();
            return data.EUR;
          }
        },
        {
          name: 'binance',
          fetch: async () => {
            if (shouldSkipProvider('binance')) {
              console.log('Binance Request übersprungen (Rate Limiting)');
              return null;
            }
            localStorage.setItem('last_binance_request', now.toString());
            
            // Binance API für ETH/USDT Preis, dann USDT/EUR
            const [ethUsdtResponse, usdtEurResponse] = await Promise.all([
              fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
              fetch('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT')
            ]);
            
            if (!ethUsdtResponse.ok || !usdtEurResponse.ok) {
              throw new Error('Binance API Fehler');
            }
            
            const ethUsdtData = await ethUsdtResponse.json();
            const usdtEurData = await usdtEurResponse.json();
            
            const ethUsdt = parseFloat(ethUsdtData.price);
            const eurUsdt = parseFloat(usdtEurData.price);
            
            if (ethUsdt && eurUsdt) {
              return ethUsdt / eurUsdt; // ETH in EUR
            }
            return null;
          }
        }
      ];

      // Versuche die Anbieter nacheinander bis einer funktioniert
      for (const provider of ethProviders) {
        try {
          const price = await provider.fetch();
          if (price && price > 0) {
            ethEur = Math.round(price * 100) / 100;
            console.log(`ETH Preis erfolgreich von ${provider.name} geholt: €${ethEur}`);
            break;
          }
        } catch (e) {
          console.log(`${provider.name} Fehler:`, e);
          continue;
        }
      }

      // Fallback auf letzten bekannten ETH Preis
      if (!ethEur && lastKnownPrices.ethEur) {
        ethEur = lastKnownPrices.ethEur;
        console.log('Verwende gespeicherten ETH Preis:', ethEur);
      } else if (!ethEur) {
        ethEur = 3000; // Hard fallback für ETH
        console.log('Verwende Hard-Fallback ETH Preis:', ethEur);
      }

      try {
        // 2. Hole D.FAITH Preis von OpenOcean für Base Chain (gleiche Richtung wie SellTab)
        const params = new URLSearchParams({
          chain: "base",
          inTokenAddress: DFAITH_TOKEN,
          outTokenAddress: "0x0000000000000000000000000000000000000000", // Native ETH
          amount: "1", // 1 D.FAITH
          gasPrice: "0.001", // Base Chain: 0.001 Gwei
        });
        
        const response = await fetch(`https://open-api.openocean.finance/v3/base/quote?${params}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("OpenOcean Response (WalletTab):", data);
          if (data && data.data && data.data.outAmount && data.data.outAmount !== "0") {
            // outAmount ist in ETH (mit 18 Decimals)
            const ethPerDfaith = Number(data.data.outAmount) / Math.pow(10, 18);
            // Preis pro D.FAITH in EUR: ethPerDfaith * ethEur
            if (ethEur && ethPerDfaith > 0) {
              dfaithPriceEur = ethPerDfaith * ethEur;
              dfaithAmount = ethPerDfaith; // Speichere ETH pro D.FAITH für Konsistenz
              console.log('D.FAITH Preis erfolgreich berechnet (WalletTab):', {
                ethEur,
                ethPerDfaith,
                dfaithPriceEur
              });
            }
          } else {
            errorMsg = "OpenOcean: Keine Liquidität verfügbar";
          }
        } else {
          errorMsg = `OpenOcean: ${response.status}`;
        }
      } catch (e) {
        console.log("OpenOcean Fehler:", e);
        errorMsg = "OpenOcean API Fehler";
      }

      // Fallback auf letzte bekannte D.FAITH Preise
      if (!dfaithPriceEur && lastKnownPrices.dfaithEur) {
        dfaithPriceEur = lastKnownPrices.dfaithEur;
        errorMsg = "";
        console.log('Verwende gespeicherten D.FAITH Preis:', dfaithPriceEur);
      }

      // Setze Preise (entweder neue oder Fallback)
      if (ethEur) setPolPriceEur(ethEur); // Keep variable name for now
      if (dfaithPriceEur) {
        setDfaithPriceEur(dfaithPriceEur);
        // EUR-Wert sofort nach Preis-Update neu berechnen
        if (dfaithBalance) {
          const newEurValue = calculateEurValue(dfaithBalance);
          setDfaithEurValue(newEurValue);
        }
      }

      // Speichere erfolgreiche Preise (erweitert um 24h Daten)
      if (dfaithPriceEur && ethEur && dfaithAmount) {
        // Lade vorherigen Preis für 24h Vergleich
        let dfaithEur24h: number | undefined;
        try {
          const stored = localStorage.getItem('dawid_faith_prices');
          if (stored) {
            const parsed = JSON.parse(stored);
            const timeDiff = now - (parsed.timestamp || 0);
            // Verwende als 24h-Referenz wenn die Daten zwischen 20-28 Stunden alt sind
            if (timeDiff >= 20 * 60 * 60 * 1000 && timeDiff <= 28 * 60 * 60 * 1000) {
              dfaithEur24h = parsed.dfaithEur;
            } else if (parsed.dfaithEur24h) {
              // Verwende bereits gespeicherten 24h-Wert
              dfaithEur24h = parsed.dfaithEur24h;
            }
          }
        } catch (e) {
          console.log('Fehler beim Laden 24h Preisdaten:', e);
        }

        // Berechne Preisänderung
        if (dfaithEur24h && dfaithEur24h > 0) {
          const change = ((dfaithPriceEur - dfaithEur24h) / dfaithEur24h) * 100;
          setPriceChange24h(change);
        }

        const newPrices = {
          dfaith: dfaithAmount, // Jetzt ETH pro D.FAITH (konsistent mit SellTab)
          dfaithEur: dfaithPriceEur,
          ethEur: ethEur,
          dfaithEur24h: dfaithEur24h || dfaithPriceEur, // Speichere 24h-Referenz
          timestamp: Date.now()
        };
        setLastKnownPrices(prev => ({ ...prev, ...newPrices }));
        try {
          localStorage.setItem('dawid_faith_prices', JSON.stringify(newPrices));
          console.log('Preise erfolgreich gespeichert (WalletTab):', newPrices);
        } catch (e) {
          console.log('Fehler beim Speichern der Preise:', e);
        }
        setPriceError(null);
      } else {
        setPriceError(errorMsg || "Preise nicht verfügbar");
      }

    } catch (error) {
      console.error("Fehler beim Abrufen des D.FAITH EUR-Preises:", error);
      // Verwende letzte bekannte Preise als Fallback
      if (lastKnownPrices.dfaithEur) {
        setDfaithPriceEur(lastKnownPrices.dfaithEur);
      }
      if (lastKnownPrices.ethEur) {
        setPolPriceEur(lastKnownPrices.ethEur);
      }
      // EUR-Wert neu berechnen mit Fallback-Preisen
      if (dfaithBalance) {
        const newEurValue = calculateEurValue(dfaithBalance);
        setDfaithEurValue(newEurValue);
      }
    }
  };

  const copyWalletAddress = async () => {
    if (account?.address) {
      try {
        await navigator.clipboard.writeText(account.address);
        setCopySuccess(true);
        setShowCopyModal(true);
        
        // Modal nach 2 Sekunden automatisch schließen
        setTimeout(() => {
          setShowCopyModal(false);
          setCopySuccess(false);
        }, 2000);
      } catch (error) {
        console.error("Fehler beim Kopieren:", error);
        setCopySuccess(false);
        setShowCopyModal(true);
        
        setTimeout(() => {
          setShowCopyModal(false);
        }, 2000);
      }
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  // Zentrale Funktion zur EUR-Wert-Berechnung (wie BuyTab/SellTab)
  const calculateEurValue = useCallback((balance: string): string => {
    const balanceFloat = parseFloat(balance);
    if (balanceFloat <= 0) return "0.00";

    // Verwende den direkt berechneten D.FAITH EUR-Preis
    if (dfaithPriceEur && dfaithPriceEur > 0) {
      const eurValue = balanceFloat * dfaithPriceEur;
      console.log('EUR-Wert berechnet (WalletTab - direkt):', {
        balance,
        dfaithPriceEur,
        eurValue: eurValue.toFixed(2)
      });
      return eurValue.toFixed(2);
    }

    // Fallback: Berechnung über gespeicherte Werte wie in SellTab
    let ethPerDfaith = 0; // Wie viel ETH für 1 D.FAITH
    let ethEur = 0;

    // 1. Aktuelle Werte aus lastKnownPrices
    if (lastKnownPrices && lastKnownPrices.dfaith && lastKnownPrices.ethEur) {
      ethPerDfaith = lastKnownPrices.dfaith; // Jetzt ETH pro D.FAITH
      ethEur = lastKnownPrices.ethEur;
    }
    // 2. Fallback: localStorage
    else {
      try {
        const stored = localStorage.getItem('dawid_faith_prices');
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();
          if (parsed.dfaith && parsed.ethEur && parsed.timestamp && (now - parsed.timestamp) < 24 * 60 * 60 * 1000) {
            ethPerDfaith = parsed.dfaith; // Jetzt ETH pro D.FAITH
            ethEur = parsed.ethEur;
          }
        }
      } catch (e) {
        console.log('Fehler beim Lesen des localStorage in calculateEurValue:', e);
      }
    }

    // Berechne EUR-Wert wie in SellTab
    if (ethPerDfaith > 0 && ethEur > 0) {
      // 1 D.FAITH = ethPerDfaith * ethEur
      const dfaithEur = ethPerDfaith * ethEur;
      const eurValue = balanceFloat * dfaithEur;
      console.log('EUR-Wert berechnet (WalletTab - Fallback):', {
        balance,
        ethPerDfaith,
        ethEur,
        dfaithEur,
        eurValue: eurValue.toFixed(2)
      });
      return eurValue.toFixed(2);
    }

    return "0.00";
  }, [dfaithPriceEur, lastKnownPrices]);

  // Lade gespeicherte Preise beim Start
  useEffect(() => {
    const loadStoredPrices = () => {
      try {
        const stored = localStorage.getItem('dawid_faith_prices');
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();
          // Verwende gespeicherte Preise wenn sie weniger als 6 Stunden alt sind
          if (parsed.timestamp && (now - parsed.timestamp) < 6 * 60 * 60 * 1000) {
            console.log('Lade gespeicherte Preise beim Start:', parsed);
            setLastKnownPrices(parsed);
            if (parsed.dfaithEur && parsed.dfaithEur > 0) {
              setDfaithPriceEur(parsed.dfaithEur);
            }
            if (parsed.ethEur && parsed.ethEur > 0) {
              setPolPriceEur(parsed.ethEur);
            }
            setPricesLoaded(true);
          }
        }
      } catch (e) {
        console.log('Fehler beim Laden gespeicherter Preise beim Start:', e);
      } finally {
        setPricesLoaded(true);
      }
    };

    loadStoredPrices();
  }, []);

  // EUR-Wert neu berechnen wenn sich Balance, Preise oder lastKnownPrices ändern
  useEffect(() => {
    if (dfaithBalance && pricesLoaded) {
      const newEurValue = calculateEurValue(dfaithBalance);
      setDfaithEurValue(newEurValue);
    } else if (!dfaithBalance) {
      setDfaithEurValue("0.00");
    }
  }, [dfaithPriceEur, dfaithBalance, lastKnownPrices.dfaithEur, pricesLoaded, calculateEurValue]);

  // Entferne fetchTokenBalanceViaContract komplett (nicht mehr benötigt)

  if (status !== "connected" || !account?.address) {
    return (
      <div className="flex flex-col items-center min-h-[70vh] justify-center bg-black py-8 relative overflow-hidden">
        {/* Musikalische Hintergrund-Animationen */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Animierte Schallwellen */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-amber-500/8 via-yellow-500/4 to-orange-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '2s' }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-purple-500/8 via-pink-500/4 to-amber-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-blue-500/4 via-purple-500/4 to-amber-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s', animationDuration: '2.5s' }}></div>
          
          {/* Schwebende Musiknoten */}
          <div className="absolute top-1/4 left-1/4 text-amber-400/30 text-lg animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3s' }}>♪</div>
          <div className="absolute top-3/4 right-1/4 text-yellow-400/40 text-sm animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '2.5s' }}>♫</div>
          <div className="absolute bottom-1/4 left-1/3 text-amber-300/35 text-base animate-bounce" style={{ animationDelay: '2.5s', animationDuration: '3.5s' }}>♬</div>
          <div className="absolute top-1/3 right-1/3 text-orange-400/25 text-xs animate-bounce" style={{ animationDelay: '3s', animationDuration: '2s' }}>♩</div>
        </div>

        <Card className="w-full max-w-md bg-gradient-to-br from-zinc-900/95 to-black/95 rounded-3xl shadow-2xl border border-zinc-700/50 relative overflow-hidden backdrop-blur-xl">
          {/* Musikalische Glanzeffekte */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-zinc-800/15 via-zinc-700/8 to-zinc-900/15 rounded-t-3xl"></div>
          <div className="absolute bottom-0 right-0 w-2/3 h-1/3 bg-gradient-to-tl from-zinc-800/8 via-zinc-700/4 to-transparent rounded-br-3xl"></div>
          
          {/* Equalizer-Balken als Dekoration */}
          <div className="absolute top-4 right-4 flex gap-1">
            <div className="w-1 bg-amber-400/20 rounded-full animate-pulse" style={{ height: '12px', animationDelay: '0s', animationDuration: '1.2s' }}></div>
            <div className="w-1 bg-amber-400/25 rounded-full animate-pulse" style={{ height: '20px', animationDelay: '0.2s', animationDuration: '1.5s' }}></div>
            <div className="w-1 bg-amber-400/30 rounded-full animate-pulse" style={{ height: '16px', animationDelay: '0.4s', animationDuration: '1.1s' }}></div>
            <div className="w-1 bg-amber-400/20 rounded-full animate-pulse" style={{ height: '24px', animationDelay: '0.6s', animationDuration: '1.8s' }}></div>
            <div className="w-1 bg-amber-400/25 rounded-full animate-pulse" style={{ height: '14px', animationDelay: '0.8s', animationDuration: '1.3s' }}></div>
          </div>
          
          <CardContent className="p-8 md:p-10 relative z-10">
            {/* Logo mit musikalischen Effekten */}
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="relative group">
                {/* Schallwellen um das Logo */}
                <div className="absolute inset-0 w-40 h-40">
                  <div className="absolute inset-0 border-2 border-amber-400/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="absolute inset-2 border border-amber-400/15 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
                  <div className="absolute inset-4 border border-amber-400/20 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '1s' }}></div>
                </div>
                
                {/* Hauptbild */}
                <div className="relative w-40 h-40 transform group-hover:scale-105 transition-transform duration-500 z-10">
                  <img 
                    src="/Dawid Faith Wallet.png" 
                    alt="Dawid Faith Wallet" 
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {/* Rotierende Musiknoten um das Logo */}
                <div className="absolute inset-0 w-40 h-40 animate-spin" style={{ animationDuration: '20s' }}>
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-amber-400/40 text-lg">♪</div>
                  <div className="absolute top-1/2 -right-4 transform -translate-y-1/2 text-yellow-400/40 text-sm">♫</div>
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-amber-300/40 text-base">♬</div>
                  <div className="absolute top-1/2 -left-4 transform -translate-y-1/2 text-orange-400/40 text-xs">♩</div>
                </div>
                
                {/* Subtiler Ambient Glow */}
                <div className="absolute inset-0 w-40 h-40 bg-gradient-to-r from-zinc-800/5 via-zinc-700/8 to-zinc-800/5 blur-3xl animate-pulse"></div>
              </div>
              
              {/* Willkommens-Text mit musikalischem Flair */}
              <div className="mt-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent mb-2 animate-pulse">
                  <TranslatedText text="Willkommen ♪" language={language} />
                </h1>
                <div className="w-20 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto rounded-full animate-pulse"></div>
                
                {/* Kleine Equalizer-Animation unter dem Titel */}
                <div className="flex justify-center gap-1 mt-3">
                  <div className="w-0.5 bg-amber-400/30 rounded-full animate-pulse" style={{ height: '6px', animationDelay: '0s', animationDuration: '0.8s' }}></div>
                  <div className="w-0.5 bg-amber-400/40 rounded-full animate-pulse" style={{ height: '10px', animationDelay: '0.1s', animationDuration: '1.2s' }}></div>
                  <div className="w-0.5 bg-amber-400/35 rounded-full animate-pulse" style={{ height: '8px', animationDelay: '0.2s', animationDuration: '0.9s' }}></div>
                  <div className="w-0.5 bg-amber-400/30 rounded-full animate-pulse" style={{ height: '12px', animationDelay: '0.3s', animationDuration: '1.5s' }}></div>
                  <div className="w-0.5 bg-amber-400/40 rounded-full animate-pulse" style={{ height: '7px', animationDelay: '0.4s', animationDuration: '1.1s' }}></div>
                </div>
              </div>
            </div>
            
            {/* Beschreibung mit musikalischem Bezug */}
            <div className="text-center mb-8">
              <p className="text-zinc-300 text-lg mb-2">
                <TranslatedText text="Verbinde dich mit deiner Wallet" language={language} />
              </p>
              <p className="text-zinc-500 text-sm">
                <TranslatedText text="und erlebe das D.FAITH Musik-Ökosystem ♫" language={language} />
              </p>
            </div>
            
            {/* Connect Button */}
            <div className="flex justify-center w-full mb-8">
              <ConnectButton
                client={client}
                connectButton={{ 
                  label: language === 'de' ? "🎵 Wallet verbinden" : language === 'en' ? "🎵 Connect Wallet" : "🎵 Połącz portfel",
                  className: "w-full py-4 px-6 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold rounded-xl hover:from-amber-500 hover:to-yellow-600 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/25 text-lg z-50 relative"
                }}
                connectModal={{
                  size: "compact",
                  title: language === 'de' ? "Wallet verbinden" : language === 'en' ? "Connect Wallet" : "Połącz portfel", 
                  welcomeScreen: {
                    title: "Dawid Faith Wallet",
                    subtitle: language === 'de' ? "Wähle deine bevorzugte Anmeldemethode" : language === 'en' ? "Choose your preferred login method" : "Wybierz preferowaną metodę logowania"
                  },
                }}
                wallets={wallets}
                chain={{
                  id: 8453,
                  rpc: "https://mainnet.base.org",
                }}
              />
            </div>
            
            {/* Musikalische Stats/Info Bereich */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-zinc-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm"><TranslatedText text="Base Network" language={language} /></span>
                <span className="text-xs">♪</span>
              </div>
              
              <div className="pt-4 border-t border-zinc-800/50">
                <p className="text-xs text-zinc-600">
                  <TranslatedText text="🎤 Powered by Dawid Faith ♫" language={language} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // D.INVEST und Staking-Bereich Funktion definieren
  const renderDinvestSection = () => {
    const hasRewards = parseFloat(availableRewards) > 0;
    const hasStaked = parseFloat(stakedBalance) > 0;
    
    return (
      <div className="flex flex-col items-center p-4 bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl border border-zinc-700 w-full">
        <div className="uppercase text-xs tracking-widest text-amber-500/80 mb-2">D.INVEST</div>
        
        {/* D.INVEST Balance normal anzeigen */}
        <div className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 mb-2 flex items-center">
          {dinvestBalance || "0"}
          {(isLoadingBalances || isRefreshing) && (
            <span className="ml-2 text-xs text-amber-500/60 animate-pulse">↻</span>
          )}
        </div>
        
        {/* Kompakter Staking Button mit integrierter Rewards-Anzeige */}
        <div className="w-full space-y-2">
          <button 
            onClick={() => setShowStakeModal(true)}
            className={`relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-amber-400 hover:from-amber-500/30 hover:to-amber-600/30 transition-all border w-full ${
              hasRewards 
                ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/30 border-amber-500/40' 
                : 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-amber-500/20'
            }`}
          >
            <FaLock size={14} />
            <span className="text-sm font-medium"><TranslatedText text="Staken & Verdienen" language={language} /></span>
          </button>
          
          {/* Kompakte Status-Zeile */}
          <div className="flex items-center justify-between text-xs">
            {/* Gestaked Status */}
            <div className="flex items-center gap-1.5">
              {hasStaked ? (
                <>
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium">{stakedBalance} <TranslatedText text="gestaked" language={language} /></span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full"></div>
                  <span className="text-zinc-500"><TranslatedText text="Nichts gestaked" language={language} /></span>
                </>
              )}
            </div>
            
            {/* Rewards Status - nur wenn vorhanden */}
            {hasRewards && (
              <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">{availableRewards} D.FAITH</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex justify-center min-h-[70vh] items-center py-8 bg-black">
        <Card className="w-full max-w-xl bg-gradient-to-br from-zinc-900 to-black rounded-3xl shadow-2xl border border-zinc-700 relative overflow-hidden">
          {/* Verbesserte Glanzeffekte */}
          <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5 rounded-t-3xl"></div>
          <div className="absolute top-0 right-0 w-1/3 h-20 bg-amber-400/10 blur-3xl rounded-full"></div>
          
          <CardContent className="p-6 md:p-10 relative z-10">
            {/* Header mit verbessertem Gold-Akzent und Bild */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center">
                  <img 
                    src="/Dawid Faith Wallet.png" 
                    alt="Dawid Faith Wallet" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-base md:text-lg font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  Dawid Faith Wallet
                </span>
              </div>
              <ConnectButton
                client={client}
                connectButton={{ 
                  label: "", 
                  className: "bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
                }}
                connectModal={{ size: "compact" }}
                wallets={wallets}
                chain={{
                  id: 8453,
                  // Base Chain RPC-Endpunkt
                  rpc: "https://mainnet.base.org",
                }}
              />
            </div>

            {/* Wallet Address mit besserem Styling und Refresh Button */}
            <div className="flex justify-between items-center bg-zinc-800/70 backdrop-blur-sm rounded-xl p-3 mb-6 border border-zinc-700/80">
              <div className="flex flex-col">
                <span className="text-xs text-amber-300 mb-0.5"><TranslatedText text="Wallet Adresse" language={language} /></span>
                <button
                  onClick={copyWalletAddress}
                  className="font-mono text-amber-400 text-sm hover:text-amber-300 transition-colors text-left group flex items-center gap-2"
                  title={language === 'de' ? "Adresse kopieren" : language === 'en' ? "Copy address" : "Kopiuj adres"}
                >
                  <span>{formatAddress(account.address)}</span>
                  <FaRegCopy className="text-xs opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshBalances}
                  disabled={isRefreshing || isLoadingBalances}
                  className={`p-2 rounded-lg ${isRefreshing || isLoadingBalances ? 'bg-amber-600/20' : 'bg-zinc-700 hover:bg-zinc-600'} text-zinc-200 text-sm font-medium transition-all duration-200`}
                  title={language === 'de' ? "Aktualisieren" : language === 'en' ? "Refresh" : "Odśwież"}
                >
                  <FaSync className={`text-amber-400 ${isRefreshing || isLoadingBalances ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={copyWalletAddress}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-400 text-sm font-medium transition-all duration-200 border border-amber-500/30"
                  title={language === 'de' ? "Adresse kopieren" : language === 'en' ? "Copy address" : "Kopiuj adres"}
                >
                  <FaRegCopy /> <TranslatedText text="Kopieren" language={language} />
                </button>
              </div>
            </div>

            {/* DFAITH Token-Karte - jetzt mit D.FAITH */}
            <div className="flex flex-col items-center p-4 bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 rounded-xl border border-zinc-700 w-full mb-6">
              <span className="uppercase text-xs tracking-widest text-amber-500/80 mb-2">D.FAITH</span>
              <div className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-sm">
                {dfaithBalance ? dfaithBalance : "0.00"}
                {(isLoadingBalances || isRefreshing) && (
                  <span className="ml-2 text-xs text-amber-500/60 animate-pulse">↻</span>
                )}
              </div>
              {/* EUR-Wert anzeigen, wenn sowohl Balance als auch ein EUR-Wert vorhanden sind */}
              {dfaithBalance && 
               parseFloat(dfaithBalance) > 0 && 
               parseFloat(dfaithEurValue) > 0 && (
                <div className="text-xs text-zinc-500 mt-2">
                  ≈ {dfaithEurValue} EUR
                </div>
              )}
              
              {/* Preisanzeige mit 24h Änderung */}
              {dfaithPriceEur > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-zinc-400">
                    €{dfaithPriceEur.toFixed(4)} <TranslatedText text="pro D.FAITH" language={language} />
                  </span>
                  {priceChange24h !== null && (
                    <span className={`text-xs font-medium flex items-center gap-1 ${
                      priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {priceChange24h >= 0 ? '↗' : '↘'}
                      {Math.abs(priceChange24h).toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-2 md:gap-3 mb-6">
              <Button
                className="flex flex-col items-center justify-center gap-1 px-1 py-3 md:py-4 bg-gradient-to-br from-zinc-800/90 to-zinc-900 hover:from-zinc-800 hover:to-zinc-800 shadow-lg shadow-black/20 rounded-xl hover:scale-[1.02] transition-all duration-300 border border-zinc-700/80"
                onClick={() => setShowBuyModal(true)}
              >
                <div className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full mb-1 shadow-inner">
                  <FaArrowDown className="text-black text-xs" />
                </div>
                <span className="text-xs bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent font-medium"><TranslatedText text="Kaufen" language={language} /></span>
              </Button>
              <Button
                className="flex flex-col items-center justify-center gap-1 px-1 py-3 md:py-4 bg-gradient-to-br from-zinc-800/90 to-zinc-900 hover:from-zinc-800 hover:to-zinc-800 shadow-lg shadow-black/20 rounded-xl hover:scale-[1.02] transition-all duration-300 border border-zinc-700/80"
                onClick={() => setShowSellModal(true)}
              >
                <div className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full mb-1 shadow-inner">
                  <FaArrowUp className="text-black text-xs" />
                </div>
                <span className="text-xs bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent font-medium"><TranslatedText text="Verkauf" language={language} /></span>
              </Button>
              <Button
                className="flex flex-col items-center justify-center gap-1 px-1 py-3 md:py-4 bg-gradient-to-br from-zinc-800/90 to-zinc-900 hover:from-zinc-800 hover:to-zinc-800 shadow-lg shadow-black/20 rounded-xl hover:scale-[1.02] transition-all duration-300 border border-zinc-700/80"
                onClick={() => setShowSendModal(true)}
              >
                <div className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full mb-1 shadow-inner">
                  <FaPaperPlane className="text-black text-xs" />
                </div>
                <span className="text-xs bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent font-medium"><TranslatedText text="Senden" language={language} /></span>
              </Button>
              <Button
                className="flex flex-col items-center justify-center gap-1 px-1 py-3 md:py-4 bg-gradient-to-br from-zinc-800/90 to-zinc-900 hover:from-zinc-800 hover:to-zinc-800 shadow-lg shadow-black/20 rounded-xl hover:scale-[1.02] transition-all duration-300 border border-zinc-700/80"
                onClick={() => setShowHistoryModal(true)}
              >
                <div className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full mb-1 shadow-inner">
                  <FaHistory className="text-black text-xs" />
                </div>
                <span className="text-xs bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent font-medium"><TranslatedText text="Historie" language={language} /></span>
              </Button>
            </div>
            
            {/* D.INVEST immer anzeigen */}
            {renderDinvestSection()}

            {/* Modale für die verschiedenen Funktionen */}
            <Modal open={showBuyModal} onClose={() => setShowBuyModal(false)} title={language === 'de' ? 'Kaufen' : language === 'en' ? 'Buy' : 'Kupować'}>
              <BuyTab language={language} />
            </Modal>

            <Modal open={showSellModal} onClose={() => setShowSellModal(false)} title={language === 'de' ? 'Verkaufen' : language === 'en' ? 'Sell' : 'Sprzedawać'}>
              <SellTab language={language} />
            </Modal>

            <Modal open={showSendModal} onClose={() => setShowSendModal(false)} title={language === 'de' ? 'Senden' : language === 'en' ? 'Send' : 'Wysłać'}>
              <SendTab language={language} />
            </Modal>

            <Modal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} title={language === 'de' ? 'Transaktionshistorie' : language === 'en' ? 'Transaction History' : 'Historia transakcji'}>
              <HistoryTab language={language} />
            </Modal>

            {/* Staking Modal mit verbesserter Integration */}
            <Modal open={showStakeModal} onClose={() => setShowStakeModal(false)} title={language === 'de' ? 'Staking' : language === 'en' ? 'Staking' : 'Staking'}>
              <div className="min-h-[400px]">
                <StakeTab 
                  language={language}
                  onStakeChanged={() => {
                  console.log("🔄 Staking-Änderung erkannt, aktualisiere Balances...");
                  fetchStakedBalance();
                  // Die Token-Balances aktualisieren sich automatisch durch thirdweb Hooks
                  fetchAvailableRewards(); // Auch Rewards nach Staking-Änderung aktualisieren
                }} />
              </div>
            </Modal>

            {/* Copy Success Modal */}
            <Modal open={showCopyModal} onClose={() => setShowCopyModal(false)} title={copySuccess ? (language === 'de' ? "Erfolgreich kopiert!" : language === 'en' ? "Successfully copied!" : "Pomyślnie skopiowano!") : (language === 'de' ? "Fehler beim Kopieren" : language === 'en' ? "Copy failed" : "Błąd kopiowania")}>
              <div className="text-center py-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  copySuccess 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {copySuccess ? (
                    <span className="text-2xl">✓</span>
                  ) : (
                    <span className="text-2xl">✗</span>
                  )}
                </div>
                <p className={`text-lg font-medium mb-2 ${
                  copySuccess ? 'text-green-400' : 'text-red-400'
                }`}>
                  <TranslatedText text={copySuccess ? 'Wallet-Adresse kopiert!' : 'Kopieren fehlgeschlagen'} language={language} />
                </p>
                <p className="text-zinc-400 text-sm mb-4">
                  <TranslatedText text={copySuccess 
                    ? 'Die Adresse befindet sich jetzt in deiner Zwischenablage.' 
                    : 'Bitte versuche es erneut oder kopiere die Adresse manuell.'
                  } language={language} />
                </p>
                {copySuccess && (
                  <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                    <p className="text-xs text-zinc-500 mb-1"><TranslatedText text="Kopierte Adresse:" language={language} /></p>
                    <p className="text-amber-400 font-mono text-sm break-all">
                      {account?.address}
                    </p>
                  </div>
                )}
              </div>
            </Modal>
          </CardContent>
        </Card>
      </div>
    );
  }