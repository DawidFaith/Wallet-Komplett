import { useState, useEffect } from "react";

// Smart Contract Setup
const CONTRACT_ADDRESS = "0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940";
const REWARD_TOKEN_ADDRESS = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1"; // D.FAITH

export default function TokenomicsTab() {
  const [contractBalance, setContractBalance] = useState<number | null>(null);
  const [totalStaked, setTotalStaked] = useState<number | null>(null);
  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [currentRewardRate, setCurrentRewardRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Smart Contract Daten über RPC abrufen
  useEffect(() => {
    const fetchContractData = async () => {
      setLoading(true);
      try {
        const RPC_URL = "https://mainnet.base.org";
        
        // Helper function für RPC calls
        const callContract = async (to: string, data: string) => {
          const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [
                {
                  to: to,
                  data: data
                },
                'latest'
              ],
              id: 1
            })
          });
          
          const result = await response.json();
          return result.result;
        };

        // Function selectors für Contract calls
        const totalStakedSelector = "0x817b1cd2"; // totalStaked()
        const totalRewardsDistributedSelector = "0x91040b2b"; // totalRewardsDistributed()
        const getCurrentStageSelector = "0x0f644e70"; // getCurrentStage()
        const getCurrentRewardRateSelector = "0x49bb6f94"; // getCurrentRewardRate()
        const balanceOfSelector = "0x70a08231"; // balanceOf(address)

        // Contract calls ausführen
        const [
          totalStakedHex,
          totalRewardsHex, 
          currentStageHex,
          rewardRateHex,
          balanceHex
        ] = await Promise.all([
          callContract(CONTRACT_ADDRESS, totalStakedSelector),
          callContract(CONTRACT_ADDRESS, totalRewardsDistributedSelector),
          callContract(CONTRACT_ADDRESS, getCurrentStageSelector),
          callContract(CONTRACT_ADDRESS, getCurrentRewardRateSelector),
          callContract(REWARD_TOKEN_ADDRESS, balanceOfSelector + CONTRACT_ADDRESS.slice(2).padStart(64, '0'))
        ]);

        // Hex zu Number konvertieren
        const totalStakedAmount = parseInt(totalStakedHex, 16);
        const totalRewards = parseInt(totalRewardsHex, 16);
        const stage = parseInt(currentStageHex, 16);
        const rewardRate = parseInt(rewardRateHex, 16);
        const balance = parseInt(balanceHex, 16);

        // Daten setzen (D.FAITH hat 2 Decimals)
        setTotalStaked(totalStakedAmount); // D.INVEST hat 0 Decimals
        setContractBalance(Math.floor(balance / 100)); // D.FAITH: 2 Decimals -> ganze Token
        setCurrentStage(stage);
        setCurrentRewardRate(rewardRate / 100); // Rate in Prozent
        setTotalRewardsDistributed(Math.floor(totalRewards / 100)); // D.FAITH: 2 Decimals

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
                      <div className="text-blue-400 font-bold">{contractBalance?.toLocaleString() || "..."}</div>
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
            <h4 className="font-semibold text-purple-300 mb-3">📈 Live Contract Statistiken</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-zinc-800/40 rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Verfügbare Rewards:</span>
                <div className="text-green-400 font-bold text-lg">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-5 w-24 rounded"></div>
                  ) : (
                    `${contractBalance?.toLocaleString() || "..."} D.FAITH`
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800/40 rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Gestakte D.INVEST:</span>
                <div className="text-blue-400 font-bold text-lg">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-5 w-16 rounded"></div>
                  ) : (
                    `${totalStaked?.toLocaleString() || "..."}`
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800/40 rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Verteilte Rewards:</span>
                <div className="text-yellow-400 font-bold text-lg">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-5 w-20 rounded"></div>
                  ) : (
                    `${totalRewardsDistributed?.toLocaleString() || "..."} D.FAITH`
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-800/40 rounded-lg p-3">
                <span className="text-zinc-400 block mb-1">Aktuelle APR:</span>
                <div className="text-purple-400 font-bold text-lg flex items-center gap-2">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-5 w-16 rounded"></div>
                  ) : (
                    <>
                      <span>{currentRewardRate || "..."}% pro Woche</span>
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Stage {currentStage || 1}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Reward Progression Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500 mb-2">
                <span>Reward Progression (Stage {currentStage || 1})</span>
                <span>{totalRewardsDistributed || 0} / {currentStage === 1 ? "10,000" : currentStage === 2 ? "20,000" : currentStage === 3 ? "40,000" : currentStage === 4 ? "60,000" : currentStage === 5 ? "80,000" : "∞"} D.FAITH</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500"
                  style={{ 
                    width: `${totalRewardsDistributed && currentStage ? 
                      Math.min((totalRewardsDistributed / (currentStage === 1 ? 10000 : currentStage === 2 ? 20000 : currentStage === 3 ? 40000 : currentStage === 4 ? 60000 : currentStage === 5 ? 80000 : 100000)) * 100, 100) : 0}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-zinc-500 mt-1 text-center">
                Live Blockchain Daten • Aktualisiert alle 30 Sekunden
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}