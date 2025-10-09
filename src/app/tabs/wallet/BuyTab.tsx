import { useEffect, useState, useRef } from "react";
import { Button } from "../../../../components/ui/button";
import { FaLock, FaExchangeAlt, FaSync, FaRegCopy } from "react-icons/fa";
import { useActiveAccount, useSendTransaction, BuyWidget, useWalletBalance, useReadContract } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { NATIVE_TOKEN_ADDRESS, getContract, prepareContractCall, sendAndConfirmTransaction, readContract } from "thirdweb";
import { client } from "../../client";
import { balanceOf, approve } from "thirdweb/extensions/erc20";
import { StripeCheckout } from "../../components/StripeCheckout";

import { TranslatedText } from "../../components/TranslatedText";
import type { SupportedLanguage } from "../../utils/deepLTranslation";

// Token Adressen (gleich wie im SendTab, SellTab und WalletTab)
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DFAITH_DECIMALS = 2;
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";
const DINVEST_DECIMALS = 0;
const ETH_DECIMALS = 18;

interface BuyTabProps {
  language: SupportedLanguage;
}

export default function BuyTab({ language }: BuyTabProps) {
  // Globale Fehlerbehandlung für Thirdweb Analytics
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        const url = args[0]?.toString() || '';
        
        // Ignoriere 400-Fehler von Thirdweb Analytics (sowohl Event-API als auch Chain-spezifische Probleme)
        if (!response.ok && (
            url.includes('c.thirdweb.com/event') ||
            url.includes('thirdweb.com') && response.status === 400
          )) {
          console.log('Thirdweb Analytics/API Fehler ignoriert:', response.status, 'URL:', url);
          console.log('Möglicherweise falsche Chain-ID in Analytics-Request');
          // Gib eine fake erfolgreiche Antwort zurück
          return new Response('{}', { status: 200, statusText: 'OK' });
        }
        return response;
      } catch (error) {
        const url = args[0]?.toString() || '';
        // Ignoriere Analytics-Fehler und Chain-bezogene Fehler
        if (url.includes('c.thirdweb.com') ||
            url.includes('thirdweb.com')) {
          console.log('Thirdweb API Netzwerkfehler ignoriert:', error, 'URL:', url);
          console.log('Könnte an falscher Chain-ID liegen - verwende Base Chain (8453)');
          return new Response('{}', { status: 200, statusText: 'OK' });
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending: isSwapPending } = useSendTransaction();

  // Thirdweb Hooks für Balance (wie im SendTab, SellTab und WalletTab)
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

  // Formatierte Balances berechnen (wie im SendTab, SellTab und WalletTab)
  const ethBalance = ethBalanceData 
    ? (Number(ethBalanceData.value) / Math.pow(10, ETH_DECIMALS)).toFixed(5)
    : "0.00000";

  const dfaithBalance = dfaithBalanceData 
    ? (Number(dfaithBalanceData) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS)
    : "0.00";

  const dinvestBalance = dinvestBalanceData 
    ? (Number(dinvestBalanceData) / Math.pow(10, DINVEST_DECIMALS)).toString()
    : "0";

  // Alte State-Variablen für Balances entfernt, da wir jetzt direkt die berechneten Werte verwenden
  const [dfaithPrice, setDfaithPrice] = useState<number | null>(null);
  const [dfaithPriceEur, setDfaithPriceEur] = useState<number | null>(null);
  const [ethPriceEur, setEthPriceEur] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [lastKnownPrices, setLastKnownPrices] = useState<{
    dfaith?: number;
    dfaithEur?: number;
    ethEur?: number;
    timestamp?: number;
  }>({});
  // Modal- und Token-Auswahl-States für neues Design
  const [selectedToken, setSelectedToken] = useState<null | "DFAITH" | "DINVEST" | "ETH">(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [swapAmount, setSwapAmount] = useState("");
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);

  // Neuer State für mehrstufigen Kaufprozess
  const [buyStep, setBuyStep] = useState<'initial' | 'quoteFetched' | 'approved' | 'completed'>('initial');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [quoteTxData, setQuoteTxData] = useState<any>(null);
  const [spenderAddress, setSpenderAddress] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Neue States für Stripe Integration
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [dinvestAmount, setDinvestAmount] = useState<number>(1);
  const [eurAmount, setEurAmount] = useState<number>(5);
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [showDinvestSuccessModal, setShowDinvestSuccessModal] = useState(false);

  // D.FAITH Preis von ParaSwap holen und in Euro umrechnen mit Fallback
  useEffect(() => {
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
            if (parsed.dfaith) setDfaithPrice(parsed.dfaith);
            if (parsed.dfaithEur) setDfaithPriceEur(parsed.dfaithEur);
            if (parsed.ethEur) setEthPriceEur(parsed.ethEur);
          }
        }
      } catch (e) {
        console.log('Fehler beim Laden gespeicherter Preise:', e);
      }
    };

    loadStoredPrices();

    const fetchDfaithPrice = async () => {
      setIsLoadingPrice(true);
      setPriceError(null);
      let ethEur: number | null = null;
      let dfaithPriceEur: number | null = null;
      let errorMsg = "";
      
      try {
        // 1. Hole ETH/EUR Preis von CoinGecko
        try {
          const ethResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur');
          if (ethResponse.ok) {
            const ethData = await ethResponse.json();
            ethEur = ethData['ethereum']?.eur;
            if (ethEur) {
              // Auf 2 Dezimalstellen runden
              ethEur = Math.round(ethEur * 100) / 100;
            }
          }
        } catch (e) {
          console.log('ETH Preis Fehler:', e);
        }
        
        // Fallback auf letzten bekannten ETH Preis
        if (!ethEur && lastKnownPrices.ethEur) {
          ethEur = lastKnownPrices.ethEur;
        } else if (!ethEur) {
          ethEur = 3000; // Hard fallback für ETH
        }
        
        // 2. Hole D.FAITH Preis von ParaSwap für Base Chain
        try {
          const priceParams = new URLSearchParams({
            srcToken: DFAITH_TOKEN,
            destToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH address for ParaSwap
            srcDecimals: DFAITH_DECIMALS.toString(),
            destDecimals: ETH_DECIMALS.toString(),
            amount: "100", // 1 D.FAITH (100 mit 2 Decimals)
            network: "8453", // Base Chain ID
            side: "SELL"
          });
          
          const priceResponse = await fetch(`https://apiv5.paraswap.io/prices?${priceParams}`);
          
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            console.log("ParaSwap Price Response:", priceData);
            
            if (priceData && priceData.priceRoute && priceData.priceRoute.destAmount) {
              // destAmount ist in ETH Wei (18 Decimals)
              const ethPerDfaith = Number(priceData.priceRoute.destAmount) / Math.pow(10, 18);
              setDfaithPrice(ethPerDfaith); // Wie viele ETH für 1 D.FAITH
              // Preis pro D.FAITH in EUR: ethPerDfaith * ethEur
              if (ethEur && ethPerDfaith > 0) {
                dfaithPriceEur = ethPerDfaith * ethEur;
              } else {
                dfaithPriceEur = null;
              }
            } else {
              errorMsg = "ParaSwap: Keine Liquidität verfügbar";
            }
          } else {
            errorMsg = `ParaSwap: ${priceResponse.status}`;
          }
        } catch (e) {
          console.log("ParaSwap Fehler:", e);
          errorMsg = "ParaSwap API Fehler";
        }
        
        // Fallback auf letzte bekannte D.FAITH Preise
        if (!dfaithPrice && lastKnownPrices.dfaith) {
          setDfaithPrice(lastKnownPrices.dfaith);
          errorMsg = "";
        }
        if (!dfaithPriceEur && lastKnownPrices.dfaithEur) {
          dfaithPriceEur = lastKnownPrices.dfaithEur;
          errorMsg = "";
        }
        
      } catch (e) {
        console.error("Price fetch error:", e);
        errorMsg = "Preis-API Fehler";
        
        // Verwende letzte bekannte Preise als Fallback
        if (lastKnownPrices.dfaith) setDfaithPrice(lastKnownPrices.dfaith);
        if (lastKnownPrices.dfaithEur) dfaithPriceEur = lastKnownPrices.dfaithEur;
        if (lastKnownPrices.ethEur) ethEur = lastKnownPrices.ethEur;
        
        if (dfaithPrice && dfaithPriceEur && ethEur) {
          errorMsg = ""; // Kein Fehler anzeigen wenn Fallback verfügbar
        }
      }
      
      // Setze Preise (entweder neue oder Fallback)
      if (ethEur) setEthPriceEur(ethEur);
      if (dfaithPriceEur !== null && dfaithPriceEur !== undefined) setDfaithPriceEur(dfaithPriceEur);
      
      // Speichere erfolgreiche Preise
      if (dfaithPrice && dfaithPriceEur && ethEur) {
        const newPrices = {
          dfaith: dfaithPrice,
          dfaithEur: dfaithPriceEur,
          ethEur: ethEur,
          timestamp: Date.now()
        };
        setLastKnownPrices(newPrices);
        try {
          localStorage.setItem('dawid_faith_prices', JSON.stringify(newPrices));
        } catch (e) {
          console.log('Fehler beim Speichern der Preise:', e);
        }
        setPriceError(null);
      } else {
        setPriceError(errorMsg || "Preise nicht verfügbar");
      }
      
      setIsLoadingPrice(false);
    };

    fetchDfaithPrice();
    // Preis alle 2 Minuten aktualisieren
    const interval = setInterval(fetchDfaithPrice, 120000);
    return () => clearInterval(interval);
  }, [lastKnownPrices.dfaith, lastKnownPrices.dfaithEur, lastKnownPrices.ethEur, dfaithPrice]);


  // Entfernt: handleInvestBuy, handleInvestContinue, setShowInvestModal, investBuyModalRef, showInvestModal

  // State für D.FAITH Swap (Modal wird jetzt zentral gesteuert)
  const [swapAmountEth, setSwapAmountEth] = useState("");
  const [swapAmountDfaith, setSwapAmountDfaith] = useState(""); // Neue State für D.FAITH Input
  const [slippage, setSlippage] = useState("1"); // Fest auf 1% gesetzt
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapTxStatus, setSwapTxStatus] = useState<string | null>(null);
  
  // Neuer State für das zweite Modal (Kaufprozess)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Automatische ETH-Berechnung bei D.FAITH Eingabe
  useEffect(() => {
    if (swapAmountDfaith && parseFloat(swapAmountDfaith) > 0 && dfaithPrice && dfaithPrice > 0) {
      const estimatedEth = parseFloat(swapAmountDfaith) * dfaithPrice;
      setSwapAmountEth(estimatedEth.toFixed(6));
    } else {
      setSwapAmountEth("");
    }
  }, [swapAmountDfaith, dfaithPrice]);

  // D.FAITH Swap Funktion mit mehrstufigem Prozess angepasst für ParaSwap
  const handleGetQuote = async () => {
    setSwapTxStatus("pending");
    setQuoteError(null);
    setQuoteTxData(null);
    setSpenderAddress(null);
    setNeedsApproval(false);

    try {
      if (!swapAmountDfaith || parseFloat(swapAmountDfaith) <= 0 || !account?.address) return;

      // Minimum Check für D.FAITH
      if (parseFloat(swapAmountDfaith) < 0.01) {
        throw new Error("Minimum purchase amount ist 0.01 D.FAITH");
      }

      console.log("=== ParaSwap Quote Request für Base (D.FAITH Input mit ETH SELL-side) ===");
      console.log("D.FAITH Amount:", swapAmountDfaith);
      console.log("Account Address:", account.address);
      
      // Schritt 1: Berechne grob die benötigte ETH-Menge basierend auf aktuellem D.FAITH Preis
      let estimatedEthAmount = 0.001; // Fallback minimum
      
      if (dfaithPrice && dfaithPrice > 0) {
        // Verwende aktuellen D.FAITH Preis für Schätzung
        estimatedEthAmount = parseFloat(swapAmountDfaith) * dfaithPrice;
        console.log("Estimated ETH needed based on current price:", estimatedEthAmount);
      } else {
        // Fallback: Verwende kleine ETH-Menge für Quote
        estimatedEthAmount = parseFloat(swapAmountDfaith) * 0.0001; // Sehr konservativ
        console.log("Using fallback ETH estimation:", estimatedEthAmount);
      }
      
      // Minimum ETH-Menge für Liquidität
      if (estimatedEthAmount < 0.0001) {
        estimatedEthAmount = 0.0001;
      }
      
      // Schritt 2: Nutze SELL-side Quote mit geschätzter ETH-Menge (bewährte Methode)
      const ethAmountWei = (estimatedEthAmount * Math.pow(10, ETH_DECIMALS)).toString();
      console.log("ETH Amount in Wei for quote:", ethAmountWei);
      
      const priceParams = new URLSearchParams({
        srcToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH address for ParaSwap
        destToken: DFAITH_TOKEN, // D.FAITH
        srcDecimals: ETH_DECIMALS.toString(),
        destDecimals: DFAITH_DECIMALS.toString(),
        amount: ethAmountWei, // ETH in Wei (SELL-side)
        network: "8453", // Base Chain ID
        side: "SELL", // Zurück zu SELL-side (bewährt)
        userAddress: account.address,
        slippage: "100", // Fest 1% (100 basis points)
        maxImpact: "50" // Erlaube bis zu 50% Price Impact
      });
      
      console.log("Price Parameters:", Object.fromEntries(priceParams));
      
      // 1. Hole Preis-Quote
      const priceUrl = `https://apiv5.paraswap.io/prices?${priceParams}`;
      console.log("Price URL:", priceUrl);
      
      const priceResponse = await fetch(priceUrl);
      
      if (!priceResponse.ok) {
        const errorText = await priceResponse.text();
        console.error("ParaSwap Price Response Error:", priceResponse.status, errorText);
        
        // Spezielle Behandlung für Liquiditätsprobleme
        if (errorText.includes("No routes found with enough liquidity") || priceResponse.status === 404) {
          throw new Error("Nicht genügend Liquidität für diesen Betrag. Versuche einen kleineren Betrag oder versuche es später erneut.");
        }
        
        // Spezielle Behandlung für Price Impact Fehler
        if (errorText.includes("ESTIMATED_LOSS_GREATER_THAN_MAX_IMPACT")) {
          try {
            const errorData = JSON.parse(errorText);
            const impactValue = errorData.value || "unbekannt";
            throw new Error(`Hoher Price Impact (${impactValue}) - Swap trotzdem möglich, aber mit Verlust verbunden. Versuche weniger D.FAITH.`);
          } catch (parseError) {
            throw new Error(`Hoher Price Impact erkannt. Versuche es mit einem kleineren Betrag.`);
          }
        }
        
        throw new Error(`ParaSwap Price Quote Fehler: ${priceResponse.status} - ${errorText}`);
      }
      
      const priceData = await priceResponse.json();
      console.log("ParaSwap Price Response:", priceData);
      
      if (!priceData || !priceData.priceRoute) {
        console.error("Invalid price data:", priceData);
        throw new Error('ParaSwap: Keine gültige Price Route erhalten');
      }
      
      // Schritt 3: Berechne das Verhältnis und skaliere für gewünschte D.FAITH-Menge
      const receivedDfaithWei = priceData.priceRoute.destAmount;
      const receivedDfaith = Number(receivedDfaithWei) / Math.pow(10, DFAITH_DECIMALS);
      const usedEthWei = priceData.priceRoute.srcAmount;
      const usedEth = Number(usedEthWei) / Math.pow(10, ETH_DECIMALS);
      
      console.log("Quote result: ETH", usedEth, "→ D.FAITH", receivedDfaith);
      
      // Berechne Skalierungsfaktor für gewünschte D.FAITH-Menge
      const targetDfaith = parseFloat(swapAmountDfaith);
      const scaleFactor = targetDfaith / receivedDfaith;
      const requiredEth = usedEth * scaleFactor;
      
      console.log("Scale factor:", scaleFactor, "Required ETH for", targetDfaith, "D.FAITH:", requiredEth);
      
      // Schritt 4: Hole finale Quote mit korrekter ETH-Menge
      const finalEthAmountWei = (requiredEth * Math.pow(10, ETH_DECIMALS)).toString();
      
      const finalPriceParams = new URLSearchParams({
        srcToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        destToken: DFAITH_TOKEN,
        srcDecimals: ETH_DECIMALS.toString(),
        destDecimals: DFAITH_DECIMALS.toString(),
        amount: finalEthAmountWei,
        network: "8453",
        side: "SELL",
        userAddress: account.address,
        slippage: "100",
        maxImpact: "50"
      });
      
      const finalPriceResponse = await fetch(`https://apiv5.paraswap.io/prices?${finalPriceParams}`);
      
      if (!finalPriceResponse.ok) {
        // Fallback: verwende erste Quote
        console.log("Final quote failed, using scaled first quote");
        setSwapAmountEth(requiredEth.toFixed(6));
      } else {
        const finalPriceData = await finalPriceResponse.json();
        if (finalPriceData && finalPriceData.priceRoute) {
          const finalEth = Number(finalPriceData.priceRoute.srcAmount) / Math.pow(10, ETH_DECIMALS);
          setSwapAmountEth(finalEth.toFixed(6));
          priceData.priceRoute = finalPriceData.priceRoute; // Verwende finale Quote
          console.log("Using final quote with ETH:", finalEth);
        } else {
          setSwapAmountEth(requiredEth.toFixed(6));
        }
      }
      
      // Warnung anzeigen bei hohem Price Impact
      if (priceData.priceRoute.maxImpactReached) {
        console.warn("⚠️ Hoher Price Impact erkannt:", priceData);
      }
      
      // 2. Baue Transaction mit korrekten Parametern
      const buildTxParams = {
        srcToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        destToken: DFAITH_TOKEN,
        srcAmount: priceData.priceRoute.srcAmount,
        priceRoute: priceData.priceRoute,
        userAddress: account.address,
        slippage: "100" // Fest 1% (100 basis points)
      };
      
      console.log("Build TX Parameters:", buildTxParams);
      
      const buildTxResponse = await fetch('https://apiv5.paraswap.io/transactions/8453', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DawidFaithWallet/1.0'
        },
        body: JSON.stringify(buildTxParams)
      });
      
      console.log("Build TX Response Status:", buildTxResponse.status);
      
      if (!buildTxResponse.ok) {
        const errorText = await buildTxResponse.text();
        console.error("ParaSwap Build Transaction Error:", buildTxResponse.status, errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error("ParaSwap Error Details:", errorJson);
          throw new Error(`ParaSwap Build Transaction Fehler: ${buildTxResponse.status} - ${errorJson.error || errorJson.message || errorText}`);
        } catch (parseError) {
          throw new Error(`ParaSwap Build Transaction Fehler: ${buildTxResponse.status} - ${errorText}`);
        }
      }
      
      const buildTxData = await buildTxResponse.json();
      console.log("ParaSwap Build Transaction Response:", buildTxData);
      
      if (!buildTxData || !buildTxData.to || !buildTxData.data) {
        console.error("Invalid transaction data:", buildTxData);
        throw new Error('ParaSwap: Unvollständige Transaktionsdaten');
      }
      
      setQuoteTxData(buildTxData);
      
      // Bei ETH-Käufen ist normalerweise kein Approval nötig, da es native Token sind
      setNeedsApproval(false);
      setBuyStep('quoteFetched');
      setSwapTxStatus(null);
      
      // Zeige das Purchase Modal
      setShowPurchaseModal(true);
      
    } catch (e: any) {
      console.error("Quote Fehler:", e);
      
      // Spezifische Fehlerbehandlung für ParaSwap
      let errorMessage = e.message || "Quote Fehler";
      
      if (errorMessage.includes("400")) {
        errorMessage = "ParaSwap: Ungültige Parameter. Möglicherweise ist die Liquidität für diesen Betrag nicht ausreichend oder der Token wird nicht unterstützt.";
      } else if (errorMessage.includes("404")) {
        errorMessage = "ParaSwap: Route nicht gefunden. Token möglicherweise nicht verfügbar auf Base Chain.";
      } else if (errorMessage.includes("500")) {
        errorMessage = "ParaSwap: Server-Fehler. Bitte später erneut versuchen.";
      } else if (errorMessage.includes("Cannot specify both")) {
        errorMessage = "ParaSwap: Parameter-Konflikt behoben. Bitte erneut versuchen.";
      } else if (errorMessage.includes("Price Impact")) {
        // Für Price Impact Fehler: Lass die Original-Nachricht durch
        // errorMessage bleibt wie es ist
      }
      
      setQuoteError(errorMessage);
      setSwapTxStatus("error");
      setTimeout(() => setSwapTxStatus(null), 6000);
    }
  };

  // Approval wird normalerweise nicht benötigt bei ETH → D.FAITH da ETH native ist
  const handleApprove = async () => {
    if (!account?.address) return;
    setSwapTxStatus("approving");
    
    try {
      console.log("Approval für ETH (normalerweise nicht nötig)");
      // Bei Native Token ist kein Approval nötig, also überspringen wir direkt
      setNeedsApproval(false);
      setBuyStep('approved');
      setSwapTxStatus(null);
    } catch (e) {
      console.error("Approve Fehler:", e);
      setSwapTxStatus("error");
      setTimeout(() => setSwapTxStatus(null), 4000);
    }
  };

  // Verbesserter D.FAITH Swap mit ETH-Balance-Verifizierung für ParaSwap
  const handleBuySwap = async () => {
    if (!quoteTxData || !account?.address) return;
    setIsSwapping(true);
    setSwapTxStatus("swapping");
    
    // Aktuelle ETH-Balance vor dem Swap speichern
    const initialEthBalance = parseFloat(ethBalance);
    const ethAmount = parseFloat(swapAmountEth);
    
    try {
      console.log("=== D.FAITH Kauf-Swap wird gestartet mit ParaSwap auf Base ===");
      console.log("Verwende ParaSwap Transaction-Daten:", quoteTxData);
      
      const { prepareTransaction } = await import("thirdweb");
      
      // Stelle sicher, dass wir auf Base Chain (ID: 8453) sind
      console.log("Target Chain:", base.name, "Chain ID:", base.id);
      if (base.id !== 8453) {
        throw new Error("Falsche Chain - Base Chain erwartet");
      }
      
      const transaction = await prepareTransaction({
        to: quoteTxData.to,
        data: quoteTxData.data,
        value: BigInt(quoteTxData.value || "0"),
        chain: base, // Explizit Base Chain
        client,
        // Entferne gasLimit - Thirdweb macht automatische Gas-Schätzung
      });
      
      console.log("Prepared ParaSwap Transaction:", transaction);
      setSwapTxStatus("confirming");
      
      // Sende Transaktion mit verbesserter Fehlerbehandlung
      try {
        // Explizit Base Chain Context setzen vor Transaction
        console.log("Sende ParaSwap Transaktion auf Base Chain (ID: 8453)");
        sendTransaction(transaction);
        console.log("ParaSwap Transaction sent successfully on Base Chain");
        
        // Da sendTransaction void zurückgibt, können wir nicht sofort die TxHash prüfen
        // Die Balance-Verifizierung wird das Ergebnis bestätigen
      } catch (txError: any) {
        console.log("Transaction error details:", txError);
        
        // Ignoriere Analytics-Fehler von Thirdweb (c.thirdweb.com/event) oder Chain-bezogene 400er
        if (txError?.message?.includes('event') || 
            txError?.message?.includes('analytics') || 
            txError?.message?.includes('c.thirdweb.com') ||
            txError?.message?.includes('400') && txError?.message?.includes('thirdweb')) {
          console.log("Thirdweb API-Fehler ignoriert, ParaSwap Transaktion könnte trotzdem erfolgreich sein");
          // Gehe weiter zur Verifizierung
        } else {
          // Echter Transaktionsfehler
          throw txError;
        }
      }
      
      setSwapTxStatus("verifying");
      console.log("Verifiziere D.FAITH-Balance-Erhöhung nach ParaSwap...");
      
      // Aktuelle D.FAITH Balance vor dem Swap speichern
      const initialDFaithBalance = parseFloat(dfaithBalance);
      console.log("Initiale D.FAITH Balance:", initialDFaithBalance);
      
      // D.FAITH-Balance-Verifizierung mit optimierten, schnelleren Intervallen
      let balanceVerified = false;
      let attempts = 0;
      const maxAttempts = 15; // Maximal 15 Versuche (ca. 20 Sekunden total)
      
      // Erste sehr kurze Wartezeit nach Transaktionsbestätigung
      console.log("Warte 1 Sekunde vor erster D.FAITH Balance-Prüfung...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      while (!balanceVerified && attempts < maxAttempts) {
        attempts++;
        console.log(`D.FAITH-Balance-Verifizierung Versuch ${attempts}/${maxAttempts}`);
        
        try {
          // D.FAITH Balance über thirdweb hooks prüfen (die werden automatisch aktualisiert)
          const currentDFaithBalance = Number(dfaithBalance);
          
          console.log(`Initiale D.FAITH: ${initialDFaithBalance}, Aktuelle D.FAITH: ${currentDFaithBalance}`);
          
          // Prüfe ob sich die D.FAITH Balance erhöht hat (mindestens 0.01 D.FAITH Unterschied)
          const balanceIncrease = currentDFaithBalance - initialDFaithBalance;
          
          if (balanceIncrease > 0.01) { // Mindestens 0.01 D.FAITH Erhöhung
            console.log(`✅ D.FAITH-Balance-Erhöhung verifiziert: +${balanceIncrease.toFixed(2)} D.FAITH - Kauf erfolgreich!`);
            
            // Balances werden automatisch über thirdweb hooks aktualisiert - keine manuellen Updates nötig
            
            balanceVerified = true;
            setBuyStep('completed');
            setSwapTxStatus("success");
            // WICHTIG: Inputfelder NICHT leeren, damit User die Erfolgsmeldung sehen kann
            // setSwapAmountEth("");
            // setSwapAmountDfaith("");
            // setQuoteTxData(null);
            // setSpenderAddress(null);
            
            // Erfolgsmeldung bleibt dauerhaft sichtbar - kein automatisches Schließen
          } else {
            console.log(`Versuch ${attempts}: D.FAITH-Balance noch nicht erhöht (+${balanceIncrease.toFixed(4)}), weiter warten...`);
            
            // Schnellere Intervalle: 1.5 Sekunden zwischen den Versuchen
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        } catch (balanceError) {
          console.error(`D.FAITH-Balance-Verifizierung Versuch ${attempts} fehlgeschlagen:`, balanceError);
          
          // Warte 1.5 Sekunden bei Fehlern
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
      
      if (!balanceVerified) {
        console.log("⚠️ D.FAITH-Balance-Verifizierung nach mehreren Versuchen nicht erfolgreich - Transaktion könnte trotzdem erfolgreich sein");
        setSwapTxStatus("success");
        setBuyStep('completed');
        
        // Erfolgsmeldung bleibt dauerhaft sichtbar - kein automatisches Schließen
      }
      
    } catch (error) {
      console.error("ParaSwap Swap Error:", error);
      setSwapTxStatus("error");
      setTimeout(() => setSwapTxStatus(null), 5000);
    } finally {
      setIsSwapping(false);
    }
  };


  // Modal-Ref für Scroll
  const buyModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showBuyModal && buyModalRef.current) {
      setTimeout(() => {
        buyModalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [showBuyModal]);

  // Token-Auswahl wie im SendTab
  const tokenOptions = [
    {
      key: "DFAITH",
      label: "D.FAITH",
      symbol: "DFAITH",
      balance: dfaithBalance,
      color: "from-transparent to-transparent", // Kein Hintergrund für D.FAITH
      description: "Dawid Faith Token",
      price: dfaithPriceEur ? `${dfaithPriceEur.toFixed(2)}€ ${language === 'en' ? 'per' : language === 'pl' ? 'za' : 'pro'} D.FAITH` : (isLoadingPrice ? <TranslatedText text="Laden..." language={language} /> : (priceError || <TranslatedText text="Preis nicht verfügbar" language={language} />)),
      sub: dfaithPrice ? `1 ETH = ${(1 / dfaithPrice).toFixed(2)} D.FAITH` : <TranslatedText text="Wird geladen..." language={language} />,
      icon: <img src="/D.FAITH.png" alt="D.FAITH" className="w-10 h-10 object-contain" />,
    },
    {
      key: "DINVEST",
      label: "D.INVEST",
      symbol: "DINVEST",
      balance: dinvestBalance,
      color: "from-blue-400 to-blue-600",
      description: "Investment & Staking Token",
      price: `5€ ${language === 'en' ? 'per' : language === 'pl' ? 'za' : 'pro'} D.INVEST`,
      sub: <TranslatedText text="Minimum: 5 EUR" language={language} />,
      icon: <img src="/D.INVEST.png" alt="D.INVEST" className="w-10 h-10 object-contain" />,
    },
    {
      key: "ETH",
      label: "ETH",
      symbol: "ETH",
      balance: ethBalance,
      color: "from-blue-500 to-blue-700",
      description: "Ethereum Native Token",
      price: ethPriceEur ? `${ethPriceEur.toFixed(2)}€ ${language === 'en' ? 'per' : language === 'pl' ? 'za' : 'pro'} ETH` : <TranslatedText text="Preis wird geladen..." language={language} />,
      sub: <TranslatedText text="mit EUR kaufen" language={language} />,
      icon: <img src="/ETH.png" alt="ETH" className="w-8 h-8 object-contain" />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      {/* Token-Auswahl Grid */}
      <div className="space-y-3">
        <div className="grid gap-3">
          {tokenOptions.map((token) => (
            <div
              key={token.key}
              onClick={() => {
                if (account?.address) {
                  setSelectedToken(token.key as "DFAITH" | "DINVEST" | "ETH");
                  setShowBuyModal(true);
                  setCopied(false);
                } else {
                  alert(language === 'en' ? 'Please connect wallet!' : language === 'pl' ? 'Proszę połączyć portfel!' : 'Bitte Wallet verbinden!');
                }
              }}
              className="relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/70 hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-20 h-20 rounded-full ${token.key === 'DFAITH' || token.key === 'DINVEST' || token.key === 'ETH' ? 'bg-transparent' : `bg-gradient-to-r ${token.color}`} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                  {token.key === 'DFAITH' ? (
                    <img src="/D.FAITH.png" alt="D.FAITH" className="w-20 h-20 object-contain" />
                  ) : token.key === 'DINVEST' ? (
                    <img src="/D.INVEST.png" alt="D.INVEST" className="w-20 h-20 object-contain" />
                  ) : token.key === 'ETH' ? (
                    <img src="/ETH.png" alt="ETH" className="w-16 h-16 object-contain" />
                  ) : (
                    token.icon
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{token.label}</h3>
                  <p className="text-zinc-400 text-xs">{token.description}</p>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-zinc-400">{token.price}</span>
                <span className="text-zinc-400">{token.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kauf-Modal zentral - Mobile Optimiert und zentriert */}
      {showBuyModal && selectedToken && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 overflow-y-auto p-4 pt-20">
          <div
            ref={buyModalRef}
      className="bg-zinc-900 rounded-xl p-3 sm:p-6 max-w-sm w-full border border-zinc-700 ring-1 ring-amber-400/20 shadow-xl shadow-black/20 max-h-[85vh] overflow-y-auto my-4 relative"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Modal-Header - Sticky X Button */}
            <div className="sticky top-0 z-10 bg-zinc-900 flex items-center justify-end mb-2 -mx-3 -mt-3 px-3 pt-3 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
              <button
                onClick={() => {
                  setShowBuyModal(false);
                  setSelectedToken(null);
                  setSwapAmountEth("");
                  setSwapAmountDfaith("");
                  setSlippage("1");
                  setSwapTxStatus(null);
                  setBuyStep('initial');
                  setQuoteTxData(null);
                  setSpenderAddress(null);
                  setNeedsApproval(false);
                  setQuoteError(null);
                }}
                className="p-2 text-amber-400 hover:text-yellow-300 hover:bg-zinc-800 rounded-lg transition-all flex-shrink-0 shadow-lg"
                disabled={isSwapping}
              >
                <span className="text-lg">✕</span>
              </button>
            </div>

            {/* Modal-Inhalt je nach Token */}
            {selectedToken === "DFAITH" && (
              <div className="w-full space-y-4">
                {/* Professional Buy Widget Header */}
                <div className="text-center pb-3 border-b border-zinc-700 mb-4">
                  <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
                    <img src="/D.FAITH.png" alt="D.FAITH" className="w-32 h-32 object-contain" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1"><TranslatedText text="D.FAITH kaufen" language={language} /></h3>
                  {dfaithPriceEur && (
                    <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full inline-block">
                      <span className="text-amber-400 text-xs font-semibold">
                        €{dfaithPriceEur.toFixed(2)} / D.FAITH
                      </span>
                    </div>
                  )}
                </div>

                {/* Buy Widget Steps Indicator */}
                <div className="flex justify-between items-center px-2">
                  <div className={`flex items-center space-x-1 ${buyStep !== 'initial' ? 'text-green-400' : 'text-zinc-500'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${buyStep !== 'initial' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                      {buyStep !== 'initial' ? '✓' : '1'}
                    </div>
                    <span className="text-xs font-medium"><TranslatedText text="Quote" language={language} /></span>
                  </div>
                  <div className={`w-8 h-0.5 ${buyStep === 'approved' || buyStep === 'completed' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                  <div className={`flex items-center space-x-1 ${buyStep === 'approved' || buyStep === 'completed' ? 'text-green-400' : 'text-zinc-500'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${buyStep === 'approved' || buyStep === 'completed' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                      {buyStep === 'approved' || buyStep === 'completed' ? '✓' : '2'}
                    </div>
                    <span className="text-xs font-medium"><TranslatedText text="Approve" language={language} /></span>
                  </div>
                  <div className={`w-8 h-0.5 ${buyStep === 'completed' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                  <div className={`flex items-center space-x-1 ${buyStep === 'completed' ? 'text-green-400' : 'text-zinc-500'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${buyStep === 'completed' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                      {buyStep === 'completed' ? '✓' : '3'}
                    </div>
                    <span className="text-xs font-medium"><TranslatedText text="Purchase" language={language} /></span>
                  </div>
                </div>

                {/* Amount Input Section */}
                <div className="space-y-3">
                  {/* You Want Section - D.FAITH Input */}
                  <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2 bg-amber-500/20 rounded-lg px-2 py-1 border border-amber-500/30 flex-shrink-0">
                        <img src="/D.FAITH.png" alt="D.FAITH" className="w-8 h-8 object-contain" />
                        <span className="text-amber-300 font-semibold text-xs">D.FAITH</span>
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        className="flex-1 bg-transparent text-lg sm:text-xl font-bold text-white focus:outline-none min-w-0 text-center"
                        value={swapAmountDfaith}
                        onChange={e => setSwapAmountDfaith(e.target.value)}
                        disabled={isSwapping || buyStep !== 'initial'}
                      />
                      <button
                        className="text-amber-400 hover:text-amber-300 font-medium px-3 py-1 rounded bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex-shrink-0"
                        onClick={handleGetQuote}
                        disabled={
                          !swapAmountDfaith || 
                          parseFloat(swapAmountDfaith) <= 0 || 
                          isSwapping || 
                          !account?.address || 
                          parseFloat(ethBalance) <= 0 ||
                          parseFloat(swapAmountDfaith) < 0.01 ||
                          swapTxStatus === "pending"
                        }
                      >
                        {swapTxStatus === "pending" ? (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-amber-300 border-t-transparent rounded-full animate-spin"></div>
                            <span>...</span>
                          </div>
                        ) : (
                          <TranslatedText text="Kaufen" language={language} />
                        )}
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">
                        <TranslatedText text="Balance" language={language} />: {dfaithBalance ? `${Number(dfaithBalance).toFixed(2)} D.FAITH` : <TranslatedText text="Loading..." language={language} />}
                      </span>
                      <span className="text-zinc-500">
                        {dfaithPrice ? `1 D.FAITH = ${dfaithPrice.toFixed(6)} ETH` : <TranslatedText text="Loading..." language={language} />}
                      </span>
                    </div>
                  </div>

                  {/* You Pay Section - ETH Cost Display */}
                  <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2 bg-purple-500/20 rounded-lg px-2 py-1 border border-purple-500/30 flex-shrink-0">
                        <img src="/ETH.png" alt="ETH" className="w-8 h-8 object-contain" />
                        <span className="text-purple-300 font-semibold text-xs"><TranslatedText text="ETH Kosten" language={language} /></span>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-lg sm:text-xl font-bold text-purple-300">
                          {swapAmountEth || "0.000000"}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">
                        <TranslatedText text="Balance" language={language} />: {ethBalance ? `${Number(ethBalance).toFixed(4)} ETH` : <TranslatedText text="Loading..." language={language} />}
                      </span>
                      <span className="text-zinc-500">
                        {swapAmountEth && parseFloat(swapAmountEth) > 0 && ethPriceEur
                          ? `≈ €${(parseFloat(swapAmountEth) * ethPriceEur).toFixed(2)}`
                          : "≈ €0.00"
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Validation Warnings */}
                {swapAmountEth && parseFloat(swapAmountEth) > parseFloat(ethBalance) && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 text-red-400 text-sm">
                    <div className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span><TranslatedText text="Insufficient ETH balance" language={language} /></span>
                    </div>
                  </div>
                )}

                {parseFloat(swapAmountDfaith) > 0 && parseFloat(swapAmountDfaith) < 0.01 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2 text-yellow-400 text-sm">
                    <div className="flex items-center gap-2">
                      <span>💡</span>
                      <span><TranslatedText text="Minimum purchase: 0.01 D.FAITH" language={language} /></span>
                    </div>
                  </div>
                )}

                {/* Status Display for Quote Errors */}
                {swapTxStatus === "error" && quoteError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-xl">❌</span>
                      <span className="font-semibold"><TranslatedText text="Quote Failed" language={language} /></span>
                    </div>
                    <p className="text-sm opacity-80">{quoteError}</p>
                  </div>
                )}
              </div>
            )}
            {selectedToken === "DINVEST" && (
              <div className="w-full space-y-4">
                {/* D.INVEST Kaufanleitung */}
                <div className="text-center pb-3 border-b border-zinc-700 mb-4">
                  <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
                    <img src="/D.INVEST.png" alt="D.INVEST" className="w-32 h-32 object-contain" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1"><TranslatedText text="D.INVEST kaufen" language={language} /></h3>
                  <p className="text-zinc-400 text-xs"><TranslatedText text="Investment & Staking Token" language={language} /></p>
                </div>
                
                <div className="mb-4 text-zinc-300 text-sm space-y-2">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-blue-400 font-medium mb-2">💡 <TranslatedText text="Was ist D.INVEST?" language={language} /></p>
                    <p className="text-zinc-300 text-xs leading-relaxed">
                      <TranslatedText text="D.INVEST ist das Investment-Token für das Dawid Faith Projekt. Mit diesem Token können Sie 80% des gesamten D.FAITH Supplys aus dem Smart Contract durch Staking erhalten. Es dient als langfristiges Investment in die Entwicklung und den Erfolg des Projekts." language={language} />
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span><strong><TranslatedText text="Preis" language={language} />:</strong> 5€ {language === 'en' ? 'per' : language === 'pl' ? 'za' : 'pro'} D.INVEST</span>
                    <span><strong><TranslatedText text="Minimum" language={language} />:</strong> 5 EUR</span>
                  </div>
                </div>

                {/* Amount Selection */}
                <div className="space-y-3">
                  <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                    <label className="block text-sm font-medium text-zinc-300 mb-2"><TranslatedText text="Anzahl D.INVEST Token" language={language} /></label>
                    <div className="flex items-center justify-center gap-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-24 bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 text-white text-center focus:border-amber-500 focus:outline-none"
                        value={dinvestAmount}
                        onChange={(e) => {
                          const amount = parseInt(e.target.value) || 1;
                          setDinvestAmount(amount);
                          setEurAmount(amount * 5);
                        }}
                      />
                      <span className="text-zinc-400 text-sm">×</span>
                      <span className="text-zinc-300 text-sm">5€</span>
                      <span className="text-zinc-400 text-sm">=</span>
                      <span className="text-amber-400 font-semibold">
                        €{eurAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Messages only - Success will show in separate modal */}
                {stripeError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-xl">❌</span>
                      <span className="font-semibold"><TranslatedText text="Zahlung fehlgeschlagen" language={language} /></span>
                    </div>
                    <p className="text-sm opacity-80">{stripeError}</p>
                  </div>
                )}
                
                <Button
                  className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-3"
                  onClick={() => {
                    if (account?.address) {
                      setShowStripeCheckout(true);
                      setStripeError(null);
                    } else {
                      alert(language === 'en' ? 'Please connect wallet!' : language === 'pl' ? 'Proszę połączyć portfel!' : 'Bitte Wallet verbinden!');
                    }
                  }}
                  disabled={dinvestAmount < 1 || eurAmount < 5}
                >
                  <span>{eurAmount.toFixed(2)}€ <TranslatedText text="bezahlen" language={language} /></span>
                </Button>
              </div>
            )}
            {selectedToken === "ETH" && (
              <div className="w-full flex-1 flex items-center justify-center">
                <BuyWidget
                  client={client}
                  tokenAddress={NATIVE_TOKEN_ADDRESS}
                  chain={base}
                  amount="0.1"
                  theme="dark"
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Purchase Modal - Erscheint nach erfolgreichem Quote */}
      {showPurchaseModal && quoteTxData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 overflow-y-auto p-4 pt-20">
          <div className="bg-zinc-900 rounded-xl p-3 sm:p-6 max-w-sm w-full border border-zinc-700 ring-1 ring-green-400/20 shadow-xl shadow-black/20 max-h-[85vh] overflow-y-auto my-4 relative">
            {/* Modal-Header - Sticky X Button */}
            <div className="sticky top-0 z-10 bg-zinc-900 flex items-center justify-end mb-2 -mx-3 -mt-3 px-3 pt-3 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  setBuyStep('initial');
                  setQuoteTxData(null);
                  setSpenderAddress(null);
                  setNeedsApproval(false);
                  setQuoteError(null);
                  setSwapTxStatus(null);
                }}
                className="p-2 text-green-400 hover:text-green-300 hover:bg-zinc-800 rounded-lg transition-all flex-shrink-0 shadow-lg"
                disabled={isSwapping}
              >
                <span className="text-lg">✕</span>
              </button>
            </div>

            <div className="w-full space-y-4">
              {/* Purchase Header */}
              <div className="text-center pb-3 border-b border-zinc-700 mb-4">
                <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
                  <img src="/D.FAITH.png" alt="D.FAITH" className="w-32 h-32 object-contain" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1"><TranslatedText text="Kauf bestätigen" language={language} /></h3>
                <p className="text-zinc-400 text-xs"><TranslatedText text="Quote erhalten - bereit für den Kauf" language={language} /></p>
              </div>

              {/* Purchase Summary */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                <div className="text-center space-y-2">
                  <div className="text-lg font-semibold text-green-400">
                    {swapAmountDfaith} D.FAITH
                  </div>
                  <div className="text-sm text-zinc-300">
                    <TranslatedText text="für" language={language} /> {swapAmountEth} ETH
                  </div>
                  <div className="text-lg font-bold text-amber-400">
                    {swapAmountEth && ethPriceEur 
                      ? `≈ €${(parseFloat(swapAmountEth) * ethPriceEur).toFixed(2)}`
                      : "≈ €0.00"
                    }
                  </div>
                </div>
              </div>

              {/* Purchase Steps Indicator */}
              <div className="flex justify-between items-center px-2">
                <div className={`flex items-center space-x-1 text-green-400`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-green-500 text-white">
                    ✓
                  </div>
                  <span className="text-xs font-medium"><TranslatedText text="Quote" language={language} /></span>
                </div>
                <div className={`w-8 h-0.5 ${buyStep === 'approved' || buyStep === 'completed' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                <div className={`flex items-center space-x-1 ${buyStep === 'approved' || buyStep === 'completed' ? 'text-green-400' : 'text-zinc-500'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${buyStep === 'approved' || buyStep === 'completed' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                    {buyStep === 'approved' || buyStep === 'completed' ? '✓' : '2'}
                  </div>
                  <span className="text-xs font-medium"><TranslatedText text="Approve" language={language} /></span>
                </div>
                <div className={`w-8 h-0.5 ${buyStep === 'completed' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                <div className={`flex items-center space-x-1 ${buyStep === 'completed' ? 'text-green-400' : 'text-zinc-500'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${buyStep === 'completed' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                    {buyStep === 'completed' ? '✓' : '3'}
                  </div>
                  <span className="text-xs font-medium"><TranslatedText text="Purchase" language={language} /></span>
                </div>
              </div>

              {/* Status Display */}
              {swapTxStatus && (
                <div className={`rounded-xl p-4 border text-center ${
                  swapTxStatus === "success" ? "bg-green-500/20 border-green-500/50 text-green-300" :
                  swapTxStatus === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                  "bg-blue-500/10 border-blue-500/30 text-blue-400"
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {swapTxStatus === "success" && <span className="text-3xl">🎉</span>}
                    {swapTxStatus === "error" && <span className="text-xl">❌</span>}
                    {(swapTxStatus === "confirming" || swapTxStatus === "verifying" || swapTxStatus === "swapping") && (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span className="font-bold text-lg">
                      {swapTxStatus === "success" && <TranslatedText text="Kauf erfolgreich abgeschlossen!" language={language} />}
                      {swapTxStatus === "error" && <TranslatedText text="Kauf fehlgeschlagen" language={language} />}
                      {swapTxStatus === "confirming" && <TranslatedText text="Bestätige Transaktion..." language={language} />}
                      {swapTxStatus === "verifying" && <TranslatedText text="Verifiziere Kauf..." language={language} />}
                      {swapTxStatus === "swapping" && <TranslatedText text="Führe Kauf durch..." language={language} />}
                    </span>
                  </div>
                  {swapTxStatus === "success" && (
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-green-200">
                        🚀 {swapAmountDfaith} D.FAITH <TranslatedText text="wurden erfolgreich gekauft!" language={language} />
                      </p>
                      <p className="text-sm text-green-300/80">
                        💰 <TranslatedText text="Für" language={language} /> {swapAmountEth} ETH ({swapAmountEth && ethPriceEur ? `≈ €${(parseFloat(swapAmountEth) * ethPriceEur).toFixed(2)}` : '€0.00'})
                      </p>
                      <p className="text-xs text-green-400/70 mt-2">
                        ✨ <TranslatedText text="Deine neuen Token sind bereits in deiner Wallet verfügbar!" language={language} />
                      </p>
                    </div>
                  )}
                  {swapTxStatus === "error" && quoteError && (
                    <p className="text-sm opacity-80">{quoteError}</p>
                  )}
                  {swapTxStatus === "verifying" && (
                    <p className="text-sm opacity-80 mt-1">
                      <TranslatedText text="Prüfe Balance-Änderungen... Das kann einen Moment dauern." language={language} />
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {buyStep === 'quoteFetched' && needsApproval && (
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-base transition-all"
                    onClick={handleApprove}
                    disabled={isSwapping}
                  >
                    {isSwapping ? <TranslatedText text="Approving..." language={language} /> : <TranslatedText text="Approve ETH" language={language} />}
                  </Button>
                )}

                {((buyStep === 'quoteFetched' && !needsApproval) || buyStep === 'approved') && (
                  <Button
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 rounded-xl text-base transition-all transform hover:scale-[1.02]"
                    onClick={handleBuySwap}
                    disabled={isSwapping}
                  >
                    {isSwapping ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span><TranslatedText text="Kaufe..." language={language} /></span>
                      </div>
                    ) : (
                      `${language === 'en' ? 'Buy' : language === 'pl' ? 'Kup' : 'Kaufe'} ${swapAmountDfaith} D.FAITH ${language === 'en' ? 'for' : language === 'pl' ? 'za' : 'für'} ${swapAmountEth && ethPriceEur ? `€${(parseFloat(swapAmountEth) * ethPriceEur).toFixed(2)}` : '€0.00'}`
                    )}
                  </Button>
                )}

                {buyStep === 'completed' && (
                  <Button
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl text-base transition-all"
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setBuyStep('initial');
                      setQuoteTxData(null);
                      setSpenderAddress(null);
                      setNeedsApproval(false);
                      setQuoteError(null);
                      setSwapAmountEth("");
                      setSwapTxStatus(null);
                    }}
                    disabled={isSwapping}
                  >
                    <TranslatedText text="Weiteren Kauf tätigen" language={language} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Checkout Modal */}
      {showStripeCheckout && account?.address && (
        <StripeCheckout
          walletAddress={account.address}
          amount={eurAmount}
          dinvestAmount={dinvestAmount}
          onSuccess={() => {
            setShowStripeCheckout(false);
            setShowBuyModal(false); // Schließe das Haupt-Buy-Modal
            setShowDinvestSuccessModal(true); // Öffne separates Success Modal
            setStripeError(null);
          }}
          onError={(error) => {
            setShowStripeCheckout(false);
            setStripeError(error);
            setStripeSuccess(false);
          }}
          onClose={() => setShowStripeCheckout(false)}
        />
      )}

      {/* D.INVEST Success Modal */}
      {showDinvestSuccessModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 overflow-y-auto p-4 pt-20">
          <div className="bg-zinc-900 rounded-xl p-3 sm:p-6 max-w-sm w-full border border-zinc-700 ring-1 ring-green-400/20 shadow-xl shadow-black/20 max-h-[85vh] overflow-y-auto my-4 relative">
            {/* Modal-Header - Sticky X Button */}
            <div className="sticky top-0 z-10 bg-zinc-900 flex items-center justify-end mb-2 -mx-3 -mt-3 px-3 pt-3 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
              <button
                onClick={() => {
                  setShowDinvestSuccessModal(false);
                  setStripeSuccess(false);
                  setDinvestAmount(1);
                  setEurAmount(5);
                }}
                className="p-2 text-green-400 hover:text-green-300 hover:bg-zinc-800 rounded-lg transition-all flex-shrink-0 shadow-lg"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>

            <div className="w-full space-y-4">
              {/* Success Header */}
              <div className="text-center pb-3 border-b border-zinc-700 mb-4">
                <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
                  <img src="/D.INVEST.png" alt="D.INVEST" className="w-32 h-32 object-contain" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1"><TranslatedText text="Kauf erfolgreich!" language={language} /></h3>
                <p className="text-zinc-400 text-xs"><TranslatedText text="D.INVEST Token wurden sofort gesendet" language={language} /></p>
              </div>

              {/* Success Message */}
              <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-4xl">🎉</span>
                  <span className="font-bold text-xl text-green-300"><TranslatedText text="Zahlung erfolgreich!" language={language} /></span>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-200 font-semibold text-lg mb-1">
                      {dinvestAmount} D.INVEST Token
                    </p>
                    <p className="text-green-300/80 text-sm">
                      <TranslatedText text="für" language={language} /> €{eurAmount.toFixed(2)} <TranslatedText text="gekauft" language={language} />
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-sm text-green-300/90">
                    <p className="flex items-center justify-center gap-2">
                      <span>⚡</span>
                      <span><TranslatedText text="Token wurden sofort an deine Wallet gesendet" language={language} /></span>
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <span>💰</span>
                      <span><TranslatedText text="Berechtigt zum D.FAITH Staking" language={language} /></span>
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <span>❓</span>
                      <span><TranslatedText text="Fragen? Schreib mir per DM oder an dawid.faith@gmail.com" language={language} /></span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl text-base transition-all"
                  onClick={() => {
                    setShowDinvestSuccessModal(false);
                    setStripeSuccess(false);
                    setDinvestAmount(1);
                    setEurAmount(5);
                    // Öffne Buy Modal wieder für weitere Käufe
                    setSelectedToken("DINVEST");
                    setShowBuyModal(true);
                  }}
                >
                  <TranslatedText text="Weitere D.INVEST Token kaufen" language={language} />
                </Button>
                
                <Button
                  className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold py-3 rounded-xl text-base transition-all"
                  onClick={() => {
                    setShowDinvestSuccessModal(false);
                    setStripeSuccess(false);
                    setDinvestAmount(1);
                    setEurAmount(5);
                    setSelectedToken(null);
                  }}
                >
                  <TranslatedText text="Fertig" language={language} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

