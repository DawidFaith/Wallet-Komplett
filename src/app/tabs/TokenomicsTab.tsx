import { useState, useEffect } from "react";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
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

  // Leaderboard Modal State (Instagram-style)
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [lbData, setLbData] = useState<LeaderboardResponse | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbSearch, setLbSearch] = useState("");
  const [lbNow, setLbNow] = useState<number>(Date.now());
  const [lbOpenRow, setLbOpenRow] = useState<number | null>(null);

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

  // Load leaderboard when modal opens (and refresh every 30s while open)
  useEffect(() => {
    if (!showLeaderboardModal) return;
    let mounted = true;
    const load = async () => {
      setLbLoading(true); // keep stale data visible to avoid flicker
      try {
        const res = await fetch('/api/leaderboard-proxy', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const data: LeaderboardResponse = (raw?.entries || raw?.prizes || raw?.timer) ? raw : (raw?.data || { entries: [], prizes: [] });
        if (mounted) setLbData({
          entries: data.entries || [],
          prizes: data.prizes || [],
          timer: data.timer,
          lastUpdated: data.lastUpdated,
        });
      } catch (e) {
        console.error('Leaderboard laden fehlgeschlagen:', e);
      } finally {
        if (mounted) setLbLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [showLeaderboardModal]);

  // Countdown ticker while modal open
  useEffect(() => {
    if (!showLeaderboardModal) return;
    const id = setInterval(() => setLbNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showLeaderboardModal]);
  // Helper to format remaining time like Instagram tab
  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '00:00:00';
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    s = s % 86400;
    const h = Math.floor(s / 3600);
    s = s % 3600;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ss = sec.toString().padStart(2, '0');
    return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };

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
  {/* Hero Section – Willkommensbereich */}
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
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <img src="/D.FAITH.png" alt="D.FAITH Token" className="w-16 h-16 object-contain" />
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  Willkommen im Musik‑Ökosystem von Dawid Faith
                </h2>
                <p className="text-amber-300 text-sm mt-2 max-w-2xl mx-auto">
                  Fans werden am Erfolg beteiligt: Sammle EXP über Social Media, erhalte Belohnungen, stake Tokens und wachse mit dem Projekt.
                </p>
              </div>
              <img src="/D.FAITH.png" alt="D.FAITH Token" className="w-16 h-16 object-contain" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <a
                href="https://example.com/whitepaper"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition"
              >
                📄 Whitepaper lesen
              </a>
              <a href="#live-price" className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-white hover:bg-zinc-800 transition">
                📈 Zum Live‑Preis‑Chart
              </a>
              <a href="#token-distribution" className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-white hover:bg-zinc-800 transition">
                🎯 Zur Token‑Verteilung
              </a>
              <a href="#leaderboard" className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-white hover:bg-zinc-800 transition">
                🏆 Zum Leaderboard
              </a>
            </div>
          </div>
        </div>
      </div>

  {/* Token Distribution Visualization */}
  <div id="token-distribution" className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
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
  <div id="live-price" className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
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

      {/* Leaderboard Section (Trigger + Modal) */}
      <div id="leaderboard" className="bg-zinc-900 rounded-xl border border-zinc-700 p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">🏆 Leaderboard</h3>
            <p className="text-zinc-400 text-xs md:text-sm">Aktivste Fans nach EXP</p>
          </div>
          {!showLeaderboardModal && (
            <button
              type="button"
              onClick={() => setShowLeaderboardModal(true)}
              className="relative group w-9 h-9 rounded-full bg-yellow-400 text-black shadow-lg hover:bg-yellow-300 active:scale-95 hover:scale-105 transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 hover:ring-4 hover:ring-yellow-200/60 hover:shadow-yellow-300/60"
              aria-label="Leaderboard öffnen"
              title="Leaderboard öffnen"
            >
              <span className="absolute -inset-1 rounded-full bg-yellow-400/20 blur-sm opacity-60 group-hover:opacity-80 transition pointer-events-none"></span>
              <span className="inline-block animate-bounce">🏆</span>
            </button>
          )}
        </div>
        <div className="text-xs text-zinc-500">Öffne das Leaderboard, um Namen, EXP und Preise zu sehen.</div>
      </div>

      {showLeaderboardModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="text-yellow-300">🏆</span>
                <h3 className="text-white font-semibold">Leaderboard</h3>
              </div>
              <div className="text-xs text-zinc-400 mr-auto ml-3">
                {lbData?.timer?.isActive && lbData?.timer?.endDate ? (
                  <span>
                    Endet in: {formatDuration(new Date(lbData.timer.endDate).getTime() - lbNow)}
                  </span>
                ) : null}
              </div>
              <button onClick={() => setShowLeaderboardModal(false)} className="text-zinc-400 hover:text-white">✖</button>
            </div>
            <div className="px-4 py-3">
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-md px-2 py-1 flex items-center gap-2 w-full mb-3">
                <span className="text-zinc-400 text-xs">Suche</span>
                <input
                  value={lbSearch}
                  onChange={(e) => setLbSearch(e.target.value)}
                  placeholder="@handle oder Name"
                  className="bg-transparent outline-none text-sm text-white placeholder:text-zinc-500 w-full"
                />
              </div>
              {/* Legende / Kopfzeile */}
              <div className="text-[11px] text-zinc-400 px-3 mb-1 grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_5.25rem] gap-3">
                <div className="opacity-0 select-none">#</div>
                <div className="text-left">Name</div>
                <div className="text-center">EXP</div>
                <div className="text-right">Preis</div>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg max-h-[24rem] overflow-y-auto overflow-x-hidden">
                {lbLoading && (
                  <div className="px-4 py-3 text-zinc-400 text-sm">Lade Leaderboard…</div>
                )}
                {(lbData?.entries || []).length === 0 && !lbLoading && (
                  <div className="px-4 py-3 text-zinc-400 text-sm">Keine Einträge gefunden</div>
                )}
                {(lbData?.entries || []).filter(e => {
                  if (!lbSearch) return true;
                  const names = [e.instagram, e.tiktok, e.facebook, (e as any).name, (e as any).handle].filter(Boolean) as string[];
                  const q = lbSearch.toLowerCase();
                  return names.some(n => n.toLowerCase().includes(q));
                }).map((e) => {
                  const namesDetailed = [
                    e.instagram ? { label: e.instagram as string, platform: 'instagram' } : null,
                    e.tiktok ? { label: e.tiktok as string, platform: 'tiktok' } : null,
                    e.facebook ? { label: e.facebook as string, platform: 'facebook' } : null,
                  ].filter(Boolean) as { label: string; platform: 'instagram' | 'tiktok' | 'facebook' }[];
                  const primary = (e.instagram || e.tiktok || e.facebook || '-') as string;
                  const primaryPlatform: 'instagram' | 'tiktok' | 'facebook' = e.instagram ? 'instagram' : e.tiktok ? 'tiktok' : 'facebook';
                  const PlatformIcon = primaryPlatform === 'instagram' ? FaInstagram : primaryPlatform === 'tiktok' ? FaTiktok : FaFacebookF;
                  const prize = (lbData?.prizes || []).find(p => p.position === e.rank);
                  const prizeText = prize ? (prize.value || prize.description || '') : '';
                  const prizeDisplay = prizeText ? prizeText : '-';
                  return (
                    <div key={e.rank} className="border-b border-zinc-800/70 last:border-b-0">
                      <div className="px-3 py-2 grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_5.25rem] gap-3 items-center">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono">#{e.rank}</span>
                        <div className="flex items-center gap-2 w-full">
                          {PlatformIcon && <PlatformIcon className="w-4 h-4 text-zinc-300 shrink-0" aria-hidden="true" />}
                          <span className="text-white whitespace-nowrap overflow-x-auto w-full">{primary}</span>
                          {namesDetailed.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setLbOpenRow(lbOpenRow === e.rank ? null : e.rank)}
                              className="text-zinc-400 hover:text-white text-xs border border-zinc-700 rounded px-1 py-0.5"
                              aria-label="Weitere Namen anzeigen"
                              title="Weitere Namen anzeigen"
                            >
                              {lbOpenRow === e.rank ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        <span className="text-amber-300 text-sm font-mono tabular-nums text-center">{e.expTotal.toLocaleString()}</span>
                        <span className="text-emerald-300 text-xs font-medium tabular-nums text-right truncate max-w-full" title={prizeDisplay}>
                          {prizeDisplay}
                        </span>
                      </div>
                      {lbOpenRow === e.rank && namesDetailed.length > 1 && (
                        <div className="pl-[3.25rem] pr-3 pb-2 flex flex-col gap-1 items-start">
                          {namesDetailed.map((n, idx) => {
                            const ChipIcon = n.platform === 'instagram' ? FaInstagram : n.platform === 'tiktok' ? FaTiktok : FaFacebookF;
                            return (
                              <div key={idx} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-[11px] w-full text-left whitespace-normal break-words flex items-center gap-2">
                                {ChipIcon && <ChipIcon className="w-3.5 h-3.5 text-zinc-300" aria-hidden="true" />}
                                <span className="break-words">{n.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-zinc-500 mt-2 text-right">Letztes Update: {lbData?.lastUpdated ? new Date(lbData.lastUpdated).toLocaleString() : '-'}</div>
            </div>
          </div>
        </div>
      )}

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
