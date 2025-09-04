'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { validateBaseAddress, validateBaseAddressRealTime } from '../utils/walletValidation';
import { useActiveAccount } from 'thirdweb/react';

interface UserData {
  username: string;
  image: string;
  expTotal: number;
  expTiktok: number;
  expInstagram: number;
  expFacebook: number;
  expStream: number;
  liveNFTBonus: number;
  miningpower: number;
  liked: string;
  commented: string;
  story: string;
  saved: boolean | string;
  wallet?: string;
}

// Leaderboard types
interface LeaderboardEntry {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  name?: string;
  handle?: string;
  expTotal: number;
  rank: number;
}
interface Prize {
  position: number;
  description: string;
  value: string;
}
interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  prizes: Prize[];
  timer?: { endDate: string; title: string; description: string; isActive: boolean };
  lastUpdated?: string;
}

// Level Funktionen
const getLevelAndExpRange = (exp: number) => {
  let level = 1;
  let minExp = 0;
  let maxExp = 39;
  const levelThresholds = [39, 119, 239, 399, 599, 839, 1119, 1439, 1799, 2199, 2639, 3119, 3639, 4199, 4799, 5439, 6119, 6839, 7599, 8399, 9239, 10119, 11039, 11999, 12999, 14039, 15119, 16239, 17399, 18599, 19839, 21119, 22439, 23799, 25199, 26639, 28119, 29639, 31199, 32799, 34439, 36119, 37839, 39599, 41399, 43239, 45119, 47039, 48999, 99999999];
  const levelMins = [0, 40, 120, 240, 400, 600, 840, 1120, 1440, 1800, 2200, 2640, 3120, 3640, 4200, 4800, 5440, 6120, 6840, 7600, 8400, 9240, 10120, 11040, 12000, 13000, 14040, 15120, 16240, 17400, 18600, 19840, 21120, 22440, 23800, 25200, 26640, 28120, 29640, 31200, 32800, 34440, 36120, 37840, 39600, 41400, 43240, 45120, 47040, 49000];
  
  for (let i = 0; i < levelThresholds.length; i++) {
    if (exp <= levelThresholds[i]) {
      level = i + 1;
      maxExp = levelThresholds[i];
      minExp = levelMins[i];
      break;
    }
  }
  return { level, minExp, maxExp };
};

// UUID aus URL Parameter holen (temporär auf dfaith3781123 gesetzt)
const getUUID = () => {
  // Temporär für Tests: dfaith3781123
  return 'dfaith3781123';
  
  // Original Code:
  // if (typeof window !== 'undefined') {
  //   const urlParams = new URLSearchParams(window.location.search);
  //   return urlParams.get('uuid');
  // }
  // return null;
};

export default function InstagramTab() {
  const router = useRouter();
  const account = useActiveAccount(); // Thirdweb Hook für eingeloggte Wallet
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showStoryHelpModal, setShowStoryHelpModal] = useState(false);
  const [showConfirmInitial, setShowConfirmInitial] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [showNoValuesFoundModal, setShowNoValuesFoundModal] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [walletValidation, setWalletValidation] = useState<{
    isValid: boolean;
    isPartiallyValid: boolean;
    error?: string;
  }>({ isValid: false, isPartiallyValid: true });
  const [claimStatus, setClaimStatus] = useState('');
  const [initialValues, setInitialValues] = useState<{likes: number, saves: number} | null>(null);
  const [afterValues, setAfterValues] = useState<{likes: number, saves: number} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [expGained, setExpGained] = useState<{likes: number, saves: number, total: number} | null>(null);
  const [showNoUuidModal, setShowNoUuidModal] = useState(false);
  const [showMiningPowerModal, setShowMiningPowerModal] = useState(false);
  // Leaderboard modal state
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [lbData, setLbData] = useState<LeaderboardResponse | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbSearch, setLbSearch] = useState("");
  const [lbNow, setLbNow] = useState<number>(Date.now());
  const [lbOpenRow, setLbOpenRow] = useState<number | null>(null);

  // Formatter für Countdown
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

  // Daten laden
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const uuid = getUUID();
        console.log('Lade Daten für UUID:', uuid);
        
        // UUID Überprüfung - temporär deaktiviert für dfaith3781123
        // Aktuell ist diese Prüfung deaktiviert für Tests
        const showNoUuidModal = false; // Auf false gesetzt für temporäre UUID dfaith3781123
        if (showNoUuidModal && (!uuid || uuid === null)) {
          setLoading(false);
          setShowNoUuidModal(true);
          // Dummy Daten setzen damit die UI angezeigt wird
          setUserData({
            username: "Gast",
            image: "https://via.placeholder.com/100",
            expTotal: 0,
            expTiktok: 0,
            expInstagram: 0,
            expFacebook: 0,
            expStream: 0,
            liveNFTBonus: 0,
            miningpower: 0,
            liked: "false",
            commented: "false",
            story: "false",
            saved: "false",
            wallet: undefined
          });
          return;
        }
        
        const response = await fetch("https://uuid-check-insta.vercel.app/api/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid })
        });
        
        console.log('API Response Status:', response.status);
        const data = await response.json();
        console.log('API Response Data:', data);
        
        // Wallet setzen falls vorhanden
        if (data.wallet && data.wallet.startsWith("0x")) {
          setWalletInput(data.wallet);
          // Validierung auch für automatisch gesetzte Wallet durchführen
          const validation = validateBaseAddressRealTime(data.wallet);
          setWalletValidation(validation);
        }
        
        setUserData({
          username: data.username || "User",
          image: data.image || "https://via.placeholder.com/100",
          expTotal: parseInt(data.expTotal) || 0,
          expTiktok: Number(data.expTiktok) || 0,
          expInstagram: Number(data.expInstagram) || 0,
          expFacebook: Number(data.expFacebook) || 0,
          expStream: Number(data.expStream) || 0,
          liveNFTBonus: Number(data.liveNFTBonus) || 0,
          miningpower: Number(data.miningpower) || 0,
          liked: data.liked || "false",
          commented: data.commented || "false",
          story: data.story || "false",
          saved: data.saved || "false",
          wallet: data.wallet
        });
        
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Automatisch eingeloggte Wallet-Adresse setzen
  useEffect(() => {
    if (account?.address) {
      console.log('Eingeloggte Wallet gefunden:', account.address);
      setWalletInput(account.address);
      // Validierung für automatisch gesetzte Wallet durchführen
      const validation = validateBaseAddressRealTime(account.address);
      setWalletValidation(validation);
    }
  }, [account?.address]);

  // Fetch leaderboard when modal opens (and refresh every 30s while open)
  useEffect(() => {
    if (!showLeaderboardModal) return;
    let mounted = true;
    const load = async () => {
      // Set loading, but we'll keep showing stale data to avoid flicker
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
        // Keep stale data on error to prevent UI from clearing
        console.error('Leaderboard laden fehlgeschlagen:', e);
      } finally {
        if (mounted) setLbLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [showLeaderboardModal]);

  // Countdown-Ticker für Timer im Leaderboard
  useEffect(() => {
    if (!showLeaderboardModal) return;
    const id = setInterval(() => setLbNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showLeaderboardModal]);

  // Like/Save Check API
  const checkInitial = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      if (!uuid) return;
      
      const response = await fetch(`https://hook.eu2.make.com/bli0jo4nik0m9r4x9aj76ptktghdzckd?uuid=${encodeURIComponent(uuid)}`);
      const data = await response.json();
      
      if (data.likes === undefined || data.saves === undefined || data.likes === null || data.saves === null) {
        setShowNoValuesFoundModal(true);
        return;
      }
      
      const likes = parseInt(data.likes);
      const saves = parseInt(data.saves);
      setInitialValues({ likes, saves });
      
      // LocalStorage setzen
      if (typeof window !== 'undefined') {
        localStorage.setItem("dfaith_likeStart", likes.toString());
        localStorage.setItem("dfaith_saveStart", saves.toString());
      }
    } catch (error) {
      console.error('Fehler beim Check:', error);
      setShowNoValuesFoundModal(true);
    } finally {
      setLoading(false);
    }
  };

  const checkAfter = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      if (!uuid) return;
      
      const response = await fetch(`https://hook.eu2.make.com/bli0jo4nik0m9r4x9aj76ptktghdzckd?uuid=${encodeURIComponent(uuid)}`);
      const data = await response.json();
      
      const newLikes = parseInt(data.likes);
      const newSaves = parseInt(data.saves);
      setAfterValues({ likes: newLikes, saves: newSaves });
      
      // Automatischer Vergleich und EXP Berechnung
      if (initialValues) {
        const likesGained = Math.max(0, newLikes - initialValues.likes);
        const savesGained = Math.max(0, newSaves - initialValues.saves);
        const totalExp = (likesGained * 10) + (savesGained * 10);
        
        if (totalExp > 0) {
          setExpGained({
            likes: likesGained,
            saves: savesGained,
            total: totalExp
          });
          setConfirmationMessage('🎉 Glückwunsch! Du hast erfolgreich EXP gesammelt!');
        }
      }
    } catch (error) {
      console.error('Fehler beim Check:', error);
    } finally {
      setLoading(false);
    }
  };

  // Claim absenden
  const submitClaim = async () => {
    // Priorität: Eingeloggte Wallet > Eingabe-Wallet > gespeicherte Wallet
    const claimWalletAddress = account?.address || walletInput;
    
    if (!claimWalletAddress) {
      setClaimStatus('❌ Keine Wallet-Adresse verfügbar. Bitte verbinde deine Wallet oder gib eine Adresse ein.');
      return;
    }
    
    // Validierung der Wallet-Adresse
    const validation = validateBaseAddress(claimWalletAddress);
    if (!validation.isValid) {
      setClaimStatus(`❌ ${validation.error}`);
      return;
    }

    setLoading(true);
    try {
      const uuid = getUUID();
      if (!uuid) {
        setClaimStatus('❌ Keine UUID verfügbar.');
        return;
      }
      
      console.log('Claim mit Wallet-Adresse:', claimWalletAddress);
      
      const response = await fetch('https://hook.eu2.make.com/1c62icx2yngv8v4g6y7k7songq01rblk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          wallet: claimWalletAddress.trim(),
          username: userData?.username || '',
          miningpower: userData?.miningpower || 0
        })
      });
      
      const data = await response.json();
      
      // Verschiedene Status-Responses behandeln
      if (data.status === 'success') {
        setClaimStatus('✅ Dein Claim war erfolgreich! Die Tokens werden in Kürze auf deine Wallet gesendet.');
        // localStorage leeren bei erfolgreichem Claim
        if (typeof window !== 'undefined') {
          localStorage.clear();
        }
      } else if (data.status === 'wallet') {
        setClaimStatus('⚠️ Diese Wallet wird bereits verwendet. Bitte gib eine andere Adresse ein.');
      } else if (data.status === 'info') {
        setClaimStatus('ℹ️ Du hast bereits geclaimed.');
      } else {
        // Fallback für unbekannte Status oder alte API-Responses
        if (data.success === true || data.claimed === true) {
          setClaimStatus('✅ Dein Claim war erfolgreich! Die Tokens werden in Kürze auf deine Wallet gesendet.');
          if (typeof window !== 'undefined') {
            localStorage.clear();
          }
        } else {
          setClaimStatus('❌ Fehler: ' + (data.message || 'Unbekannter Fehler.'));
        }
      }
    } catch (error) {
      setClaimStatus('❌ Netzwerkfehler oder ungültige Antwort.');
      console.error('Claim Fehler:', error);
    } finally {
      setLoading(false);
    }
  };

  // Wallet Input Handler mit Validierung
  const handleWalletInputChange = (value: string) => {
    setWalletInput(value);
    const validation = validateBaseAddressRealTime(value);
    setWalletValidation(validation);
    
    // Clear claim status wenn sich die Wallet ändert
    if (claimStatus) {
      setClaimStatus('');
    }
  };

  // LocalStorage laden beim Start
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const likeStored = localStorage.getItem("dfaith_likeStart");
      const saveStored = localStorage.getItem("dfaith_saveStart");

      if (likeStored && saveStored) {
        setInitialValues({
          likes: parseInt(likeStored),
          saves: parseInt(saveStored)
        });
      }
    }
  }, []);

  if (!userData) {
    return (
      <div 
        className="min-h-screen w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #475569, #334155, #1e293b, #0f172a)',
          fontFamily: 'Poppins, Segoe UI, sans-serif'
        }}
      >
        <div className="text-white text-center">
          <div className="animate-spin w-20 h-20 border-4 border-white/20 border-t-white rounded-full mx-auto mb-8"></div>
          <p className="text-2xl font-bold mb-3">Instagram Tab wird geladen...</p>
          <p className="text-lg opacity-90 mb-2">Bitte warten Sie einen Moment</p>
          <div className="flex items-center justify-center gap-2 text-sm opacity-70">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
        </div>
      </div>
    );
  }

  const { level, minExp, maxExp } = getLevelAndExpRange(userData.expTotal);
  const currentLevelExp = userData.expTotal - minExp;
  const levelRange = maxExp - minExp;
  const progressPercent = Math.round((currentLevelExp / levelRange) * 100);

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95), rgba(153, 27, 27, 0.95), rgba(127, 29, 29, 0.95))',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div className="text-center text-white">
            <div className="animate-spin w-16 h-16 border-4 border-white/30 border-t-white rounded-full mx-auto mb-6"></div>
            <p className="text-xl font-bold mb-2">Wird verarbeitet...</p>
            <p className="text-sm opacity-80">Bitte warten Sie einen Moment</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div 
        className="min-h-screen flex items-center justify-center p-8"
        style={{ 
          background: 'linear-gradient(135deg, #475569, #334155, #1e293b, #0f172a)',
          fontFamily: 'Poppins, Segoe UI, sans-serif'
        }}
      >
        <div className="bg-black bg-opacity-15 rounded-3xl p-8 w-full max-w-sm text-center text-white border-2 border-white border-opacity-15 shadow-2xl relative">
          {/* FAB wird rechts beim System Check platziert */}
          {/* Username */}
          <div className="text-2xl font-bold mb-4">@{userData.username}</div>
          
          {/* Profile Image */}
          <img 
            src={userData.image || 'https://via.placeholder.com/100'} 
            alt="Profilbild"
            className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
            loading="lazy"
          />
          
          {/* Level Box */}
          <div className="bg-black bg-opacity-20 rounded-2xl p-4 mb-4 border border-white/10">
            {/* Level und EXP Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">Level</span>
                <span className="text-2xl font-black bg-gradient-to-r from-pink-200 to-rose-300 bg-clip-text text-transparent">{level}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">{userData.expTotal.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={(e) => { e.stopPropagation(); setShowInfoModal(true); }}
                className="bg-pink-500 hover:bg-pink-600 text-white w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
              >
                i
              </button>
            </div>
            
            {/* Progress Bar mit Animation */}
            <div className="relative bg-gray-800/60 rounded-full h-4 overflow-hidden mb-4 shadow-inner border border-gray-700/50">
              <div 
                className="h-full bg-gradient-to-r from-pink-400 via-pink-500 to-rose-500 transition-all duration-1000 ease-out relative shadow-lg"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                {progressPercent}%
              </div>
            </div>
            
            {/* Mining Power mit verbessertem Design */}
            <button 
              onClick={() => setShowMiningPowerModal(true)}
              className="w-full bg-gradient-to-r from-pink-500/20 to-rose-500/20 rounded-xl p-3 border border-pink-500/30 hover:from-pink-500/30 hover:to-rose-500/30 hover:border-pink-500/50 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl animate-bounce">⛏</span>
                <div className="text-center">
                  <div className="text-pink-300 text-sm font-medium">Mining Power</div>
                  <div className="text-pink-200 text-lg font-bold">+{userData.miningpower} D.Faith</div>
                </div>
              </div>
            </button>
          </div>
          
          {/* System Check */}
          <div className="border-2 border-white rounded-2xl p-4 mb-6 bg-black bg-opacity-20">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-lg text-white">✅ System Check</div>
              {!showLeaderboardModal && (
                <button
                  type="button"
                  onClick={() => setShowLeaderboardModal(true)}
                  className="w-8 h-8 rounded-full bg-yellow-400 text-black shadow hover:bg-yellow-300 active:scale-95 transition flex items-center justify-center"
                  aria-label="Leaderboard öffnen"
                  title="Leaderboard öffnen"
                >
                  🏆
                </button>
              )}
            </div>
            
            <div className="space-y-2 text-sm text-white">
              <div className="flex justify-between">
                <span>❤️ Like</span>
                <span>{userData.liked === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span>💬 Kommentar</span>
                <span>{userData.commented === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span>📣 Story</span>
                <span>{userData.story === 'true' ? '✅' : '❌'} +20 EXP</span>
              </div>
              <div className="flex justify-between">
                <span>💾 Save</span>
                <span>{userData.saved === true || userData.saved === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="relative flex-1 bg-gradient-to-r from-pink-500 via-pink-600 to-rose-600 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-400/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-pulse">✨</span>
                <span className="tracking-wider">Sammle EXP</span>
              </div>
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="relative flex-1 bg-gradient-to-r from-pink-400 via-pink-500 to-rose-500 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-300/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-bounce">🪙</span>
                <span className="tracking-wider">Claim</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowUpgradeModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">✨ Sammle mehr EXP!</h2>
            <button 
              onClick={() => {
                setShowUpgradeModal(false);
                setShowLikeSaveModal(true);
              }}
              className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white p-4 rounded-2xl font-bold mb-4 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-xl">❤️</span>
              <span className="text-xl">💾</span>
              <span>Like + Save</span>
            </button>
            <button 
              onClick={() => {
                setShowUpgradeModal(false);
                setShowStoryHelpModal(true);
              }}
              className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-xl">📣</span>
              <span>Story teilen</span>
            </button>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowClaimModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <span className="text-xl animate-bounce">🪙</span>
              <span>D.FAITH Claim</span>
            </h2>
            <div className="text-xs text-gray-600 mb-4 text-center">
              💡 Wallet ändern? Schreib mir eine DM mit &quot;Wallet&quot; auf Instagram
            </div>
            
            {/* Automatische Wallet-Erkennung */}
            {account?.address ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-green-800 mb-2 font-semibold">
                  ✅ Eingeloggte Wallet erkannt!
                </p>
                <p className="text-gray-700 text-sm mb-3">
                  Deine verbundene Wallet-Adresse wird automatisch für den Claim verwendet:
                </p>
                <div className="bg-white border border-green-300 rounded-lg p-3 mb-3">
                  <p className="font-mono text-sm text-green-700 break-all">
                    {account.address}
                  </p>
                </div>
                <p className="text-gray-800 mb-2">
                  Du kannst <strong className="text-green-600">+{userData.miningpower} D.FAITH</strong> für deine Instagram Aktivität claimen!
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-gray-800 text-base flex flex-col items-center animate-pulse">
                <span className="font-semibold mb-3 text-center">Du hast noch keine gültige Base Chain Wallet hinterlegt.<br/>Erstelle jetzt deine Wallet, um deine Belohnung zu erhalten!</span>
                <button
                  className="w-full mt-2 mb-2 py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-pink-400 via-pink-500 to-rose-500 text-white shadow-lg hover:from-pink-500 hover:to-rose-600 active:from-pink-600 active:to-rose-700 transition text-base border border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 text-center block"
                  onClick={() => router.push("/wallet")}
                >
                  🚀 Wallet jetzt anlegen
                </button>
                <span className="text-xs text-gray-500 mt-1">Du findest den Wallet Tab auch oben im Menü.</span>
              </div>
            )}
            <button 
              onClick={submitClaim}
              disabled={!account?.address}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white p-4 rounded-2xl font-bold mb-4 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="text-xl">✅</span>
              <span>{account?.address ? 'Mit verbundener Wallet claimen' : 'Wallet verbinden um zu claimen'}</span>
            </button>
            {claimStatus && (
              <div className={`mb-4 p-3 rounded-xl ${
                claimStatus.includes('✅') 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : claimStatus.includes('⚠️') 
                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  : claimStatus.includes('ℹ️')
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-pink-100 text-pink-700 border border-pink-200'
              }`}>
                {claimStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Like & Save Modal */}
      {showLikeSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">✨ Like & Save Verification</h2>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-4">
              <p className="font-semibold mb-3 text-pink-800">1️⃣ Entferne alle Likes und Saves von meinem Beitrag</p>
              <button 
                onClick={() => setShowConfirmInitial(true)}
                disabled={initialValues !== null || loading}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  initialValues !== null || loading
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full"></div>
                    <span>Erfasse Daten...</span>
                  </div>
                ) : initialValues !== null ? '✅ Werte bereits erfasst' : '✅ Check aktuelle Werte'}
              </button>
              {initialValues && (
                <div className="bg-white border border-purple-300 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span>Likes:</span>
                    <span className="font-bold text-emerald-600">{initialValues.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saves:</span>
                    <span className="font-bold text-emerald-600">{initialValues.saves}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <p className="font-semibold mb-3 text-green-800">2️⃣ Like und speichere den Beitrag erneut!</p>
              <button 
                onClick={() => setShowConfirmAfter(true)}
                disabled={loading || !initialValues || !!afterValues}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  loading || !initialValues
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : afterValues ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full"></div>
                    <span>Prüfe Änderungen...</span>
                  </div>
                ) : !initialValues ? '⚠️ Zuerst Schritt 1 ausführen' : afterValues ? '✅ Neue Werte erfasst' : '✅ Check neue Werte'}
              </button>
              {afterValues && (
                <div className="bg-white border border-green-300 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span>Likes:</span>
                    <span className="font-bold text-green-600">{afterValues.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saves:</span>
                    <span className="font-bold text-green-600">{afterValues.saves}</span>
                  </div>
                </div>
              )}
            </div>
            
            {afterValues && (
              <div className={`rounded-xl p-4 mb-4 ${expGained && expGained.total > 0 ? 'bg-green-100 border border-green-200' : 'bg-orange-100 border border-orange-200'}`}>
                {expGained && expGained.total > 0 ? (
                  <>
                    <div className="text-center mb-3">
                      <p className="text-green-700 font-bold text-lg">🎉 Glückwunsch!</p>
                      <p className="text-green-600 text-sm">Du hast erfolgreich EXP gesammelt:</p>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {expGained.likes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-600">❤️ Likes (+{expGained.likes}):</span>
                          <span className="font-bold text-green-600">+{expGained.likes * 10} EXP</span>
                        </div>
                      )}
                      {expGained.saves > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-600">💾 Saves (+{expGained.saves}):</span>
                          <span className="font-bold text-green-600">+{expGained.saves * 10} EXP</span>
                        </div>
                      )}
                      <div className="border-t border-green-300 pt-2 mt-2">
                        <div className="flex justify-between font-bold">
                          <span className="text-green-700">Gesamt EXP:</span>
                          <span className="text-green-600 text-lg">+{expGained.total} EXP</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center mb-4">
                      <p className="text-green-600 text-xs mb-3">Lade die Seite neu, um deine neuen EXP zu sehen!</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center mb-4">
                    <p className="text-orange-700 font-bold text-lg">😔 Keine neuen Interaktionen</p>
                    <p className="text-orange-600 text-sm mb-3">Es wurden keine neuen Likes oder Saves erkannt. Du kannst die Werte zurücksetzen und es erneut versuchen.</p>
                  </div>
                )}
                
                <button 
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      // Nur Instagram-spezifische Verification Daten löschen
                      localStorage.removeItem("dfaith_likeStart");
                      localStorage.removeItem("dfaith_saveStart");
                      
                      // Seite neu laden
                      window.location.href = window.location.pathname + '?tab=instagram' + (window.location.search.includes('uuid=') ? '&' + window.location.search.split('?')[1] : '');
                    }
                  }}
                  className={`w-full p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    expGained && expGained.total > 0 
                      ? 'bg-gradient-to-r from-green-500 to-pink-500 hover:from-green-600 hover:to-pink-600 text-white'
                      : 'bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white'
                  }`}
                >
                  🔄 Seite neu laden
                </button>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLikeSaveModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
              >
                ❌ Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Help Modal */}
      {showStoryHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowStoryHelpModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="text-6xl mb-4">📣</div>
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">Story teilen</h2>
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-700 leading-relaxed">
                Bitte teile meinen Beitrag in deiner Instagram-Story<br/><strong className="text-pink-600">@dawidfaith</strong>, damit du dein Upgrade erhältst.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowInfoModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">✨ Deine EXP-Quellen</h2>
            <div className="text-left space-y-3 mb-6">
              <div className="flex items-center gap-3 border-l-4 border-purple-500 pl-3 bg-purple-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-6 h-6 rounded-full" />
                <div>
                  <div className="font-bold text-purple-800">Instagram</div>
                  <div className="text-purple-600 font-semibold">{userData.expInstagram} EXP</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-4 border-black pl-3 bg-gray-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" className="w-6 h-6 rounded-full" />
                <div>
                  <div className="font-bold text-gray-800">TikTok</div>
                  <div className="text-gray-600 font-semibold">{userData.expTiktok} EXP</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3 bg-blue-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-6 h-6" />
                <div>
                  <div className="font-bold text-blue-800">Facebook</div>
                  <div className="text-blue-600 font-semibold">{userData.expFacebook} EXP</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-4 border-purple-700 pl-3 bg-purple-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/727/727245.png" alt="Stream" className="w-6 h-6 rounded-full" />
                <div>
                  <div className="font-bold text-purple-800">Stream</div>
                  <div className="text-purple-600 font-semibold">{userData.expStream} EXP</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-4 border-yellow-400 pl-3 bg-yellow-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Live" className="w-6 h-6 rounded-full" />
                <div>
                  <div className="font-bold text-yellow-800">Live EXP Bonus</div>
                  <div className="text-yellow-600 font-semibold">{userData.liveNFTBonus} EXP</div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-700 font-medium">💡 Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen! 🚀</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Initial Modal */}
      {showConfirmInitial && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800">Bestätigung erforderlich</h2>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4">
              <p className="text-purple-800 leading-relaxed">Bitte entferne alle Likes und Saves von meinem Beitrag – danach werden alle aktuellen Zahlen gespeichert.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmInitial(false);
                  setShowLikeSaveModal(true);
                  checkInitial();
                }}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ Ja, fortfahren
              </button>
              <button 
                onClick={() => setShowConfirmInitial(false)}
                className="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
              >
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm After Modal */}
      {showConfirmAfter && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800">Finale Bestätigung</h2>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <p className="text-green-800 leading-relaxed">Bitte Like und speichere den Beitrag erneut, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  setShowLikeSaveModal(true);
                  checkAfter();
                }}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ Ja, fortfahren
              </button>
              <button 
                onClick={() => setShowConfirmAfter(false)}
                className="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
              >
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Values Found Modal */}
      {showNoValuesFoundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowNoValuesFoundModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-lg font-bold text-gray-900">Versuch bereits unternommen</p>
            </div>
            <div className="text-center space-y-3">
              <p className="text-gray-700">
                Es scheint, als hättest du bereits einen Versuch für diesen Beitrag unternommen.
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-purple-800 font-medium text-sm">
                  💡 <strong>Nächste Möglichkeit:</strong><br/>
                  Warte auf meinen nächsten Instagram-Beitrag für eine neue Chance!
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Jeder Beitrag bietet neue Möglichkeiten für EXP-Belohnungen.
              </p>
            </div>
            <button 
              className="w-full mt-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow transition-all duration-300 transform hover:scale-105"
              onClick={() => setShowNoValuesFoundModal(false)}
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
      {/* No UUID Modal */}
      {showNoUuidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowNoUuidModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">🔒</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Profil nicht gefunden</h2>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Dein Profil ist nur durch die <strong className="text-purple-600">Teilnahme an den Beiträgen</strong> von <strong className="text-purple-600">Dawid Faith</strong> erreichbar.
              </p>
              <p className="text-gray-600 text-sm">
                💡 Like, kommentiere und teile seine Beiträge, um Zugang zu erhalten!
              </p>
            </div>
            
            <div className="space-y-3 mb-6">
              <p className="text-gray-700 font-medium">📱 Folge Dawid Faith auf Instagram:</p>
              
              <a 
                href="https://www.instagram.com/dawidfaith?igsh=aTF5dXBoYWxkb2Js"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3 block"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>Instagram @dawidfaith</span>
              </a>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-yellow-800 font-medium text-sm">
                ⚡ <strong>Tipp:</strong> Nach der Teilnahme kannst du über den speziellen Link auf dein Profil zugreifen!
              </p>
            </div>
            
            <button 
              onClick={() => setShowNoUuidModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
            >
              ❌ Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Mining Power Modal */}
      {showMiningPowerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowMiningPowerModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-400 to-rose-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">⛏</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">Mining Power Info</h2>
            </div>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Deine <strong className="text-pink-600">Mining Power</strong> ist abhängig von verschiedenen Faktoren:
              </p>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-pink-300">
                  <span className="text-xl">💰</span>
                  <div>
                    <div className="font-bold text-gray-800">Marketing Budget</div>
                    <div className="text-sm text-gray-600">Pro User für den aktuellen Beitrag</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-pink-300">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-bold text-gray-800">Dein Level</div>
                    <div className="text-sm text-gray-600">Aktuell: Level {level}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-pink-300">
                  <span className="text-xl">💎</span>
                  <div>
                    <div className="font-bold text-gray-800">D.FAITH Preis</div>
                    <div className="text-sm text-gray-600">Aktueller Marktpreis</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
              <p className="text-rose-800 font-medium text-sm">
                ⚡ <strong>Aktuell:</strong> +{userData.miningpower} D.Faith pro Beitrag
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Global Leaderboard Modal + optional FAB */}
  {/* Global FAB entfernt – Button sitzt nun in der Karte */}
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
              <div className="text-[11px] text-zinc-400 px-3 mb-1 grid grid-cols-[auto_1fr_6rem_8rem] gap-4">
                <div className="opacity-0 select-none">#</div>
                <div className="text-left">Name</div>
                <div className="text-center">EXP</div>
                <div className="text-right">Preis/Symbol</div>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg max-h-[24rem] overflow-y-auto">
                {lbLoading && (
                  <div className="px-4 py-3 text-zinc-400 text-sm">Lade Leaderboard…</div>
                )}
                {(lbData?.entries || []).length === 0 && !lbLoading && (
                  <div className="px-4 py-3 text-zinc-400 text-sm">Keine Einträge gefunden</div>
                )}
                {(lbData?.entries || []).filter(e => {
                  if (!lbSearch) return true;
                  const names = [e.instagram, e.tiktok, e.facebook, e.name, e.handle].filter(Boolean) as string[];
                  const q = lbSearch.toLowerCase();
                  return names.some(n => n.toLowerCase().includes(q));
                }).map((e) => {
                  const names = [e.instagram, e.tiktok, e.facebook, e.name, e.handle].filter(Boolean) as string[];
                  const primary = e.instagram || e.tiktok || e.facebook || e.name || e.handle || '-';
                  const prize = (lbData?.prizes || []).find(p => p.position === e.rank);
                  const prizeText = prize ? (prize.value || prize.description || '') : '';
                  const prizeDisplay = prizeText ? prizeText : '-';
                  return (
                    <div key={e.rank} className="border-b border-zinc-800/70 last:border-b-0">
                      <div className="px-3 py-2 grid grid-cols-[auto_1fr_6rem_8rem] gap-4 items-center">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono">#{e.rank}</span>
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-white whitespace-nowrap overflow-x-auto w-full">{primary}</span>
                          {names.length > 1 && (
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
                        <span className="text-amber-300 text-sm font-mono text-center">{e.expTotal.toLocaleString()}</span>
                        <span className="text-emerald-300 text-xs font-medium text-right truncate" title={prizeDisplay}>
                          {prizeDisplay}
                        </span>
                      </div>
                      {lbOpenRow === e.rank && names.length > 1 && (
                        <div className="pl-12 pr-3 pb-2 flex flex-col gap-1 items-start">
                          {names.map((n, idx) => (
                            <div key={idx} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-[11px] w-full text-left whitespace-normal break-words">
                              {n}
                            </div>
                          ))}
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
    </>
  );
}
