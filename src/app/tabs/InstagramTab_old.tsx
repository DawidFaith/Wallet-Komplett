'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    return urlParams.get('uuid') || 'dfaith3789953';
  }
  return 'dfaith3789953';
};

export default function InstagramTab() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
  const [showStoryHelpModal, setShowStoryHelpModal] = useState(false);
  const [showConfirmInitial, setShowConfirmInitial] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [showNoValuesFoundModal, setShowNoValuesFoundModal] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [initialValues, setInitialValues] = useState<{likes: number, saves: number} | null>(null);
  const [afterValues, setAfterValues] = useState<{likes: number, saves: number} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState(false);

  // Daten laden
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const uuid = getUUID();
        const response = await fetch("https://uuid-check-insta.vercel.app/api/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid })
        });
        const data = await response.json();
        
        // Wallet setzen falls vorhanden
        if (data.wallet && data.wallet.startsWith("0x")) {
          setWalletInput(data.wallet);
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

  // Like/Save Check API
  const checkInitial = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
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
      const response = await fetch(`https://hook.eu2.make.com/bli0jo4nik0m9r4x9aj76ptktghdzckd?uuid=${encodeURIComponent(uuid)}`);
      const data = await response.json();
      
      const newLikes = parseInt(data.likes);
      const newSaves = parseInt(data.saves);
      setAfterValues({ likes: newLikes, saves: newSaves });
      
      if (initialValues && (newLikes > initialValues.likes || newSaves > initialValues.saves)) {
        setConfirmationMessage(true);
      }
    } catch (error) {
      console.error('Fehler beim Check:', error);
    } finally {
      setLoading(false);
    }
  };

  // Claim absenden
  const submitClaim = async () => {
    if (!walletInput.startsWith('0x') || walletInput.length < 42) {
      setClaimStatus('❌ Ungültige Wallet-Adresse.');
      return;
    }

    setLoading(true);
    try {
      const uuid = getUUID();
      const response = await fetch('https://hook.eu2.make.com/1c62icx2yngv8v4g6y7k7songq01rblk', {
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
          background: 'linear-gradient(135deg, #e1306c, #fd1d1d, #833ab4)',
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
            background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.95), rgba(253, 29, 29, 0.95), rgba(131, 58, 180, 0.95))',
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
          background: 'linear-gradient(135deg, #e1306c, #fd1d1d, #833ab4)',
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
                <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-red-500 bg-clip-text text-transparent">{level}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">{userData.expTotal.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-pink-500 hover:bg-pink-600 text-white w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
              >
                i
              </button>
            </div>
            
            {/* Progress Bar mit Animation */}
            <div className="relative bg-gray-800/60 rounded-full h-4 overflow-hidden mb-4 shadow-inner border border-gray-700/50">
              <div 
                className="h-full bg-gradient-to-r from-pink-400 via-red-500 to-purple-500 transition-all duration-1000 ease-out relative shadow-lg"
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
              className="relative flex-1 bg-gradient-to-r from-pink-500 via-pink-600 to-red-700 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-400/30"
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
        <p className="text-lg font-bold mb-2">🪙 Wallet benötigt für Claim</p>
        {!wallet || !wallet.startsWith("0x") ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-zinc-800 text-base flex flex-col items-center animate-pulse">
            <span className="font-semibold mb-2 text-center">Du hast noch keine Wallet hinterlegt.<br/>Erstelle jetzt deine Wallet, um deine Belohnung zu erhalten!</span>
            <button
              className="w-full mt-2 mb-1 py-2 px-4 rounded-xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-zinc-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition text-base border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center block"
              onClick={() => router.push("/wallet")}
            >
              🚀 Wallet jetzt anlegen
            </button>
            <span className="text-xs text-zinc-500 mt-2">Du findest den Wallet Tab auch oben im Menü.</span>
          </div>
        ) : null}
        <div className="relative">
          <input
            className="w-full p-2 pr-10 my-2 rounded-lg border border-gray-300 text-black text-base focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition"
            type="text"
            placeholder="0x..."
            value={wallet}
            onChange={e => setWallet(e.target.value)}
            readOnly={!!wallet && wallet.startsWith("0x")}
          />
          <button
            onClick={() => setModal("walletInfo")}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-sm transition-all duration-200 text-xs"
            title="Wallet Info"
          >
            i
          </button>
        </div>
        <button
          className="modal-btn w-full py-3 rounded-2xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-zinc-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition text-base tracking-tight flex items-center justify-center gap-2 border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={submitClaim}
          disabled={!wallet || !wallet.startsWith("0x")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mr-1"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#FFA500" strokeWidth="2"/><text x="12" y="16" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">₿</text></svg>
          Claim
        </button>
        <p className="mt-2 min-h-[1.5em] text-center" style={{ color: claimStatus.startsWith("✅") ? "green" : claimStatus.startsWith("❌") ? "red" : undefined }}>{claimStatus}</p>
      </Modal>
      <Modal open={modal === "storyHelp"} onClose={() => setModal(null)}>
        <p>📣 Bitte teile meinen Beitrag in deiner Instagram-Story<br/><b>@dawidfaith</b>, damit du dein Upgrade erhältst.</p>
      </Modal>
      <Modal open={modal === "likeSave"} onClose={() => setModal(null)}>
        <div className="flex flex-col items-center gap-2 mb-4">
          <p className="text-xl font-bold text-zinc-900">📊 Like & Save Verification</p>
          <p className="text-sm text-zinc-600">Verifiziere deine Interaktionen für EXP-Belohnungen</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-zinc-800 text-base flex flex-col items-center">
            <span className="font-semibold mb-1">1️⃣ Entferne alle Likes und Saves von meinem Beitrag.</span>
            <button 
              className={`modal-btn w-full py-2 rounded-xl font-semibold shadow transition text-base flex items-center justify-center gap-2 border focus:outline-none focus:ring-2 mt-2 ${
                likeStart !== null && saveStart !== null 
                  ? "bg-gray-400 text-gray-600 border-gray-300 cursor-not-allowed opacity-60" 
                  : "bg-zinc-900/90 text-white border-zinc-200 hover:bg-zinc-900/95 active:bg-zinc-800 focus:ring-zinc-300"
              }`}
              onClick={() => setModal("confirmCheckInitial")}
              disabled={likeStart !== null && saveStart !== null}
            >
              {likeStart !== null && saveStart !== null ? "✅ Werte bereits erfasst" : "✅ Check aktuelle Werte"}
            </button>
            {likeStart !== null && saveStart !== null && (
              <div className="flex gap-4 mt-2">
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Likes: <b>{likeStart}</b></div>
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Saves: <b>{saveStart}</b></div>
              </div>
            )}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-zinc-800 text-base flex flex-col items-center">
            <span className="font-semibold mb-1">2️⃣ Like & speichere den Beitrag erneut, dann fortfahren!</span>
            <button className="modal-btn w-full py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 mt-2" onClick={() => setModal("confirmCheckAfter")}>✅ Check neue Werte</button>
            {likeAfter !== null && saveAfter !== null && (
              <div className="flex gap-4 mt-2">
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Likes: <b>{likeAfter}</b></div>
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Saves: <b>{saveAfter}</b></div>
              </div>
            )}
          </div>
        </div>
        {confirmationMessage && <p className="text-green-600 font-bold mt-4 text-center">{confirmationMessage}</p>}
        <button className="modal-btn w-full mt-4 py-2 rounded-xl font-semibold bg-white text-zinc-900 shadow hover:bg-zinc-100 active:bg-zinc-200 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300" onClick={() => { if (typeof window !== "undefined") { localStorage.clear(); window.location.reload(); } }}>🔄 Neu laden</button>
      </Modal>
      <Modal open={modal === "confirmCheckInitial"} onClose={() => setModal(null)}>
        <p>Bitte <b>entferne zuerst alle Likes und Saves</b> von meinem Beitrag – danach werden die aktuellen Zahlen gespeichert.</p>
        <p className="text-yellow-400 font-bold mt-2">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
        <div className="flex gap-3 mt-4">
          <button className="modal-btn flex-1 py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 w-full" onClick={() => { setModal("likeSave"); checkInitial(); }}>✅ Ja, fortfahren</button>
        </div>
      </Modal>
      <Modal open={modal === "confirmCheckAfter"} onClose={() => setModal(null)}>
        <p>Bitte <b>like und speichere den Beitrag erneut</b>, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
        <p className="text-yellow-400 font-bold mt-2">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
        <div className="flex gap-3 mt-4">
          <button className="modal-btn flex-1 py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 w-full" onClick={() => { setModal("likeSave"); checkAfter(); }}>✅ Ja, fortfahren</button>
        </div>
      </Modal>
      <Modal open={modal === "walletInfo"} onClose={() => setModal(null)}>
        <p><b>🔒 Wichtiger Hinweis:</b><br/><br/>Deine Wallet-Adresse wird dauerhaft mit deinem Social-Media-Account verbunden.<br/><br/>Wenn du sie ändern willst, schreib mir eine <b>DM mit dem Stichwort „Wallet“</b> auf <b>Instagram</b>.</p>
      </Modal>
      <Modal open={modal === "noValuesFound"} onClose={() => setModal(null)}>
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-lg font-bold text-zinc-900">Versuch bereits unternommen</p>
        </div>
        <div className="text-center space-y-3">
          <p className="text-zinc-700">
            Es scheint, als hättest du bereits einen Versuch für diesen Beitrag unternommen.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-blue-800 font-medium text-sm">
              💡 <strong>Nächste Möglichkeit:</strong><br/>
              Warte auf meinen nächsten Instagram-Beitrag für eine neue Chance!
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            Jeder Beitrag bietet neue Möglichkeiten für EXP-Belohnungen.
          </p>
        </div>
        <button 
          className="modal-btn w-full mt-4 py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          onClick={() => setModal(null)}
        >
          Verstanden
        </button>
      </Modal>

      {/* Card */}
      <div className="card w-full max-w-[350px] bg-white/90 rounded-3xl shadow-xl border border-zinc-200/80 relative overflow-hidden p-4 sm:p-6 text-zinc-900 text-center flex flex-col items-center backdrop-blur-sm" style={{boxShadow:'0 8px 32px 0 rgba(0,0,0,0.08), 0 1.5px 8px 0 rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.8)'}}>
        <style jsx>{`
          @keyframes shine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-2px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.3); }
            50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.4); }
          }
        `}</style>
        <div className="username text-[1.8rem] sm:text-[2.1rem] font-semibold mb-1 flex items-center justify-center gap-2 tracking-tight hover:scale-105 transition-transform duration-300" style={{fontFamily:'SF Pro Display,Poppins,Arial,sans-serif', letterSpacing:'0.01em'}}>
          <span className="text-zinc-900/90">{username}</span>
        </div>
        <div className="relative mb-3 group">
          <img
            src={profileImage || "https://via.placeholder.com/100"}
            alt="Profilbild"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover mx-auto border-4 border-zinc-200 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
            style={{boxShadow:'0 0 0 4px #e5e7eb, 0 2px 16px 0 rgba(0,0,0,0.1)'}}
          />
          <div className="absolute -inset-1 rounded-full bg-white/60 blur-[8px] z-[-1] group-hover:bg-white/80 transition-all duration-300"></div>
        </div>
        <div className="level-box bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-3 sm:p-4 mb-3 w-full border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="flex justify-between items-center mb-2">
            <div className="level font-bold text-base sm:text-lg text-zinc-900 tracking-tight flex items-center gap-2 group-hover:text-zinc-800 transition-colors duration-200">
              Level {level}
            </div>
            <div className="exp text-xs sm:text-sm font-semibold text-zinc-600 bg-white/60 px-2 py-1 rounded-full border border-zinc-200 hover:bg-white/80 transition-all duration-200">{exp.toLocaleString()} / {maxExp.toLocaleString()}</div>
            <button className="bg-white/80 text-zinc-600 font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-md border border-white/60 hover:scale-110 hover:bg-white hover:text-zinc-800 transition-all duration-200 hover:shadow-lg text-sm" title="Info" onClick={() => setModal("info")}>i</button>
          </div>
          <div className="progress-container relative mb-2">
            <div className="progress-bar relative w-full h-5 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 rounded-full overflow-hidden border-2 border-white/60 shadow-inner backdrop-blur-sm hover:shadow-lg transition-shadow duration-300">
              <div
                className="progress-fill absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out hover:shadow-lg"
                style={{
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)",
                  boxShadow: '0 0 20px 4px rgba(255, 215, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  zIndex: 1,
                  borderRadius: 'inherit'
                }}
              ></div>
              <div className="progress-shine absolute left-0 top-0 h-full w-full rounded-full opacity-30" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                animation: progressPercent > 0 ? 'shine 2s ease-in-out infinite' : 'none',
                zIndex: 2
              }}></div>
              <div className="progress-label absolute w-full h-full flex items-center justify-center text-xs font-bold text-zinc-800 drop-shadow-sm" style={{zIndex:3, letterSpacing:'0.01em'}}>
                {currentLevelExp.toLocaleString()} / {levelRange.toLocaleString()} EXP
              </div>
            </div>
          </div>
          <div className="mining-power bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-2 text-center hover:from-yellow-100 hover:to-orange-100 transition-all duration-300 hover:shadow-md" style={{animation: miningPower > 0 ? 'float 3s ease-in-out infinite' : 'none'}}>
            <div className="text-zinc-700 text-xs font-medium mb-0.5">Mining Power</div>
            <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 flex items-center justify-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-pulse">
                <circle cx="12" cy="12" r="10" fill="url(#coinGradient)" stroke="#FFA500" strokeWidth="2"/>
                <defs>
                  <linearGradient id="coinGradient" x1="0" y1="0" x2="24" y2="24">
                    <stop stopColor="#FFD700"/>
                    <stop offset="1" stopColor="#FFA500"/>
                  </linearGradient>
                </defs>
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold">₿</text>
              </svg>
              +{miningPower.toLocaleString()} D.FAITH
            </div>
          </div>
        </div>
        {/* System-Check */}
        <div className="system-check border border-zinc-200 rounded-2xl p-3 sm:p-4 bg-white/60 mb-3 w-full shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-sm">
          <div className="system-check-header font-semibold text-sm mb-2 text-zinc-700 flex items-center gap-2">
            <span className="animate-pulse">✅</span> System Check
          </div>
          <div className="space-y-0">
            <div className="check-item flex justify-between items-center p-1 rounded-lg hover:bg-white/40 transition-all duration-200 text-sm sm:text-base font-medium">
              <span className="flex items-center gap-2">❤️ Like</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-all duration-200 ${checkLike ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                {checkLike ? "✅ +10 EXP" : "❌ +10 EXP"}
              </span>
            </div>
            <div className="check-item flex justify-between items-center p-1 rounded-lg hover:bg-white/40 transition-all duration-200 text-sm sm:text-base font-medium">
              <span className="flex items-center gap-2">💬 Kommentar</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-all duration-200 ${checkComment ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                {checkComment ? "✅ +10 EXP" : "❌ +10 EXP"}
              </span>
            </div>
            <div className="check-item flex justify-between items-center p-1 rounded-lg hover:bg-white/40 transition-all duration-200 text-sm sm:text-base font-medium">
              <span className="flex items-center gap-2">📣 Story</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-all duration-200 ${checkStory ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                {checkStory ? "✅ +20 EXP" : "❌ +20 EXP"}
              </span>
            </div>
            <div className="check-item flex justify-between items-center p-1 rounded-lg hover:bg-white/40 transition-all duration-200 text-sm sm:text-base font-medium">
              <span className="flex items-center gap-2">💾 Save</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-all duration-200 ${checkSave ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                {checkSave ? "✅ +10 EXP" : "❌ +10 EXP"}
              </span>
            </div>
          </div>
        </div>
        {/* Buttons */}
        <div className="button-row flex flex-col gap-2 mt-4 w-full">
          <button className="btn-upgrade w-full py-2.5 rounded-2xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition-all duration-200 text-sm sm:text-base tracking-tight flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 hover:scale-105 hover:shadow-lg active:scale-95" onClick={() => setModal("upgrade")}>
            <span className="animate-pulse">✨</span> Sammle mehr EXP
          </button>
          <button className="btn-claim w-full py-2.5 rounded-2xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-zinc-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition-all duration-200 text-sm sm:text-base tracking-tight flex items-center justify-center gap-2 border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 hover:scale-105 hover:shadow-xl active:scale-95" onClick={() => setModal("claim")}>
            <span className="animate-bounce">🪙</span> Claim
          </button>
        </div>
      </div>
    </div>
  );
}