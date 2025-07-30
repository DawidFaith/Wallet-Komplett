import { useState, useEffect } from "react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";

// Smart Contract Setup
const CONTRACT_ADDRESS = "0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940";
const REWARD_TOKEN_ADDRESS = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1"; // D.FAITH
const DFAITH_DECIMALS = 2;

const client = createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID! });

export default function TokenomicsTab() {
  const [contractBalance, setContractBalance] = useState<number | null>(null);
  const [totalStaked, setTotalStaked] = useState<number | null>(null);
  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [currentRewardRate, setCurrentRewardRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Preis-Daten für D.FAITH
  const [priceData, setPriceData] = useState<{
    price: number | null;
    priceChange24h: number | null;
  }>({
    price: null,
    priceChange24h: null
  });

  // Smart Contract Daten abrufen
  useEffect(() => {
    const fetchContractData = async () => {
      setLoading(true);
      try {
        const staking = getContract({
          client,
          chain: base,
          address: CONTRACT_ADDRESS,
        });

        const rewardToken = getContract({
          client,
          chain: base,
          address: REWARD_TOKEN_ADDRESS,
        });

        // Preis-Daten mit Paraswap API abrufen
        const fetchPriceData = async () => {
          try {
            // Hole EUR-Preis von CoinGecko für USDC (als EUR-Referenz)
            const eurResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur');
            const eurData = await eurResponse.json();
            const usdcEur = eurData['usd-coin']?.eur || 0.92; // Fallback zu ~0.92 EUR pro USDC
            
            // Hole D.FAITH/USDC Rate von Paraswap (1 D.FAITH = ? USDC)
            const paraswapResponse = await fetch(`https://apiv5.paraswap.io/prices/?srcToken=0x69eFD833288605f320d77eB2aB99DDE62919BbC1&destToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=${Math.pow(10, DFAITH_DECIMALS)}&srcDecimals=${DFAITH_DECIMALS}&destDecimals=6&side=SELL&network=8453`);
            const paraswapData = await paraswapResponse.json();
            
            console.log('Paraswap Response:', paraswapData);
            
            if (paraswapData.priceRoute?.destAmount) {
              // Konvertierung: destAmount ist in USDC (6 Decimals)
              const usdcPerDfaith = Number(paraswapData.priceRoute.destAmount) / Math.pow(10, 6);
              const dfaithPriceEur = usdcPerDfaith * usdcEur;
              
              console.log('D.FAITH Preis berechnet (Paraswap):', { 
                usdcPerDfaith, 
                usdcEur, 
                dfaithPriceEur,
                destAmount: paraswapData.priceRoute.destAmount 
              });
              
              setPriceData({
                price: dfaithPriceEur,
                priceChange24h: null // TODO: 24h Change implementieren
              });
            } else {
              console.log('Paraswap: Keine priceRoute.destAmount gefunden');
              setPriceData({
                price: null,
                priceChange24h: null
              });
            }
          } catch (error) {
            console.error("Error fetching price data:", error);
            setPriceData({
              price: null,
              priceChange24h: null
            });
          }
        };

        // Contract calls (wie im StakeTab)
        const [
          totalStakedResult,
          totalRewardsResult,
          currentStageResult,
          contractBalanceResult
        ] = await Promise.all([
          readContract({
            contract: staking,
            method: "function totalStaked() view returns (uint256)",
            params: []
          }).catch(() => "0"),
          readContract({
            contract: staking,
            method: "function totalRewardsDistributed() view returns (uint256)",
            params: []
          }).catch(() => "0"),
          readContract({
            contract: staking,
            method: "function getCurrentStage() view returns (uint8)",
            params: []
          }).catch(() => "1"),
          readContract({
            contract: rewardToken,
            method: "function balanceOf(address) view returns (uint256)",
            params: [CONTRACT_ADDRESS]
          }).catch(() => "0"),
          fetchPriceData() // Preis-Daten parallel laden
        ]);

        // Daten setzen (D.FAITH hat 2 Decimals, wie im StakeTab)
        setTotalStaked(Number(totalStakedResult)); // D.INVEST hat 0 Decimals
        setContractBalance(Number(contractBalanceResult) / Math.pow(10, DFAITH_DECIMALS)); // D.FAITH: 2 Decimals
        setCurrentStage(Number(currentStageResult));
        setTotalRewardsDistributed(Number(totalRewardsResult) / Math.pow(10, DFAITH_DECIMALS)); // D.FAITH: 2 Decimals

        console.log("Contract Data (TokenomicsTab):", {
          totalStaked: Number(totalStakedResult),
          contractBalance: Number(contractBalanceResult) / Math.pow(10, DFAITH_DECIMALS),
          currentStage: Number(currentStageResult),
          totalRewards: Number(totalRewardsResult) / Math.pow(10, DFAITH_DECIMALS)
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching contract data:", error);
        // Fallback zu Dummy-Daten bei Fehlern
        setContractBalance(0);
        setTotalStaked(0);
        setTotalRewardsDistributed(0);
        setCurrentStage(1);
        setCurrentRewardRate(10);
        setLoading(false);
      }
    };

    fetchContractData();
    
    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(fetchContractData, 30000);
    return () => clearInterval(interval);
  }, []);

  const liquiditySupply = 15000;
  const davidSupply = 5000;
  const totalSupply = 100000;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          Tokenomics Übersicht
        </h2>
        <p className="text-zinc-400 text-sm">
          Ausführliche Informationen zu den D.FAITH und D.INVEST Token
        </p>
      </div>

      {/* Preis-Chart (nur DexScreener) */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          📈 Live-Preis-Chart
        </h3>
        <div className="w-full h-96 rounded-lg overflow-hidden bg-zinc-800">
          <iframe
            src="https://dexscreener.com/base/0x7109214bafde13a6ef8060644656464bccab93cd?embed=1&theme=dark&trades=0&info=0"
            width="100%"
            height="100%"
            frameBorder="0"
            className="w-full h-full"
            title="DexScreener Chart"
          />
        </div>
        <div className="mt-4 text-xs text-zinc-400 text-center">
          Live-Daten von der Base Chain • Pool: 0x7109214bafde13a6ef8060644656464bccab93cd
          <span className="ml-2 text-green-400">• DexScreener: Speziell für DEX-Trading optimiert</span>
        </div>
      </div>

      {/* D.FAITH Token Box */}
      <div className="bg-zinc-900 rounded-xl border border-amber-500/30 p-6">
        <div className="flex items-center gap-4 mb-4">
          <img src="/D.FAITH.png" alt="D.FAITH" className="w-16 h-16 object-contain" />
          <div>
            <h3 className="text-2xl font-bold text-amber-400">D.FAITH</h3>
            <p className="text-zinc-400 text-sm">Dawid Faith Token</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
            <h4 className="font-semibold text-amber-300 mb-3">📊 Token Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-400">Token Name:</span>
                <div className="text-white font-semibold">Dawid Faith</div>
              </div>
              <div>
                <span className="text-zinc-400">Symbol:</span>
                <div className="text-white font-semibold">D.FAITH</div>
              </div>
              <div>
                <span className="text-zinc-400">Total Supply:</span>
                <div className="text-white font-semibold">{totalSupply.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-zinc-400">Live Preis:</span>
                <div className="flex items-center gap-2">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-16 rounded"></div>
                  ) : (
                    <>
                      <span className="text-green-400 font-semibold">
                        €{priceData.price && !isNaN(priceData.price) ? priceData.price.toFixed(4) : "Lädt..."}
                      </span>
                      {priceData.priceChange24h !== null && !isNaN(priceData.priceChange24h) && (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          priceData.priceChange24h >= 0 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {priceData.priceChange24h >= 0 ? '+' : ''}{priceData.priceChange24h.toFixed(2)}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Adresse:</span>
                <div className="text-blue-400 font-mono text-xs break-all">0x69eF...BbC1</div>
                <a href="https://basescan.org/address/0x69eFD833288605f320d77eB2aB99DDE62919BbC1#code" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs">Vollständige Adresse</a>
              </div>
              <div>
                <span className="text-zinc-400">Contract Status:</span>
                <div className="text-green-400 font-semibold">Live & Aktiv</div>
              </div>
            </div>
          </div>

          {/* Supply Distribution */}
          <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
            <h4 className="font-semibold text-amber-300 mb-3">🔄 Supply Verteilung</h4>
            <div className="space-y-3">
              {/* Smart Contract */}
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-zinc-300">Smart Contract (Rewards)</span>
                </div>
                <div className="text-right">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-16 rounded"></div>
                  ) : (
                    <>
                      <div className="text-blue-400 font-bold">{contractBalance?.toFixed(2) || "0.00"}</div>
                      <div className="text-xs text-zinc-500">{contractBalance ? `${((contractBalance / totalSupply) * 100).toFixed(1)}%` : ""}</div>
                    </>
                  )}
                </div>
              </div>

              {/* DEX Liquidity */}
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-zinc-300">DEX Liquidity</span>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">{liquiditySupply.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">{((liquiditySupply / totalSupply) * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Dawid Faith Holdings */}
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-zinc-300">Dawid Faith</span>
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-bold">{davidSupply.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">{((davidSupply / totalSupply) * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${contractBalance ? (contractBalance / totalSupply) * 100 : 0}%` }}
                    ></div>
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${(liquiditySupply / totalSupply) * 100}%` }}
                    ></div>
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: `${(davidSupply / totalSupply) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 mt-1 text-center">
                  Live Blockchain Daten • Aktualisiert alle 30 Sekunden
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* D.INVEST Token Box */}
      <div className="bg-zinc-900 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center gap-4 mb-4">
          <img src="/D.INVEST.png" alt="D.INVEST" className="w-16 h-16 object-contain" />
          <div>
            <h3 className="text-2xl font-bold text-blue-400">D.INVEST</h3>
            <p className="text-zinc-400 text-sm">Investment- & Staking-Token</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <h4 className="font-semibold text-blue-300 mb-3">📊 Token Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-400">Token Name:</span>
                <div className="text-white font-semibold">D.INVEST</div>
              </div>
              <div>
                <span className="text-zinc-400">Symbol:</span>
                <div className="text-white font-semibold">D.INVEST</div>
              </div>
              <div>
                <span className="text-zinc-400">Supply:</span>
                <div className="text-white font-semibold">10.000</div>
              </div>
              <div>
                <span className="text-zinc-400">Adresse:</span>
                <div className="text-blue-400 font-mono text-xs break-all">0x6F1f...F4bb</div>
                <a href="https://basescan.org/address/0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb#code" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs">Vollständige Adresse</a>
              </div>
              <div>
                <span className="text-zinc-400">Preis:</span>
                <div className="text-blue-400 font-semibold">5€ pro Token</div>
              </div>
              <div>
                <span className="text-zinc-400">Min. Kaufbetrag:</span>
                <div className="text-white font-semibold">5€</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Contract Details */}
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <span className="text-2xl">📜</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-purple-400">Smart Contract</h3>
            <p className="text-zinc-400 text-sm">Staking & Rewards Contract</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
            <h4 className="font-semibold text-purple-300 mb-3">🔗 Contract Info</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-400">Contract Name:</span>
                <div className="text-white font-semibold">Staking Contract</div>
              </div>
              <div>
                <span className="text-zinc-400">Netzwerk:</span>
                <div className="text-white font-semibold">Base Chain</div>
              </div>
              <div>
                <span className="text-zinc-400">Compiler:</span>
                <div className="text-white font-semibold">Solidity ^0.8.0</div>
              </div>
              <div>
                <span className="text-zinc-400">Status:</span>
                <div className="text-green-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Verifiziert & Aktiv
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-400">Contract Adresse:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-purple-400 font-mono text-xs break-all">0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940</div>
                  <a 
                    href="https://basescan.org/address/0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940#code" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-2 py-1 rounded text-xs transition-colors duration-200 flex items-center gap-1"
                  >
                    <span>🔍</span>
                    Basescan
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
            <h4 className="font-semibold text-purple-300 mb-4">📈 Live Contract Statistiken</h4>
            
            {/* Kompakte 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">💰 Rewards Pool</span>
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-16 rounded"></div>
                  ) : (
                    <span className="text-green-400 font-bold text-sm">{contractBalance?.toFixed(2) || "0.00"}</span>
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">🔒 Gestaked</span>
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-12 rounded"></div>
                  ) : (
                    <span className="text-blue-400 font-bold text-sm">{totalStaked?.toLocaleString() || "0"}</span>
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">📤 Verteilt</span>
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-16 rounded"></div>
                  ) : (
                    <span className="text-yellow-400 font-bold text-sm">{totalRewardsDistributed?.toFixed(2) || "0.00"}</span>
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">⚡ Stage</span>
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-8 rounded"></div>
                  ) : (
                    <span className="text-purple-400 font-bold text-sm">{currentStage || 1}/6</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Kompakte Progress Bar */}
            <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400 text-xs font-medium">Stage {currentStage || 1} Progress</span>
                <span className="text-zinc-500 text-xs">
                  {totalRewardsDistributed?.toFixed(0) || 0} / {currentStage === 1 ? "10K" : currentStage === 2 ? "20K" : currentStage === 3 ? "40K" : currentStage === 4 ? "60K" : currentStage === 5 ? "80K" : "∞"}
                </span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${totalRewardsDistributed && currentStage ? 
                      Math.min((totalRewardsDistributed / (currentStage === 1 ? 10000 : currentStage === 2 ? 20000 : currentStage === 3 ? 40000 : currentStage === 4 ? 60000 : currentStage === 5 ? 80000 : 100000)) * 100, 100) : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div className="text-xs text-zinc-500 mt-3 text-center flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Live • Aktualisiert alle 30s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}