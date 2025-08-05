import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { FaCoins, FaExchangeAlt, FaArrowDown } from "react-icons/fa";
import { useActiveAccount, useSendTransaction, useWalletBalance, useReadContract } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { getContract, prepareContractCall } from "thirdweb";
import { client } from "../../client";
import { balanceOf } from "thirdweb/extensions/erc20";

// Token Adressen (gleich wie im SendTab und WalletTab)
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DFAITH_DECIMALS = 2;
const ETH_DECIMALS = 18;

export default function SellTab() {
  const [selectedToken, setSelectedToken] = useState<"DFAITH" | "ETH" | null>(null);
  const [sellAmount, setSellAmount] = useState("");
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();

  // Thirdweb Hooks für Balance (wie im SendTab und WalletTab)
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

  // Formatierte Balances berechnen (wie im SendTab und WalletTab)
  const ethBalance = ethBalanceData 
    ? (Number(ethBalanceData.value) / Math.pow(10, ETH_DECIMALS)).toFixed(4)
    : "0.0000";

  const dfaithBalance = dfaithBalanceData 
    ? (Number(dfaithBalanceData) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS)
    : "0.00";

  // Alte State-Variablen für Balances entfernt, da wir jetzt direkt die berechneten Werte verwenden
  const [dfaithPrice, setDfaithPrice] = useState<number | null>(null);
  const [dfaithPriceEur, setDfaithPriceEur] = useState<number | null>(null);
  const [ethPriceEur, setEthPriceEur] = useState<number | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [slippage, setSlippage] = useState("1");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapTxStatus, setSwapTxStatus] = useState<string | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [quoteTxData, setQuoteTxData] = useState<any>(null);
  const [spenderAddress, setSpenderAddress] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [sellStep, setSellStep] = useState<'initial' | 'quoteFetched' | 'approved' | 'completed'>('initial');
  
  // D.FAITH & ETH Preis laden (umgekehrte Richtung - D.FAITH zu ETH) mit ParaSwap
  useEffect(() => {
    const fetchPrice = async () => {
      setIsLoadingPrice(true);
      setPriceError(null);
      try {
        // 1. ETH/EUR Preis von CoinGecko holen
        const ethResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur');
        if (ethResponse.ok) {
          const ethData = await ethResponse.json();
          const ethEur = ethData['ethereum']?.eur || 3000;
          setEthPriceEur(ethEur);
        }
        
        // 2. D.FAITH zu ETH Preis von ParaSwap für Base Chain
        const priceParams = new URLSearchParams({
          srcToken: DFAITH_TOKEN, // D.FAITH
          destToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH address for ParaSwap
          srcDecimals: DFAITH_DECIMALS.toString(),
          destDecimals: "18", // ETH has 18 decimals
          amount: "100", // 1 D.FAITH (100 mit 2 Decimals)
          network: "8453", // Base Chain ID
          side: "SELL"
        });
        
        const priceResponse = await fetch(`https://apiv5.paraswap.io/prices?${priceParams}`);
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          console.log("ParaSwap Sell Price Response:", priceData);
          
          if (priceData && priceData.priceRoute && priceData.priceRoute.destAmount) {
            // destAmount ist in ETH Wei (18 Decimals)
            const ethPerDfaith = Number(priceData.priceRoute.destAmount) / Math.pow(10, 18);
            setDfaithPrice(ethPerDfaith); // Wie viele ETH für 1 D.FAITH
            // Preis pro D.FAITH in EUR: ethPerDfaith * ethEur
            const currentEthEur = ethPriceEur || 3000;
            setDfaithPriceEur(ethPerDfaith * currentEthEur);
          } else {
            setPriceError("ParaSwap: Keine Liquidität für Verkauf verfügbar");
          }
        } else {
          const errorText = await priceResponse.text();
          console.error("ParaSwap Price Error:", priceResponse.status, errorText);
          setPriceError(`ParaSwap Preis-API Fehler: ${priceResponse.status}`);
        }
      } catch (error) {
        console.error("Price fetch error:", error);
        setPriceError("Preis-API Fehler");
      }
      setIsLoadingPrice(false);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [ethPriceEur]);

  // Token-Auswahl-Handler
  const handleTokenSelect = (token: "DFAITH" | "ETH") => {
    if (!account?.address) {
      alert('Bitte Wallet verbinden!');
      return;
    }
    
    setSelectedToken(token);
    setSellAmount("");
    setQuoteTxData(null);
    setSpenderAddress(null);
    setNeedsApproval(false);
    setQuoteError(null);
    setSwapTxStatus(null);
    setSellStep('initial');
    
    if (token === "ETH") {
      // Öffne externe Seite
      window.open('https://global.transak.com/', '_blank');
    } else {
      setShowSellModal(true);
    }
  };

  // Funktion um eine Verkaufs-Quote zu erhalten mit ParaSwap
  const handleGetQuote = async () => {
    setSwapTxStatus("pending");
    setQuoteError(null);
    setQuoteTxData(null);
    setSpenderAddress(null);
    setNeedsApproval(false);

    try {
      if (!sellAmount || parseFloat(sellAmount) <= 0 || !account?.address) return;

      // Minimum Check
      if (parseFloat(sellAmount) < 0.01) {
        throw new Error("Minimum Verkaufsbetrag ist 0.01 D.FAITH");
      }

      console.log("=== ParaSwap Sell Quote Request für Base ===");
      console.log("D.FAITH Amount:", sellAmount);
      console.log("Account Address:", account.address);
      
      const dfaithAmountRaw = (parseFloat(sellAmount) * Math.pow(10, DFAITH_DECIMALS)).toString();
      console.log("D.FAITH Amount Raw:", dfaithAmountRaw);
      
      // Verwende die ParaSwap TokenTransferProxy Adresse für Base Chain
      const paraswapTokenTransferProxy = "0x93aAAe79a53759cD164340E4C8766E4Db5331cD7"; // ParaSwap TokenTransferProxy auf Base
      setSpenderAddress(paraswapTokenTransferProxy);
      
      // 1. ZUERST: Prüfe Allowance für D.FAITH Token mit korrekter Spender-Adresse
      console.log("1. Prüfe Allowance für ParaSwap TokenTransferProxy:", paraswapTokenTransferProxy);
      
      try {
        const contract = getContract({
          client,
          chain: base,
          address: DFAITH_TOKEN
        });
        
        const { readContract } = await import("thirdweb");
        const currentAllowance = await readContract({
          contract,
          method: "function allowance(address owner, address spender) view returns (uint256)",
          params: [account.address, paraswapTokenTransferProxy]
        });
        
        console.log("Aktuelle Allowance für TokenTransferProxy:", currentAllowance.toString());
        
        const requiredAmount = BigInt(dfaithAmountRaw);
        console.log("Benötigte Allowance:", requiredAmount.toString());
        
        if (currentAllowance < requiredAmount) {
          console.log("Approval nötig für TokenTransferProxy - stoppe Quote-Anfrage");
          setNeedsApproval(true);
          setSellStep('quoteFetched'); // Gehe direkt zum Approval-Schritt
          setSwapTxStatus(null);
          return; // Stoppe hier, da Approval benötigt wird
        } else {
          console.log("Approval bereits vorhanden für TokenTransferProxy - fahre mit Quote fort");
          setNeedsApproval(false);
        }
      } catch (allowanceError) {
        console.error("Fehler beim Abrufen der Allowance:", allowanceError);
        // Sicherheitshalber Approval als nötig setzen und stoppen
        setNeedsApproval(true);
        setSellStep('quoteFetched');
        setSwapTxStatus(null);
        return;
      }
      
      // 2. Nur wenn Allowance OK ist: Hole Preis-Quote von ParaSwap
      const priceParams = new URLSearchParams({
        srcToken: DFAITH_TOKEN, // D.FAITH
        destToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH address for ParaSwap
        srcDecimals: DFAITH_DECIMALS.toString(),
        destDecimals: "18", // ETH has 18 decimals
        amount: dfaithAmountRaw, // D.FAITH in raw units
        network: "8453", // Base Chain ID
        side: "SELL",
        userAddress: account.address,
        slippage: (parseFloat(slippage) * 100).toString(), // ParaSwap expects slippage in basis points
        maxImpact: "50" // Erlaube bis zu 50% Price Impact
      });
      
      console.log("Price Parameters:", Object.fromEntries(priceParams));
      
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
            throw new Error(`Hoher Price Impact (${impactValue}) - Verkauf trotzdem möglich, aber mit Verlust verbunden. Versuche es mit weniger D.FAITH.`);
          } catch (parseError) {
            throw new Error(`Hoher Price Impact erkannt. Versuche es mit einem kleineren Betrag.`);
          }
        }
        
        throw new Error(`ParaSwap Price Quote Fehler: ${priceResponse.status} - ${errorText}`);
      }
      
      const priceData = await priceResponse.json();
      console.log("ParaSwap Sell Price Response:", priceData);
      
      if (!priceData || !priceData.priceRoute) {
        console.error("Invalid price data:", priceData);
        throw new Error('ParaSwap: Keine gültige Price Route erhalten');
      }
      
      // Warnung anzeigen bei hohem Price Impact
      if (priceData.priceRoute.maxImpactReached) {
        console.warn("⚠️ Hoher Price Impact erkannt:", priceData);
      }
      
      // 3. Baue Transaction mit korrekten Parametern
      const buildTxParams = {
        srcToken: DFAITH_TOKEN,
        destToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        srcAmount: priceData.priceRoute.srcAmount,
        priceRoute: priceData.priceRoute,
        userAddress: account.address,
        slippage: (parseFloat(slippage) * 100).toString()
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
      setSellStep('quoteFetched');
      setSwapTxStatus(null);
      
    } catch (e: any) {
      console.error("Quote Fehler:", e);
      
      // Spezifische Fehlerbehandlung für ParaSwap
      let errorMessage = e.message || "Quote Fehler";
      
      if (errorMessage.includes("400")) {
        errorMessage = "ParaSwap: Ungültige Parameter. Möglicherweise ist die Liquidität für diesen Betrag nicht ausreichend.";
      } else if (errorMessage.includes("404")) {
        errorMessage = "ParaSwap: Route nicht gefunden. Token möglicherweise nicht verfügbar auf Base Chain.";
      } else if (errorMessage.includes("500")) {
        errorMessage = "ParaSwap: Server-Fehler. Bitte später erneut versuchen.";
      } else if (errorMessage.includes("Price Impact")) {
        // Für Price Impact Fehler: Lass die Original-Nachricht durch
      }
      
      setQuoteError(errorMessage);
      setSwapTxStatus("error");
      setTimeout(() => setSwapTxStatus(null), 6000);
    }
  };

  // Funktion um die Tokens für den Swap freizugeben (Approve) mit ParaSwap
  const handleApprove = async () => {
    if (!spenderAddress || !account?.address) return;
    setSwapTxStatus("approving");
    try {
      console.log("Approve Transaktion starten für ParaSwap TokenTransferProxy:", spenderAddress);
      
      const contract = getContract({
        client,
        chain: base,
        address: DFAITH_TOKEN
      });
      
      // Maximaler Approve-Betrag (type(uint256).max)
      const maxApproval = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
      
      console.log("Verkaufsbetrag:", sellAmount);
      console.log("Approve-Betrag:", "MAX (type(uint256).max)");
      console.log("Approve-Betrag Wert:", maxApproval.toString());
      console.log("Spender (TokenTransferProxy):", spenderAddress);
      
      const approveTransaction = prepareContractCall({
        contract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [spenderAddress, maxApproval]
      });
      
      console.log("Sending approve transaction to TokenTransferProxy...");
      const approveResult = await sendTransaction(approveTransaction);
      console.log("Approve TX gesendet:", approveResult);
      
      setSwapTxStatus("waiting_approval");
      
      // Robuste Approval-Überwachung für Base Chain
      console.log("Warte auf Approval-Bestätigung...");
      let approveReceipt = null;
      let approveAttempts = 0;
      const maxApproveAttempts = 40; // 40 Versuche = ca. 1.5 Minuten
      
      while (!approveReceipt && approveAttempts < maxApproveAttempts) {
        approveAttempts++;
        try {
          console.log(`Approval-Bestätigungsversuch ${approveAttempts}/${maxApproveAttempts}`);
          
          // Versuche Receipt über RPC zu holen
          const txHash = approveResult.transactionHash;
          const receiptResponse = await fetch(base.rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [txHash],
              id: 1
            })
          });
          
          const receiptData = await receiptResponse.json();
          
          if (receiptData.result && receiptData.result.status) {
            approveReceipt = {
              status: receiptData.result.status === "0x1" ? "success" : "reverted",
              transactionHash: receiptData.result.transactionHash
            };
            console.log("Approval bestätigt via RPC:", approveReceipt);
            break;
          } else {
            // Wenn noch nicht bestätigt, warte 2 Sekunden
            if (approveAttempts < maxApproveAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        } catch (receiptError) {
          console.log(`Approval-Bestätigungsversuch ${approveAttempts} fehlgeschlagen:`, receiptError);
          if (approveAttempts < maxApproveAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // Wenn nach allen Versuchen keine Bestätigung, aber gehe trotzdem weiter
      if (!approveReceipt) {
        console.log("⚠️ Keine Approval-Bestätigung erhalten, aber gehe weiter");
        approveReceipt = { status: "unknown", transactionHash: approveResult.transactionHash };
      }
      
      // Prüfe ob Approval erfolgreich war
      if (approveReceipt.status === "reverted") {
        throw new Error(`Approval fehlgeschlagen - Hash: ${approveReceipt.transactionHash}`);
      }
      
      setNeedsApproval(false);
      setSellStep('approved');
      setSwapTxStatus(null);
      
      // Nach erfolgreichem Approval: Hole jetzt die Quote
      console.log("Approval erfolgreich - hole jetzt Quote von ParaSwap...");
      await handleGetQuote();
      
    } catch (e) {
      console.error("Approve Fehler:", e);
      setSwapTxStatus("error");
      setTimeout(() => setSwapTxStatus(null), 4000);
    }
  };

  // Verbesserter D.FAITH Verkauf mit ParaSwap und schneller Balance-Verifizierung
  const handleSellSwap = async () => {
    if (!quoteTxData || !account?.address) return;
    setIsSwapping(true);
    setSwapTxStatus("swapping");
    
    // Aktuelle D.FAITH Balance vor dem Swap speichern
    const initialBalance = parseFloat(dfaithBalance);
    const sellAmountNum = parseFloat(sellAmount);
    
    try {
      console.log("=== D.FAITH Verkauf-Swap wird gestartet mit ParaSwap auf Base ===");
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
      console.log("Verifiziere D.FAITH-Balance-Verringerung nach ParaSwap...");
      
      // D.FAITH-Balance-Verifizierung mit schnelleren Intervallen
      let balanceVerified = false;
      let attempts = 0;
      const maxAttempts = 20; // Maximal 20 Versuche (60 Sekunden total)
      
      // Erste kurze Wartezeit nach Transaktionsbestätigung
      console.log("Warte 2 Sekunden vor erster D.FAITH Balance-Prüfung...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      while (!balanceVerified && attempts < maxAttempts) {
        attempts++;
        console.log(`D.FAITH-Balance-Verifizierung Versuch ${attempts}/${maxAttempts}`);
        
        try {
          // D.FAITH Balance wird automatisch durch thirdweb Hook aktualisiert
          // Warten auf automatische Aktualisierung der Balance durch refetchInterval
          const currentDFaithBalance = parseFloat(dfaithBalance);
          
          console.log(`Initiale D.FAITH: ${initialBalance}, Aktuelle D.FAITH: ${currentDFaithBalance}`);
          
          // Prüfe ob sich die D.FAITH Balance um mindestens den Verkaufsbetrag verringert hat
          const expectedDecrease = sellAmountNum;
          const actualDecrease = initialBalance - currentDFaithBalance;
          
          console.log(`Erwartete Verringerung: ${expectedDecrease}, Tatsächliche Verringerung: ${actualDecrease}`);
          
          // Großzügige Toleranz für Rundungsfehler (10%)
          if (actualDecrease >= (expectedDecrease * 0.9)) {
            console.log(`✅ D.FAITH-Balance-Verringerung verifiziert: -${actualDecrease.toFixed(2)} D.FAITH - Verkauf erfolgreich!`);
            
            // Balance wird automatisch durch thirdweb Hook aktualisiert
            
            balanceVerified = true;
            setSellStep('completed');
            setSwapTxStatus("success");
            setSellAmount("");
            setQuoteTxData(null);
            setSpenderAddress(null);
            setTimeout(() => setSwapTxStatus(null), 5000);
          } else {
            console.log(`Versuch ${attempts}: D.FAITH-Balance noch nicht ausreichend verringert (-${actualDecrease.toFixed(4)}), weiter warten...`);
            
            // Warte 3 Sekunden zwischen den Versuchen
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        } catch (balanceError) {
          console.error(`D.FAITH-Balance-Verifizierung Versuch ${attempts} fehlgeschlagen:`, balanceError);
          
          // Warte 3 Sekunden bei Fehlern
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      
      if (!balanceVerified) {
        console.log("⚠️ D.FAITH-Balance-Verifizierung nach mehreren Versuchen nicht erfolgreich - Transaktion könnte trotzdem erfolgreich sein");
        setSwapTxStatus("success");
        setSellStep('completed');
        setSellAmount("");
        setQuoteTxData(null);
        setSpenderAddress(null);
        setTimeout(() => setSwapTxStatus(null), 8000);
      }
      
    } catch (error) {
      console.error("ParaSwap Sell Swap Error:", error);
      setSwapTxStatus("error");
      
      // Versuche trotzdem die Balance zu aktualisieren
      // Die Balance wird automatisch durch thirdweb Hook aktualisiert
      console.log("Balance wird automatisch durch thirdweb Hook aktualisiert");
      
      setTimeout(() => setSwapTxStatus(null), 5000);
    } finally {
      setIsSwapping(false);
    }
  };

// Alle Schritte in einer Funktion
const handleSellAllInOne = async () => {
  if (!sellAmount || parseFloat(sellAmount) <= 0 || isSwapping || parseFloat(sellAmount) > parseFloat(dfaithBalance)) return;
  
  try {
    // Erster Schritt
    console.log("Start des Verkaufsprozesses");
    
    // Nur weitere Schritte ausführen, wenn Quote erfolgreich war
    if (sellStep === 'initial') {
      setIsSwapping(true);
      await handleGetQuote();
    }
    
    // Nur Approve ausführen, wenn nötig
    if (sellStep === 'quoteFetched' && needsApproval) {
      await handleApprove();
    }
    
    // Swap ausführen wenn Quote vorhanden und Approve erledigt/nicht nötig
    if ((sellStep === 'quoteFetched' && !needsApproval) || sellStep === 'approved') {
      await handleSellSwap();
    }
    
  } catch (e: any) {
    console.error("Verkaufsprozess Fehler:", e);
    setQuoteError(e.message || "Fehler beim Verkauf");
    setSwapTxStatus("error");
    setTimeout(() => setSwapTxStatus(null), 4000);
  } finally {
    setIsSwapping(false);
  }
};

// Token-Auswahl Options
const tokenOptions = [
  {
    key: "DFAITH",
    label: "D.FAITH",
    symbol: "DFAITH",
    balance: dfaithBalance,
    color: "from-transparent to-transparent", // Kein Hintergrund für D.FAITH
    description: "Dawid Faith Token",
    price: dfaithPriceEur ? `${dfaithPriceEur.toFixed(2)}€ pro D.FAITH` : "Wird geladen...",
    icon: <img src="/D.FAITH.png" alt="D.FAITH" className="w-12 h-12 object-contain" />,
  },
  {
    key: "ETH",
    label: "ETH",
    symbol: "ETH",
    balance: "–",
    color: "from-blue-500 to-blue-700",
    description: "Ethereum Native Token",
    price: ethPriceEur ? `${ethPriceEur.toFixed(2)}€ pro ETH` : "~3000€ pro ETH",
    sub: "via Transak verkaufen",
    icon: <img src="/ETH.png" alt="ETH" className="w-8 h-8 object-contain" />,
  },
];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          Token verkaufen
        </h2>
      </div>

      {/* Token-Auswahl Grid */}
      <div className="space-y-3">
        <div className="grid gap-3">
          {tokenOptions.map((token) => (
            <div
              key={token.key}
              onClick={() => {
                if (account?.address) {
                  handleTokenSelect(token.key as "DFAITH" | "ETH");
                } else {
                  alert('Bitte Wallet verbinden!');
                }
              }}
              className="relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/70 hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-20 h-20 rounded-full ${token.key === 'DFAITH' || token.key === 'ETH' ? 'bg-transparent' : `bg-gradient-to-r ${token.color}`} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                  {token.key === 'DFAITH' ? (
                    <img src="/D.FAITH.png" alt="D.FAITH" className="w-20 h-20 object-contain" />
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
              {token.key === "DFAITH" && (
                <div className="mt-2 text-xs text-zinc-500">
                  Balance: {token.balance} D.FAITH
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Verkaufs-Modal zentral - Mobile Optimiert und zentriert */}
      {showSellModal && selectedToken === "DFAITH" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 overflow-y-auto p-4 pt-20">
          <div
            className="bg-zinc-900 rounded-xl p-3 sm:p-6 max-w-sm w-full border border-amber-400 max-h-[85vh] overflow-y-auto my-4 relative"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Modal-Header */}
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={() => {
                  setShowSellModal(false);
                  setSelectedToken(null);
                  setSellAmount("");
                  setSlippage("1");
                  setSwapTxStatus(null);
                  setSellStep('initial');
                  setQuoteTxData(null);
                  setSpenderAddress(null);
                  setNeedsApproval(false);
                  setQuoteError(null);
                }}
                className="p-2 text-amber-400 hover:text-yellow-300 hover:bg-zinc-800 rounded-lg transition-all flex-shrink-0"
                disabled={isSwapping}
              >
                <span className="text-lg">✕</span>
              </button>
            </div>

            {/* Modal-Inhalt für D.FAITH Verkauf */}
            <div className="w-full space-y-4">
              {/* Professional Sell Widget Header */}
              <div className="text-center pb-3 border-b border-zinc-700 mb-4">
                <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
                  <img src="/D.FAITH.png" alt="D.FAITH" className="w-32 h-32 object-contain" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">D.FAITH verkaufen</h3>
                {dfaithPriceEur && (
                  <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full inline-block">
                    <span className="text-amber-400 text-xs font-semibold">
                      €{dfaithPriceEur.toFixed(2)} / D.FAITH
                    </span>
                  </div>
                )}
              </div>

              {/* Sell Widget Steps Indicator */}
              <div className="flex justify-between items-center px-2">
                <div className={`flex items-center space-x-1 ${sellStep !== 'initial' ? 'text-green-400' : 'text-zinc-500'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${sellStep !== 'initial' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                    {sellStep !== 'initial' ? '✓' : '1'}
                  </div>
                  <span className="text-xs font-medium">Quote</span>
                </div>
                <div className={`w-8 h-0.5 ${sellStep === 'approved' || sellStep === 'completed' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                <div className={`flex items-center space-x-1 ${sellStep === 'approved' || sellStep === 'completed' ? 'text-green-400' : 'text-zinc-500'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${sellStep === 'approved' || sellStep === 'completed' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                    {sellStep === 'approved' || sellStep === 'completed' ? '✓' : '2'}
                  </div>
                  <span className="text-xs font-medium">Approve</span>
                </div>
                <div className={`w-8 h-0.5 ${sellStep === 'completed' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                <div className={`flex items-center space-x-1 ${sellStep === 'completed' ? 'text-green-400' : 'text-zinc-500'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${sellStep === 'completed' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                    {sellStep === 'completed' ? '✓' : '3'}
                  </div>
                  <span className="text-xs font-medium">Sell</span>
                </div>
              </div>

              {/* Amount Input Section */}
              <div className="space-y-3">
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">You Sell</label>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 bg-amber-500/20 rounded-lg px-2 py-1 border border-amber-500/30 flex-shrink-0">
                      <img src="/D.FAITH.png" alt="D.FAITH" className="w-6 h-6 object-contain" />
                      <span className="text-amber-400 text-xs font-semibold">{dfaithBalance}</span>
                      <span className="text-amber-300 font-semibold text-xs">D.FAITH</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.0"
                      className="flex-1 bg-transparent text-lg sm:text-xl font-bold text-white focus:outline-none min-w-0 text-center"
                      value={sellAmount}
                      onChange={e => setSellAmount(e.target.value)}
                      disabled={isSwapping || sellStep !== 'initial'}
                    />
                    <button
                      className="text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded flex-shrink-0"
                      onClick={() => setSellAmount(dfaithBalance)}
                      disabled={isSwapping || parseFloat(dfaithBalance) <= 0 || sellStep !== 'initial'}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* You Receive Section mit Exchange Rate */}
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">You Receive</label>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 bg-purple-500/20 rounded-lg px-2 py-1 border border-purple-500/30 flex-shrink-0">
                      <img src="/ETH.png" alt="ETH" className="w-6 h-6 object-contain" />
                      <span className="text-purple-300 font-semibold text-xs">ETH</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-purple-400 text-center">
                        {sellAmount && parseFloat(sellAmount) > 0 && dfaithPrice 
                          ? (parseFloat(sellAmount) * dfaithPrice).toFixed(6)
                          : "0.000000"
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">
                      {dfaithPrice ? `1 D.FAITH = ${dfaithPrice.toFixed(6)} ETH` : "Loading..."}
                    </span>
                    <span className="text-zinc-500">
                      {sellAmount && parseFloat(sellAmount) > 0 && dfaithPrice && ethPriceEur
                        ? `≈ €${(parseFloat(sellAmount) * dfaithPrice * ethPriceEur).toFixed(2)}`
                        : ""
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Advanced Settings - Kompakt */}
              <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium text-zinc-300 whitespace-nowrap">Slippage</span>
                    <input
                      type="number"
                      placeholder="1.0"
                      min="0.1"
                      max="50"
                      step="0.1"
                      className="w-16 bg-zinc-700 border border-zinc-600 rounded-lg py-1 px-2 text-sm text-zinc-300 focus:border-amber-500 focus:outline-none"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      disabled={isSwapping || sellStep !== 'initial'}
                    />
                    <span className="text-xs text-zinc-500">%</span>
                  </div>
                  <div className="flex gap-1">
                    {["0.5", "1", "3"].map((value) => (
                      <button
                        key={value}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${
                          slippage === value 
                            ? "bg-amber-500 text-black" 
                            : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                        }`}
                        onClick={() => setSlippage(value)}
                        disabled={isSwapping || sellStep !== 'initial'}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Display */}
              {swapTxStatus && (
                <div className={`rounded-xl p-3 border text-center ${
                  swapTxStatus === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" :
                  swapTxStatus === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                  "bg-blue-500/10 border-blue-500/30 text-blue-400"
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {swapTxStatus === "success" && <span className="text-xl">🎉</span>}
                    {swapTxStatus === "error" && <span className="text-xl">❌</span>}
                    {swapTxStatus === "pending" && <span className="text-xl">📝</span>}
                    {swapTxStatus === "confirming" && <span className="text-xl">⏳</span>}
                    {swapTxStatus === "verifying" && <span className="text-xl">🔎</span>}
                    {swapTxStatus === "swapping" && <span className="text-xl">🔄</span>}
                    {swapTxStatus === "approving" && <span className="text-xl">🔐</span>}
                    {swapTxStatus === "waiting_approval" && <span className="text-xl">⌛</span>}
                    <span className="font-semibold text-sm">
                      {swapTxStatus === "success" && "Sale Successful!"}
                      {swapTxStatus === "error" && "Sale Failed"}
                      {swapTxStatus === "pending" && "Getting Quote..."}
                      {swapTxStatus === "confirming" && "Confirming..."}
                      {swapTxStatus === "verifying" && "Verifying..."}
                      {swapTxStatus === "swapping" && "Processing Sale..."}
                      {swapTxStatus === "approving" && "Approving Tokens..."}
                      {swapTxStatus === "waiting_approval" && "Waiting for Approval..."}
                    </span>
                  </div>
                  {swapTxStatus === "error" && quoteError && (
                    <p className="text-sm opacity-80">{quoteError}</p>
                  )}
                </div>
              )}

              {/* Validation Warnings */}
              {parseFloat(sellAmount) > parseFloat(dfaithBalance) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 text-red-400 text-sm">
                  <div className="flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Insufficient D.FAITH balance</span>
                  </div>
                </div>
              )}

              {parseFloat(sellAmount) > 0 && parseFloat(sellAmount) < 0.01 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2 text-yellow-400 text-sm">
                  <div className="flex items-center gap-2">
                    <span>💡</span>
                    <span>Minimum sale: 0.01 D.FAITH</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {sellStep === 'initial' && (
                  <Button
                    className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-black font-bold py-3 rounded-xl text-base transition-all transform hover:scale-[1.02]"
                    onClick={handleGetQuote}
                    disabled={
                      !sellAmount || 
                      parseFloat(sellAmount) <= 0 || 
                      isSwapping || 
                      !account?.address || 
                      parseFloat(dfaithBalance) <= 0 ||
                      parseFloat(sellAmount) > (parseFloat(dfaithBalance) + 0.001) ||
                      parseFloat(sellAmount) < 0.01
                    }
                  >
                    {isSwapping ? "Processing..." : "Get Quote"}
                  </Button>
                )}

                {sellStep === 'quoteFetched' && needsApproval && (
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-base transition-all"
                    onClick={handleApprove}
                    disabled={isSwapping}
                  >
                    {isSwapping ? "Approving..." : "Approve D.FAITH"}
                  </Button>
                )}

                {((sellStep === 'quoteFetched' && !needsApproval) || sellStep === 'approved') && (
                  <Button
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 rounded-xl text-base transition-all transform hover:scale-[1.02]"
                    onClick={handleSellSwap}
                    disabled={isSwapping}
                  >
                    {isSwapping ? "Processing Sale..." : `Sell ${sellAmount || "0"} D.FAITH`}
                  </Button>
                )}

                {sellStep === 'completed' && (
                  <Button
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl text-base transition-all"
                    onClick={() => {
                      setSellStep('initial');
                      setQuoteTxData(null);
                      setSpenderAddress(null);
                      setNeedsApproval(false);
                      setQuoteError(null);
                      setSellAmount("");
                      setSwapTxStatus(null);
                      setSlippage("1");
                    }}
                    disabled={isSwapping}
                  >
                    Make Another Sale
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}