'use client';

import React, { useState, useEffect } from 'react';

interface UserData {
  username: string;
  image: string;
  expTotal: number;
  expTiktok: number;
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
  const [claimStatus, setClaimStatus] = useState('');
  const [initialValues, setInitialValues] = useState<{likes: number, shares: number} | null>(null);
  const [afterValues, setAfterValues] = useState<{likes: number, shares: number} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState(false);

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
        const url = `https://uuid-check-fb.vercel.app/api/uuid-check?uuid=${uuid}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        // Wallet setzen falls vorhanden
        if (data.wallet && data.wallet.startsWith("0x")) {
          setWalletInput(data.wallet);
        }
        
        setUserData({
          username: data.username,
          image: data.image?.startsWith("http://") ? data.image.replace("http://", "https://") : data.image || "https://via.placeholder.com/100",
          expTotal: parseInt(data.expTotal),
          expTiktok: data.expTiktok,
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
    if (!walletInput.startsWith('0x') || walletInput.length < 42) {
      setClaimStatus('❌ Ungültige Wallet-Adresse.');
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
          wallet: walletInput,
          username: userData?.username || '',
          miningpower: userData?.miningpower || 0
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success' || data.success === true || data.claimed === true) {
        setClaimStatus(data.message || '✅ Claim erfolgreich ausgelöst!');
        // localStorage leeren wie im Original
        if (typeof window !== 'undefined') {
          localStorage.clear();
        }
      } else {
        setClaimStatus('❌ Fehler: ' + (data.message || 'Unbekannter Fehler.'));
      }
    } catch (error) {
      setClaimStatus('❌ Netzwerkfehler oder ungültige Antwort.');
      console.error('Claim Fehler:', error);
    } finally {
      setLoading(false);
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
      
      if (initialValues && (newLikes > initialValues.likes || newShares > initialValues.shares)) {
        setConfirmationMessage(true);
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
            <div className="flex justify-between items-center mb-3">
              <div className="text-xl font-bold">Level {level}</div>
              <div className="text-right">
                <div className="text-sm text-gray-300">EXP</div>
                <div className="text-base font-bold">{userData.expTotal} / {maxExp}</div>
              </div>
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-white text-pink-600 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200"
              >
                i
              </button>
            </div>
            
            {/* Progress Bar mit Animation */}
            <div className="relative bg-gray-800 rounded-full h-4 overflow-hidden mb-4 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-purple-600 transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                {progressPercent}%
              </div>
            </div>
            
            {/* Mining Power mit verbessertem Design */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-3 border border-yellow-500/30">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl animate-bounce">⛏</span>
                <div className="text-center">
                  <div className="text-yellow-300 text-sm font-medium">Mining Power</div>
                  <div className="text-yellow-200 text-lg font-bold">+{userData.miningpower} D.Faith</div>
                </div>
              </div>
            </div>
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
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="relative w-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 px-6 py-4 rounded-2xl font-bold text-lg text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 border border-blue-400/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-2">
                <span className="text-2xl animate-pulse">✨</span>
                <span className="tracking-wider">Sammle mehr EXP</span>
              </div>
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="relative w-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 px-6 py-4 rounded-2xl font-bold text-lg text-gray-900 overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25 border border-yellow-300/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-2">
                <span className="text-2xl animate-bounce">🪙</span>
                <span className="tracking-wider">Claim Belohnung</span>
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
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <div className="flex justify-center mb-6">
              <button 
                onClick={() => setShowWalletInfoModal(true)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-600 w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center shadow-lg border border-blue-300 transition-all duration-300 hover:scale-110"
              >
                i
              </button>
            </div>
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">🪙 Wallet für Claim benötigt</h2>
            <p className="mb-6 text-gray-700">Gib deine Wallet-Adresse ein, um deine Belohnung zu erhalten:</p>
            <input 
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="0x..."
              readOnly={!!(userData?.wallet && userData.wallet.startsWith("0x"))}
              className="w-full p-4 border-2 border-gray-300 rounded-2xl mb-6 text-base focus:border-blue-500 focus:outline-none transition-colors duration-300"
            />
            <button 
              onClick={submitClaim}
              disabled={!walletInput || !walletInput.startsWith('0x')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white p-4 rounded-2xl font-bold mb-4 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="text-xl">✅</span>
              <span>Claim absenden</span>
            </button>
            {claimStatus && (
              <div className={`mb-4 p-3 rounded-xl ${claimStatus.includes('✅') ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                {claimStatus}
              </div>
            )}
            <button 
              onClick={() => setShowClaimModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 p-4 rounded-2xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Like & Save Modal */}
      {showLikeSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">📊 Like & Share Verification</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <p className="font-semibold mb-3 text-blue-800">1️⃣ Entferne alle Likes und Shares von meinem Beitrag</p>
              <button 
                onClick={() => setShowConfirmInitial(true)}
                disabled={initialValues !== null}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  initialValues !== null 
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transform hover:scale-105'
                }`}
              >
                {initialValues !== null ? '✅ Werte bereits erfasst' : '✅ Check aktuelle Werte'}
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
              <p className="font-semibold mb-3 text-green-800">2️⃣ Like und teile den Beitrag erneut!</p>
              <button 
                onClick={() => setShowConfirmAfter(true)}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ Check neue Werte
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
            
            {confirmationMessage && (
              <div className="bg-green-100 border border-green-200 rounded-xl p-3 mb-4">
                <p className="text-green-700 font-bold">✅ Erfolgreich! Bitte lade die Seite neu.</p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                🔄 Neu laden
              </button>
              <button 
                onClick={() => setShowLikeSaveModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 p-3 rounded-xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
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
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">📊 Deine EXP-Quellen</h2>
            <div className="text-left space-y-4 mb-8">
              <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 py-2 rounded-r-xl">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 text-xl">👍</span>
                  <div>
                    <div className="font-bold text-blue-800">Facebook</div>
                    <div className="text-blue-600 font-semibold">{userData.expFacebook} EXP</div>
                  </div>
                </div>
              </div>
              <div className="border-l-4 border-black pl-4 bg-gray-50 py-2 rounded-r-xl">
                <div className="flex items-center gap-2">
                  <span className="text-black text-xl">🎵</span>
                  <div>
                    <div className="font-bold text-gray-800">TikTok</div>
                    <div className="text-gray-600 font-semibold">{userData.expTiktok} EXP</div>
                  </div>
                </div>
              </div>
              <div className="border-l-4 border-pink-500 pl-4 bg-pink-50 py-2 rounded-r-xl">
                <div className="flex items-center gap-2">
                  <span className="text-pink-600 text-xl">📸</span>
                  <div>
                    <div className="font-bold text-pink-800">Instagram</div>
                    <div className="text-pink-600 font-semibold">0 EXP</div>
                  </div>
                </div>
              </div>
              <div className="border-l-4 border-purple-500 pl-4 bg-purple-50 py-2 rounded-r-xl">
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 text-xl">🎬</span>
                  <div>
                    <div className="font-bold text-purple-800">Stream</div>
                    <div className="text-purple-600 font-semibold">{userData.expStream} EXP</div>
                  </div>
                </div>
              </div>
              <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 py-2 rounded-r-xl">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 text-xl">🎤</span>
                  <div>
                    <div className="font-bold text-yellow-800">Live EXP Bonus</div>
                    <div className="text-yellow-600 font-semibold">{userData.liveNFTBonus} EXP</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-700 font-medium">💡 Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen! 🚀</p>
            </div>
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 p-4 rounded-2xl font-bold transition-all duration-300 border border-gray-300 hover:border-gray-400"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Wallet Info Modal */}
      {showWalletInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Wichtiger Hinweis</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-700 leading-relaxed">
                Deine Wallet-Adresse wird dauerhaft mit deinem Social-Media-Account verbunden.<br/><br/>
                Wenn du sie ändern willst, schreib mir eine <strong className="text-blue-600">DM mit dem Stichwort &quot;Wallet&quot;</strong> auf <strong className="text-blue-600">Facebook</strong>.
              </p>
            </div>
            <button 
              onClick={() => setShowWalletInfoModal(false)}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
            </button>
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
              <p className="text-green-800 leading-relaxed">Bitte Like und Share den Beitrag erneut, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
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
    </>
  );
}