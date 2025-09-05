import { useState, useEffect } from "react";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Users, Coins, DollarSign, ExternalLink, FileText, Target, Zap, Crown, Vote, Trophy, Timer, Award, X } from 'lucide-react';

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
  priceEUR: number;
  marketCapEUR: {
    circulating: number;
    fdv: number;
  };
  balances: {
    tokenInPool: number;
  };
}

interface WalletBalance {
  balanceRaw: string;
  balanceFormatted: string;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  points: number;
  rank: number;
  avatar?: string;
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
          fetch('/api/metrics-proxy', { cache: 'no-store' }),
          fetch('/api/dfaith-balance', { cache: 'no-store' }),
          fetch('/api/dinvest-balance', { cache: 'no-store' })
        ]);

        // Metrics API (lokaler Proxy)
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          console.log("✅ Metrics API Response:", metricsData);
          setTokenMetrics(metricsData);
        } else {
          console.log("❌ Metrics API failed or not ok");
        }

        // D.FAITH Balance API
        if (davidRes.ok) {
          const davidData = await davidRes.json();
          console.log("✅ D.FAITH Balance API Response:", davidData);
          setDavidBalance(davidData);
        } else {
          console.log("❌ D.FAITH API failed or not ok");
        }

        // D.INVEST Balance API  
        if (dinvestRes.ok) {
          const dinvestData = await dinvestRes.json();
          console.log("✅ D.INVEST Balance API Response:", dinvestData);
          setDinvestBalance(dinvestData);
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

  // Top Holders für Preview (simuliert basierend auf den Daten)
  const topHolders = [
    { address: "Dawid Faith", balance: davidBalanceNum, percentage: davidPercentage },
    { address: "0x7109...93cd", balance: poolTokens, percentage: totalSupply > 0 ? (poolTokens / totalSupply) * 100 : 0 },
    { address: "0xe85b...940", balance: stakingTokens, percentage: totalSupply > 0 ? (stakingTokens / totalSupply) * 100 : 0 }
  ].sort((a, b) => b.balance - a.balance);

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
      className="flex flex-col gap-6 p-3 md:p-6 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Mobile-optimierter Hero Section */}
      <motion.div 
        className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-amber-500/20 p-4 md:p-8"
        variants={itemVariants}
      >
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
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
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
            />
          </svg>
        </div>
        
        <div className="relative z-10 text-center">
          <motion.div 
            className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mb-4 md:mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <motion.img 
              src="/D.FAITH.png" 
              alt="D.FAITH Token" 
              className="w-16 h-16 md:w-24 md:h-24 object-contain"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            />
            <div>
              <h1 className="text-2xl md:text-5xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2 md:mb-3">
                D.FAITH Ecosystem
              </h1>
              <p className="text-amber-300 text-sm md:text-xl max-w-2xl px-2">
                Das innovative Musik-Token, das Fans und Künstler zusammenbringt
              </p>
            </div>
          </motion.div>
          
          {/* Mobile-optimierte Call-to-Action */}
          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mt-6 md:mt-8 px-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.a
              href="https://docs.google.com/document/d/1YourWhitepaperLink"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm md:text-lg transition-all duration-300 shadow-xl hover:shadow-amber-500/30 w-full sm:w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FileText className="w-4 h-4 md:w-6 md:h-6" />
              <span className="truncate">Whitepaper entdecken</span>
              <ExternalLink className="w-3 h-3 md:w-5 md:h-5 opacity-70" />
            </motion.a>
            
            <motion.a 
              href="#live-trading" 
              className="flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm md:text-lg transition-all duration-300 shadow-xl w-full sm:w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <TrendingUp className="w-4 h-4 md:w-6 md:h-6" />
              <span>Jetzt handeln</span>
            </motion.a>
          </motion.div>
        </div>
      </motion.div>

      {/* Interaktive Live Market Overview - Mobile First */}
      <motion.div variants={itemVariants}>
        <div className="text-center mb-4 md:mb-8">
          <motion.h2 
            className="text-xl md:text-3xl font-bold text-white mb-2"
            whileHover={{ scale: 1.02 }}
          >
            🚀 Live Market Data
          </motion.h2>
          <motion.p 
            className="text-zinc-400 text-sm md:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Tippe auf die Karten für Details
          </motion.p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Market Cap - Interaktiv */}
          <motion.div 
            className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl md:rounded-2xl border border-green-500/40 p-4 md:p-6 backdrop-blur-sm cursor-pointer"
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <DollarSign className="w-6 h-6 md:w-10 md:h-10 text-green-400" />
              </motion.div>
              <motion.div 
                className="px-2 py-1 md:px-3 md:py-1 rounded-full bg-green-500/20 text-green-400 text-xs md:text-sm font-bold"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                LIVE
              </motion.div>
            </div>
            <div className="text-white">
              <motion.div 
                className="text-lg md:text-3xl font-bold mb-1 md:mb-2"
                key={tokenMetrics?.marketCapEUR?.circulating}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                €{tokenMetrics?.marketCapEUR?.circulating?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </motion.div>
              <div className="text-green-300 text-sm md:text-lg font-semibold">Market Cap</div>
              <div className="text-green-400/80 text-xs md:text-sm mt-1 md:mt-2">
                FDV: €{tokenMetrics?.marketCapEUR?.fdv?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </div>
            </div>
          </motion.div>

          {/* Token Preis - Interaktiv */}
          <motion.div 
            className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl md:rounded-2xl border border-amber-500/40 p-4 md:p-6 backdrop-blur-sm cursor-pointer"
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Target className="w-6 h-6 md:w-10 md:h-10 text-amber-400" />
              </motion.div>
            </div>
            <div className="text-white">
              <motion.div 
                className="text-lg md:text-3xl font-bold mb-1 md:mb-2"
                key={tokenMetrics?.priceEUR}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                €{tokenMetrics?.priceEUR?.toFixed(6) || "0.000000"}
              </motion.div>
              <div className="text-amber-300 text-sm md:text-lg font-semibold">Token Preis</div>
              <div className="text-amber-400/80 text-xs md:text-sm mt-1 md:mt-2">EUR/D.FAITH</div>
            </div>
          </motion.div>

          {/* Aktive Fans - Ersetzt Total Supply */}
          <motion.div 
            className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl md:rounded-2xl border border-blue-500/40 p-4 md:p-6 backdrop-blur-sm cursor-pointer"
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Users className="w-6 h-6 md:w-10 md:h-10 text-blue-400" />
              </motion.div>
              <motion.div 
                className="text-blue-400 text-xs"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎵
              </motion.div>
            </div>
            <div className="text-white">
              <motion.div 
                className="text-lg md:text-3xl font-bold mb-1 md:mb-2"
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {Math.floor(circulatingSupply / 1000).toLocaleString()}K
              </motion.div>
              <div className="text-blue-300 text-sm md:text-lg font-semibold">Aktive Fans</div>
              <div className="text-blue-400/80 text-xs md:text-sm mt-1 md:mt-2">
                {circulatingSupply.toLocaleString()} Tokens
              </div>
            </div>
          </motion.div>

          {/* Community Owned - Erweitert */}
          <motion.div 
            className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl md:rounded-2xl border border-purple-500/40 p-4 md:p-6 backdrop-blur-sm cursor-pointer"
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <motion.div
                animate={{ rotate: [0, 15, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Coins className="w-6 h-6 md:w-10 md:h-10 text-purple-400" />
              </motion.div>
              <motion.div 
                className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(0) : "0"}%
              </motion.div>
            </div>
            <div className="text-white">
              <motion.div 
                className="text-lg md:text-3xl font-bold mb-1 md:mb-2"
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {circulatingSupply.toLocaleString()}
              </motion.div>
              <div className="text-purple-300 text-sm md:text-lg font-semibold">Community</div>
              <div className="text-purple-400/80 text-xs md:text-sm mt-1 md:mt-2">
                Im freien Umlauf
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Mobile-optimierte Token Distribution Chart */}
      <motion.div 
        className="bg-gradient-to-br from-zinc-900/50 to-zinc-800/30 rounded-xl md:rounded-2xl border border-amber-500/30 p-4 md:p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <motion.h3 
          className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 text-center"
          whileHover={{ scale: 1.02 }}
        >
          🎯 Token Verteilung
        </motion.h3>
        
        <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8">
          {/* Chart - Mobile angepasst */}
          <div className="w-full max-w-md md:max-w-lg mx-auto lg:mx-0">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #f59e0b',
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                  formatter={(value: any) => [`${value}%`, 'Anteil']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Mobile-optimierte Legend */}
          <div className="w-full lg:w-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4">
              {pieChartData.map((item, index) => (
                <motion.div 
                  key={index}
                  className="flex items-center gap-3 p-3 md:p-4 rounded-xl bg-gradient-to-r from-zinc-800/50 to-zinc-700/30 border border-zinc-600/30 cursor-pointer"
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <motion.div 
                    className="w-4 h-4 md:w-5 md:h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm md:text-base truncate">{item.name}</div>
                    <div className="text-zinc-400 text-xs md:text-sm">{item.percentage.toFixed(1)}%</div>
                  </div>
                  <motion.div 
                    className="text-lg md:text-xl font-bold"
                    style={{ color: item.color }}
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  >
                    {item.percentage.toFixed(0)}%
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile-optimiertes Community Ecosystem */}
      <motion.div 
        className="bg-gradient-to-br from-zinc-900/50 to-zinc-800/30 rounded-xl md:rounded-2xl border border-purple-500/30 p-4 md:p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <motion.h3 
          className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 text-center"
          whileHover={{ scale: 1.02 }}
        >
          🌟 Community Features
        </motion.h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Staking Rewards - Interaktiv */}
          <motion.div 
            className="group p-4 md:p-6 rounded-xl bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/30 cursor-pointer"
            whileHover={{ scale: 1.03, rotate: 1 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Zap className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
              </motion.div>
              <div>
                <h4 className="text-white font-bold text-sm md:text-lg">Staking Rewards</h4>
                <p className="text-green-300 text-xs md:text-sm">Bis zu 15% APY</p>
              </div>
            </div>
            <p className="text-zinc-300 text-xs md:text-sm leading-relaxed">
              Verdiene passive Belohnungen durch das Staken deiner D.FAITH Token
            </p>
            <motion.div 
              className="mt-3 text-green-400 text-xs md:text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
              initial={{ y: 10 }}
              whileHover={{ y: 0 }}
            >
              → Tippe zum Staken
            </motion.div>
          </motion.div>

          {/* Exclusive Content - Interaktiv */}
          <motion.div 
            className="group p-4 md:p-6 rounded-xl bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30 cursor-pointer"
            whileHover={{ scale: 1.03, rotate: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <motion.div
                animate={{ 
                  y: [0, -3, 0],
                  rotate: [0, 5, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Crown className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
              </motion.div>
              <div>
                <h4 className="text-white font-bold text-sm md:text-lg">Exklusiver Content</h4>
                <p className="text-purple-300 text-xs md:text-sm">VIP Zugang</p>
              </div>
            </div>
            <p className="text-zinc-300 text-xs md:text-sm leading-relaxed">
              Früher Zugang zu neuen Tracks und exklusiven Live-Sessions
            </p>
            <motion.div 
              className="mt-3 text-purple-400 text-xs md:text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
              initial={{ y: 10 }}
              whileHover={{ y: 0 }}
            >
              → Entdecke VIP Bereich
            </motion.div>
          </motion.div>

          {/* Voting Rights - Interaktiv */}
          <motion.div 
            className="group p-4 md:p-6 rounded-xl bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/30 cursor-pointer sm:col-span-2 lg:col-span-1"
            whileHover={{ scale: 1.03, rotate: 1 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Vote className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
              </motion.div>
              <div>
                <h4 className="text-white font-bold text-sm md:text-lg">Governance</h4>
                <p className="text-blue-300 text-xs md:text-sm">Mitbestimmung</p>
              </div>
            </div>
            <p className="text-zinc-300 text-xs md:text-sm leading-relaxed">
              Stimme über zukünftige Projekte und Community-Entscheidungen ab
            </p>
            <motion.div 
              className="mt-3 text-blue-400 text-xs md:text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
              initial={{ y: 10 }}
              whileHover={{ y: 0 }}
            >
              → Zu den Abstimmungen
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Mobile-optimierte Leaderboard Section */}
      <motion.div 
        className="bg-gradient-to-br from-zinc-900/50 to-zinc-800/30 rounded-xl md:rounded-2xl border border-amber-500/30 p-4 md:p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 md:mb-6">
          <motion.h3 
            className="text-xl md:text-2xl font-bold text-white text-center sm:text-left"
            whileHover={{ scale: 1.02 }}
          >
            🏆 Top Community Members
          </motion.h3>
          <motion.button
            onClick={() => setShowLeaderboardModal(true)}
            className="px-4 md:px-6 py-2 md:py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm md:text-base transition-all duration-300 shadow-lg hover:shadow-amber-500/30 w-full sm:w-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4 md:w-5 md:h-5" />
              Vollständige Rangliste
            </span>
          </motion.button>
        </div>
        
        {/* Mobile-optimierte Top 3 Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {topHolders.slice(0, 3).map((holder, index) => (
            <motion.div 
              key={index}
              className="p-3 md:p-4 rounded-xl bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-500/20 text-center cursor-pointer"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div 
                className="text-2xl md:text-3xl mb-1 md:mb-2"
                animate={{ 
                  rotate: index === 0 ? [0, 10, -10, 0] : 0,
                  scale: index === 0 ? [1, 1.1, 1] : 1
                }}
                transition={{ duration: 2, repeat: index === 0 ? Infinity : 0 }}
              >
                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
              </motion.div>
              <div className="text-white font-semibold text-sm md:text-base mb-1 truncate">
                {holder.address}
              </div>
              <div className="text-amber-300 text-xs md:text-sm font-bold">
                {holder.balance.toLocaleString()} D.FAITH
              </div>
              <div className="text-amber-400/70 text-xs mt-1">
                {holder.percentage.toFixed(1)}%
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLeaderboardModal(false)}
          >
            <motion.div
              className="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-4xl w-full max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700 p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-white">Top Community Members</h3>
                      <p className="text-zinc-400 text-sm">Vollständige Rangliste der D.FAITH Holder</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLeaderboardModal(false)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto">
                <div className="text-center text-zinc-400 py-8">
                  Detaillierte Leaderboard-Daten werden hier angezeigt
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
