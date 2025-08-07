'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { validateBaseAddress, validateBaseAddressRealTime } from '../utils/walletValidation';

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
  saved: boolean | string;
  wallet?: string;
}

export default function FacebookTab() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
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

  // UUID aus URL Parameter holen (Simulation)
  const getUUID = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('uuid') || 'Dawidfaithtest3736FB';
    }
    return 'Dawidfaithtest3736FB';
  };

  // Daten laden
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const uuid = getUUID();
        
        // UUID Überprüfung - Test-UUID ist jetzt erlaubt
        if (uuid === 'Dawidfaithtest3736FB_DISABLED') {  // Disabled für Test
          setLoading(false);
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
            saved: "false",
            wallet: undefined
          });
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
          expStream: data.expStream,
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

  // Claim funktionen
  const submitClaim = async () => {
    // Validierung der Wallet-Adresse
    const validation = validateBaseAddress(walletInput);
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
          wallet: walletInput.trim(),
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
      const response = await fetch(`https://hook.eu2.make.com/q75ocak1iqjwhafs7t99xpxp1xzeymqt?uuid=${encodeURIComponent(uuid)}`);
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
      const response = await fetch(`https://hook.eu2.make.com/q75ocak1iqjwhafs7t99xpxp1xzeymqt?uuid=${encodeURIComponent(uuid)}`);
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
    return (
      <div 
        className="min-h-screen w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #1877f2, #3b5998, #1d2e70)',
          fontFamily: 'Poppins, Segoe UI, sans-serif'
        }}
      >
        <div className="text-white text-center">
          <div className="animate-spin w-20 h-20 border-4 border-white/20 border-t-white rounded-full mx-auto mb-8"></div>
          <p className="text-2xl font-bold mb-3">Facebook Tab wird geladen...</p>
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
            background: 'linear-gradient(135deg, rgba(24, 119, 242, 0.95), rgba(59, 89, 152, 0.95), rgba(29, 46, 112, 0.95))',
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
                <span className="text-xl font-bold text-white">Level</span>
                <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">{level}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">{userData.expTotal.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
              >
                i
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
              className="w-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-3 border border-yellow-500/30 hover:from-yellow-500/30 hover:to-orange-500/30 hover:border-yellow-500/50 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl animate-bounce">⛏</span>
                <div className="text-center">
                  <div className="text-yellow-300 text-sm font-medium">Mining Power</div>
                  <div className="text-yellow-200 text-lg font-bold">+{userData.miningpower} D.Faith</div>
                </div>
              </div>
            </button>
          </div>
          
          {/* System Check */}
          <div className="border-2 border-white rounded-2xl p-4 mb-6 bg-black bg-opacity-20">
            <div className="font-bold text-lg mb-3 text-white">✅ System Check</div>
            
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
                <span>🔁 Share</span>
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
                <span className="tracking-wider">Sammle EXP</span>
              </div>
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="relative flex-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 px-4 py-4 rounded-2xl font-bold text-sm text-gray-900 overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25 border border-yellow-300/50"
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
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">✨ Sammle mehr EXP!</h2>
            <button 
              onClick={() => {
                setShowUpgradeModal(false);
                setShowLikeSaveModal(true);
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white p-4 rounded-2xl font-bold mb-4 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-xl">❤️</span>
              <span className="text-xl">🔁</span>
              <span>Like + Share</span>
            </button>
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 p-4 rounded-2xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
            >
              ❌ Schließen
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
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <span className="text-xl animate-bounce">🪙</span>
              <span>D.FAITH Claim</span>
            </h2>
            
            {!walletInput || !walletValidation.isValid ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-gray-800 text-base flex flex-col items-center animate-pulse">
                <span className="font-semibold mb-3 text-center">Du hast noch keine gültige Base Chain Wallet hinterlegt.<br/>Erstelle jetzt deine Wallet, um deine Belohnung zu erhalten!</span>
                <button
                  className="w-full mt-2 mb-2 py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-gray-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition text-base border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center block"
                  onClick={() => router.push("/wallet")}
                >
                  🚀 Wallet jetzt anlegen
                </button>
                <span className="text-xs text-gray-500 mt-1">Du findest den Wallet Tab auch oben im Menü.</span>
              </div>
            ) : null}
            
            <p className="mb-4 text-gray-700">Gib deine Base Chain Wallet-Adresse ein, um deine Belohnung zu erhalten:</p>
            
            {walletInput && walletValidation.isValid && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-gray-800 mb-2">
                  Du kannst <strong className="text-blue-600">+{userData.miningpower} D.FAITH</strong> für deine Facebook Aktivität claimen!
                </p>
              </div>
            )}
            <div className="relative mb-6">
              <input 
                type="text"
                value={walletInput}
                onChange={(e) => handleWalletInputChange(e.target.value)}
                placeholder="0x... (Base Chain Adresse)"
                readOnly={!!(userData?.wallet && userData.wallet.startsWith("0x"))}
                className={`w-full p-4 pr-12 border-2 rounded-2xl text-base focus:outline-none transition-colors duration-300 ${
                  walletInput && !walletValidation.isPartiallyValid
                    ? 'border-red-400 focus:border-red-500 bg-red-50'
                    : walletInput && walletValidation.isValid
                    ? 'border-green-400 focus:border-green-500 bg-green-50'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
              />
              {walletInput && walletValidation.error && (
                <div className="absolute left-0 top-full mt-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1 shadow-sm z-10">
                  {walletValidation.error}
                </div>
              )}
              <button
                onClick={() => setShowWalletInfoModal(true)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-sm transition-all duration-200 text-sm"
                title="Wallet Info"
              >
                i
              </button>
            </div>
            <button 
              onClick={submitClaim}
              disabled={!walletInput || !walletValidation.isValid}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white p-4 rounded-2xl font-bold mb-4 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Claim absenden</span>
            </button>
            {claimStatus && (
              <div className={`mb-4 p-3 rounded-xl ${claimStatus.includes('✅') ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
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
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">✨ Like & Share Verification</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <p className="font-semibold mb-3 text-blue-800">1️⃣ Entferne alle Likes von meinem Beitrag</p>
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
                    <span>Erfasse Daten...</span>
                  </div>
                ) : initialValues !== null ? '✅ Werte bereits erfasst' : '✅ Check aktuelle Werte'}
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
              <p className="font-semibold mb-3 text-green-800">2️⃣ Bitte Like und Share den Beitrag!</p>
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
                      <p className="text-green-700 font-bold text-lg">🎉 Glückwunsch!</p>
                      <p className="text-green-600 text-sm">Du hast erfolgreich EXP gesammelt:</p>
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
                    <p className="text-orange-600 text-sm mb-3">Es wurden keine neuen Likes oder Shares erkannt. Du kannst die Werte zurücksetzen und es erneut versuchen.</p>
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
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">✨ Deine EXP-Quellen</h2>
            <div className="text-left space-y-3 mb-6">
              <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3 bg-blue-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-6 h-6" />
                <div>
                  <div className="font-bold text-blue-800">Facebook</div>
                  <div className="text-blue-600 font-semibold">{userData.expFacebook} EXP</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-4 border-black pl-3 bg-gray-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" className="w-6 h-6 rounded-full" />
                <div>
                  <div className="font-bold text-gray-800">TikTok</div>
                  <div className="text-gray-600 font-semibold">{userData.expTiktok} EXP</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-4 border-pink-500 pl-3 bg-pink-50 py-2 rounded-r-xl">
                <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-6 h-6 rounded-full" />
                <div>
                  <div className="font-bold text-pink-800">Instagram</div>
                  <div className="text-pink-600 font-semibold">{userData.expInstagram} EXP</div>
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
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-700 font-medium">💡 Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen! 🚀</p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Info Modal */}
      {showWalletInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowWalletInfoModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Wichtiger Hinweis</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-700 leading-relaxed">
                Deine Base Chain Wallet-Adresse wird dauerhaft mit deinem Social-Media-Account verbunden.<br/><br/>
                Wenn du sie ändern willst, schreib mir eine <strong className="text-blue-600">DM mit dem Stichwort &quot;Wallet&quot;</strong> auf <strong className="text-blue-600">Facebook</strong>.
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
            <h2 className="text-xl font-bold mb-4 text-gray-800">Bestätigung erforderlich</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <p className="text-blue-800 leading-relaxed">Bitte entferne alle Likes von meinem Beitrag – danach werden alle aktuellen Zahlen gespeichert.</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
              <p className="text-yellow-700 font-bold text-sm">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmInitial(false);
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
              <p className="text-green-800 leading-relaxed">Bitte Like und Share den Beitrag, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
              <p className="text-yellow-700 font-bold text-sm">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  checkAfter();
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
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
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Profil nicht gefunden</h2>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Dein Profil ist nur durch die <strong className="text-blue-600">Teilnahme an den Beiträgen</strong> von <strong className="text-blue-600">Dawid Faith</strong> erreichbar.
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
                <span>Facebook Profil</span>
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
              <div className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">⛏</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">Mining Power Info</h2>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Deine <strong className="text-orange-600">Mining Power</strong> ist abhängig von verschiedenen Faktoren:
              </p>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-yellow-300">
                  <span className="text-xl">💰</span>
                  <div>
                    <div className="font-bold text-gray-800">Marketing Budget</div>
                    <div className="text-sm text-gray-600">Pro User für den aktuellen Beitrag</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-yellow-300">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-bold text-gray-800">Dein Level</div>
                    <div className="text-sm text-gray-600">Aktuell: Level {getLevelAndExpRange(userData?.expTotal || 0).level}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-yellow-300">
                  <span className="text-xl">💎</span>
                  <div>
                    <div className="font-bold text-gray-800">D.FAITH Preis</div>
                    <div className="text-sm text-gray-600">Aktueller Marktpreis</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
              <p className="text-orange-800 font-medium text-sm">
                ⚡ <strong>Aktuell:</strong> +{userData?.miningpower || 0} D.Faith pro Beitrag
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  );
}