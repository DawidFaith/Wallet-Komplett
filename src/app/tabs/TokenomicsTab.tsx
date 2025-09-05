import { useState, useEffect } from "react";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, Coins, DollarSign, ExternalLink, FileText, BarChart3, PieChartIcon, Target } from 'lucide-react';

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

  // Chart-Daten für Recharts
  const pieChartData = [
    { name: 'Dawid Faith', value: davidBalanceNum, color: '#f59e0b', percentage: davidPercentage },
    { name: 'DEX Pool', value: poolTokens, color: '#10b981', percentage: totalSupply > 0 ? (poolTokens / totalSupply) * 100 : 0 },
    { name: 'Staking Rewards', value: stakingTokens, color: '#3b82f6', percentage: totalSupply > 0 ? (stakingTokens / totalSupply) * 100 : 0 },
    { name: 'Community', value: circulatingSupply, color: '#8b5cf6', percentage: totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 0 }
  ];

  // Dummy-Daten für Preis-Trend (später mit echter API ersetzen)
  const priceHistoryData = [
    { time: '00:00', price: tokenMetrics?.priceEUR ? tokenMetrics.priceEUR * 0.95 : 0 },
    { time: '04:00', price: tokenMetrics?.priceEUR ? tokenMetrics.priceEUR * 0.98 : 0 },
    { time: '08:00', price: tokenMetrics?.priceEUR ? tokenMetrics.priceEUR * 1.02 : 0 },
    { time: '12:00', price: tokenMetrics?.priceEUR ? tokenMetrics.priceEUR * 0.99 : 0 },
    { time: '16:00', price: tokenMetrics?.priceEUR ? tokenMetrics.priceEUR * 1.01 : 0 },
    { time: '20:00', price: tokenMetrics?.priceEUR ? tokenMetrics.priceEUR * 1.03 : 0 },
    { time: 'Jetzt', price: tokenMetrics?.priceEUR || 0 }
  ];

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <motion.div 
      className="flex flex-col gap-6 p-6 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Professional Hero Section */}
      <motion.div 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-amber-500/20 p-8 mb-6"
        variants={itemVariants}
      >
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 1200 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <motion.path 
              d="M0,100 Q150,50 300,100 T600,100 T900,100 T1200,100" 
              stroke="url(#waveGradient)" 
              strokeWidth="3" 
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            />
          </svg>
        </div>
        
        {/* Hero Content */}
        <div className="relative z-10">
          <div className="text-center mb-8">
            <motion.div 
              className="flex items-center justify-center gap-4 mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <motion.img 
                src="/D.FAITH.png" 
                alt="D.FAITH Token" 
                className="w-20 h-20 object-contain"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
                  D.FAITH Tokenomics
                </h1>
                <p className="text-amber-300 text-lg">
                  Professionelle Übersicht über das Musik-Ökosystem
                </p>
              </div>
              <motion.img 
                src="/D.FAITH.png" 
                alt="D.FAITH Token" 
                className="w-20 h-20 object-contain"
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
            
            {/* Professional Action Buttons */}
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-4 mt-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.a
                href="https://docs.google.com/document/d/1YourWhitepaperLink"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all duration-300 shadow-lg hover:shadow-amber-500/25"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FileText className="w-5 h-5" />
                Whitepaper lesen
                <ExternalLink className="w-4 h-4 opacity-70" />
              </motion.a>
              
              <motion.a 
                href="#analytics-dashboard" 
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-600 text-white transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <BarChart3 className="w-5 h-5" />
                Analytics Dashboard
              </motion.a>
              
              <motion.a 
                href="#token-distribution" 
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-600 text-white transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PieChartIcon className="w-5 h-5" />
                Token Distribution
              </motion.a>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics Dashboard */}
      <motion.div variants={itemVariants} id="analytics-dashboard">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-green-400" />
          Live Analytics Dashboard
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Market Cap */}
          <motion.div 
            className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl border border-green-500/30 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-400" />
              <motion.div 
                className="text-green-400 text-sm"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                LIVE
              </motion.div>
            </div>
            <div className="text-white">
              <div className="text-2xl font-bold">
                €{tokenMetrics?.marketCapEUR?.circulating?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </div>
              <div className="text-green-300 text-sm">Market Cap</div>
              <div className="text-green-400/70 text-xs mt-1">
                FDV: €{tokenMetrics?.marketCapEUR?.fdv?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </div>
            </div>
          </motion.div>

          {/* Total Supply */}
          <motion.div 
            className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-xl border border-blue-500/30 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-between mb-4">
              <Coins className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-white">
              <div className="text-2xl font-bold">{totalSupply.toLocaleString()}</div>
              <div className="text-blue-300 text-sm">Total Supply</div>
              <div className="text-blue-400/70 text-xs mt-1">D.FAITH Token</div>
            </div>
          </motion.div>

          {/* Circulating Supply */}
          <motion.div 
            className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-xl border border-purple-500/30 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-white">
              <div className="text-2xl font-bold">{circulatingSupply.toLocaleString()}</div>
              <div className="text-purple-300 text-sm">Circulating</div>
              <div className="text-purple-400/70 text-xs mt-1">
                {totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(1) : "0"}% vom Total
              </div>
            </div>
          </motion.div>

          {/* Price */}
          <motion.div 
            className="bg-gradient-to-br from-amber-900/20 to-amber-800/10 rounded-xl border border-amber-500/30 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8 text-amber-400" />
            </div>
            <div className="text-white">
              <div className="text-2xl font-bold">
                €{tokenMetrics?.priceEUR?.toFixed(6) || "0.000000"}
              </div>
              <div className="text-amber-300 text-sm">Aktueller Preis</div>
              <div className="text-amber-400/70 text-xs mt-1">EUR/D.FAITH</div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Advanced Token Distribution with Professional Charts */}
      <motion.div 
        id="token-distribution" 
        className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 p-8 mb-6 backdrop-blur-sm"
        variants={itemVariants}
      >
        <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
          <PieChartIcon className="w-7 h-7 text-amber-400" />
          Token Distribution Analytics
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Professional Pie Chart */}
          <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/50">
            <h4 className="text-lg font-semibold text-white mb-4">Distribution Breakdown</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [value.toLocaleString(), 'Tokens']}
                    labelStyle={{ color: '#000' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Price Trend Chart */}
          <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/50">
            <h4 className="text-lg font-semibold text-white mb-4">24h Preis-Trend</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => `€${value.toFixed(6)}`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`€${value.toFixed(6)}`, 'Preis']}
                    labelStyle={{ color: '#000' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#f59e0b"
                    fill="url(#priceGradient)"
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Token Distribution Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {pieChartData.map((item, index) => (
            <motion.div
              key={item.name}
              className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-white font-semibold text-sm">{item.name}</span>
              </div>
              <div className="text-xl font-bold text-white">{item.value.toLocaleString()}</div>
              <div className="text-sm" style={{ color: item.color }}>
                {item.percentage.toFixed(1)}%
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Live-Preis-Chart */}
      <motion.div 
        id="live-price" 
        className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6"
        variants={itemVariants}
      >
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
      </motion.div>

      {/* Enhanced Leaderboard Section */}
      <motion.div 
        id="leaderboard" 
        className="bg-zinc-900 rounded-xl border border-zinc-700 p-4 md:p-6 mb-6"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">🏆 Leaderboard</h3>
            <p className="text-zinc-400 text-xs md:text-sm">Aktivste Fans nach EXP</p>
          </div>
          {!showLeaderboardModal && (
            <motion.button
              type="button"
              onClick={() => setShowLeaderboardModal(true)}
              className="relative group w-9 h-9 rounded-full bg-yellow-400 text-black shadow-lg hover:bg-yellow-300 active:scale-95 hover:scale-105 transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 hover:ring-4 hover:ring-yellow-200/60 hover:shadow-yellow-300/60"
              aria-label="Leaderboard öffnen"
              title="Leaderboard öffnen"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <span className="absolute -inset-1 rounded-full bg-yellow-400/20 blur-sm opacity-60 group-hover:opacity-80 transition pointer-events-none"></span>
              <motion.span 
                className="inline-block"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🏆
              </motion.span>
            </motion.button>
          )}
        </div>
        <div className="text-xs text-zinc-500">Öffne das Leaderboard, um Namen, EXP und Preise zu sehen.</div>
      </motion.div>

      <AnimatePresence>
        {showLeaderboardModal && (
          <motion.div 
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
                <motion.button 
                  onClick={() => setShowLeaderboardModal(false)} 
                  className="text-zinc-400 hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✖
                </motion.button>
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
                      <motion.div 
                        key={e.rank} 
                        className="border-b border-zinc-800/70 last:border-b-0"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (e.rank - 1) * 0.05 }}
                      >
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
                        <AnimatePresence>
                          {lbOpenRow === e.rank && namesDetailed.length > 1 && (
                            <motion.div 
                              className="pl-[3.25rem] pr-3 pb-2 flex flex-col gap-1 items-start"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {namesDetailed.map((n, idx) => {
                                const ChipIcon = n.platform === 'instagram' ? FaInstagram : n.platform === 'tiktok' ? FaTiktok : FaFacebookF;
                                return (
                                  <div key={idx} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-[11px] w-full text-left whitespace-normal break-words flex items-center gap-2">
                                    {ChipIcon && <ChipIcon className="w-3.5 h-3.5 text-zinc-300" aria-hidden="true" />}
                                    <span className="break-words">{n.label}</span>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-zinc-500 mt-2 text-right">Letztes Update: {lbData?.lastUpdated ? new Date(lbData.lastUpdated).toLocaleString() : '-'}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced D.INVEST & Staking Dashboard */}
      <motion.div 
        className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 p-6 mb-6 backdrop-blur-sm"
        variants={itemVariants}
      >
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <motion.img 
              src="/D.INVEST.png" 
              alt="D.INVEST" 
              className="w-8 h-8 object-contain"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
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
            <motion.div 
              className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-green-300 text-xs font-medium mb-1 flex items-center gap-1">
                <motion.div 
                  className="w-1.5 h-1.5 bg-green-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                ></motion.div>
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
            </motion.div>
            
            {/* Verfügbar */}
            <motion.div 
              className="bg-zinc-800/50 rounded-lg p-3 border border-amber-500/20"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-amber-300 text-xs font-medium mb-1 flex items-center gap-1">
                <motion.div 
                  className="w-1.5 h-1.5 bg-amber-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                ></motion.div>
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
            </motion.div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-zinc-700/50 mb-8"></div>

        {/* Staking Statistics */}
        <div>
          <h4 className="text-lg font-semibold text-purple-400 mb-4">
            Live Staking Board
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Rewards Pool */}
            <motion.div 
              className="bg-zinc-800/50 rounded-lg p-3 border border-purple-500/20"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-purple-300 text-xs font-medium mb-1 flex items-center gap-1">
                <motion.div 
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                ></motion.div>
                Rewards Pool
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : stakingTokens.toFixed(2)}
              </div>
              <div className="text-purple-400 text-xs">D.FAITH</div>
            </motion.div>
            
            {/* Total Gestaked */}
            <motion.div 
              className="bg-zinc-800/50 rounded-lg p-3 border border-blue-500/20"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-blue-300 text-xs font-medium mb-1 flex items-center gap-1">
                <motion.div 
                  className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                ></motion.div>
                Total Gestaked
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : totalStaked?.toLocaleString() || "0"}
              </div>
              <div className="text-blue-400 text-xs">D.INVEST</div>
            </motion.div>
            
            {/* Verteilt */}
            <motion.div 
              className="bg-zinc-800/50 rounded-lg p-3 border border-green-500/20"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-green-300 text-xs font-medium mb-1 flex items-center gap-1">
                <motion.div 
                  className="w-1.5 h-1.5 bg-green-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                ></motion.div>
                Verteilt
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : totalRewardsDistributed?.toFixed(2) || "0"}
              </div>
              <div className="text-green-400 text-xs">D.FAITH</div>
            </motion.div>
            
            {/* Current Stage */}
            <motion.div 
              className="bg-zinc-800/50 rounded-lg p-3 border border-amber-500/20"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-amber-300 text-xs font-medium mb-1 flex items-center gap-1">
                <motion.div 
                  className="w-1.5 h-1.5 bg-amber-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
                ></motion.div>
                Current Stage
              </div>
              <div className="text-white font-bold text-lg">
                {loading ? "..." : `${currentStage || 1}/6`}
              </div>
              <div className="text-amber-400 text-xs">Reward Stage</div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
