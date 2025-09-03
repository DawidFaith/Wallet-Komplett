import { useState, useEffect, useRef, useMemo } from "react";
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

// Leaderboard API types
interface LeaderboardEntry {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  expTotal: number;
  rank: number;
}

interface Prize {
  position: number;
  description: string;
  value: string;
}

interface TimerSettings {
  endDate: string;
  title: string;
  description: string;
  isActive: boolean;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  prizes: Prize[];
  timer?: TimerSettings;
  lastUpdated?: string;
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

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState<number>(Date.now());
  const [platform, setPlatform] = useState<"all" | "instagram" | "tiktok" | "facebook">("all");
  const mobileCarouselRef = useRef<HTMLDivElement | null>(null);

  // Daten von APIs abrufen
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      console.log("🔄 Fetching tokenomics data...");
      
      try {
        // Parallele API-Aufrufe - verwende lokalen Proxy für Metrics
        const [metricsRes, davidRes, dinvestRes] = await Promise.all([
          fetch('/api/metrics-proxy')
            .catch(err => {
              console.error("❌ Metrics Proxy Error:", err);
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

        // Token Metrics verarbeiten mit detaillierter Fehlerbehandlung
        if (metricsRes && metricsRes.ok) {
          try {
            const metricsData = await metricsRes.json();
            console.log("✅ Metrics Data:", metricsData);
            setTokenMetrics(metricsData);
          } catch (parseError) {
            console.error("❌ Metrics JSON Parse Error:", parseError);
            setTokenMetrics(null);
          }
        } else {
          console.log("❌ Metrics API failed:", metricsRes ? `Status: ${metricsRes.status}` : "No response");
          setTokenMetrics(null);
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

  // Leaderboard fetch + countdown timer
  useEffect(() => {
    let mounted = true;
    const fetchLeaderboard = async () => {
      setLbLoading(true);
      try {
        const res = await fetch("https://leaderboard-pi-liard.vercel.app/api/leaderboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`);
        const data: LeaderboardResponse = await res.json();
        if (mounted) setLeaderboard(data);
      } catch (e) {
        console.error("❌ Leaderboard fetch failed:", e);
        if (mounted) setLeaderboard(null);
      } finally {
        if (mounted) setLbLoading(false);
      }
    };
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 30000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted = false;
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  const timeLeft = (() => {
    const end = leaderboard?.timer?.endDate ? new Date(leaderboard.timer.endDate).getTime() : 0;
    const diff = Math.max(0, end - now);
    const s = Math.floor(diff / 1000);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return { days, hours, minutes, seconds, active: leaderboard?.timer?.isActive && diff > 0 };
  })();

  const filteredEntriesRaw = (leaderboard?.entries || []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = e.instagram || e.tiktok || e.facebook || "";
    return name.toLowerCase().includes(q);
  });
  const filteredEntries = useMemo(() => {
    if (platform === "all") return filteredEntriesRaw;
    return filteredEntriesRaw.filter((e) => {
      if (platform === "instagram") return !!e.instagram;
      if (platform === "tiktok") return !!e.tiktok;
      if (platform === "facebook") return !!e.facebook;
      return true;
    });
  }, [filteredEntriesRaw, platform]);
  const top3 = filteredEntries.slice(0, 3);
  const rest = filteredEntries.slice(3);
  const mobileCarousel = rest.slice(0, 12);

  // Berechnungen mit nur echten API-Daten
  const totalSupply = tokenMetrics?.supply?.total || 0;
  const davidBalanceNum = parseFloat(davidBalance?.balanceRaw || "0");
  const stakingTokens = contractBalance || 0;
  const poolTokens = tokenMetrics?.balances?.tokenInPool || 0;
  
  // Zirkulierende Supply = Total Supply - Staking Rewards - Dawid Faith Holdings - Pool Tokens
  const circulatingSupply = Math.max(0, totalSupply - stakingTokens - davidBalanceNum - poolTokens);
  
  const davidPercentage = totalSupply > 0 ? (davidBalanceNum / totalSupply) * 100 : 0;
  const targetPercentage = 75;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Hero Section - D.FAITH Tokenomics mit Dawid Faith Holdings */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-amber-500/20 p-8 mb-6">
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
        
        {/* Hero Content */}
        <div className="relative z-10">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <img src="/D.FAITH.png" alt="D.FAITH Token" className="w-16 h-16 object-contain" />
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  D.FAITH Tokenomics Dashboard
                </h2>
                <div className="flex items-center justify-center gap-2 text-sm text-amber-400 mt-2">
                  <span>🎼</span>
                  <span>Powered by Dawid Faith</span>
                  <span>🎼</span>
                </div>
              </div>
              <img src="/D.FAITH.png" alt="D.FAITH Token" className="w-16 h-16 object-contain" />
            </div>
          </div>

          {/* Dawid Faith Holdings Section */}
          <div className="bg-amber-900/10 rounded-xl border border-amber-500/30 p-6 backdrop-blur-sm">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-amber-400 flex items-center gap-3 mb-2">
                👑 Dawid Faith Holdings
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <span className="text-amber-300">Langfristiges Ziel: 75%</span>
                <span className="text-zinc-400">Quartalsweise Käufe aus Musikeinnahmen</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Progress Section */}
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
              
              {/* Next Purchase Timer */}
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
              strokeDasharray={`${totalSupply > 0 ? (davidBalanceNum / totalSupply) * 283 : 0} 283`}
              strokeDashoffset="0"
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #f59e0b60)' }}
            />
            
            {/* DEX Pool Section */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#10b981" strokeWidth="8"
              strokeDasharray={`${totalSupply > 0 ? (poolTokens / totalSupply) * 283 : 0} 283`}
              strokeDashoffset={`-${totalSupply > 0 ? (davidBalanceNum / totalSupply) * 283 : 0}`}
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #10b98160)' }}
            />
            
            {/* Staking Section */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#3b82f6" strokeWidth="8"
              strokeDasharray={`${totalSupply > 0 ? (stakingTokens / totalSupply) * 283 : 0} 283`}
              strokeDashoffset={`-${totalSupply > 0 ? ((davidBalanceNum + poolTokens) / totalSupply) * 283 : 0}`}
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #3b82f660)' }}
            />
            
            {/* Community Section */}
            <circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#8b5cf6" strokeWidth="8"
              strokeDasharray={`${totalSupply > 0 ? (circulatingSupply / totalSupply) * 283 : 0} 283`}
              strokeDashoffset={`-${totalSupply > 0 ? ((davidBalanceNum + poolTokens + stakingTokens) / totalSupply) * 283 : 0}`}
              className="transition-all duration-1000 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px #8b5cf660)' }}
            />
            
            {/* Vinyl grooves */}
            <circle cx="50" cy="50" r="35" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
            <circle cx="50" cy="50" r="25" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>

            {/* Fliegender D.FAITH Token - Position 1 */}
            <g className="animate-spin" style={{ animationDuration: '12s', animationTimingFunction: 'linear', transformOrigin: '50px 50px' }}>
              <foreignObject x="71" y="46" width="8" height="8">
                <img src="/D.FAITH.png" alt="D.FAITH" className="w-full h-full object-contain" />
              </foreignObject>
            </g>

            {/* Fliegender D.FAITH Token - Position 2 */}
            <g className="animate-spin" style={{ animationDuration: '15s', animationTimingFunction: 'linear', transformOrigin: '50px 50px', animationDelay: '2s' }}>
              <foreignObject x="22.5" y="47" width="6" height="6">
                <img src="/D.FAITH.png" alt="D.FAITH" className="w-full h-full object-contain" />
              </foreignObject>
            </g>

            {/* Fliegender D.INVEST Token - Position 3 */}
            <g className="animate-spin" style={{ animationDuration: '18s', animationTimingFunction: 'linear', transformOrigin: '50px 50px', animationDelay: '4s' }}>
              <foreignObject x="48" y="23" width="5" height="5">
                <img src="/D.INVEST.png" alt="D.INVEST" className="w-full h-full object-contain" />
              </foreignObject>
            </g>

            {/* Glitzer-Effekt um die fliegenden Token */}
            <g className="animate-pulse" style={{ animationDuration: '2s' }}>
              <circle cx="70" cy="45" r="0.5" fill="#fbbf24" opacity="0.8" />
              <circle cx="30" cy="55" r="0.5" fill="#f59e0b" opacity="0.6" />
              <circle cx="55" cy="30" r="0.5" fill="#eab308" opacity="0.7" />
            </g>
          </svg>
          
          {/* Center Label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <img src="/D.FAITH.png" alt="D.FAITH Token" className="w-8 h-8 object-contain mx-auto animate-pulse" />
              <div className="text-white text-xs font-semibold mt-1">D.FAITH</div>
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
        </div>
        
        {/* Market Metrics unter dem Chart - Kompakt und mobil optimiert */}
        <div className="grid grid-cols-1 gap-3 mt-6">
          {/* Market Cap */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-400 font-semibold text-xs">Market Cap</span>
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
        </div>
      </div>

      {/* Leaderboard Section */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              🏆 Leaderboard
            </h3>
            <p className="text-zinc-400 text-sm">
              Die aktivsten Fans nach EXP – automatisch aktualisiert
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 flex items-center gap-2 w-full sm:w-72">
              <span className="text-zinc-400 text-xs">Suche</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="@handle oder Name"
                className="bg-transparent outline-none text-sm text-white placeholder:text-zinc-500 w-full"
              />
            </div>
            {/* Platform Filter */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-700 w-full sm:w-auto">
              {([
                { k: "all", l: "Alle" },
                { k: "instagram", l: "IG" },
                { k: "tiktok", l: "TT" },
                { k: "facebook", l: "FB" },
              ] as const).map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setPlatform(opt.k)}
                  className={`px-3 py-2 text-xs font-medium transition-colors flex-1 sm:flex-none ${
                    platform === opt.k ? "bg-zinc-700 text-white" : "bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            {leaderboard?.timer?.isActive && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-300 text-sm w-full sm:w-auto">
                <div className="font-semibold">
                  {leaderboard?.timer?.title || "Contest endet in:"}
                </div>
                <div className="font-mono text-amber-200">
                  {timeLeft.active ? (
                    <span>
                      {timeLeft.days}d : {String(timeLeft.hours).padStart(2, "0")}h : {String(timeLeft.minutes).padStart(2, "0")}m : {String(timeLeft.seconds).padStart(2, "0")}s
                    </span>
                  ) : (
                    <span>Beendet</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Podium Top 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map((idx) => {
            const e = top3[idx];
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
            const color = idx === 0 ? "text-amber-400" : idx === 1 ? "text-zinc-200" : "text-orange-300";
            // Order for mobile vs desktop: gold first on mobile, centered on md
            const orderClass = idx === 0 ? "order-1 md:order-2" : idx === 1 ? "order-2 md:order-1" : "order-3 md:order-3";
            const emphasis = idx === 0 ? "md:bg-zinc-800/70 md:border-amber-500/30 md:scale-105" : "";
            return (
              <div key={idx} className={`rounded-xl border p-4 text-center bg-zinc-800/40 border-zinc-700 ${orderClass} ${emphasis}`}>
                <div className={`text-2xl sm:text-3xl ${color}`}>{medal}</div>
                <div className="mt-2 text-white font-bold truncate">
                  {e ? (e.instagram || e.tiktok || e.facebook || "- ") : "-"}
                </div>
                <div className="text-zinc-400 text-xs">EXP</div>
                <div className="text-amber-300 font-mono">{e ? e.expTotal.toLocaleString() : "0"}</div>
                {leaderboard?.prizes?.find((p) => p.position === (e?.rank || 0)) && (
                  <div className="mt-2 text-xs text-green-300">
                    {leaderboard.prizes.find((p) => p.position === (e?.rank || 0))!.description} • {leaderboard.prizes.find((p) => p.position === (e?.rank || 0))!.value}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile carousel for ranks > 3 */}
        <div className="md:hidden">
          {mobileCarousel.length > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <div className="text-zinc-400 text-sm">Weitere Plätze</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const el = mobileCarouselRef.current; if (!el) return; el.scrollBy({ left: -el.clientWidth * 0.9, behavior: "smooth" });
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm"
                  aria-label="Vorherige Einträge"
                >
                  ◀
                </button>
                <button
                  onClick={() => {
                    const el = mobileCarouselRef.current; if (!el) return; el.scrollBy({ left: el.clientWidth * 0.9, behavior: "smooth" });
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm"
                  aria-label="Nächste Einträge"
                >
                  ▶
                </button>
              </div>
            </div>
          )}
          <div ref={mobileCarouselRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1">
            {mobileCarousel.map((e) => {
              const prize = leaderboard?.prizes?.find((p) => p.position === e.rank);
              return (
                <div key={e.rank} className="min-w-[82%] shrink-0 snap-start bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-mono">#{e.rank}</span>
                    {prize && <span className="text-green-300 text-xs">{prize.value}</span>}
                  </div>
                  <div className="text-white font-semibold truncate mb-1">{e.instagram || e.tiktok || e.facebook || "-"}</div>
                  <div className="text-amber-300 text-sm font-mono">{e.expTotal.toLocaleString()} EXP</div>
                  {prize && <div className="text-zinc-400 text-xs mt-1">{prize.description}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabelle/Liste der restlichen Plätze */}
        <div className="bg-zinc-900/60 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-6 gap-2 px-4 py-3 text-xs text-zinc-400 border-b border-zinc-700/60">
            <div>#</div>
            <div className="col-span-2">Handle</div>
            <div className="text-right">EXP</div>
            <div className="col-span-2 text-right">Preis</div>
          </div>
          <div className="divide-y divide-zinc-800/80">
            {lbLoading && (
              <div className="px-4 py-3 text-zinc-400 text-sm">Lade Leaderboard…</div>
            )}
            {!lbLoading && rest.length === 0 && (
              <div className="px-4 py-3 text-zinc-400 text-sm">Keine Einträge gefunden</div>
            )}
            {!lbLoading && rest.map((e) => {
              const prize = leaderboard?.prizes?.find((p) => p.position === e.rank);
              return (
                <div key={e.rank} className="px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-6 gap-2 items-center">
                    <div className="text-zinc-300 font-mono">{e.rank}</div>
                    <div className="col-span-2 text-white truncate">{e.instagram || e.tiktok || e.facebook || "-"}</div>
                    <div className="text-right text-amber-300 font-medium">{e.expTotal.toLocaleString()}</div>
                    <div className="col-span-2 text-right text-green-300 text-xs">{prize ? `${prize.description} • ${prize.value}` : "—"}</div>
                  </div>
                  {/* Mobile card */}
                  <div className="md:hidden flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono">#{e.rank}</span>
                        <span className="text-white truncate">{e.instagram || e.tiktok || e.facebook || "-"}</span>
                      </div>
                      <div className="text-amber-300 text-sm font-medium">{e.expTotal.toLocaleString()} EXP</div>
                    </div>
                    {prize && (
                      <div className="text-green-300 text-xs">{prize.description} • {prize.value}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prizes overview */}
        {leaderboard?.prizes && leaderboard.prizes.length > 0 && (
          <div className="mt-6">
            <h4 className="text-white font-semibold mb-3">Preise</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {leaderboard.prizes.map((p) => (
                <div key={p.position} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 flex items-center justify-between">
                  <div className="text-zinc-300 text-sm">{p.description}</div>
                  <div className="text-green-300 text-sm font-semibold">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
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
        </div>

        {/* D.INVEST Token Metrics */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-blue-400 mb-4">
            D.INVEST Token Distribution
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </div>

        {/* Divider - Vereinfacht */}
        <div className="w-full h-px bg-zinc-700/50 mb-8"></div>

        {/* Staking Statistics - Minimalistisch */}
        <div>
          <h4 className="text-lg font-semibold text-purple-400 mb-4">
            Live Staking Board
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
