'use client';

import React, { useState, useEffect } from 'react';
import { FaInstagram, FaFacebookF, FaInfoCircle, FaYoutube } from 'react-icons/fa';
import { FaTiktok } from 'react-icons/fa6';
import { useRouter } from 'next/navigation';
import { validateBaseAddress, validateBaseAddressRealTime } from '../utils/walletValidation';
import { useActiveAccount } from 'thirdweb/react';
import type { SupportedLanguage } from "../utils/deepLTranslation";
import { translationService } from "../utils/deepLTranslation";
import { TranslatedText } from '../components/TranslatedText';

interface UserData {
  username: string;
  image: string;
  expTotal: number;
  expTiktok: number;
  expInstagram: number;
  expFacebook: number;
  // expYoutube entfernt, YouTube EXP kommt jetzt aus expStream
  expStream: number;
  liveNFTBonus: number;
  miningpower: number;
  liked: string;
  commented: string;
  saved: boolean | string;
  wallet?: string;
}

interface FacebookTabProps {
  language: SupportedLanguage;
}

export default function FacebookTab({ language }: FacebookTabProps) {
  const router = useRouter();
  const account = useActiveAccount(); // Thirdweb Hook für eingeloggte Wallet
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showConfirmInitial, setShowConfirmInitial] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [walletValidation, setWalletValidation] = useState<{
    isValid: boolean;
    isPartiallyValid: boolean;
    error?: string;
  }>({ isValid: false, isPartiallyValid: true });
  const [claimStatus, setClaimStatus] = useState('');
  const [initialValues, setInitialValues] = useState<{likes: number, shares: number} | null>(null);
  const [afterValues, setAfterValues] = useState<{likes: number, shares: number} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [expGained, setExpGained] = useState<{likes: number, shares: number, total: number} | null>(null);
  const [showNoUuidModal, setShowNoUuidModal] = useState(false);
  const [showMiningPowerModal, setShowMiningPowerModal] = useState(false);
  // Leaderboard state
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [lbData, setLbData] = useState<any>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbSearch, setLbSearch] = useState("");
  const [lbNow, setLbNow] = useState<number>(Date.now());
  const [lbOpenRow, setLbOpenRow] = useState<number | null>(null);

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '00:00:00';
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    s %= 86400;
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ss = sec.toString().padStart(2, '0');
    return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };

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

  // UUID aus URL Parameter holen
  const getUUID = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('uuid');
      return uuid || 'Dawidfaithtest3736FB';
    }
    return 'Dawidfaithtest3736FB';
  };

  // Daten laden
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const uuid = getUUID();
        // Wenn keine UUID vorhanden, Modal anzeigen und nicht laden
        if (!uuid) {
          setShowNoUuidModal(true);
          setLoading(false);
          setUserData(null);
          return;
        }
        const url = `https://uuid-check-fb.vercel.app/api/uuid-check?uuid=${uuid}`;
        const response = await fetch(url);
        const data = await response.json();
        // Wallet setzen falls vorhanden
        if (data.wallet && data.wallet.startsWith("0x")) {
          setWalletInput(data.wallet);
          // Validierung auch für automatisch gesetzte Wallet durchführen
          const validation = validateBaseAddressRealTime(data.wallet);
          setWalletValidation(validation);
        }
        setUserData({
          username: data.username,
          image: data.image?.startsWith("http://") ? data.image.replace("http://", "https://") : data.image || "https://via.placeholder.com/100",
          expTotal: parseInt(data.expTotal),
          expTiktok: data.expTiktok,
          expInstagram: data.expInstagram,
          expFacebook: data.expFacebook,
          expStream: data.expStream, // YouTube EXP
          liveNFTBonus: data.liveNFTBonus,
          miningpower: data.miningpower,
          liked: data.liked,
          commented: data.commented,
          saved: data.saved,
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

  // Leaderboard fetch when modal opens
  useEffect(() => {
    if (!showLeaderboardModal) return;
    let mounted = true;
    const load = async () => {
      setLbLoading(true);
      try {
        const res = await fetch('/api/leaderboard-proxy', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const data = (raw?.entries || raw?.prizes || raw?.timer) ? raw : (raw?.data || { entries: [], prizes: [] });
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

  // Timer tick
  useEffect(() => {
    if (!showLeaderboardModal) return;
    const id = setInterval(() => setLbNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showLeaderboardModal]);

  // Claim funktionen
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
      const response = await fetch('https://hook.eu2.make.com/f6610bt372aucoln742252jovg5yydra', {
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

  const checkInitial = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      const safeUuid = uuid ?? '';
      const response = await fetch(`https://hook.eu2.make.com/q75ocak1iqjwhafs7t99xpxp1xzeymqt?uuid=${encodeURIComponent(safeUuid)}`);
      const data = await response.json();
      const likes = parseInt(data.likes);
      const shares = parseInt(data.shares);
      setInitialValues({ likes, shares });
      // LocalStorage setzen wie im Original
      if (typeof window !== 'undefined') {
        localStorage.setItem("dfaith_likeStart", likes.toString());
        localStorage.setItem("dfaith_shareStart", shares.toString());
      }
    } catch (error) {
      console.error('Fehler beim Check:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAfter = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      const safeUuid = uuid ?? '';
      const response = await fetch(`https://hook.eu2.make.com/q75ocak1iqjwhafs7t99xpxp1xzeymqt?uuid=${encodeURIComponent(safeUuid)}`);
      const data = await response.json();
      const newLikes = parseInt(data.likes);
      const newShares = parseInt(data.shares);
      setAfterValues({ likes: newLikes, shares: newShares });
      // Automatischer Vergleich und EXP Berechnung
      if (initialValues) {
        const likesGained = Math.max(0, newLikes - initialValues.likes);
        const sharesGained = Math.max(0, newShares - initialValues.shares);
        const totalExp = (likesGained * 10) + (sharesGained * 10);
        if (totalExp > 0) {
          setExpGained({
            likes: likesGained,
            shares: sharesGained,
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

  // LocalStorage laden beim Start (wie im Original)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const likeStored = localStorage.getItem("dfaith_likeStart");
      const shareStored = localStorage.getItem("dfaith_shareStart");

      if (likeStored && shareStored) {
        setInitialValues({
          likes: parseInt(likeStored),
          shares: parseInt(shareStored)
        });
      }
    }
  }, []);

  if (!userData) {
    // Zeige nur das Modal, wenn keine UUID vorhanden ist
    return (
      <>
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
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-3xl text-white">🔒</span>
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"><TranslatedText text="Profil nicht gefunden" language={language} /></h2>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <p className="text-gray-800 leading-relaxed mb-4">
                  <TranslatedText text="Dein Profil ist nur durch die " language={language} /><strong className="text-blue-600"><TranslatedText text="Teilnahme an den Beiträgen" language={language} /></strong><TranslatedText text=" von " language={language} /><strong className="text-blue-600">Dawid Faith</strong><TranslatedText text=" erreichbar." language={language} />
                </p>
                <p className="text-gray-600 text-sm">
                  💡 Like, kommentiere und teile seine Beiträge, um Zugang zu erhalten!
                </p>
              </div>
              <div className="space-y-3 mb-6">
                <p className="text-gray-700 font-medium">📱 Folge Dawid Faith auf Facebook:</p>
                <a 
                  href="https://www.facebook.com/share/1Auve8u2CG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3 block"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span><TranslatedText text="Facebook Profil" language={language} /></span>
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
                ❌ <TranslatedText text="Verstanden" language={language} />
              </button>
            </div>
          </div>
        )}
      </>
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
            background: 'linear-gradient(135deg, rgba(24, 119, 242, 0.95), rgba(59, 89, 152, 0.95), rgba(29, 46, 112, 0.95))',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div className="text-center text-white">
            <div className="animate-spin w-16 h-16 border-4 border-white/30 border-t-white rounded-full mx-auto mb-6"></div>
            <p className="text-xl font-bold mb-2"><TranslatedText text="Wird verarbeitet..." language={language} /></p>
            <p className="text-sm opacity-80"><TranslatedText text="Bitte warten Sie einen Moment" language={language} /></p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div 
        className="min-h-screen flex items-center justify-center p-8"
        style={{ 
          background: 'linear-gradient(135deg, #1877f2, #3b5998, #1d2e70)',
          fontFamily: 'Poppins, Segoe UI, sans-serif'
        }}
      >
        <div className="bg-black bg-opacity-15 rounded-3xl p-8 w-full max-w-sm text-center text-white border-2 border-white border-opacity-15 shadow-2xl">
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
                <TranslatedText text="Level" language={language} className="text-xl font-bold text-white" />
                <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">{level}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">{userData.expTotal.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
                aria-label={language === 'en' ? 'Your EXP Sources' : language === 'pl' ? 'Twoje źródła EXP' : 'Deine EXP-Quellen'}
                title={language === 'en' ? 'Your EXP Sources' : language === 'pl' ? 'Twoje źródła EXP' : 'Deine EXP-Quellen'}
              >
                <FaInfoCircle className="w-3.5 h-3.5 text-white animate-bounce" />
              </button>
            </div>
            
            {/* Progress Bar mit Animation */}
            <div className="relative bg-gray-800/60 rounded-full h-4 overflow-hidden mb-4 shadow-inner border border-gray-700/50">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 transition-all duration-1000 ease-out relative shadow-lg"
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
              className="w-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-xl p-3 border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 hover:border-blue-500/50 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl animate-bounce">⛏</span>
                <div className="text-center">
                  <div className="text-blue-300 text-sm font-medium">Mining Power</div>
                  <div className="text-blue-200 text-lg font-bold">+{userData.miningpower} D.Faith</div>
                </div>
              </div>
            </button>
          </div>
          
          {/* Facebook Check */}
          <div className="bg-black/50 border border-blue-500/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                <span className="inline-block align-middle mr-2" style={{width:'1.5em',height:'1.5em',verticalAlign:'middle'}}>
                  <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" style={{width:'1.5em',height:'1.5em',display:'block'}} />
                </span>
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  <TranslatedText text="Facebook Check" language={language} />
                </span>
              </div>
              {!showLeaderboardModal && (
                <button
                  type="button"
                  onClick={() => setShowLeaderboardModal(true)}
                  className="relative group w-8 h-8 rounded-full bg-yellow-400 text-black shadow-lg hover:bg-yellow-300 active:scale-95 hover:scale-105 transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 hover:ring-4 hover:ring-yellow-200/60 hover:shadow-yellow-300/60"
                  aria-label={language === 'en' ? 'Open Leaderboard' : language === 'pl' ? 'Otwórz ranking' : 'Leaderboard öffnen'}
                  title={language === 'en' ? 'Open Leaderboard' : language === 'pl' ? 'Otwórz ranking' : 'Leaderboard öffnen'}
                >
                  <span className="absolute -inset-1 rounded-full bg-yellow-400/20 blur-sm opacity-60 group-hover:opacity-80 transition pointer-events-none"></span>
                  <span className="inline-block animate-bounce">🏆</span>
                </button>
              )}
            </div>
            
            <div className="space-y-2 text-sm text-white">
              <div className="flex justify-between">
                <span className="text-red-400 font-bold">❤️ <TranslatedText text="Like" language={language} /></span>
                <span>{userData.liked === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400 font-bold">💬 <TranslatedText text="Kommentar" language={language} /></span>
                <span>{userData.commented === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-400 font-bold">🔁 <TranslatedText text="Share" language={language} /></span>
                <span>{userData.saved === true || userData.saved === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="relative flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 border border-blue-400/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-pulse">✨</span>
                <TranslatedText text="Sammle EXP" language={language} className="tracking-wider" />
              </div>
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="relative flex-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 border border-blue-300/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-bounce">🪙</span>
                <TranslatedText text="Claim" language={language} className="tracking-wider" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="text-yellow-300">🏆</span>
                <h3 className="text-white font-semibold"><TranslatedText text="Leaderboard" language={language} /></h3>
              </div>
              <div className="text-xs text-zinc-400 mr-auto ml-3">
                {lbData?.timer?.isActive && lbData?.timer?.endDate ? (
                  <span>Endet in: {formatDuration(new Date(lbData.timer.endDate).getTime() - lbNow)}</span>
                ) : null}
              </div>
              <button onClick={() => setShowLeaderboardModal(false)} className="text-zinc-400 hover:text-white">✖</button>
            </div>
            <div className="px-4 py-3">
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-md px-2 py-1 flex items-center gap-2 w-full mb-3">
                <span className="text-blue-500">
                  <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" style={{width:'1em',height:'1em',display:'inline-block',verticalAlign:'middle'}} />
                </span>
                <input
                  value={lbSearch}
                  onChange={(e) => setLbSearch(e.target.value)}
                  placeholder={language === 'en' ? '@handle or name' : language === 'pl' ? '@nazwa lub imię' : '@handle oder Name'}
                  className="bg-transparent outline-none text-sm text-white placeholder:text-zinc-500 w-full"
                />
              </div>
              {/* Legende / Kopfzeile */}
              <div className="text-[11px] text-zinc-400 px-3 mb-1 grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_5.25rem] gap-3">
                <div className="opacity-0 select-none">#</div>
                <div className="text-left"><TranslatedText text="Name" language={language} /></div>
                <div className="text-center">EXP</div>
                <div className="text-right"><TranslatedText text="Preis" language={language} /></div>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg max-h-[24rem] overflow-y-auto overflow-x-hidden">
                {lbLoading && (
                  <div className="px-4 py-3 text-zinc-400 text-sm"><TranslatedText text="Lade Leaderboard…" language={language} /></div>
                )}
                {(lbData?.entries || []).length === 0 && !lbLoading && (
                  <div className="px-4 py-3 text-zinc-400 text-sm"><TranslatedText text="Keine Einträge gefunden" language={language} /></div>
                )}
                {(lbData?.entries || []).filter((e: any) => {
                  if (!lbSearch) return true;
                  const names = [e.youtube, e.instagram, e.tiktok, e.facebook, e.name, e.handle].filter(Boolean) as string[];
                  const q = lbSearch.toLowerCase();
                  return names.some(n => n.toLowerCase().includes(q));
                }).map((e: any) => {
                  const namesDetailed = [
                    e.youtube ? { label: e.youtube, platform: 'youtube' } : null,
                    e.instagram ? { label: e.instagram, platform: 'instagram' } : null,
                    e.tiktok ? { label: e.tiktok, platform: 'tiktok' } : null,
                    e.facebook ? { label: e.facebook, platform: 'facebook' } : null,
                    e.name ? { label: `Name: ${e.name}`, platform: 'generic' } : null,
                    e.handle ? { label: `Handle: ${e.handle}`, platform: 'generic' } : null,
                  ].filter(Boolean) as { label: string; platform: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'generic' }[];
                  const primary = (e.youtube || e.instagram || e.tiktok || e.facebook || e.name || e.handle || '-') as string;
                  const primaryPlatform: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'generic' = e.youtube ? 'youtube' : e.instagram ? 'instagram' : e.tiktok ? 'tiktok' : e.facebook ? 'facebook' : 'generic';
                  const PlatformIcon = primaryPlatform === 'youtube' ? FaYoutube : primaryPlatform === 'instagram' ? FaInstagram : primaryPlatform === 'tiktok' ? FaTiktok : primaryPlatform === 'facebook' ? FaFacebookF : null;
                  const prize = (lbData?.prizes || []).find((p: any) => p.position === e.rank);
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
                              aria-label={language === 'en' ? 'Show more names' : language === 'pl' ? 'Pokaż więcej nazw' : 'Weitere Namen anzeigen'}
                              title={language === 'en' ? 'Show more names' : language === 'pl' ? 'Pokaż więcej nazw' : 'Weitere Namen anzeigen'}
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
                            const ChipIcon = n.platform === 'youtube' ? FaYoutube : n.platform === 'instagram' ? FaInstagram : n.platform === 'tiktok' ? FaTiktok : n.platform === 'facebook' ? FaFacebookF : null;
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

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-blue-500/30 rounded-2xl p-6 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                ✨ <TranslatedText text="Sammle EXP" language={language} />
              </h2>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-gray-400 hover:text-blue-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <span className="text-5xl animate-pulse">✨</span>
              </div>
              <p className="text-blue-200 leading-relaxed mb-4 text-center">
                <TranslatedText text="Sammle mehr EXP für deine Facebook-Aktivitäten!" language={language} />
              </p>
            </div>
            
            <div className="space-y-3 mb-4">
              <button 
                onClick={() => {
                  setShowUpgradeModal(false);
                  setShowLikeSaveModal(true);
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl py-3 font-bold transition-all flex items-center justify-center gap-3"
              >
                <span className="text-lg">❤️</span>
                <span className="text-lg">🔁</span>
                <span><TranslatedText text="Like + Share" language={language} /></span>
              </button>
            </div>
            
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-2 font-bold transition-all"
            >
              <TranslatedText text="Schließen" language={language} />
            </button>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-blue-500/30 rounded-2xl p-6 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                <TranslatedText text="D.FAITH Claim" language={language} />
              </h2>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-gray-400 hover:text-blue-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <img
                  src="/D.FAITH.png"
                  alt="D.FAITH Logo"
                  className="w-16 h-16 coin-flip"
                  style={{ animation: 'coin-flip 5s linear infinite' }}
                />
                <style>{`
                  @keyframes coin-flip {
                    0% { transform: rotateY(0deg); }
                    100% { transform: rotateY(360deg); }
                  }
                `}</style>
              </div>
              <p className="text-blue-200 leading-relaxed mb-3 text-center">
                <TranslatedText text="Du kannst" language={language} /> <strong className="text-blue-400">+{userData?.miningpower || 0} D.FAITH</strong> <TranslatedText text="für deine Facebook Aktivität claimen!" language={language} />
              </p>
              
              {account?.address && (
                <div className="bg-black/30 border border-blue-500/20 rounded-lg p-3 mb-3">
                  <div className="text-xs text-blue-300 mb-1"><TranslatedText text="Wallet Adresse:" language={language} /></div>
                  <div className="font-mono text-sm text-blue-100 break-all">
                    {account.address}
                  </div>
                </div>
              )}
            </div>
            
            {!account?.address && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <p className="text-yellow-200 text-sm font-medium mb-3 text-center">
                  <TranslatedText text="Du hast noch keine Wallet verbunden." language={language} /><br/><TranslatedText text="Verbinde deine Wallet, um fortzufahren!" language={language} />
                </p>
                <button
                  type="button"
                  onClick={() => router?.push("/wallet")}
                  className="w-full py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 text-black shadow-lg hover:from-yellow-500 hover:to-orange-500 transition-all duration-200 text-sm"
                >
                  🚀 <TranslatedText text="Wallet jetzt verbinden" language={language} />
                </button>
                <p className="text-xs text-yellow-300 mt-2 text-center">
                  <TranslatedText text="Du findest den Wallet Tab auch oben im Menü." language={language} />
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClaimModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-3 font-bold transition-all"
              >
                <TranslatedText text="Abbrechen" language={language} />
              </button>
              <button 
                onClick={submitClaim}
                disabled={!account?.address}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-xl py-3 font-bold transition-all disabled:cursor-not-allowed"
              >
                <TranslatedText text="Claimen" language={language} />
              </button>
            </div>
            
            {claimStatus && (
              <div className={`mt-4 p-3 rounded-xl text-sm ${
                claimStatus.includes('✅') 
                  ? 'bg-green-500/10 text-green-300 border border-green-500/30' 
                  : claimStatus.includes('⚠️') 
                  ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
                  : claimStatus.includes('ℹ️')
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                  : 'bg-red-500/10 text-red-300 border border-red-500/30'
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
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">✨ <TranslatedText text="Like & Share Verification" language={language} /></h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <p className="font-semibold mb-3 text-blue-800">1️⃣ <TranslatedText text="Entferne alle Likes von meinem Beitrag" language={language} /></p>
              <button 
                onClick={() => setShowConfirmInitial(true)}
                disabled={initialValues !== null || loading}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  initialValues !== null || loading
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full"></div>
                    <TranslatedText text="Erfasse Daten..." language={language} />
                  </div>
                ) : initialValues !== null ? <TranslatedText text="✅ Werte bereits erfasst" language={language} /> : <TranslatedText text="✅ Check aktuelle Werte" language={language} />}
              </button>
              {initialValues && (
                <div className="bg-white border border-blue-300 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span>Likes:</span>
                    <span className="font-bold text-blue-600">{initialValues.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shares:</span>
                    <span className="font-bold text-blue-600">{initialValues.shares}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <p className="font-semibold mb-3 text-green-800">2️⃣ <TranslatedText text="Bitte Like und Share den Beitrag!" language={language} /></p>
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
                    <TranslatedText text="Prüfe Änderungen..." language={language} />
                  </div>
                ) : !initialValues ? <TranslatedText text="⚠️ Zuerst Schritt 1 ausführen" language={language} /> : afterValues ? <TranslatedText text="✅ Neue Werte erfasst" language={language} /> : <TranslatedText text="✅ Check neue Werte" language={language} />}
              </button>
              {afterValues && (
                <div className="bg-white border border-green-300 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span>Likes:</span>
                    <span className="font-bold text-green-600">{afterValues.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shares:</span>
                    <span className="font-bold text-green-600">{afterValues.shares}</span>
                  </div>
                </div>
              )}
            </div>
            
            {afterValues && (
              <div className={`rounded-xl p-4 mb-4 ${expGained && expGained.total > 0 ? 'bg-green-100 border border-green-200' : 'bg-orange-100 border border-orange-200'}`}>
                {expGained && expGained.total > 0 ? (
                  <>
                    <div className="text-center mb-3">
                      <p className="text-green-700 font-bold text-lg">🎉 <TranslatedText text="Glückwunsch!" language={language} /></p>
                      <p className="text-green-600 text-sm"><TranslatedText text="Du hast erfolgreich EXP gesammelt:" language={language} /></p>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {expGained.likes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-600">❤️ Likes (+{expGained.likes}):</span>
                          <span className="font-bold text-green-600">+{expGained.likes * 10} EXP</span>
                        </div>
                      )}
                      {expGained.shares > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-600">🔁 Shares (+{expGained.shares}):</span>
                          <span className="font-bold text-green-600">+{expGained.shares * 10} EXP</span>
                        </div>
                      )}
                      <div className="border-t border-green-300 pt-2 mt-2">
                        <div className="flex justify-between font-bold">
                          <span className="text-green-700"><TranslatedText text="Gesamt EXP:" language={language} /></span>
                          <span className="text-green-600 text-lg">+{expGained.total} EXP</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center mb-4">
                      <p className="text-green-600 text-xs mb-3"><TranslatedText text="Lade die Seite neu, um deine neuen EXP zu sehen!" language={language} /></p>
                    </div>
                  </>
                ) : (
                  <div className="text-center mb-4">
                    <p className="text-orange-700 font-bold text-lg">😔 <TranslatedText text="Keine neuen Interaktionen" language={language} /></p>
                    <p className="text-orange-600 text-sm mb-3"><TranslatedText text="Es wurden keine neuen Likes oder Shares erkannt. Du kannst die Werte zurücksetzen und es erneut versuchen." language={language} /></p>
                  </div>
                )}
                
                <button 
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      // Nur Facebook-spezifische Verification Daten löschen
                      localStorage.removeItem("dfaith_likeStart");
                      localStorage.removeItem("dfaith_shareStart");
                      
                      // Seite neu laden
                      window.location.href = window.location.pathname + '?tab=facebook' + (window.location.search.includes('uuid=') ? '&' + window.location.search.split('?')[1] : '');
                    }
                  }}
                  className={`w-full p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    expGained && expGained.total > 0 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                  }`}
                >
                  🔄 <TranslatedText text="Seite neu laden" language={language} />
                </button>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLikeSaveModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
              >
                ❌ <TranslatedText text="Schließen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-blue-500/30 rounded-2xl p-6 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                ✨ <TranslatedText text="EXP-Quellen" language={language} />
              </h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-blue-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 border-l-4 border-red-500 pl-3 bg-red-500/10 py-3 rounded-r-xl">
                  <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" className="w-6 h-6 rounded-full" />
                  <div>
                    <div className="font-bold text-red-300">YouTube</div>
                    <div className="text-red-200 font-semibold">{userData.expStream} EXP</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-l-4 border-blue-500 pl-3 bg-blue-500/10 py-3 rounded-r-xl">
                  <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-6 h-6" />
                  <div>
                    <div className="font-bold text-blue-300">Facebook</div>
                    <div className="text-blue-200 font-semibold">{userData.expFacebook} EXP</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-l-4 border-cyan-400 pl-3 bg-cyan-500/10 py-3 rounded-r-xl">
                  <img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" className="w-6 h-6 rounded-full" />
                  <div>
                    <div className="font-bold text-cyan-300">TikTok</div>
                    <div className="text-cyan-200 font-semibold">{userData.expTiktok} EXP</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-l-4 border-pink-500 pl-3 bg-pink-500/10 py-3 rounded-r-xl">
                  <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-6 h-6 rounded-full" />
                  <div>
                    <div className="font-bold text-pink-300">Instagram</div>
                    <div className="text-pink-200 font-semibold">{userData.expInstagram} EXP</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-l-4 border-yellow-500 pl-3 bg-yellow-500/10 py-3 rounded-r-xl">
                  <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Live" className="w-6 h-6 rounded-full" />
                  <div>
                    <div className="font-bold text-yellow-300">Live</div>
                    <div className="text-yellow-200 font-semibold">{userData.liveNFTBonus} EXP</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
              <p className="text-sm text-blue-200 font-medium text-center">
                💡 <TranslatedText text="Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen!" language={language} /> 🚀
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Initial Modal */}
      {showConfirmInitial && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800"><TranslatedText text="Bestätigung erforderlich" language={language} /></h2>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <p className="text-blue-800 leading-relaxed"><TranslatedText text="Bitte entferne alle Likes von meinem Beitrag – danach werden alle aktuellen Zahlen gespeichert." language={language} /></p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
              <p className="text-yellow-700 font-bold text-sm">⚠️ <TranslatedText text="Diese Aktion ist nur einmal möglich pro Beitrag!" language={language} /></p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmInitial(false);
                  checkInitial();
                }}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ <TranslatedText text="Ja, fortfahren" language={language} />
              </button>
              <button 
                onClick={() => setShowConfirmInitial(false)}
                className="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
              >
                ❌ <TranslatedText text="Abbrechen" language={language} />
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
            <h2 className="text-xl font-bold mb-4 text-gray-800"><TranslatedText text="Finale Bestätigung" language={language} /></h2>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <p className="text-green-800 leading-relaxed"><TranslatedText text="Bitte Like und Share den Beitrag, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert." language={language} /></p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
              <p className="text-yellow-700 font-bold text-sm">⚠️ <TranslatedText text="Diese Aktion ist nur einmal möglich pro Beitrag!" language={language} /></p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  checkAfter();
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ <TranslatedText text="Ja, fortfahren" language={language} />
              </button>
              <button 
                onClick={() => setShowConfirmAfter(false)}
                className="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
              >
                ❌ <TranslatedText text="Abbrechen" language={language} />
              </button>
            </div>
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
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">🔒</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"><TranslatedText text="Profil nicht gefunden" language={language} /></h2>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                <TranslatedText text="Dein Profil ist nur durch die " language={language} /><strong className="text-blue-600"><TranslatedText text="Teilnahme an den Beiträgen" language={language} /></strong><TranslatedText text=" von " language={language} /><strong className="text-blue-600">Dawid Faith</strong><TranslatedText text=" erreichbar." language={language} />
              </p>
              <p className="text-gray-600 text-sm">
                💡 Like, kommentiere und teile seine Beiträge, um Zugang zu erhalten!
              </p>
            </div>
            
            <div className="space-y-3 mb-6">
              <p className="text-gray-700 font-medium">📱 Folge Dawid Faith auf Facebook:</p>
              
              <a 
                href="https://www.facebook.com/share/1Auve8u2CG"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3 block"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span><TranslatedText text="Facebook Profil" language={language} /></span>
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
              ❌ <TranslatedText text="Verstanden" language={language} />
            </button>
          </div>
        </div>
      )}

      {/* Mining Power Modal */}
      {showMiningPowerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-blue-500/30 rounded-2xl p-6 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                ⛏ <TranslatedText text="Mining Power" language={language} />
              </h2>
              <button
                onClick={() => setShowMiningPowerModal(false)}
                className="text-gray-400 hover:text-blue-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
              <p className="text-blue-200 leading-relaxed mb-4 text-center">
                <TranslatedText text="Deine " language={language} /><strong className="text-blue-400">Mining Power</strong><TranslatedText text=" ist abhängig von verschiedenen Faktoren:" language={language} />
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-blue-500/20">
                  <span className="text-xl text-green-400">$</span>
                  <div>
                    <div className="font-bold text-blue-300">Marketing Budget</div>
                    <div className="text-sm text-blue-400/80"><TranslatedText text="Pro User für den aktuellen Beitrag" language={language} /></div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-blue-500/20">
                  {userData?.image ? (
                    <img 
                      src={userData.image} 
                      alt="Profilbild"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">�</span>
                  )}
                  <div>
                    <div className="font-bold text-blue-300">Dein Level</div>
                    <div className="text-sm text-blue-400/80">Aktuell: Level {getLevelAndExpRange(userData?.expTotal || 0).level}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-blue-500/20">
                  <img src="/D.FAITH.png" alt="D.FAITH Logo" className="w-7 h-7 object-contain" />
                  <div>
                    <div className="font-bold text-blue-300">D.FAITH Preis</div>
                    <div className="text-sm text-blue-400/80">Aktueller Marktpreis</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 mb-4">
              <p className="text-indigo-300 font-medium text-sm text-center">
                ⚡ <strong>Aktuell:</strong> +{userData?.miningpower || 0} D.Faith pro Beitrag
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl py-3 font-bold transition-all"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}