import { useState, useEffect } from "react";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Users, Coins, DollarSign, ExternalLink, FileText, Target } from 'lucide-react';

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
      className="flex flex-col gap-8 p-6 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Werbefreundlicher Hero Section */}
      <motion.div 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-amber-500/20 p-8"
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
            className="flex items-center justify-center gap-6 mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <motion.img 
              src="/D.FAITH.png" 
              alt="D.FAITH Token" 
              className="w-24 h-24 object-contain"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-3">
                D.FAITH Ecosystem
              </h1>
              <p className="text-amber-300 text-xl max-w-2xl">
                Das innovative Musik-Token, das Fans und Künstler zusammenbringt
              </p>
            </div>
          </motion.div>
          
          {/* Call-to-Action */}
          <motion.div 
            className="flex flex-wrap items-center justify-center gap-4 mt-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.a
              href="https://docs.google.com/document/d/1YourWhitepaperLink"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg transition-all duration-300 shadow-xl hover:shadow-amber-500/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FileText className="w-6 h-6" />
              Whitepaper entdecken
              <ExternalLink className="w-5 h-5 opacity-70" />
            </motion.a>
            
            <motion.a 
              href="#live-trading" 
              className="flex items-center gap-3 px-8 py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all duration-300 shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <TrendingUp className="w-6 h-6" />
              Jetzt handeln
            </motion.a>
          </motion.div>
        </div>
      </motion.div>

      {/* Live Market Overview */}
      <motion.div variants={itemVariants}>
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          🚀 Live Market Data
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Market Cap */}
          <motion.div 
            className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-2xl border border-green-500/40 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.03, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-10 h-10 text-green-400" />
              <motion.div 
                className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                LIVE
              </motion.div>
            </div>
            <div className="text-white">
              <div className="text-3xl font-bold mb-2">
                €{tokenMetrics?.marketCapEUR?.circulating?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </div>
              <div className="text-green-300 text-lg font-semibold">Market Cap</div>
              <div className="text-green-400/80 text-sm mt-2">
                FDV: €{tokenMetrics?.marketCapEUR?.fdv?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
              </div>
            </div>
          </motion.div>

          {/* Token Preis */}
          <motion.div 
            className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-2xl border border-amber-500/40 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.03, y: -5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <Target className="w-10 h-10 text-amber-400" />
            </div>
            <div className="text-white">
              <div className="text-3xl font-bold mb-2">
                €{tokenMetrics?.priceEUR?.toFixed(6) || "0.000000"}
              </div>
              <div className="text-amber-300 text-lg font-semibold">Token Preis</div>
              <div className="text-amber-400/80 text-sm mt-2">EUR/D.FAITH</div>
            </div>
          </motion.div>

          {/* Total Supply */}
          <motion.div 
            className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-2xl border border-blue-500/40 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.03, y: -5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <Coins className="w-10 h-10 text-blue-400" />
            </div>
            <div className="text-white">
              <div className="text-3xl font-bold mb-2">{totalSupply.toLocaleString()}</div>
              <div className="text-blue-300 text-lg font-semibold">Total Supply</div>
              <div className="text-blue-400/80 text-sm mt-2">D.FAITH Token</div>
            </div>
          </motion.div>

          {/* Community Owned */}
          <motion.div 
            className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-2xl border border-purple-500/40 p-6 backdrop-blur-sm"
            whileHover={{ scale: 1.03, y: -5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-10 h-10 text-purple-400" />
            </div>
            <div className="text-white">
              <div className="text-3xl font-bold mb-2">{circulatingSupply.toLocaleString()}</div>
              <div className="text-purple-300 text-lg font-semibold">Community</div>
              <div className="text-purple-400/80 text-sm mt-2">
                {totalSupply > 0 ? ((circulatingSupply / totalSupply) * 100).toFixed(1) : "0"}% im Umlauf
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Token Distribution Showcase */}
      <motion.div 
        id="token-distribution" 
        className="bg-zinc-900/50 rounded-2xl border border-zinc-700/50 p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold text-white mb-4">
            🎯 Transparente Token-Verteilung
          </h3>
          <p className="text-zinc-300 text-lg max-w-3xl mx-auto">
            Faire und nachvollziehbare Verteilung für nachhaltiges Wachstum des Ecosystems
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Professioneller Pie Chart */}
          <div className="bg-zinc-800/40 rounded-xl p-6 border border-zinc-700/50">
            <h4 className="text-xl font-semibold text-white mb-6 text-center">Token Allocation</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={120}
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

          {/* Token Distribution Details */}
          <div className="space-y-4">
            {pieChartData.map((item, index) => (
              <motion.div
                key={item.name}
                className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-white font-bold text-lg">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{item.value.toLocaleString()}</div>
                    <div className="text-lg font-semibold" style={{ color: item.color }}>
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <motion.div
                    className="h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ delay: index * 0.2, duration: 1 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Live Trading & DexScreener Integration */}
      <motion.div 
        id="live-trading" 
        className="bg-zinc-900/60 rounded-2xl border border-zinc-700/50 p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold text-white mb-4">
            📈 Live Trading Hub
          </h3>
          <p className="text-zinc-300 text-lg max-w-2xl mx-auto">
            Handeln Sie D.FAITH direkt auf der Base Chain mit Echtzeit-Marktdaten
          </p>
        </div>
        
        <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
          <div className="w-full h-96 rounded-lg overflow-hidden">
            <iframe
              src="https://dexscreener.com/base/0x7109214bafde13a6ef8060644656464bccab93cd?embed=1&theme=dark&trades=0&info=0"
              width="100%"
              height="100%"
              frameBorder="0"
              className="w-full h-full rounded-lg"
              title="DexScreener Live Trading Chart"
            />
          </div>
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-300 text-sm">
              🔗 Base Chain Pool: 0x7109214bafde13a6ef8060644656464bccab93cd
            </div>
          </div>
        </div>
      </motion.div>

      {/* Community & Staking Ecosystem */}
      <motion.div 
        className="bg-zinc-900/60 rounded-2xl border border-zinc-700/50 p-8 backdrop-blur-sm"
        variants={itemVariants}
      >
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold text-white mb-4">
            🌟 Community Ecosystem
          </h3>
          <p className="text-zinc-300 text-lg max-w-3xl mx-auto">
            Verdienen Sie D.FAITH durch Social Media Aktivitäten und staken Sie D.INVEST für Belohnungen
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* D.INVEST Staking */}
          <div className="space-y-6">
            <h4 className="text-2xl font-bold text-blue-400 mb-6 text-center">
              🚀 D.INVEST Staking
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div 
                className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-4 border border-green-500/30"
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-green-300 text-sm font-medium mb-2 flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 bg-green-400 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  Community Owned
                </div>
                <div className="text-white font-bold text-2xl">
                  {dinvestBalance ? (10000 - parseInt(dinvestBalance.balance)).toLocaleString() : "0"}
                </div>
                <div className="text-green-400 text-sm">
                  {dinvestBalance ? (((10000 - parseInt(dinvestBalance.balance)) / 10000) * 100).toFixed(1) : "0"}% verkauft
                </div>
              </motion.div>
              
              <motion.div 
                className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl p-4 border border-amber-500/30"
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-amber-300 text-sm font-medium mb-2 flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 bg-amber-400 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  />
                  Verfügbar
                </div>
                <div className="text-white font-bold text-2xl">
                  {dinvestBalance ? parseInt(dinvestBalance.balance).toLocaleString() : "0"}
                </div>
                <div className="text-amber-400 text-sm">5€ pro Token</div>
              </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                className="bg-zinc-800/50 rounded-xl p-4 border border-blue-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-blue-300 text-sm font-medium mb-1">Total Gestaked</div>
                <div className="text-white font-bold text-xl">{totalStaked?.toLocaleString() || "0"}</div>
                <div className="text-blue-400 text-xs">D.INVEST</div>
              </motion.div>
              
              <motion.div 
                className="bg-zinc-800/50 rounded-xl p-4 border border-purple-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-purple-300 text-sm font-medium mb-1">Rewards Pool</div>
                <div className="text-white font-bold text-xl">{stakingTokens.toFixed(2)}</div>
                <div className="text-purple-400 text-xs">D.FAITH</div>
              </motion.div>
            </div>
          </div>

          {/* Fan Leaderboard Teaser */}
          <div className="space-y-6">
            <h4 className="text-2xl font-bold text-yellow-400 mb-6 text-center">
              🏆 Fan Leaderboard
            </h4>
            
            <div className="bg-zinc-800/50 rounded-xl p-6 border border-yellow-500/20">
              <div className="text-center mb-4">
                <div className="text-yellow-300 text-4xl mb-2">🎵</div>
                <h5 className="text-white font-bold text-lg mb-2">Social Media Belohnungen</h5>
                <p className="text-zinc-400 text-sm">
                  Sammle EXP durch Instagram, TikTok & Facebook Posts und gewinne D.FAITH Rewards
                </p>
              </div>
              
              <motion.button
                onClick={() => setShowLeaderboardModal(true)}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-yellow-500/25"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>🏆 Leaderboard anzeigen</span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <motion.div 
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-gradient-to-r from-yellow-500/10 to-yellow-400/10">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-300 text-2xl">🏆</span>
                  <div>
                    <h3 className="text-white font-bold text-lg">Fan Leaderboard</h3>
                    <p className="text-zinc-400 text-sm">Top Performer nach EXP</p>
                  </div>
                </div>
                <motion.button 
                  onClick={() => setShowLeaderboardModal(false)} 
                  className="text-zinc-400 hover:text-white text-xl"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✖
                </motion.button>
              </div>
              
              <div className="px-6 py-4 max-h-96 overflow-y-auto">
                {lbLoading && (
                  <div className="text-center py-8 text-zinc-400">
                    <div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                    Lade Leaderboard...
                  </div>
                )}
                
                {(lbData?.entries || []).length === 0 && !lbLoading && (
                  <div className="text-center py-8 text-zinc-400">
                    Keine Einträge gefunden
                  </div>
                )}
                
                {(lbData?.entries || []).slice(0, 10).map((entry, idx) => {
                  const primary = entry.instagram || entry.tiktok || entry.facebook || '-';
                  const platformIcon = entry.instagram ? '📸' : entry.tiktok ? '🎵' : entry.facebook ? '👥' : '❓';
                  
                  return (
                    <motion.div
                      key={entry.rank}
                      className="flex items-center justify-between py-3 border-b border-zinc-800/50 last:border-b-0"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-zinc-300">
                          #{entry.rank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{platformIcon}</span>
                            <span className="text-white font-medium">{primary}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-bold">{entry.expTotal.toLocaleString()}</div>
                        <div className="text-zinc-400 text-xs">EXP</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
