import { useState, useEffect } from "react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";

// Smart Contract Setup
const CONTRACT_ADDRESS = "0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940";
const REWARD_TOKEN_ADDRESS = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1"; // D.FAITH
const DFAITH_DECIMALS = 2;

const client = createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID! });

interface TokenMetrics {
  supply: {
    total: number;
    circulating: number;
  };
  marketCap: {
    circulating: number;
    fdv: number;
  };
  marketCapEUR: {
    circulating: number;
    fdv: number;
  };
  priceEUR: number;
  balances: {
    tokenInPool: number;
    quoteInPool: number;
  };
}

interface WalletBalance {
  balance: string;
  balanceRaw: string;
  timestamp: string;
}

export default function TokenomicsTab() {
  const [contractBalance, setContractBalance] = useState<number | null>(null);
  const [totalStaked, setTotalStaked] = useState<number | null>(null);
  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // API-Daten
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [davidBalance, setDavidBalance] = useState<WalletBalance | null>(null);
  const [dinvestBalance, setDinvestBalance] = useState<any | null>(null);

  // Daten von APIs abrufen
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      console.log("🔄 Fetching tokenomics data...");
      
      try {
        // Parallele API-Aufrufe mit lokalen Proxy-Routes
        const [metricsRes, davidRes, dinvestRes] = await Promise.all([
          fetch('/api/tokenomics/metrics')
            .catch(err => {
              console.error("❌ Metrics API Error:", err);
              return null;
            }),
          fetch('/api/tokenomics/dfaith-balance')
            .catch(err => {
              console.error("❌ D.FAITH API Error:", err);
              return null;
            }),
          fetch('/api/tokenomics/dinvest-balance')
            .catch(err => {
              console.error("❌ D.INVEST API Error:", err);
              return null;
            })
        ]);

        // Token Metrics verarbeiten
        if (metricsRes && metricsRes.ok) {
          const metricsData = await metricsRes.json();
          console.log("✅ Metrics Data:", metricsData);
          setTokenMetrics(metricsData);
        } else {
          console.log("❌ Metrics API failed or not ok");
        }

        // Dawid Faith Balance verarbeiten
        if (davidRes && davidRes.ok) {
          const davidData = await davidRes.json();
          console.log("✅ David Balance Data:", davidData);
          if (davidData.success) {
            setDavidBalance(davidData.data);
          }
        } else {
          console.log("❌ David Balance API failed or not ok");
        }

        // D.INVEST Balance verarbeiten
        if (dinvestRes && dinvestRes.ok) {
          const dinvestData = await dinvestRes.json();
          console.log("✅ D.INVEST Data:", dinvestData);
          if (dinvestData.success) {
            setDinvestBalance(dinvestData.data);
          }
        } else {
          console.log("❌ D.INVEST API failed or not ok");
        }

        // Smart Contract Daten abrufen
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
          }).catch(() => "0")
        ]);

        setTotalStaked(Number(totalStakedResult));
        setContractBalance(Number(contractBalanceResult) / Math.pow(10, DFAITH_DECIMALS));
        setCurrentStage(Number(currentStageResult));
        setTotalRewardsDistributed(Number(totalRewardsResult) / Math.pow(10, DFAITH_DECIMALS));

        console.log("✅ Smart Contract Data:", {
          totalStaked: Number(totalStakedResult),
          contractBalance: Number(contractBalanceResult) / Math.pow(10, DFAITH_DECIMALS),
          currentStage: Number(currentStageResult),
          totalRewards: Number(totalRewardsResult) / Math.pow(10, DFAITH_DECIMALS)
        });

      } catch (error) {
        console.error("❌ Error fetching data:", error);
      } finally {
        setLoading(false);
        console.log("🏁 Loading complete");
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Berechnungen mit nur echten API-Daten
  const totalSupply = tokenMetrics?.supply?.total || 0;
  const davidBalanceNum = parseFloat(davidBalance?.balanceRaw || "0");
  const stakingTokens = contractBalance || 0;
  const poolTokens = tokenMetrics?.balances?.tokenInPool || 0;
  
  // Zirkulierende Supply = Total Supply - Staking Rewards - Dawid Faith Holdings
  const circulatingSupply = totalSupply - stakingTokens - davidBalanceNum;
  
  const davidPercentage = totalSupply > 0 ? (davidBalanceNum / totalSupply) * 100 : 0;
  const targetPercentage = 50;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          D.FAITH Tokenomics Dashboard
        </h2>
        <p className="text-zinc-400 text-sm">
          Live Blockchain-Daten • Marktkapitalisierung • Token-Verteilung
        </p>
      </div>

      {/* Dawid Faith Holdings & Ziel */}
      <div className="bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-500/30 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">👑</span>
          <div>
            <h3 className="text-amber-400 font-bold text-lg">Dawid Faith Holdings</h3>
            <p className="text-amber-300 text-sm">Langfristiges Ziel: 50% | Quartalsweise Käufe aus Musikeinnahmen</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Aktueller Stand */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-amber-400 font-semibold">Aktueller Besitz</span>
              <span className="text-white font-bold text-xl">{davidPercentage.toFixed(1)}% / 50%</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden mb-2">
              <div className="h-full flex">
                <div
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 h-full transition-all duration-1000"
                  style={{ width: `${(davidPercentage / targetPercentage) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="text-amber-300 text-sm">
              {davidBalanceNum?.toLocaleString() || "0"} Token • Noch {(targetPercentage - davidPercentage).toFixed(1)}% bis zum Ziel
            </div>
          </div>
          
          {/* Quartalsweise Käufe Timer */}
          <div>
            <div className="text-amber-400 font-semibold mb-2">Nächster Kauf aus Musikeinnahmen</div>
            <div className="bg-amber-900/30 rounded-lg p-3 border border-amber-500/20">
              <div className="text-white font-bold text-lg mb-1">
                Q{Math.ceil((new Date().getMonth() + 1) / 3)} {new Date().getFullYear()}
              </div>
              <div className="text-amber-300 text-sm">
                {(() => {
                  const now = new Date();
                  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
                  const nextQuarterMonth = currentQuarter * 3;
                  const nextQuarterDate = new Date(now.getFullYear() + (nextQuarterMonth > 12 ? 1 : 0), (nextQuarterMonth - 1) % 12, 1);
                  const daysUntil = Math.ceil((nextQuarterDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return `${daysUntil} Tage bis zum nächsten Quartal`;
                })()}
              </div>
              <div className="text-xs text-amber-400 mt-1">🎵 Finanziert durch Musik-Royalties</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Marktkapitalisierung */}
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💰</span>
            <h3 className="text-green-400 font-bold text-sm">Marktkapitalisierung</h3>
          </div>
          {loading ? (
            <div className="animate-pulse bg-zinc-600 h-6 w-24 rounded mb-1"></div>
          ) : (
            <div className="text-white font-bold text-xl">
              €{tokenMetrics?.marketCapEUR?.circulating?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
            </div>
          )}
          <div className="text-green-300 text-xs">
            FDV: €{tokenMetrics?.marketCapEUR?.fdv?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
          </div>
        </div>

        {/* Token Preis */}
        <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📈</span>
            <h3 className="text-blue-400 font-bold text-sm">Token Preis</h3>
          </div>
          {loading ? (
            <div className="animate-pulse bg-zinc-600 h-6 w-20 rounded mb-1"></div>
          ) : (
            <div className="text-white font-bold text-xl">
              €{tokenMetrics?.priceEUR?.toFixed(4) || "0.0000"}
            </div>
          )}
          <div className="text-blue-300 text-xs">Live DEX-Preis</div>
        </div>

        {/* Zirkulierende Supply */}
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔄</span>
            <h3 className="text-purple-400 font-bold text-sm">Zirkulierende Supply</h3>
          </div>
          {loading ? (
            <div className="animate-pulse bg-zinc-600 h-6 w-20 rounded mb-1"></div>
          ) : (
            <div className="text-white font-bold text-xl">
              {circulatingSupply > 0 ? circulatingSupply.toLocaleString() : "0"}
            </div>
          )}
          <div className="text-purple-300 text-xs">
            von {totalSupply?.toLocaleString() || "0"} Total
          </div>
        </div>

        {/* Dawid Faith Holdings wurde nach oben verschoben */}
      </div>

      {/* Token Distribution Visualization */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          🎯 Token-Verteilung Übersicht
        </h3>
        
        {/* Token Distribution Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* DEX Pool */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-400 font-semibold text-sm">DEX Pool</span>
            </div>
            <div className="text-white font-bold text-lg">{poolTokens.toLocaleString()}</div>
            <div className="text-green-300 text-xs">{((poolTokens / totalSupply) * 100).toFixed(2)}%</div>
          </div>

          {/* Staking Contract */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-blue-400 font-semibold text-sm">Staking Rewards</span>
            </div>
            <div className="text-white font-bold text-lg">{stakingTokens.toLocaleString()}</div>
            <div className="text-blue-300 text-xs">{((stakingTokens / totalSupply) * 100).toFixed(2)}%</div>
          </div>

          {/* Community */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-purple-400 font-semibold text-sm">Zirkulierend</span>
            </div>
            <div className="text-white font-bold text-lg">
              {circulatingSupply > 0 ? circulatingSupply.toLocaleString() : "0"}
            </div>
            <div className="text-purple-300 text-xs">
              {totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(2) : "0"}%
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-6">
          <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${davidPercentage}%` }}
                title={`Dawid Faith: ${davidPercentage.toFixed(1)}%`}
              ></div>
              <div
                className="bg-green-500 h-full"
                style={{ width: `${(poolTokens / totalSupply) * 100}%` }}
                title={`DEX Pool: ${((poolTokens / totalSupply) * 100).toFixed(1)}%`}
              ></div>
              <div
                className="bg-blue-500 h-full"
                style={{ width: `${(stakingTokens / totalSupply) * 100}%` }}
                title={`Staking: ${((stakingTokens / totalSupply) * 100).toFixed(1)}%`}
              ></div>
              <div
                className="bg-purple-500 h-full"
                style={{ width: `${totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 0}%` }}
                title={`Zirkulierend: ${totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(1) : "0"}%`}
              ></div>
            </div>
          </div>
          <div className="text-xs text-zinc-400 mt-2 text-center">
            Live Token-Verteilung • Aktualisiert alle 30 Sekunden
          </div>
        </div>
      </div>

      {/* D.INVEST Section */}
      <div className="bg-zinc-900 rounded-xl border border-blue-500/30 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <img src="/D.INVEST.png" alt="D.INVEST" className="w-12 h-12 object-contain" />
          <div>
            <h3 className="text-xl font-bold text-blue-400">D.INVEST Token</h3>
            <p className="text-zinc-400 text-sm">Investment- & Staking-Token</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <h4 className="text-blue-300 font-semibold mb-2">Total Supply</h4>
            <div className="text-white font-bold text-2xl">10,000</div>
            <div className="text-blue-400 text-sm">D.INVEST Token</div>
          </div>
          
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <h4 className="text-blue-300 font-semibold mb-2">Community Owned</h4>
            {loading ? (
              <div className="animate-pulse bg-zinc-600 h-8 w-16 rounded"></div>
            ) : (
              <>
                <div className="text-white font-bold text-2xl">
                  {dinvestBalance ? (10000 - parseInt(dinvestBalance.balance)).toLocaleString() : "0"}
                </div>
                <div className="text-blue-400 text-sm">
                  {dinvestBalance ? (((10000 - parseInt(dinvestBalance.balance)) / 10000) * 100).toFixed(1) : "0"}% verkauft
                </div>
              </>
            )}
          </div>
          
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <h4 className="text-blue-300 font-semibold mb-2">Verfügbar</h4>
            {loading ? (
              <div className="animate-pulse bg-zinc-600 h-8 w-16 rounded"></div>
            ) : (
              <>
                <div className="text-white font-bold text-2xl">
                  {dinvestBalance ? parseInt(dinvestBalance.balance).toLocaleString() : "0"}
                </div>
                <div className="text-blue-400 text-sm">5€ pro Token</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Staking Stats */}
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 p-6 mb-6">
        <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
          📊 Staking Statistiken
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
            <div className="text-purple-300 text-xs font-medium mb-1">Rewards Pool</div>
            <div className="text-white font-bold text-lg">
              {loading ? "..." : stakingTokens.toFixed(2)}
            </div>
            <div className="text-purple-400 text-xs">D.FAITH</div>
          </div>
          
          <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
            <div className="text-purple-300 text-xs font-medium mb-1">Total Gestaked</div>
            <div className="text-white font-bold text-lg">
              {loading ? "..." : totalStaked?.toLocaleString() || "0"}
            </div>
            <div className="text-purple-400 text-xs">D.INVEST</div>
          </div>
          
          <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
            <div className="text-purple-300 text-xs font-medium mb-1">Verteilt</div>
            <div className="text-white font-bold text-lg">
              {loading ? "..." : totalRewardsDistributed?.toFixed(2) || "0"}
            </div>
            <div className="text-purple-400 text-xs">D.FAITH</div>
          </div>
          
          <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
            <div className="text-purple-300 text-xs font-medium mb-1">Current Stage</div>
            <div className="text-white font-bold text-lg">
              {loading ? "..." : `${currentStage || 1}/6`}
            </div>
            <div className="text-purple-400 text-xs">Reward Stage</div>
          </div>
        </div>
      </div>

      {/* Live-Preis-Chart */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
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
    </div>
  );
}
