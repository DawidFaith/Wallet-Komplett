import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { FaPaperPlane, FaLock, FaCoins, FaEthereum, FaExchangeAlt, FaWallet, FaTimes, FaQrcode } from "react-icons/fa";
import { useActiveAccount, useSendTransaction, useWalletBalance, useReadContract } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { getContract, prepareContractCall } from "thirdweb";
import { client } from "../../client";
import QRScanner from "../../components/QRScanner";

// Token Adressen
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DFAITH_DECIMALS = 2;
const DINVEST_TOKEN = "0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb";
const DINVEST_DECIMALS = 0;
const ETH_DECIMALS = 18;

// Modal Komponente für Token Transfer (mit echter Transaktion und Bestätigung)
function TokenTransferModal({ 
  isOpen, 
  onClose, 
  token, 
  onSend, 
  showSuccess, 
  onSuccessClose 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  token: any | null,
  onSend: (amount: string, address: string) => Promise<boolean>,
  showSuccess: boolean,
  onSuccessClose: () => void
}) {
  const [sendAmount, setSendAmount] = useState("");
  const [sendToAddress, setSendToAddress] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSendAmount("");
      setSendToAddress("");
      setTxError(null);
      setShowQRScanner(false);
    }
  }, [isOpen]);

  if (!isOpen || !token) return null;

  const handleSend = async () => {
    if (!sendAmount || !sendToAddress) return;
    setIsSending(true);
    setTxError(null);
    try {
      const ok = await onSend(sendAmount, sendToAddress);
      if (!ok) {
        setTxError("Transaktion fehlgeschlagen");
        setIsSending(false);
        return;
      }
      setSendAmount("");
      setSendToAddress("");
    } catch (error: any) {
      setTxError(error?.message || "Fehler beim Senden");
    } finally {
      setIsSending(false);
    }
  };

  const handleMax = () => {
    setSendAmount(token.balance.replace(",", "."));
  };

  const handleQRScan = (scannedAddress: string) => {
    setSendToAddress(scannedAddress);
    setShowQRScanner(false);
  };

  const isAmountValid = sendAmount && 
    parseFloat(sendAmount) > 0 && 
    parseFloat(sendAmount) <= parseFloat(token.balance.replace(",", "."));

  // Success Modal
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto p-4 pt-20">
        <div className="bg-zinc-900 rounded-xl p-6 max-w-sm w-full border border-green-500 my-4">
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-green-400 text-xl font-bold mb-2">Token gesendet!</div>
            <div className="text-zinc-300 text-sm mb-4">Deine Transaktion wurde erfolgreich abgeschickt.</div>
            <Button 
              className="w-full bg-gradient-to-r from-green-400 to-green-600 text-black font-bold py-3 rounded-xl" 
              onClick={onSuccessClose}
            >
              Schließen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto p-4 pt-20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 rounded-xl p-3 sm:p-6 max-w-sm w-full border border-amber-400 max-h-[85vh] overflow-y-auto my-4 relative">
        {/* Header */}
        <div className="flex items-center justify-end mb-2">
          <button 
            className="p-2 text-amber-400 hover:text-yellow-300 hover:bg-zinc-800 rounded-lg transition-all flex-shrink-0"
            onClick={onClose}
            disabled={isSending}
          >
            <span className="text-lg">✕</span>
          </button>
        </div>
        
        {/* Modal Header */}
        <div className="text-center pb-3 border-b border-zinc-700 mb-4">
          <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
            {token.key === 'DFAITH' ? (
              <img src="/D.FAITH.png" alt="D.FAITH" className="w-32 h-32 object-contain" />
            ) : token.key === 'DINVEST' ? (
              <img src="/D.INVEST.png" alt="D.INVEST" className="w-32 h-32 object-contain" />
            ) : (
              <img src="/ETH.png" alt="ETH" className="w-24 h-24 object-contain" />
            )}
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{token.label} senden</h3>
          <p className="text-zinc-400 text-xs">Verfügbar: {token.balance} {token.symbol}</p>
        </div>
        
        {/* Content */}
        <div className="space-y-4">
          {/* Betrag Eingabe */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Betrag</label>
            
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex items-center gap-2 ${
                  token.key === 'DFAITH' ? 'bg-amber-500/20 border-amber-500/30' : 
                  token.key === 'DINVEST' ? 'bg-blue-500/20 border-blue-500/30' : 
                  'bg-purple-500/20 border-purple-500/30'
                } rounded-lg px-2 py-1 border flex-shrink-0`}>
                  {token.key === 'DFAITH' ? (
                    <img src="/D.FAITH.png" alt="D.FAITH" className="w-8 h-8 object-contain" />
                  ) : token.key === 'DINVEST' ? (
                    <img src="/D.INVEST.png" alt="D.INVEST" className="w-8 h-8 object-contain" />
                  ) : (
                    <img src="/ETH.png" alt="ETH" className="w-6 h-6 object-contain" />
                  )}
                  <span className={`${
                    token.key === 'DFAITH' ? 'text-amber-300' : 
                    token.key === 'DINVEST' ? 'text-blue-300' : 
                    'text-purple-300'
                  } font-semibold text-xs`}>{token.symbol}</span>
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step={token.key === "DINVEST" ? "1" : "0.000001"}
                  className={`flex-1 bg-transparent text-lg font-bold placeholder-zinc-500 focus:outline-none min-w-0 text-center ${
                    sendAmount && parseFloat(sendAmount) > parseFloat(token.balance.replace(",", ".")) 
                      ? 'text-red-400' 
                      : 'text-white'
                  }`}
                  value={sendAmount}
                  onChange={e => {
                    let val = e.target.value.replace(",", ".");
                    if (token.key === "DINVEST") val = val.replace(/\..*$/, "");
                    setSendAmount(val);
                  }}
                  disabled={isSending}
                />
                <button
                  className={`${
                    token.key === 'DFAITH' ? 'text-amber-400 hover:text-amber-300' : 
                    token.key === 'DINVEST' ? 'text-blue-400 hover:text-blue-300' : 
                    'text-purple-400 hover:text-purple-300'
                  } font-medium px-2 py-1 rounded flex-shrink-0`}
                  type="button"
                  onClick={handleMax}
                  disabled={isSending}
                >
                  MAX
                </button>
              </div>
              {/* Validation */}
              {sendAmount && parseFloat(sendAmount) > parseFloat(token.balance.replace(",", ".")) && (
                <div className="mt-2 text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Nicht genügend {token.symbol} verfügbar</span>
                </div>
              )}
            </div>
          </div>

          {/* Empfänger Eingabe */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Empfänger</label>
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="0x... oder ENS Name"
                  className="flex-1 bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm font-mono"
                  value={sendToAddress}
                  onChange={e => setSendToAddress(e.target.value)}
                  disabled={isSending}
                />
                <button
                  onClick={() => setShowQRScanner(true)}
                  className="flex-shrink-0 p-2 bg-amber-400/20 text-amber-400 rounded-lg hover:bg-amber-400/30 hover:text-amber-300 transition-all border border-amber-400/30"
                  disabled={isSending}
                  title="QR-Code scannen"
                >
                  <FaQrcode className="text-lg" />
                </button>
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Base Network Adresse
              </div>
            </div>
          </div>

          {/* Transaktionsübersicht - Kompakt */}
          {sendAmount && sendToAddress && isAmountValid && (
            <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-700">
              <h4 className="font-medium text-white mb-2 text-sm">Übersicht</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Betrag:</span>
                  <span className="text-white font-medium">{sendAmount} {token.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">An:</span>
                  <span className={`${
                    token.key === 'DFAITH' ? 'text-amber-400' : 
                    token.key === 'DINVEST' ? 'text-blue-400' : 
                    'text-purple-400'
                  } font-mono`}>
                    {sendToAddress.slice(0, 6)}...{sendToAddress.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Gebühr:</span>
                  <span className="text-zinc-300">~0.001 ETH</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {txError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              <div className="flex items-center gap-2">
                <span>❌</span>
                <span>{txError}</span>
              </div>
            </div>
          )}

          {/* Senden Button */}
          <Button
            className={`w-full py-3 font-bold rounded-xl text-base transition-all ${
              isAmountValid && sendToAddress && !isSending
                ? token.key === 'DFAITH' 
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:from-amber-500 hover:to-yellow-600 transform hover:scale-[1.02]"
                  : token.key === 'DINVEST'
                  ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white hover:from-blue-500 hover:to-blue-700 transform hover:scale-[1.02]"
                  : "bg-gradient-to-r from-purple-400 to-purple-600 text-white hover:from-purple-500 hover:to-purple-700 transform hover:scale-[1.02]"
                : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
            }`}
            onClick={handleSend}
            disabled={!isAmountValid || !sendToAddress || isSending}
          >
            {isSending ? (
              <div className="flex items-center justify-center gap-2">
                <span className="animate-spin">↻</span>
                <span>Wird gesendet...</span>
              </div>
            ) : (
              <span>
                {sendAmount || "0"} {token.symbol} senden
              </span>
            )}
          </Button>

          {/* Sicherheitshinweis - Kompakt */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">⚠️</span>
              <div>
                <p className="text-yellow-200 font-medium mb-1">Sicherheitshinweis</p>
                <p className="text-yellow-100 leading-relaxed">
                  Überprüfe die Empfängeradresse sorgfältig. Transaktionen sind irreversibel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={showQRScanner}
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />
    </div>
  );
}

export default function SendTab() {
  const [selectedToken, setSelectedToken] = useState<any | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();

  // Native ETH Balance mit Thirdweb Hook
  const { data: ethBalanceData } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
  });

  // D.FAITH Balance mit Thirdweb Hook
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

  // D.INVEST Balance mit Thirdweb Hook
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

  // Formatierte Balances berechnen
  const ethBalance = ethBalanceData 
    ? (Number(ethBalanceData.value) / Math.pow(10, ETH_DECIMALS)).toFixed(4)
    : "0.0000";

  const dfaithBalance = dfaithBalanceData 
    ? (Number(dfaithBalanceData) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS)
    : "0.00";

  const dinvestBalance = dinvestBalanceData 
    ? (Number(dinvestBalanceData) / Math.pow(10, DINVEST_DECIMALS)).toString()
    : "0";

  // Hilfsfunktion zum Warten auf Balance-Änderung (vereinfacht)
  const waitForBalanceChange = async (tokenKey: string, oldBalance: string, maxTries = 10) => {
    for (let i = 0; i < maxTries; i++) {
      await new Promise(res => setTimeout(res, 1000));
      // Da Thirdweb Hooks automatisch refetchen, einfach kurz warten
      // Die Hooks werden die neuen Balances automatisch laden
    }
    return true; // Optimistisch annehmen, dass es funktioniert hat
  };

  // Echte Token-Transaktion
  const handleSend = async (amount: string, toAddress: string): Promise<boolean> => {
    if (!amount || !toAddress || !selectedToken || !account?.address) return false;
    try {
      let tx;
      // Vorherige Balance merken
      const oldBalance = selectedToken.balance;
      if (selectedToken.key === "ETH") {
        tx = {
          to: toAddress,
          value: BigInt(Math.floor(parseFloat(amount) * Math.pow(10, ETH_DECIMALS))),
          chain: base,
          client,
        };
        await sendTransaction(tx);
      } else {
        const tokenAddress = selectedToken.key === "DFAITH" ? DFAITH_TOKEN : DINVEST_TOKEN;
        const decimals = selectedToken.key === "DFAITH" ? DFAITH_DECIMALS : DINVEST_DECIMALS;
        const contract = getContract({ client, chain: base, address: tokenAddress });
        const txCall = prepareContractCall({
          contract,
          method: "function transfer(address,uint256) returns (bool)",
          params: [toAddress, BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)))]
        });
        await sendTransaction(txCall);
      }
      // Warte kurz für Balance-Update
      await waitForBalanceChange(selectedToken.key, oldBalance);
      setShowSuccessModal(true);
      return true;
    } catch (error) {
      console.error("Fehler beim Senden:", error);
      return false;
    }
  };

  const handleTokenSelect = (token: any) => {
    setSelectedToken(token);
    setShowTransferModal(true);
    setShowSuccessModal(false);
  };

  // Token-Auswahl Options mit sofort verfügbaren Balances
  const tokenOptions = [
    {
      key: "DFAITH",
      label: "D.FAITH",
      symbol: "D.FAITH",
      balance: dfaithBalance,
      color: "from-transparent to-transparent",
      description: "Dawid Faith Token",
      icon: <img src="/D.FAITH.png" alt="D.FAITH" className="w-12 h-12 object-contain" />,
    },
    { 
      key: "DINVEST", 
      label: "D.INVEST", 
      symbol: "D.INVEST",
      balance: dinvestBalance,
      icon: <img src="/D.INVEST.png" alt="D.INVEST" className="w-10 h-10 object-contain" />,
      color: "from-blue-400 to-blue-600",
      description: "Investment & Staking Token"
    },
    { 
      key: "ETH", 
      label: "Ethereum", 
      symbol: "ETH",
      balance: ethBalance,
      icon: <img src="/ETH.png" alt="ETH" className="w-8 h-8 object-contain" />,
      color: "from-purple-400 to-purple-600",
      description: "Ethereum Native Token"
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          Token senden
        </h2>
      </div>

      {/* Wallet Status */}
      {!account?.address && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center">
          <FaLock className="text-red-400 text-2xl mx-auto mb-2" />
          <p className="text-red-400 font-medium">Wallet nicht verbunden</p>
          <p className="text-red-300 text-sm">Verbinde deine Wallet um Token zu senden</p>
        </div>
      )}

      {account?.address && (
        <>
          {/* Token-Auswahl Grid */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <FaCoins className="text-amber-400" />
              Token auswählen:
            </label>
            <div className="grid gap-3">
              {tokenOptions.map((token) => (
                <div
                  key={token.key}
                  onClick={() => handleTokenSelect(token)}
                  className="relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/70 hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between">
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
                        <p className="text-zinc-300 text-sm font-medium mt-1">
                          {token.balance} {token.symbol}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Transfer Modal */}
      <TokenTransferModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setSelectedToken(null);
        }}
        token={selectedToken}
        onSend={handleSend}
        showSuccess={showSuccessModal}
        onSuccessClose={() => {
          setShowSuccessModal(false);
          setShowTransferModal(false);
          setSelectedToken(null);
        }}
      />
    </div>
  );
}
