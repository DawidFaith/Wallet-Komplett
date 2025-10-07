import { useState, useEffect } from "react";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Users, Coins, DollarSign, ExternalLink, FileText, Target, Zap, Crown, Vote, Trophy, Timer, Award, X, BarChart3 } from 'lucide-react';
import { Button } from "../../../components/ui/button";

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

  // Metriken Modal State
  const [showMetricsModal, setShowMetricsModal] = useState(false);

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-950 via-orange-950 to-yellow-950 text-white">
      <motion.div 
        className="space-y-6 md:space-y-8 p-4 md:p-6 max-w-7xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
      {/* Dawid Faith Tokenomics - Ultra Professional Header Design */}
      <div className="relative mb-8 overflow-hidden">
        {/* Hintergrundbild Container */}
        <div className="absolute inset-0">
          {/* Hintergrundbild */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('/Still 2025-03-19 193121_19.7.1.jpg')`
            }}
          />
          {/* Gradient-Overlays für bessere Lesbarkeit */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50"></div>
          
          {/* Farb-Overlay für Branding */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-950/30 via-amber-900/20 to-yellow-950/25"></div>
          
          {/* Subtile Textur-Overlays */}
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white via-transparent to-white"></div>
          
          {/* Animated Elements */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-amber-600/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: "1s"}}></div>
          <div className="absolute bottom-1/3 left-1/3 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl animate-pulse" style={{animationDelay: "2s"}}></div>
        </div>
        
        {/* Hauptinhalt */}
        <div className="relative">
          <motion.div 
            className="text-center p-4 md:p-6 backdrop-blur-sm"
            variants={itemVariants}
          >
            {/* Großes, zentrales Logo */}
            <div className="flex justify-center mb-6">
              <motion.div
                className="w-32 h-32 md:w-48 md:h-48 lg:w-56 lg:h-56 xl:w-64 xl:h-64 rounded-full bg-gradient-to-br from-amber-900/20 via-orange-900/30 to-yellow-900/20 backdrop-blur-sm border-2 border-orange-500/20 flex items-center justify-center overflow-hidden shadow-2xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                whileHover={{ 
                  scale: 1.05,
                  borderColor: "rgba(249, 115, 22, 0.4)"
                }}
              >
                <img
                  src="/D.FAITH.png"
                  alt="D.FAITH Token"
                  className="w-[85%] h-[85%] object-cover rounded-full"
                />
              </motion.div>
            </div>

            {/* Haupttitel mit eleganten Linien und Branding - wie im MerchTab Stil */}
            <div className="relative mb-4">
              {/* Elegante horizontale Linie mit Glow-Effekt */}
              <div className="relative mb-4">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent transform -translate-y-1/2"></div>
                <div className="text-center">
                  <div className="inline-block px-8 py-2 bg-black/60 backdrop-blur-sm rounded-full border border-orange-500/30">
                    <span className="bg-gradient-to-r from-orange-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent font-bold text-lg md:text-xl">
                      DAWID FAITH TOKENOMICS
                    </span>
                  </div>
                  {/* Unterlinie für zusätzliche Eleganz */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
                </div>
              </div>
              

            </div>

            {/* Beschreibungstext */}
            <motion.p 
              className="text-lg md:text-xl text-amber-200/90 mb-6 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Entdecke die <span className="text-orange-300 font-semibold">Tokenomics</span>, <span className="text-amber-300 font-semibold">Metriken</span> und <span className="text-yellow-300 font-semibold">Community-Statistiken</span> von <span className="bg-gradient-to-r from-orange-200 to-yellow-300 bg-clip-text text-transparent font-bold">Dawid Faith</span>
            </motion.p>
        {/* Visuell verbesserte Call-to-Action Buttons */}
        <div className="flex flex-col items-center gap-6 md:gap-8 relative">
          
          {/* Primäre Actions */}
          <motion.div 
            className="relative flex flex-col sm:flex-row gap-6 md:gap-8 w-full sm:w-auto z-10"
            variants={itemVariants}
          >
            <motion.a 
              href="/Dawid_Faith_Whitepaper.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group relative flex items-center gap-3 px-6 md:px-10 py-4 md:py-5 rounded-2xl bg-gradient-to-r from-black/60 to-black/80 hover:from-black/50 hover:to-black/70 text-white font-bold text-sm md:text-lg transition-all duration-300 border border-orange-500/30 shadow-2xl w-full sm:w-auto overflow-hidden backdrop-blur-sm"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Animierter Hintergrund-Gradient */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                animate={{ x: [-100, 100] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              
              <div className="relative flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <FileText className="w-5 h-5 md:w-7 md:h-7 text-orange-400" />
                </motion.div>
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold">Whitepaper studieren</span>
                  <span className="text-zinc-400 text-xs md:text-sm">Technische Details & Vision</span>
                </div>
                <ExternalLink className="w-4 h-4 md:w-5 md:h-5 opacity-70 ml-2" />
              </div>
            </motion.a>
            
            <motion.a 
              href="https://dawidfaith.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group relative flex items-center gap-3 px-6 md:px-10 py-4 md:py-5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm md:text-lg transition-all duration-300 shadow-2xl w-full sm:w-auto overflow-hidden"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Animierter Shine-Effekt */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: [-100, 200] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              
              <div className="relative flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Crown className="w-5 h-5 md:w-7 md:h-7 text-yellow-400" />
                </motion.div>
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold">Dawid Faith besuchen</span>
                  <span className="text-orange-100 text-xs md:text-sm">Offizielle Website</span>
                </div>
                <ExternalLink className="w-4 h-4 md:w-5 md:h-5 opacity-70 ml-2" />
              </div>
            </motion.a>
          </motion.div>

            </div>
          </motion.div>
        </div>
      </div>

      {/* DexScreener Live Price Chart */}
      <motion.div 
        className="bg-gradient-to-br from-amber-950/50 to-orange-950/30 rounded-xl md:rounded-2xl border border-orange-500/30 p-4 md:p-8 backdrop-blur-sm"
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
            className="absolute top-2 right-2 px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full border border-orange-500/30"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Vollbild-Chart öffnen</span>
          </motion.a>
        </div>
      </motion.div>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLeaderboardModal(false)}
          >
            <motion.div
              className="bg-gradient-to-br from-amber-950/90 to-orange-950/90 rounded-2xl border border-amber-700/50 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto backdrop-blur-sm"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                  <h2 className="text-2xl font-bold text-white">Fan Leaderboard</h2>
                </div>
                <motion.button
                  onClick={() => setShowLeaderboardModal(false)}
                  className="p-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Loading */}
              {lbLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-zinc-400">Lade Leaderboard...</p>
                </div>
              )}

              {/* Content */}
              {!lbLoading && lbData && (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-400">{lbData.entries?.length || 0}</div>
                      <div className="text-zinc-400 text-sm">Aktive Fans</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-400">{lbData.prizes?.length || 0}</div>
                      <div className="text-zinc-400 text-sm">Preise</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {lbData.entries?.reduce((sum, entry) => sum + (entry.points || 0), 0) || 0}
                      </div>
                      <div className="text-zinc-400 text-sm">Gesamt Punkte</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">LIVE</div>
                      <div className="text-zinc-400 text-sm">Status</div>
                    </div>
                  </div>

                  {/* Top Fans */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Crown className="w-6 h-6 text-yellow-400" />
                      Top Fans
                    </h3>
                    <div className="space-y-2">
                      {lbData.entries?.slice(0, 10).map((fan, index) => (
                        <motion.div
                          key={fan.userId || index}
                          className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold">
                            {fan.rank || index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-semibold">{fan.username || `Fan ${index + 1}`}</div>
                            <div className="text-zinc-400 text-sm">{fan.points || 0} Punkte</div>
                          </div>
                          {index < 3 && (
                            <motion.div
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Award className="w-6 h-6 text-yellow-400" />
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Prizes */}
                  {lbData.prizes && lbData.prizes.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        Preise
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lbData.prizes.map((prize, index) => (
                          <motion.div
                            key={index}
                            className="p-4 bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-lg border border-yellow-500/30"
                            whileHover={{ scale: 1.02 }}
                          >
                            <div className="text-yellow-400 font-bold text-lg">Platz {prize.position}</div>
                            <div className="text-white font-semibold">{prize.description}</div>
                            <div className="text-yellow-300 text-sm">{prize.value}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last Updated */}
                  {lbData.lastUpdated && (
                    <div className="text-center text-zinc-500 text-sm">
                      Zuletzt aktualisiert: {new Date(lbData.lastUpdated).toLocaleString('de-DE')}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schwebendes Metriken-Symbol - Unten rechts */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setShowMetricsModal(!showMetricsModal)}
          className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white relative shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 rounded-full w-16 h-16 p-0 flex items-center justify-center border border-orange-400/20"
        >
          <BarChart3 className="text-xl" />
          {/* Pulsierender Effekt für Aufmerksamkeit */}
          <div className="absolute inset-0 rounded-full bg-orange-400/20 animate-ping"></div>
        </Button>
      </div>

      {/* Metriken Modal */}
      <AnimatePresence>
        {showMetricsModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMetricsModal(false)}
          >
            <motion.div
              className="bg-gradient-to-br from-amber-950/90 to-orange-950/90 rounded-2xl border border-amber-700/50 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto backdrop-blur-sm"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-orange-400" />
                  <h2 className="text-2xl font-bold text-white">Live Metriken</h2>
                </div>
                <motion.button
                  onClick={() => setShowMetricsModal(false)}
                  className="p-2 rounded-lg bg-amber-800/50 hover:bg-amber-700/60 text-white transition-colors border border-amber-600/30"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Künstlerisches Metriken Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* D.FAITH Token - Vereinfacht */}
                <motion.div 
                  className="relative bg-gradient-to-br from-amber-900/40 via-yellow-800/30 to-orange-900/40 rounded-2xl border border-amber-500/50 p-6 overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Coins className="w-8 h-8 text-amber-400" />
                        <span className="text-amber-200 font-bold text-lg">D.FAITH</span>
                      </div>
                      <div className="px-3 py-2 rounded-full bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-400/50">
                        LIVE
                      </div>
                    </div>
                    <div className="text-white">
                      <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
                        €{tokenMetrics?.priceEUR?.toFixed(4) || "0.1700"}
                      </div>
                      <div className="text-amber-200 text-sm flex items-center gap-1">
                        <span>🎵</span>
                        Musikalischer Wert
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* D.INVEST Token - Vereinfacht */}
                <motion.div 
                  className="relative bg-gradient-to-br from-blue-900/40 via-cyan-800/30 to-indigo-900/40 rounded-2xl border border-blue-500/50 p-6 overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Target className="w-8 h-8 text-blue-400" />
                        <span className="text-blue-200 font-bold text-lg">D.INVEST</span>
                      </div>
                      <div className="px-3 py-2 rounded-full bg-blue-500/30 text-blue-300 text-xs font-bold border border-blue-400/50">
                        STABIL
                      </div>
                    </div>
                    <div className="text-white">
                      <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text text-transparent">
                        €{dinvestBalance?.priceEUR?.toFixed(2) || "5.00"}
                      </div>
                      <div className="text-blue-200 text-sm flex items-center gap-1">
                        <span>🎶</span>
                        Harmonische Balance
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Total Staked - Vereinfacht */}
                <motion.div 
                  className="relative bg-gradient-to-br from-purple-900/40 via-violet-800/30 to-fuchsia-900/40 rounded-2xl border border-purple-500/50 p-6 overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Zap className="w-8 h-8 text-purple-400" />
                        <span className="text-purple-200 font-bold text-lg">Total Staked</span>
                      </div>
                      <div className="px-3 py-2 rounded-full bg-purple-500/30 text-purple-300 text-xs font-bold border border-purple-400/50">
                        ENERGIE
                      </div>
                    </div>
                    <div className="text-white">
                      <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-300 to-fuchsia-200 bg-clip-text text-transparent">
                        {totalStaked?.toLocaleString() || "79.999,99"}
                      </div>
                      <div className="text-purple-200 text-sm flex items-center gap-1">
                        <span>🎚️</span>
                        Elektrische Komposition
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Rewards Verteilt - Vereinfacht */}
                <motion.div 
                  className="relative bg-gradient-to-br from-green-900/40 via-emerald-800/30 to-teal-900/40 rounded-2xl border border-green-500/50 p-6 overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{ 
                            rotateY: [0, 360],
                            scale: [1, 1.3, 1],
                            filter: [
                              "drop-shadow(0 0 5px rgba(34, 197, 94, 0.5))",
                              "drop-shadow(0 0 15px rgba(16, 185, 129, 0.8))",
                              "drop-shadow(0 0 5px rgba(34, 197, 94, 0.5))"
                            ]
                          }}
                          transition={{ duration: 3.5, repeat: Infinity }}
                        >
                          <Trophy className="w-8 h-8 text-green-400" />
                        </motion.div>
                        <span className="text-green-200 font-bold text-lg">Rewards verteilt</span>
                      </div>
                      <motion.div 
                        className="px-3 py-2 rounded-full bg-green-500/30 text-green-300 text-xs font-bold border border-green-400/50"
                        animate={{ 
                          boxShadow: [
                            "0 0 10px rgba(34, 197, 94, 0.3)",
                            "0 0 20px rgba(16, 185, 129, 0.6)",
                            "0 0 10px rgba(34, 197, 94, 0.3)"
                          ]
                        }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      >
                        TRIUMPH
                      </motion.div>
                    </div>
                    <div className="text-white">
                      <motion.div 
                        className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-300 to-emerald-200 bg-clip-text text-transparent"
                        animate={{ 
                          scale: [1, 1.05, 1],
                          textShadow: [
                            "0 0 10px rgba(34, 197, 94, 0.6)",
                            "0 0 20px rgba(16, 185, 129, 0.8)",
                            "0 0 10px rgba(34, 197, 94, 0.6)"
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        {totalRewardsDistributed?.toLocaleString() || "0.0"}
                      </motion.div>
                      <div className="text-green-200 text-sm flex items-center gap-1">
                        <motion.span
                          animate={{ 
                            rotate: [0, 360],
                            opacity: [0.7, 1, 0.7]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          🎖️
                        </motion.span>
                        Sieges-Melodie
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Halving Stufe - Vereinfacht */}
                <motion.div 
                  className="relative bg-gradient-to-br from-red-900/40 via-rose-800/30 to-pink-900/40 rounded-2xl border border-red-500/50 p-6 overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Timer className="w-8 h-8 text-red-400" />
                        <span className="text-red-200 font-bold text-lg">Halving Stufe</span>
                      </div>
                      <div className="px-3 py-2 rounded-full bg-red-500/30 text-red-300 text-xs font-bold border border-red-400/50">
                        DRAMA
                      </div>
                    </div>
                    <div className="text-white">
                      <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-red-300 to-rose-200 bg-clip-text text-transparent">
                        Stufe {currentStage || "1"}
                      </div>
                      <div className="text-red-200 text-sm flex items-center gap-1">
                        <span>🎪</span>
                        Epische Phase
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Bis Halving */}
                <motion.div 
                  className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl border border-orange-500/40 p-4"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-6 h-6 text-orange-400" />
                      <span className="text-orange-300 font-semibold">Bis Halving</span>
                    </div>
                  </div>
                  <div className="text-white">
                    <div className="text-2xl font-bold mb-1">
                      {(() => {
                        // Korrigierte Berechnung: Rewards bis zur NÄCHSTEN Stufe
                        const stage = currentStage || 1;
                        const currentRewardsDistributed = totalRewardsDistributed || 0;
                        let nextThreshold = 0;
                        
                        // Bestimme den Threshold für die nächste Stufe (basierend auf verteilten Rewards)
                        switch(stage) {
                          case 1: nextThreshold = 10000; break;    // Von Stufe 1 zu Stufe 2
                          case 2: nextThreshold = 20000; break;    // Von Stufe 2 zu Stufe 3  
                          case 3: nextThreshold = 40000; break;   // Von Stufe 3 zu Stufe 4
                          case 4: nextThreshold = 60000; break;   // Von Stufe 4 zu Stufe 5
                          case 5: nextThreshold = 80000; break;   // Von Stufe 5 zu Max
                          default: 
                            // Wenn bereits auf höchster Stufe
                            return "Max erreicht";
                        }
                        
                        // Berechne verbleibende Rewards bis nächste Stufe
                        const rewardsUntilNext = Math.max(0, nextThreshold - currentRewardsDistributed);
                        
                        // Debug Info (wird nur in Console angezeigt)
                        if (typeof window !== 'undefined') {
                          console.log(`🔍 Halving Berechnung:`, {
                            currentStage: stage,
                            currentRewardsDistributed,
                            nextThreshold,
                            rewardsUntilNext,
                            calculation: `${nextThreshold} - ${currentRewardsDistributed} = ${rewardsUntilNext}`
                          });
                        }
                        
                        return rewardsUntilNext.toLocaleString();
                      })()}
                    </div>
                    <div className="text-orange-300 text-sm">
                      D.FAITH Rewards bis Halving
                    </div>
                  </div>
                </motion.div>

                {/* Active Users - Vereinfacht */}
                <motion.div 
                  className="relative bg-gradient-to-br from-indigo-900/40 via-blue-800/30 to-cyan-900/40 rounded-2xl border border-indigo-500/50 p-6 md:col-span-2 overflow-hidden"
                  whileHover={{ scale: 1.01 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                >
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-indigo-400" />
                        <span className="text-indigo-200 font-bold text-xl">Active Users</span>
                      </div>
                      <div className="px-4 py-2 rounded-full bg-indigo-500/30 text-indigo-300 text-sm font-bold border border-indigo-400/50">
                        ORCHESTER
                      </div>
                    </div>
                    <div className="text-white">
                      <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-300 to-cyan-200 bg-clip-text text-transparent">
                        {activeFansCount || "8"}
                      </div>
                      <div className="text-indigo-200 text-base flex items-center gap-2">
                        <span>🎵</span>
                        Musikalische Gemeinschaft
                        <span>🎶</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Last Updated */}
              <div className="text-center text-zinc-500 text-sm mt-6">
                Zuletzt aktualisiert: {new Date().toLocaleString('de-DE')}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}
