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

  // Leaderboard Modal State
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [lbData, setLbData] = useState<LeaderboardResponse | null>(null);
  const [lbLoading, setLbLoading] = useState(false);

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
          
          // Debug: Token Verteilung
          const davidTokens = parseFloat(davidData?.balanceRaw || "0");
          const metricsData = await metricsRes.json().catch(() => null);
          console.log("🔍 Token Distribution Debug:", {
            totalSupply: metricsData?.supply?.total || 0,
            davidBalance: davidTokens,
            poolTokens: metricsData?.balances?.tokenInPool || 0,
            percentage: metricsData?.supply?.total > 0 ? ((davidTokens / metricsData?.supply?.total) * 100).toFixed(2) + "%" : "0%"
          });
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

        // Leaderboard-Daten auch hier laden für Token-Verteilung
        try {
          const lbRes = await fetch('/api/leaderboard-proxy', { cache: 'no-store' });
          if (lbRes.ok) {
            const lbRaw = await lbRes.json();
            const lbData: LeaderboardResponse = (lbRaw?.entries || lbRaw?.prizes || lbRaw?.timer) ? lbRaw : (lbRaw?.data || { entries: [], prizes: [] });
            setLbData({
              entries: lbData.entries || [],
              prizes: lbData.prizes || [],
              timer: lbData.timer,
              lastUpdated: lbData.lastUpdated,
            });
            console.log("✅ Leaderboard Data loaded:", lbData.entries?.length, "entries");
          }
        } catch (lbError) {
          console.log("❌ Leaderboard loading failed:", lbError);
        }

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
      setLbLoading(true);
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

  // Berechnungen mit echten API-Daten
  const totalSupply = tokenMetrics?.supply?.total || 0;
  const davidBalanceNum = parseFloat(davidBalance?.balanceRaw || "0");
  const stakingTokens = contractBalance || 0;
  const poolTokens = tokenMetrics?.balances?.tokenInPool || 0;
  
  // Community = Total Supply - Dawid Faith Holdings - Staking Rewards - Pool Tokens
  const circulatingSupply = Math.max(0, totalSupply - davidBalanceNum - stakingTokens - poolTokens);
  const davidPercentage = totalSupply > 0 ? (davidBalanceNum / totalSupply) * 100 : 0;

  // Aktive Fans aus Leaderboard API (verwende lbData)
  const activeFansCount = lbData?.entries?.length || 0;
  const topFans = lbData?.entries?.slice(0, 10) || [];

  // Top Holders aus echten Leaderboard-Daten
  const topHolders = topFans.map((fan, index) => ({
    address: fan.username || `Fan ${index + 1}`,
    balance: fan.points || 0,
    rank: fan.rank || index + 1
  }));

  // Chart-Daten für Token Verteilung (mit korrekter Dawid Faith Balance)
  const pieChartData = [
    { 
      name: 'Dawid Faith', 
      value: davidBalanceNum, 
      color: '#f59e0b', 
      percentage: davidPercentage,
      tokens: davidBalanceNum,
      description: 'Creator Holdings'
    },
    { 
      name: 'DEX Pool', 
      value: poolTokens, 
      color: '#10b981', 
      percentage: totalSupply > 0 ? (poolTokens / totalSupply) * 100 : 0,
      tokens: poolTokens,
      description: 'Liquidity Pool'
    },
    { 
      name: 'Staking Rewards', 
      value: stakingTokens, 
      color: '#3b82f6', 
      percentage: totalSupply > 0 ? (stakingTokens / totalSupply) * 100 : 0,
      tokens: stakingTokens,
      description: 'Contract Balance'
    },
    { 
      name: 'Community', 
      value: circulatingSupply, 
      color: '#8b5cf6', 
      percentage: totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 0,
      tokens: circulatingSupply,
      description: 'Public Circulation'
    }
  ].filter(item => item.value > 0);

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

      {/* DexScreener Live Price Chart */}
      <motion.div 
        className="bg-gradient-to-br from-zinc-900/50 to-zinc-800/30 rounded-xl md:rounded-2xl border border-green-500/30 p-4 md:p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <motion.h3 
          className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 text-center"
          whileHover={{ scale: 1.02 }}
        >
          📈 Live Preis Chart
        </motion.h3>
        
        <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-700/50">
          <iframe
            src="https://dexscreener.com/base/0x69eFD833288605f320d77eB2aB99DDE62919BbC1?embed=1&theme=dark&trades=0&info=0"
            className="w-full h-[400px] md:h-[500px] border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="D.FAITH Live Price Chart"
          />
          <motion.div 
            className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            LIVE
          </motion.div>
        </div>
        
        <div className="mt-4 text-center">
          <motion.a
            href="https://dexscreener.com/base/0x69eFD833288605f320d77eB2aB99DDE62919BbC1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Vollbild-Chart öffnen</span>
          </motion.a>
        </div>
      </motion.div>

      {/* Live Market Data Grid - Mobile First */}
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

          {/* Aktive Fans - Aus Leaderboard */}
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
                {activeFansCount}
              </motion.div>
              <div className="text-blue-300 text-sm md:text-lg font-semibold">Aktive Fans</div>
              <div className="text-blue-400/80 text-xs md:text-sm mt-1 md:mt-2">
                Im Leaderboard
              </div>
            </div>
          </motion.div>

          {/* Community Supply */}
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
                    fontSize: '0.875rem',
                    padding: '12px'
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    const entry = props.payload;
                    return [
                      <div key="tooltip" className="space-y-1">
                        <div className="font-semibold">{entry.name}</div>
                        <div className="text-sm">{entry.tokens.toLocaleString()} Tokens</div>
                        <div className="text-xs opacity-80">{entry.description}</div>
                        <div className="font-bold text-amber-400">{entry.percentage.toFixed(2)}%</div>
                      </div>
                    ];
                  }}
                  labelFormatter={() => "Token Verteilung"}
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
                    <div className="text-zinc-400 text-xs md:text-sm">
                      {item.tokens.toLocaleString()} Tokens ({item.percentage.toFixed(1)}%)
                    </div>
                    <div className="text-zinc-500 text-xs mt-1">{item.description}</div>
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

      {/* Top Community Members aus Leaderboard */}
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
        
        {/* Top 3 Preview aus echten Leaderboard-Daten */}
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
                {holder.balance.toLocaleString()} Punkte
              </div>
              <div className="text-amber-400/70 text-xs mt-1">
                Rang #{holder.rank}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Debug Section für Token Verteilung */}
      {process.env.NODE_ENV === 'development' && (
        <motion.div 
          className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 p-4 backdrop-blur-sm"
          variants={itemVariants}
        >
          <h4 className="text-white font-bold mb-3">🔍 Token Verteilung Debug</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="text-zinc-300">
                <span className="text-amber-400 font-semibold">Total Supply:</span> {totalSupply.toLocaleString()}
              </div>
              <div className="text-zinc-300">
                <span className="text-orange-400 font-semibold">Dawid Faith Balance:</span> {davidBalanceNum.toLocaleString()} ({davidPercentage.toFixed(2)}%)
              </div>
              <div className="text-zinc-300">
                <span className="text-green-400 font-semibold">Pool Tokens:</span> {poolTokens.toLocaleString()}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-zinc-300">
                <span className="text-blue-400 font-semibold">Staking Rewards:</span> {stakingTokens.toLocaleString()}
              </div>
              <div className="text-zinc-300">
                <span className="text-purple-400 font-semibold">Community Supply:</span> {circulatingSupply.toLocaleString()}
              </div>
              <div className="text-zinc-300">
                <span className="text-zinc-400 font-semibold">API Status:</span> 
                <span className={`ml-2 ${tokenMetrics ? 'text-green-400' : 'text-red-400'}`}>
                  {tokenMetrics ? '✅ Connected' : '❌ Failed'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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
                      <h3 className="text-xl md:text-2xl font-bold text-white">Community Leaderboard</h3>
                      <p className="text-zinc-400 text-sm">Top D.FAITH Community Members</p>
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
                {lbLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <div className="text-zinc-400">Loading leaderboard...</div>
                  </div>
                ) : lbData?.entries && lbData.entries.length > 0 ? (
                  <div className="space-y-4">
                    {lbData.entries.slice(0, 50).map((entry, index) => (
                      <motion.div
                        key={entry.userId || index}
                        className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="text-xl font-bold text-amber-400 min-w-12 text-center">
                          #{entry.rank || index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-bold">{entry.username || "Anonymous User"}</div>
                          <div className="text-zinc-400 text-sm">{entry.points?.toLocaleString() || 0} Punkte</div>
                        </div>
                        <div className="text-2xl">
                          {index === 0 ? "👑" : index < 3 ? "⭐" : "🎵"}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-zinc-400">Keine Leaderboard-Daten verfügbar</div>
                    <p className="text-zinc-500 text-sm mt-2">Werde Teil der Community und sammle Punkte!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
