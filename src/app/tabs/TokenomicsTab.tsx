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
  const targetPercentage = 75;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header with Waveform Background */}
      <div className="text-center mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-amber-500/20 p-8">
        {/* Animated Waveform Background */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 1200 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path 
              d="M0,100 Q150,50 300,100 T600,100 T900,100 T1200,100" 
              stroke="url(#waveGradient)" 
              strokeWidth="3" 
              fill="none"
              className="animate-pulse"
            />
            <path 
              d="M0,120 Q200,80 400,120 T800,120 T1200,120" 
              stroke="url(#waveGradient)" 
              strokeWidth="2" 
              fill="none"
              className="animate-pulse"
              style={{ animationDelay: '0.5s' }}
            />
            <path 
              d="M0,80 Q100,40 200,80 T400,80 T600,80 T800,80 T1200,80" 
              stroke="url(#waveGradient)" 
              strokeWidth="1" 
              fill="none"
              className="animate-pulse"
              style={{ animationDelay: '1s' }}
            />
          </svg>
        </div>
        
        {/* Header Content */}
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-4xl">🎵</span>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              D.FAITH Tokenomics Dashboard
            </h2>
            <span className="text-4xl">🎵</span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-400">
            <span>🎼</span>
            <span>Powered by Dawid Faith</span>
            <span>🎼</span>
          </div>
        </div>
      </div>

      {/* Dawid Faith Holdings - Minimalistisch */}
      <div className="bg-zinc-900/50 rounded-xl border border-amber-500/20 p-6 mb-6 relative overflow-hidden backdrop-blur-sm">
        {/* Subtle Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/5 to-yellow-900/5"></div>
        
        {/* Header - Kompakt */}
        <div className="relative z-10 mb-6">
          <h3 className="text-xl font-bold text-amber-400 flex items-center gap-3 mb-2">
            👑 Dawid Faith Holdings
          </h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-300">Langfristiges Ziel: 75%</span>
            <span className="text-zinc-400">Quartalsweise Käufe aus Musikeinnahmen</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {/* Progress Section - Minimalistisch */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-amber-400 font-medium text-sm">Aktueller Besitz</span>
              <span className="text-white font-bold">{davidPercentage.toFixed(1)}% / 75%</span>
            </div>
            
            {/* Clean Progress Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-amber-500 h-full transition-all duration-1000 rounded-full"
                style={{ width: `${(davidPercentage / targetPercentage) * 100}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-amber-300">{davidBalanceNum?.toLocaleString() || "0"} Token</span>
              <span className="text-zinc-400">Noch {(targetPercentage - davidPercentage).toFixed(1)}% bis zum Ziel</span>
            </div>
          </div>
          
          {/* Next Purchase Timer - Minimalistisch */}
          <div className="space-y-3">
            <div className="text-amber-400 font-medium text-sm">Nächster Kauf</div>
            
            <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
              <div className="text-white font-bold text-lg mb-1">
                Q{Math.ceil((new Date().getMonth() + 1) / 3)} {new Date().getFullYear()}
              </div>
              <div className="text-amber-300 text-sm mb-2">
                {(() => {
                  const now = new Date();
                  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
                  const nextQuarterMonth = currentQuarter * 3;
                  const nextQuarterDate = new Date(now.getFullYear() + (nextQuarterMonth > 12 ? 1 : 0), (nextQuarterMonth - 1) % 12, 1);
                  const daysUntil = Math.ceil((nextQuarterDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return `${daysUntil} Tage bis zum nächsten Quartal`;
                })()}
              </div>
              <div className="text-xs text-amber-400/80">
                Finanziert durch Musik-Royalties
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Distribution Visualization - ZUERST */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center justify-center gap-2">
          🎯 Token-Verteilung Live Dashboard
        </h3>
        
        {/* Vinyl Record Progress Ring - ZUERST */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Outer ring - Background */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#374151" strokeWidth="8"
              className="opacity-20"
            />
            
            {/* Dawid Faith Section */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#f59e0b" strokeWidth="8"
              strokeDasharray={`${(davidPercentage / 100) * 283} 283`}
              strokeDashoffset="0"
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #f59e0b60)' }}
            />
            
            {/* DEX Pool Section */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#10b981" strokeWidth="8"
              strokeDasharray={`${((poolTokens / totalSupply) * 100 / 100) * 283} 283`}
              strokeDashoffset={`-${(davidPercentage / 100) * 283}`}
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #10b98160)' }}
            />
            
            {/* Staking Section */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#3b82f6" strokeWidth="8"
              strokeDasharray={`${((stakingTokens / totalSupply) * 100 / 100) * 283} 283`}
              strokeDashoffset={`-${((davidPercentage + (poolTokens / totalSupply) * 100) / 100) * 283}`}
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #3b82f660)' }}
            />
            
            {/* Center vinyl hole */}
            <circle
              cx="50" cy="50" r="8"
              fill="#18181b" stroke="#f59e0b" strokeWidth="1"
              className="animate-spin"
              style={{ animationDuration: '8s', animationTimingFunction: 'linear' }}
            />
            
            {/* Vinyl grooves */}
            <circle cx="50" cy="50" r="35" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
            <circle cx="50" cy="50" r="25" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
          </svg>
          
          {/* Center Label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-amber-400 font-bold text-lg">🎵</div>
              <div className="text-white text-xs font-semibold">D.FAITH</div>
              <div className="text-zinc-400 text-xs">Live Data</div>
            </div>
          </div>
        </div>

        {/* Token Distribution Legend - Kompakt nebeneinander */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Dawid Faith */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-amber-400 font-semibold text-xs">Dawid Faith</span>
            </div>
            <div className="text-white font-bold text-sm">{davidBalanceNum.toLocaleString()}</div>
            <div className="text-amber-300 text-xs">{davidPercentage.toFixed(1)}%</div>
          </div>

          {/* DEX Pool */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-400 font-semibold text-xs">DEX Pool</span>
            </div>
            <div className="text-white font-bold text-sm">{poolTokens.toLocaleString()}</div>
            <div className="text-green-300 text-xs">{((poolTokens / totalSupply) * 100).toFixed(1)}%</div>
          </div>

          {/* Staking Contract */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-blue-400 font-semibold text-xs">Staking Rewards</span>
            </div>
            <div className="text-white font-bold text-sm">{stakingTokens.toLocaleString()}</div>
            <div className="text-blue-300 text-xs">{((stakingTokens / totalSupply) * 100).toFixed(1)}%</div>
          </div>

          {/* Community */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-purple-400 font-semibold text-xs">Community</span>
            </div>
            <div className="text-white font-bold text-sm">
              {circulatingSupply > 0 ? circulatingSupply.toLocaleString() : "0"}
            </div>
            <div className="text-purple-300 text-xs">
              {totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(1) : "0"}%
            </div>
          </div>
        </div>
        
        <div className="text-xs text-zinc-400 text-center">
          🎶 Live Token-Verteilung • Aktualisiert alle 30 Sekunden 🎶
        </div>
      </div>

      {/* Live-Preis-Chart */}
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
        
        {/* Market Metrics unter dem Chart - Kompakt und mobil optimiert */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {/* Marktkapitalisierung */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 md:w-2 md:h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-400 font-semibold text-xs">Marktkapitalisierung</span>
            </div>
            {loading ? (
              <div className="animate-pulse bg-zinc-600 h-5 w-16 rounded"></div>
            ) : (
              <div className="text-white font-bold text-sm">
                €{tokenMetrics?.marketCapEUR?.circulating?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </div>
            )}
            <div className="text-green-300 text-xs">
              FDV: €{tokenMetrics?.marketCapEUR?.fdv?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
            </div>
          </div>

          {/* Token Preis */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 md:w-2 md:h-2 bg-blue-500 rounded-full"></div>
              <span className="text-blue-400 font-semibold text-xs">Token Preis</span>
            </div>
            {loading ? (
              <div className="animate-pulse bg-zinc-600 h-5 w-14 rounded"></div>
            ) : (
              <div className="text-white font-bold text-sm">
                €{tokenMetrics?.priceEUR?.toFixed(4) || "0.0000"}
              </div>
            )}
            <div className="text-blue-300 text-xs">Live DEX-Preis</div>
          </div>

          {/* Total Supply */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 md:w-2 md:h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-yellow-400 font-semibold text-xs">Total Supply</span>
            </div>
            <div className="text-white font-bold text-sm">
              {totalSupply?.toLocaleString() || "0"}
            </div>
            <div className="text-yellow-300 text-xs">D.FAITH Token</div>
          </div>

          {/* Community Holdings */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 md:w-2 md:h-2 bg-purple-500 rounded-full"></div>
              <span className="text-purple-400 font-semibold text-xs">Community Holdings</span>
            </div>
            <div className="text-white font-bold text-sm">
              {circulatingSupply > 0 ? circulatingSupply.toLocaleString() : "0"}
            </div>
            <div className="text-purple-300 text-xs">
              {totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(1) : "0"}%
            </div>
          </div>
        </div>
      </div>

      {/* D.INVEST & Staking Dashboard - Minimalistisch */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 p-6 mb-6 backdrop-blur-sm">
        {/* Header Section - Vereinfacht */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <img src="/D.INVEST.png" alt="D.INVEST" className="w-8 h-8 object-contain" />
            <h3 className="text-xl font-bold text-white">
              D.INVEST & Staking Dashboard
            </h3>
          </div>
          <p className="text-zinc-400 text-sm">Investment-Token meets Live Staking Analytics</p>
        </div>

        {/* D.INVEST Token Metrics */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
            💎 D.INVEST Token Distribution
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Supply */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-blue-500/20">
              <div className="text-blue-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                Total Supply
              </div>
              <div className="text-white font-bold text-lg">10,000</div>
              <div className="text-blue-400 text-xs">D.INVEST Token</div>
            </div>
            
            {/* Community Owned */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20">
              <div className="text-green-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                Community Owned
              </div>
              {loading ? (
                <div className="animate-pulse bg-zinc-600 h-5 w-12 rounded"></div>
              ) : (
                <>
                  <div className="text-white font-bold text-lg">
                    {dinvestBalance ? (10000 - parseInt(dinvestBalance.balance)).toLocaleString() : "0"}
                  </div>
                  <div className="text-green-400 text-xs">
                    {dinvestBalance ? (((10000 - parseInt(dinvestBalance.balance)) / 10000) * 100).toFixed(1) : "0"}% verkauft
                  </div>
                </>
              )}
            </div>
            
            {/* Verfügbar */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-amber-500/20">
              <div className="text-amber-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                Verfügbar
              </div>
              {loading ? (
                <div className="animate-pulse bg-zinc-600 h-5 w-12 rounded"></div>
              ) : (
                <>
                  <div className="text-white font-bold text-lg">
                    {dinvestBalance ? parseInt(dinvestBalance.balance).toLocaleString() : "0"}
                  </div>
                  <div className="text-amber-400 text-xs">5€ pro Token</div>
                </>
              )}
            </div>

            {/* Token Wert */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-purple-500/20">
              <div className="text-purple-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                Gesamtwert
              </div>
              <div className="text-white font-bold text-lg">€50,000</div>
              <div className="text-purple-400 text-xs">10,000 × €5</div>
            </div>
          </div>
        </div>

        {/* Divider - Vereinfacht */}
        <div className="w-full h-px bg-zinc-700/50 mb-8"></div>

        {/* Staking Statistics - Minimalistisch */}
        <div>
          <h4 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
            🎛️ Live Staking Board
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Rewards Pool */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-purple-500/20">
              <div className="text-purple-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                Rewards Pool
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : stakingTokens.toFixed(2)}
              </div>
              <div className="text-purple-400 text-xs">D.FAITH</div>
            </div>
            
            {/* Total Gestaked */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-blue-500/20">
              <div className="text-blue-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                Total Gestaked
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : totalStaked?.toLocaleString() || "0"}
              </div>
              <div className="text-blue-400 text-xs">D.INVEST</div>
            </div>
            
            {/* Verteilt */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20">
              <div className="text-green-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                Verteilt
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : totalRewardsDistributed?.toFixed(2) || "0"}
              </div>
              <div className="text-green-400 text-xs">D.FAITH</div>
            </div>
            
            {/* Current Stage */}
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-amber-500/20">
              <div className="text-amber-300 text-xs font-medium mb-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                Current Stage
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : `${currentStage || 1}/6`}
              </div>
              <div className="text-amber-400 text-xs">Reward Stage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
