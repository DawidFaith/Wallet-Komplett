'use client';

import { useState, useEffect } from 'react';

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
        const url = `https://hook.eu2.make.com/vigvc79vrgcha3n1igkuhmvl1q84r3rf?uuid=${uuid}`;
        
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
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #1877f2, #3b5998, #1d2e70)'
      }}>
        <div className="text-white text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Lade Daten...</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-white text-lg font-bold">Wird verarbeitet...</p>
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
          />
          
          {/* Level Box */}
          <div className="bg-black bg-opacity-20 rounded-2xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xl font-bold">Level {level}</div>
              <div className="text-base">{userData.expTotal} / {maxExp} EXP</div>
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-white text-pink-600 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shadow-lg"
              >
                i
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="relative bg-gray-800 rounded-full h-3.5 overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {progressPercent}%
              </div>
            </div>
            
            <div className="text-yellow-300 text-sm">
              ⛏ +{userData.miningpower} D.Faith
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
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-700 px-7 py-4 rounded-full font-bold text-lg hover:from-blue-600 hover:to-blue-800 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"
            >
              ✨ Upgrade
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-700 px-7 py-4 rounded-full font-bold text-lg hover:from-blue-600 hover:to-blue-800 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"
            >
              🪙 Claim
            </button>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="text-xl font-semibold mb-4">✨ Upgrade deine EXP!</p>
            <button 
              onClick={() => {
                setShowUpgradeModal(false);
                setShowLikeSaveModal(true);
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-4 border-2 border-gray-300"
            >
              ❤️ 🔁 Like + Share
            </button>
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="flex justify-center mb-4">
              <button 
                onClick={() => setShowWalletInfoModal(true)}
                className="bg-white text-pink-600 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shadow-lg border"
              >
                i
              </button>
            </div>
            <p className="mb-4">Gib deine Wallet-Adresse ein, um deinen Claim auszulösen:</p>
            <input 
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="0x..."
              readOnly={!!(userData?.wallet && userData.wallet.startsWith("0x"))}
              className="w-full p-3 border rounded-lg mb-4 text-base"
            />
            <button 
              onClick={submitClaim}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-2 border-2 border-gray-300"
            >
              ✅ Claim absenden
            </button>
            {claimStatus && (
              <p className={`mb-4 ${claimStatus.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {claimStatus}
              </p>
            )}
            <button 
              onClick={() => setShowClaimModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Like & Save Modal */}
      {showLikeSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="mb-4">1. Bitte entferne alle Likes von meinem Beitrag.</p>
            <button 
              onClick={() => setShowConfirmInitial(true)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-4 border-2 border-gray-300"
            >
              ✅ Check aktuelle Werte
            </button>
            
            {initialValues && (
              <div className="bg-gray-100 p-3 rounded-lg mb-4 text-sm">
                Likes: {initialValues.likes}<br/>
                Shares: {initialValues.shares}
              </div>
            )}
            
            <p className="mb-4">2. Bitte Like und Teile meinen Beitrag bevor du fortfährst!</p>
            <button 
              onClick={() => setShowConfirmAfter(true)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-4 border-2 border-gray-300"
            >
              ✅ Check neue Werte
            </button>
            
            {afterValues && (
              <div className="bg-gray-100 p-3 rounded-lg mb-4 text-sm">
                Likes: {afterValues.likes}<br/>
                Shares: {afterValues.shares}
              </div>
            )}
            
            {confirmationMessage && (
              <p className="text-green-600 mb-4">✅ Erfolgreich! Bitte lade die Seite neu.</p>
            )}
            
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-2 border-2 border-gray-300"
            >
              🔄 Neu laden
            </button>
            <button 
              onClick={() => setShowLikeSaveModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="text-xl font-bold mb-4">📊 Deine EXP-Quellen</p>
            <div className="text-left space-y-3 mb-6">
              <div className="border-l-4 border-blue-500 pl-3">
                <strong>Facebook:</strong> {userData.expFacebook} EXP
              </div>
              <div className="border-l-4 border-black pl-3">
                <strong>TikTok:</strong> {userData.expTiktok} EXP
              </div>
              <div className="border-l-4 border-pink-500 pl-3">
                <strong>Instagram:</strong> 0 EXP
              </div>
              <div className="border-l-4 border-purple-500 pl-3">
                <strong>Stream:</strong> {userData.expStream} EXP
              </div>
              <div className="border-l-4 border-yellow-500 pl-3">
                <strong>Live EXP Bonus:</strong> {userData.liveNFTBonus} EXP
              </div>
            </div>
            <p className="text-sm italic mb-4">💡 Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen! 🚀</p>
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Wallet Info Modal */}
      {showWalletInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="mb-4">
              <strong>🔒 Wichtiger Hinweis:</strong><br/><br/>
              Deine Wallet-Adresse wird dauerhaft mit deinem Social-Media-Account verbunden.<br/><br/>
              Wenn du sie ändern willst, schreib mir eine <strong>DM mit dem Stichwort &ldquo;Wallet&rdquo;</strong> auf <strong>Facebook</strong>.
            </p>
            <button 
              onClick={() => setShowWalletInfoModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Schließen
            </button>
          </div>
        </div>
      )}

      {/* Confirm Initial Modal */}
      {showConfirmInitial && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="mb-4">Bitte entferne alle Likes von meinem Beitrag – danach werden alle aktuellen Zahlen gespeichert.</p>
            <p className="text-yellow-600 font-bold mb-4">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
            <button 
              onClick={() => {
                setShowConfirmInitial(false);
                checkInitial();
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-2 border-2 border-gray-300"
            >
              ✅ Ja, fortfahren
            </button>
            <button 
              onClick={() => setShowConfirmInitial(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Confirm After Modal */}
      {showConfirmAfter && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="mb-4">Bitte Like und Share den Beitrag erneut, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
            <p className="text-yellow-600 font-bold mb-4">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
            <button 
              onClick={() => {
                setShowConfirmAfter(false);
                checkAfter();
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold mb-2 border-2 border-gray-300"
            >
              ✅ Ja, fortfahren
            </button>
            <button 
              onClick={() => setShowConfirmAfter(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 p-3 rounded-lg font-bold border-2 border-gray-300"
            >
              ❌ Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}