'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';

// Base Chain Wallet-Adresse Validierung
const isValidBaseChainAddress = (address: string): boolean => {
  // Base Chain verwendet Ethereum-ähnliche Adressen (0x + 40 hexadezimale Zeichen)
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (username: string, walletAddress: string) => void;
  isLoading: boolean;
  router?: any;
  confirmationMessage?: string;
  account?: any; // Thirdweb Account
}

interface UserData {
  username: string;
  image: string;
  expTotal: number;
  expTiktok: number;
  expFacebook: number;
  expInstagram: number;
  expStream: number;
  liveNFTBonus: number;
  miningpower: number;
  liked: string;
  commented: string;
  saved: boolean | string;
  shared?: string;
  wallet?: string;
  walletAddress?: string;
}

function Modal({ isOpen, onClose, title, onSubmit, isLoading, router, confirmationMessage, account }: ModalProps) {
  const [username, setUsername] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
  const [walletError, setWalletError] = useState('');

  // Gespeicherte Daten beim Öffnen des Modals laden
  React.useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedUsername = localStorage.getItem('tiktok_saved_username');
      const savedWallet = localStorage.getItem('tiktok_saved_wallet');
      
      if (savedUsername) {
        // Entferne @ Symbol für die Anzeige im Input
        setUsername(savedUsername.startsWith('@') ? savedUsername.substring(1) : savedUsername);
      }
      if (savedWallet) {
        setWalletAddress(savedWallet);
      }
    }
  }, [isOpen]);

  // Automatisch eingeloggte Wallet-Adresse setzen
  React.useEffect(() => {
    if (account?.address) {
      console.log('Eingeloggte Wallet gefunden:', account.address);
      setWalletAddress(account.address);
      setWalletError(''); // Clear any validation errors
    }
  }, [account?.address]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung zurücksetzen
    setWalletError('');
    
    // Nur verbundene Wallet verwenden
    const claimWalletAddress = account?.address;
    
    if (!claimWalletAddress) {
      setWalletError('Keine Wallet verbunden. Bitte verbinde deine Wallet.');
      return;
    }
    
    if (username.trim() && claimWalletAddress) {
      // Wallet-Adresse validieren
      if (!isValidBaseChainAddress(claimWalletAddress)) {
        setWalletError('Ungültige Base Chain Wallet-Adresse');
        return;
      }
      
      // Füge @ Symbol hinzu, falls es nicht vorhanden ist
      const formattedUsername = username.trim().startsWith('@') ? username.trim() : `@${username.trim()}`;
      
      // Speichere die Daten im localStorage für zukünftige Verwendung
      if (typeof window !== 'undefined') {
        localStorage.setItem('tiktok_saved_username', formattedUsername);
        localStorage.setItem('tiktok_saved_wallet', claimWalletAddress);
      }
      
      onSubmit(formattedUsername, claimWalletAddress);
    }
  };

  const handleClose = () => {
    setUsername('');
    setWalletAddress('');
    setWalletError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-pink-400 text-2xl transition-colors"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-pink-300 mb-3">
              TikTok Username
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pink-400 font-bold pointer-events-none">
                @
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 bg-black/50 border border-pink-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          
          {/* Wallet Bereich - nur verbundene Wallet anzeigen oder Verbindungshinweis */}
          {account?.address ? (
            /* Verbundene Wallet anzeigen */
            <div>
              <label className="block text-sm font-medium text-pink-300 mb-3">
                Verbundene Wallet
              </label>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-green-400 text-sm">✅ Wallet verbunden</span>
                </div>
                <p className="font-mono text-sm bg-black/30 border border-green-500/20 rounded-lg p-2 break-all text-green-200 text-center">
                  {account.address}
                </p>
              </div>
            </div>
          ) : (
            /* Wallet-Verbindungshinweis wenn keine Wallet verbunden */
            <div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 text-sm font-medium mb-3 text-center">
                  Du hast noch keine Wallet verbunden.<br/>Verbinde deine Wallet, um fortzufahren!
                </p>
                <button
                  type="button"
                  onClick={() => router?.push("/wallet")}
                  className="w-full py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 text-black shadow-lg hover:from-yellow-500 hover:to-orange-500 transition-all duration-200 text-sm"
                >
                  🚀 Wallet jetzt verbinden
                </button>
                <p className="text-xs text-yellow-300 mt-2 text-center">
                  Du findest den Wallet Tab auch oben im Menü.
                </p>
              </div>
            </div>
          )}
          
          {/* Bestätigungsmeldung */}
          {confirmationMessage && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center">
                <span className="text-green-300 font-medium text-center">
                  {confirmationMessage}
                </span>
              </div>
            </div>
          )}
          
          <div className="flex space-x-4 pt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all font-medium"
              disabled={isLoading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all font-medium disabled:opacity-50 shadow-lg"
              disabled={isLoading || !username.trim() || !account?.address}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Lädt...
                </div>
              ) : (
                'Bestätigen'
              )}
            </button>
          </div>
        </form>

        {/* Wallet Info Modal */}
        {showWalletInfoModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-yellow-500/50 rounded-2xl p-6 w-80 max-w-md mx-4 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-yellow-300 flex items-center gap-2">
                  <span>⚠️</span>
                  Wallet Info
                </h3>
                <button
                  onClick={() => setShowWalletInfoModal(false)}
                  className="text-gray-400 hover:text-yellow-400 text-2xl transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <h4 className="text-yellow-300 font-bold mb-2">🔒 Wichtiger Hinweis</h4>
                <p className="text-yellow-200 text-sm leading-relaxed mb-3">
                  Deine Wallet-Adresse wird <strong>dauerhaft</strong> mit deinem Account verbunden und kann nicht mehr geändert werden.
                </p>
                <div className="bg-yellow-600/20 border border-yellow-600/40 rounded-lg p-3">
                  <p className="text-yellow-100 text-xs">
                    <strong>Änderungen nur möglich durch:</strong><br/>
                    DM an @dawidfaith mit Begründung
                  </p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <p className="text-red-300 text-sm">
                  ⚠️ Bitte überprüfe deine Wallet-Adresse sorgfältig vor der Bestätigung!
                </p>
              </div>
              
              <button 
                onClick={() => setShowWalletInfoModal(false)}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 rounded-xl transition-all duration-300"
              >
                Verstanden
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({ userData, onBack }: { userData: UserData; onBack: () => void }) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
  const [showMiningPowerModal, setShowMiningPowerModal] = useState(false);
  const [showConfirmInitial, setShowConfirmInitial] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [walletInput, setWalletInput] = useState(userData.wallet || '');
  const [claimStatus, setClaimStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<{likes: number, shares: number, saves: number} | null>(null);
  const [afterValues, setAfterValues] = useState<{likes: number, shares: number, saves: number} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [expGained, setExpGained] = useState<{likes: number, shares: number, saves: number, total: number} | null>(null);

  // Level Funktionen (gleiche Logik wie Facebook)
  const getLevelAndExpRange = (exp: number) => {
    let level = 1;
    let minExp = 0;
    let maxExp = 39;
    const levelThresholds = [39, 119, 239, 399, 599, 839, 1119, 1439, 1799, 2199, 2639, 3119, 3639, 4199, 4799, 5439, 6119, 6839, 7599, 8399, 9239, 10119, 11039, 11999, 12999, 14039, 15119, 16239, 17399, 18599, 19839, 21119, 22439, 23799, 25199, 26639, 28119, 29639, 31199, 32799, 34439, 36119, 37839, 39599, 41399, 43239, 45119, 47039, 48999, 99999999];
    const levelMins = [0, 40, 120, 240, 400, 600, 840, 1120, 1440, 1800, 2200, 2640, 3120, 3640, 4200, 4800, 5440, 6120, 6840, 7600, 8400, 9240, 10120, 11040, 12000, 13000, 14040, 15120, 16240, 17400, 18600, 19840, 21120, 22440, 23800, 25200, 26640, 28120, 29640, 31200, 32800, 34440, 36120, 37840, 39600, 41400, 43240, 45120, 47040, 49000];
    
    for (let i = 0; i < levelThresholds.length; i++) {
      if (exp <= levelThresholds[i]) {
        level = i + 1;
        minExp = levelMins[i];
        maxExp = levelThresholds[i];
        break;
      }
    }
    
    return { level, minExp, maxExp };
  };

  const { level, minExp, maxExp } = getLevelAndExpRange(userData.expTotal);
  const currentLevelExp = userData.expTotal - minExp;
  const levelRange = maxExp - minExp;
  const progressPercent = Math.round((currentLevelExp / levelRange) * 100);

  // System Check Funktionen
  const getUUID = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('uuid') || 'Dawidfaithtest3736TT';
    }
    return 'Dawidfaithtest3736TT';
  };

  const checkInitial = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      const response = await fetch('https://hook.eu2.make.com/uwixmcg3w0l14ve5g0jesxec2qeuxuej', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: uuid,
          username: userData.username,
          walletAddress: userData.walletAddress || walletInput,
          action: 'initial_check',
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      
      const likes = parseInt(data.likes) || 0;
      const shares = parseInt(data.shares) || 0;
      const saves = parseInt(data.saves) || 0;
      setInitialValues({ likes, shares, saves });
      
      // LocalStorage setzen
      if (typeof window !== 'undefined') {
        localStorage.setItem("dfaith_tiktok_likeStart", likes.toString());
        localStorage.setItem("dfaith_tiktok_shareStart", shares.toString());
        localStorage.setItem("dfaith_tiktok_saveStart", saves.toString());
      }
    } catch (error) {
      console.error('Fehler beim System Check:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAfter = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      const response = await fetch('https://hook.eu2.make.com/uwixmcg3w0l14ve5g0jesxec2qeuxuej', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: uuid,
          username: userData.username,
          walletAddress: userData.walletAddress || walletInput,
          action: 'after_check',
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      
      const newLikes = parseInt(data.likes) || 0;
      const newShares = parseInt(data.shares) || 0;
      const newSaves = parseInt(data.saves) || 0;
      setAfterValues({ likes: newLikes, shares: newShares, saves: newSaves });
      
      // Automatischer Vergleich und EXP Berechnung
      if (initialValues) {
        const likesGained = Math.max(0, newLikes - initialValues.likes);
        const sharesGained = Math.max(0, newShares - initialValues.shares);
        const savesGained = Math.max(0, newSaves - initialValues.saves);
        const totalExp = (likesGained * 10) + (sharesGained * 10) + (savesGained * 10);
        
        if (totalExp > 0) {
          setExpGained({
            likes: likesGained,
            shares: sharesGained,
            saves: savesGained,
            total: totalExp
          });
          setConfirmationMessage('🎉 Glückwunsch! Du hast erfolgreich EXP gesammelt!');
        }
      }
    } catch (error) {
      console.error('Fehler beim System Check:', error);
    } finally {
      setLoading(false);
    }
  };

  // LocalStorage laden beim Start
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const likeStored = localStorage.getItem("dfaith_tiktok_likeStart");
      const shareStored = localStorage.getItem("dfaith_tiktok_shareStart");
      const saveStored = localStorage.getItem("dfaith_tiktok_saveStart");

      if (likeStored && shareStored && saveStored) {
        setInitialValues({
          likes: parseInt(likeStored),
          shares: parseInt(shareStored),
          saves: parseInt(saveStored)
        });
      }
    }
  }, []);

  // Claim Funktion mit Webhook
  const handleClaim = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      const response = await fetch('https://hook.eu2.make.com/fm3z0p3prr5aj41hrma4yw6os6nzzr1d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: uuid,
          username: userData.username,
          walletAddress: userData.walletAddress || walletInput,
          miningpower: userData.miningpower,
          action: 'claim_dfaith',
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        
        // Prüfe den Response-Typ
        if (responseData.status === 'success') {
          setClaimStatus('✅ Claim erfolgreich gesendet!');
          setTimeout(() => {
            setShowClaimModal(false);
            setClaimStatus('');
            // KEINE Weiterleitung - User bleibt in der UserCard
          }, 2000);
        } else if (responseData.status === 'Info') {
          // Info Response - bereits geclaimed
          setClaimStatus('ℹ️ Du hast bereits geclaimed! Warte bis zum nächsten Claim-Zeitraum.');
          setTimeout(() => {
            setClaimStatus('');
          }, 4000);
          // KEINE Weiterleitung bei Info!
        } else {
          // Fallback für andere Success-Responses
          setClaimStatus('✅ Claim erfolgreich gesendet!');
          setTimeout(() => {
            setShowClaimModal(false);
            setClaimStatus('');
          }, 2000);
        }
      } else {
        setClaimStatus('❌ Fehler beim Claim. Bitte versuche es erneut.');
        setTimeout(() => {
          setClaimStatus('');
        }, 3000);
      }
    } catch (error) {
      console.error('Fehler beim Claim:', error);
      setClaimStatus('❌ Netzwerkfehler. Bitte überprüfe deine Verbindung.');
      setTimeout(() => {
        setClaimStatus('');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className="min-h-screen flex items-center justify-center p-8 bg-black"
        style={{ 
          fontFamily: 'Poppins, Segoe UI, sans-serif'
        }}
      >
        <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-3xl p-8 w-full max-w-sm text-center text-white shadow-2xl">
          {/* Username */}
          <div className="text-2xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">@{userData.username}</div>
          
          {/* Profile Image */}
          <img 
            src={userData.image || 'https://via.placeholder.com/100'} 
            alt="Profilbild"
            className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
            loading="lazy"
          />
          
          {/* Level Box */}
          <div className="bg-black/50 border border-pink-500/50 rounded-2xl p-4 mb-4">
            {/* Level und EXP Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">Level</span>
                <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">{level}</span>
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
            <div className="relative bg-black/60 border border-pink-500/30 rounded-full h-4 overflow-hidden mb-4 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 transition-all duration-1000 ease-out relative shadow-lg"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                {progressPercent}%
              </div>
            </div>
            
            {/* Mining Power mit TikTok Design */}
            <button 
              onClick={() => setShowMiningPowerModal(true)}
              className="w-full bg-black/50 border border-pink-500/50 rounded-xl p-3 hover:bg-black/70 hover:border-pink-500/70 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
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
          <div className="bg-black/50 border border-pink-500/50 rounded-2xl p-4 mb-6">
            <div className="font-bold text-lg mb-3 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">🔍 System Check</div>
            
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
                <span>{userData.shared === 'true' ? '✅' : '❌'} +10 EXP</span>
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
              onClick={() => setShowLikeSaveModal(true)}
              className="relative flex-1 bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-400/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-pulse">✨</span>
                <span className="tracking-wider">Sammle EXP</span>
              </div>
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="relative flex-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 px-4 py-4 rounded-2xl font-bold text-sm text-gray-900 overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 border border-cyan-300/50"
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

      {/* UserCard Modals */}
      {/* Sammle EXP (LikeSave) Modal */}
      {showLikeSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                ✨ TikTok Verification
              </h2>
              <button
                onClick={() => setShowLikeSaveModal(false)}
                className="text-gray-400 hover:text-pink-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-4 mb-4">
              <p className="font-semibold mb-3 text-pink-200">1️⃣ Entferne alle Likes, Shares und Saves von meinem Video</p>
              <button 
                onClick={() => setShowConfirmInitial(true)}
                disabled={initialValues !== null || loading}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  initialValues !== null || loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-white rounded-full"></div>
                    <span>Erfasse Daten...</span>
                  </div>
                ) : initialValues !== null ? '✅ Werte bereits erfasst' : '✅ Check aktuelle Werte'}
              </button>
              {initialValues && (
                <div className="bg-black/30 border border-pink-500/30 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-pink-300">Likes:</span>
                    <span className="font-bold text-pink-200">{initialValues.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300">Shares:</span>
                    <span className="font-bold text-purple-200">{initialValues.shares}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cyan-300">Saves:</span>
                    <span className="font-bold text-cyan-200">{initialValues.saves}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4">
              <p className="font-semibold mb-3 text-cyan-200">2️⃣ Like, Share und Save das Video erneut!</p>
              <button 
                onClick={() => setShowConfirmAfter(true)}
                disabled={loading || !initialValues || !!afterValues}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  loading || !initialValues
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : afterValues ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-white rounded-full"></div>
                    <span>Prüfe Änderungen...</span>
                  </div>
                ) : !initialValues ? '⚠️ Zuerst Schritt 1 ausführen' : afterValues ? '✅ Neue Werte erfasst' : '✅ Check neue Werte'}
              </button>
              {afterValues && (
                <div className="bg-black/30 border border-cyan-500/30 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-pink-300">Likes:</span>
                    <span className="font-bold text-pink-200">{afterValues.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300">Shares:</span>
                    <span className="font-bold text-purple-200">{afterValues.shares}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cyan-300">Saves:</span>
                    <span className="font-bold text-cyan-200">{afterValues.saves}</span>
                  </div>
                </div>
              )}
            </div>
            
            {confirmationMessage && expGained && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <div className="text-center mb-3">
                  <p className="text-green-300 font-bold text-lg">🎉 Glückwunsch!</p>
                  <p className="text-green-200 text-sm">Du hast erfolgreich EXP gesammelt:</p>
                </div>
                
                <div className="space-y-2 mb-4">
                  {expGained.likes > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-pink-300">❤️ Likes (+{expGained.likes}):</span>
                      <span className="font-bold text-green-300">+{expGained.likes * 10} EXP</span>
                    </div>
                  )}
                  {expGained.shares > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-300">🔁 Shares (+{expGained.shares}):</span>
                      <span className="font-bold text-green-300">+{expGained.shares * 10} EXP</span>
                    </div>
                  )}
                  {expGained.saves > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-cyan-300">💾 Saves (+{expGained.saves}):</span>
                      <span className="font-bold text-green-300">+{expGained.saves * 10} EXP</span>
                    </div>
                  )}
                  <div className="border-t border-green-500/30 pt-2 mt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-green-200">Gesamt EXP:</span>
                      <span className="text-green-300 text-lg">+{expGained.total} EXP</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-center mb-4">
                  <p className="text-green-200 text-xs mb-3">Lade die Seite neu, um deine neuen EXP zu sehen!</p>
                  <button 
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        // Nur EXP-Verification Daten löschen, Login-Daten behalten
                        localStorage.removeItem("dfaith_tiktok_likeStart");
                        localStorage.removeItem("dfaith_tiktok_shareStart");
                        localStorage.removeItem("dfaith_tiktok_saveStart");
                        
                        // Seite neu laden
                        window.location.href = window.location.pathname + '?tab=tiktok' + (window.location.search.includes('uuid=') ? '&' + window.location.search.split('?')[1] : '');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    🔄 Seite neu laden
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLikeSaveModal(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                D.FAITH Claim
              </h2>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-gray-400 hover:text-cyan-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6">
              <p className="text-cyan-200 leading-relaxed mb-4">
                Du kannst <strong className="text-cyan-400">+{userData.miningpower} D.FAITH</strong> für deine TikTok Aktivität claimen!
              </p>
              
              <div className="bg-black/30 border border-cyan-500/20 rounded-lg p-3 mb-4">
                <div className="text-xs text-cyan-300 mb-1">Wallet Adresse:</div>
                <div className="font-mono text-sm text-cyan-100 break-all">
                  {userData.walletAddress || walletInput || 'Nicht verfügbar'}
                </div>
              </div>
            </div>
            
            {!userData.walletAddress && !walletInput && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <p className="text-yellow-200 text-sm">
                  ⚠️ Bitte hinterlege zuerst eine Wallet-Adresse im Wallet Tab
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClaimModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-3 font-bold transition-all"
              >
                Abbrechen
              </button>
              <button 
                disabled={!userData.walletAddress && !walletInput}
                onClick={handleClaim}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl py-3 font-bold transition-all hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Lädt...
                  </div>
                ) : (
                  '🚀 Claim'
                )}
              </button>
            </div>
            
            {claimStatus && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300 text-center">
                {claimStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Modal (EXP Info) */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-purple-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                � EXP Information
              </h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-purple-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <h3 className="text-purple-300 font-bold mb-4">✨ Deine EXP-Quellen</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3 bg-blue-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-6 h-6" />
                    <div>
                      <div className="font-bold text-blue-300">Facebook</div>
                      <div className="text-blue-200 font-semibold">{userData.expFacebook} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-pink-600 pl-3 bg-pink-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-pink-300">TikTok</div>
                      <div className="text-pink-200 font-semibold">{userData.expTiktok} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-purple-600 pl-3 bg-purple-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-purple-300">Instagram</div>
                      <div className="text-purple-200 font-semibold">{userData.expInstagram} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-cyan-600 pl-3 bg-cyan-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/727/727245.png" alt="Stream" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-cyan-300">Stream</div>
                      <div className="text-cyan-200 font-semibold">{userData.expStream} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-yellow-600 pl-3 bg-yellow-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Live" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-yellow-300">Live EXP Bonus</div>
                      <div className="text-yellow-200 font-semibold">{userData.liveNFTBonus} EXP</div>
                    </div>
                  </div>
                  <div className="border-t border-gray-600 pt-3 mt-4">
                    <div className="flex justify-between">
                      <span className="text-white font-bold">Gesamt EXP</span>
                      <span className="text-white font-bold">{userData.expTotal}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-300/30 rounded-2xl p-4 mb-6">
                <p className="text-sm text-purple-200 font-medium">💡 Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen! 🚀</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl py-3 font-bold transition-all hover:from-purple-600 hover:to-pink-600"
            >
              ✅ Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Mining Power Modal */}
      {showMiningPowerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                ⛏️ Mining Power
              </h2>
              <button
                onClick={() => setShowMiningPowerModal(false)}
                className="text-gray-400 hover:text-cyan-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6">
              <p className="text-cyan-200 leading-relaxed mb-4">
                Deine <strong className="text-cyan-400">Mining Power</strong> bestimmt, wie viele D.FAITH Token du pro TikTok Claim erhältst.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <span className="text-xl">💰</span>
                  <div>
                    <div className="font-bold text-cyan-300">Marketing Budget</div>
                    <div className="text-sm text-cyan-400">Budget pro User für TikTok</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-bold text-pink-300">Dein Level</div>
                    <div className="text-sm text-pink-400">Level {getLevelAndExpRange(userData.expTotal).level}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <span className="text-xl">💎</span>
                  <div>
                    <div className="font-bold text-purple-300">D.FAITH Kurs</div>
                    <div className="text-sm text-purple-400">Aktueller Marktpreis</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 mb-6">
              <p className="text-pink-200 font-medium text-center">
                ⚡ <strong>Aktuell:</strong> +{userData.miningpower} D.FAITH pro Claim
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 text-white rounded-xl py-3 font-bold transition-all hover:from-cyan-600 hover:to-pink-600"
            >
              ✅ Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Confirm Initial Modal */}
      {showConfirmInitial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">⚠️</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">Bestätigung erforderlich</h2>
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-4 mb-4">
              <p className="text-pink-200 leading-relaxed">Bitte entferne alle Likes, Shares und Saves von meinem Video – danach werden alle aktuellen Zahlen gespeichert.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmInitial(false);
                  checkInitial();
                }}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ Ja, fortfahren
              </button>
              <button 
                onClick={() => setShowConfirmInitial(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm After Modal */}
      {showConfirmAfter && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">🎯</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">Finale Bestätigung</h2>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4">
              <p className="text-cyan-200 leading-relaxed">Bitte Like, Share und Save den TikTok erneut, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  checkAfter();
                }}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ Ja, fortfahren
              </button>
              <button 
                onClick={() => setShowConfirmAfter(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
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

export default function TiktokTab() {
  const router = useRouter();
  const account = useActiveAccount(); // Thirdweb Hook für eingeloggte Wallet
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  
  // Modal states für alle TikTok Modals
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
  const [showMiningPowerModal, setShowMiningPowerModal] = useState(false);
  const [showConfirmBefore, setShowConfirmBefore] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [showNoUuidModal, setShowNoUuidModal] = useState(false);

  // confirmationMessage zurücksetzen wenn Modal geschlossen wird
  React.useEffect(() => {
    if (!isCheckModalOpen) {
      setConfirmationMessage('');
    }
  }, [isCheckModalOpen]);

  // Level Funktionen (gleiche Logik wie Facebook)
  const getLevelAndExpRange = (exp: number) => {
    let level = 1;
    let minExp = 0;
    let maxExp = 39;
    const levelThresholds = [39, 119, 239, 399, 599, 839, 1119, 1439, 1799, 2199, 2639, 3119, 3639, 4199, 4799, 5439, 6119, 6839, 7599, 8399, 9239, 10119, 11039, 11999, 12999, 14039, 15119, 16239, 17399, 18599, 19839, 21119, 22439, 23799, 25199, 26639, 28119, 29639, 31199, 32799, 34439, 36119, 37839, 39599, 41399, 43239, 45119, 47039, 48999, 99999999];
    const levelMins = [0, 40, 120, 240, 400, 600, 840, 1120, 1440, 1800, 2200, 2640, 3120, 3640, 4200, 4800, 5440, 6120, 6840, 7600, 8400, 9240, 10120, 11040, 12000, 13000, 14040, 15120, 16240, 17400, 18600, 19840, 21120, 22440, 23800, 25200, 26640, 28120, 29640, 31200, 32800, 34440, 36120, 37840, 39600, 41400, 43240, 45120, 47040, 49000];
    
    for (let i = 0; i < levelThresholds.length; i++) {
      if (exp <= levelThresholds[i]) {
        level = i + 1;
        minExp = levelMins[i];
        maxExp = levelThresholds[i];
        break;
      }
    }
    
    return { level, minExp, maxExp };
  };

  const sendWebhookRequest = async (username: string, walletAddress: string, webhookUrl: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          walletAddress: walletAddress,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setMessage('Anfrage erfolgreich gesendet!');
      } else {
        setMessage('Fehler beim Senden der Anfrage. Bitte versuchen Sie es erneut.');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setMessage('Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheck = async (username: string, walletAddress: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await fetch('https://hook.eu2.make.com/6bp285kr8y9hoxk39j1v52qt2k4rt4id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          walletAddress: walletAddress,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Response Data:', responseData); // Debug-Log
        
        // Status normalisieren (Leerzeichen entfernen, lowercase)
        const normalizedStatus = responseData.status?.toString().trim().toLowerCase();
        
        // Verschiedene Status-Responses behandeln
        if (normalizedStatus === 'success') {
          setConfirmationMessage('✅ Teilnahme erfolgreich bestätigt!');
          // Modal wird nach 4 Sekunden geschlossen bei Erfolg
          setTimeout(() => {
            setConfirmationMessage('');
            setIsCheckModalOpen(false);
          }, 4000);
        } else if (normalizedStatus === 'wallet account') {
          setConfirmationMessage('⚠️ Die angegebene Wallet stimmt nicht mit deinem Account überein. Falls du die Adresse ändern möchtest, schreibe eine DM an @dawidfaith mit dem Stichwort "Wallet".');
        } else if (normalizedStatus === 'wallet in use') {
          setConfirmationMessage('❌ Diese Wallet wird bereits verwendet. Bitte verwende eine andere Wallet-Adresse.');
        } else if (normalizedStatus === 'comment') {
          setConfirmationMessage('💬 Es wurde noch kein Kommentar von dir gefunden. Bitte kommentiere den Beitrag und versuche es erneut.');
        } else if (normalizedStatus === 'evalued') {
          setConfirmationMessage('ℹ️ Du hast deine Teilnahme bereits bestätigt.');
        } else {
          setConfirmationMessage('❌ Teilnahme fehlgeschlagen. Bitte versuche es erneut.');
        }
      } else {
        setConfirmationMessage('❌ Teilnahme fehlgeschlagen. Bitte versuche es erneut.');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setConfirmationMessage('❌ Netzwerkfehler. Bitte überprüfe deine Verbindung.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (username: string, walletAddress: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await fetch('https://tiktok-userboard.vercel.app/api/userboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          walletAddress: walletAddress,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Login Response Data:', responseData); // Debug-Log
        
        // Prüfe auf Fehlermeldung "Benutzer nicht gefunden"
        if (responseData.error === 'Benutzer nicht gefunden') {
          setMessage('❌ Falsche Kombination: Benutzer nicht gefunden');
          return; // Userboard nicht laden bei Fehler
        }
        
        // Hilfsfunktion für sichere Zahlen-Konvertierung
        const safeParseInt = (value: any): number => {
          if (value === "" || value === null || value === undefined) return 0;
          const parsed = parseInt(value.toString());
          return isNaN(parsed) ? 0 : parsed;
        };
        
        const safeParseFloat = (value: any): number => {
          if (value === "" || value === null || value === undefined) return 0;
          const parsed = parseFloat(value.toString());
          return isNaN(parsed) ? 0 : parsed;
        };
        
        // Prüfe ob Benutzerdaten im Response sind (status: "ok" oder username vorhanden)
        if (responseData && (responseData.status === "ok" || responseData.username)) {
          // Lade echte Userdaten aus der Response
          setUserData({
            username: (responseData.username || username).replace('@', ''),
            image: responseData.image || "https://via.placeholder.com/100",
            expTotal: safeParseInt(responseData.expTotal),
            expTiktok: safeParseInt(responseData.expTiktok),
            expFacebook: safeParseInt(responseData.expFacebook),
            expInstagram: safeParseInt(responseData.expInstagram),
            expStream: safeParseInt(responseData.expStream),
            liveNFTBonus: safeParseInt(responseData.liveExp),
            miningpower: safeParseFloat(responseData.miningpower),
            liked: responseData.liked === "true" ? "true" : "false",
            commented: responseData.commented === "true" ? "true" : "false",
            saved: responseData.saved === "true" || responseData.saved === true,
            shared: responseData.shared === "true" ? "true" : "false",
            wallet: responseData.wallet || walletAddress,
            walletAddress: responseData.walletAddress || walletAddress
          });
          setIsLoggedIn(true);
          setMessage('Login erfolgreich!');
          setIsLoginModalOpen(false); // Modal nur bei erfolgreichem Login schließen
        } else {
          // Fallback für unbekannte User - zeige Demo-Daten
          setUserData({
            username: username.replace('@', ''),
            image: "https://via.placeholder.com/100",
            expTotal: 0,
            expTiktok: 0,
            expFacebook: 0,
            expInstagram: 0,
            expStream: 0,
            liveNFTBonus: 0,
            miningpower: 50,
            liked: 'false',
            commented: 'false',
            saved: false,
            shared: 'false',
            wallet: walletAddress,
            walletAddress: walletAddress
          });
          setIsLoggedIn(true);
          setMessage('Login erfolgreich!');
          setIsLoginModalOpen(false); // Modal nur bei erfolgreichem Login schließen
        }
      } else {
        // API Antwort war nicht erfolgreich
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'Benutzer nicht gefunden') {
          setMessage('❌ Falsche Kombination: Benutzer nicht gefunden');
        } else {
          setMessage('❌ Fehler beim Login. Bitte versuche es erneut.');
        }
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setMessage('Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.');
    } finally {
      setIsLoading(false);
    }
  };

  // Wenn eingeloggt, zeige Userkarte
  if (isLoggedIn && userData) {
    return <UserCard userData={userData} onBack={() => setIsLoggedIn(false)} />;
  }

  // Standard Dashboard
  return (
    <div className="min-h-screen bg-black relative overflow-hidden p-4">
      {/* Loading Overlay */}
      {isLoading && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 0, 80, 0.95), rgba(254, 45, 146, 0.95), rgba(37, 244, 238, 0.95))',
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

      {/* Compact Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-10 left-10 w-48 h-48 bg-gradient-to-r from-pink-500/15 to-purple-500/15 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-gradient-to-r from-blue-500/15 to-cyan-500/15 rounded-full blur-2xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-4 p-6 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-2xl backdrop-blur-sm">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                D.FAITH
              </h1>
              <p className="text-xl font-bold text-white">TikTok Claim Portal</p>
              <p className="text-sm text-gray-400 mt-1">🚀 Verdiene Tokens durch TikTok Aktivität</p>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
          {/* Action Buttons */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setIsCheckModalOpen(true)}
              className="flex items-center justify-center p-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl hover:border-pink-500/50 transition-all group"
            >
              <div className="text-center">
                <h3 className="text-white font-bold">1. Teilnahme Bestätigen</h3>
                <p className="text-gray-400 text-sm">Hast du schon kommentiert? Dann bestätige jetzt deine Teilnahme!</p>
              </div>
            </button>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center justify-center p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-xl hover:border-cyan-500/50 transition-all group"
            >
              <div className="text-center">
                <h3 className="text-white font-bold">2. Dashboard Login</h3>
                <p className="text-gray-400 text-sm">Tokens claimen - nur nach Teilnahme-Bestätigung möglich</p>
              </div>
            </button>
          </div>

          {/* TikTok Profil Link */}
          <div className="mb-6 p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-xl">
            <div className="text-center">
              <p className="text-pink-300 font-medium mb-3">
                📱 Besuche mein TikTok-Profil für das neueste Video:
              </p>
              <a 
                href="https://www.tiktok.com/@dawidfaith"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.43z"/>
                </svg>
                <span>@dawidfaith auf TikTok</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </a>
              <p className="text-pink-200 text-xs mt-2">
                💬 Kommentiere &quot;D.FAITH&quot; unter meinem neuesten Video um teilzunehmen!
              </p>
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl text-center border ${
              message.includes('erfolgreich') 
                ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <div className="flex items-center justify-center space-x-2">
                {message.includes('erfolgreich') ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                )}
                <span className="font-medium">{message}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={isCheckModalOpen}
        onClose={() => {
          setIsCheckModalOpen(false);
          setConfirmationMessage('');
        }}
        title="Bestätige deine Teilnahme"
        onSubmit={handleCheck}
        isLoading={isLoading}
        router={router}
        confirmationMessage={confirmationMessage}
        account={account}
      />

      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setMessage(''); // Message zurücksetzen beim Schließen
        }}
        title="Dashboard Login"
        onSubmit={handleLogin}
        isLoading={isLoading}
        router={router}
        confirmationMessage={message} // Fehlermeldungen im Modal anzeigen
        account={account}
      />

      {/* Additional TikTok Modals */}
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
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">⭐</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Level Upgrade!</h2>
            </div>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                <strong className="text-pink-600">Herzlichen Glückwunsch!</strong> Du hast ein neues Level erreicht!
              </p>
              <div className="text-2xl font-bold text-purple-600 mb-2">Level {userData && getLevelAndExpRange(userData.expTotal || 0).level}</div>
              <p className="text-gray-600 text-sm">
                Deine Mining Power wurde erhöht! 🚀
              </p>
            </div>
            
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✨ Awesome!
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
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">💰</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent">Claim erfolgreich!</h2>
            </div>
            
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Du hast erfolgreich <strong className="text-pink-600">+{userData?.miningpower || 0} D.FAITH</strong> für deine TikTok Aktivität erhalten!
              </p>
              <div className="text-sm text-gray-600">
                💎 Weiter so und sammle mehr Token!
              </div>
            </div>
            
            <button 
              onClick={() => setShowClaimModal(false)}
              className="w-full bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-500 hover:to-pink-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              🚀 Weiter claimen!
            </button>
          </div>
        </div>
      )}

      {/* LikeSave Modal */}
      {showLikeSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowLikeSaveModal(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-cyan-400 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">❤️</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-cyan-600 bg-clip-text text-transparent">✨ TikTok Engagement</h2>
            </div>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Bitte führe die folgenden Aktionen auf dem TikTok Video durch:
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-pink-500">❤️</span>
                  <span className="text-gray-700">Like das Video</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-500">💬</span>
                  <span className="text-gray-700">Kommentiere</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-500">🔄</span>
                  <span className="text-gray-700">Teile das Video</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-pink-500">🔖</span>
                  <span className="text-gray-700">Speichere ihn</span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-yellow-800 font-medium text-sm">
                ⚡ Nach dem Engagement kannst du deine D.FAITH Token claimen!
              </p>
            </div>
            
            <button 
              onClick={() => setShowLikeSaveModal(false)}
              className="w-full bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-600 hover:to-cyan-500 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
            </button>
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
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">ℹ️</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">TikTok Dashboard Info</h2>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Das <strong className="text-purple-600">TikTok Dashboard</strong> ermöglicht es dir, D.FAITH Token durch TikTok Engagement zu verdienen.
              </p>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-300">
                  <span className="text-xl">⛏️</span>
                  <div>
                    <div className="font-bold text-gray-800">Mining Power</div>
                    <div className="text-sm text-gray-600">Mehr D.FAITH pro Claim</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-300">
                  <span className="text-xl">🎯</span>
                  <div>
                    <div className="font-bold text-gray-800">Daily Claims</div>
                    <div className="text-sm text-gray-600">Täglich neue Möglichkeiten</div>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
            </button>
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
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">👛</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">Wallet Information</h2>
            </div>
            
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Deine <strong className="text-purple-600">Wallet-Adresse</strong> ist sicher mit deinem TikTok Profil verknüpft.
              </p>
              
              <div className="bg-white border border-cyan-300 rounded-lg p-3 mb-4">
                <div className="text-xs text-gray-500 mb-1">Wallet Adresse:</div>
                <div className="font-mono text-sm text-gray-800 break-all">
                  {userData?.walletAddress || 'Nicht verfügbar'}
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                💎 Alle D.FAITH Token werden automatisch hierhin gesendet
              </div>
            </div>
            
            <button 
              onClick={() => setShowWalletInfoModal(false)}
              className="w-full bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-500 hover:to-purple-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
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
              <div className="w-20 h-20 bg-gradient-to-r from-pink-400 to-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">⛏</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-cyan-600 bg-clip-text text-transparent">Mining Power Info</h2>
            </div>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Deine <strong className="text-cyan-600">Mining Power</strong> ist abhängig von verschiedenen Faktoren:
              </p>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-pink-300">
                  <span className="text-xl">💰</span>
                  <div>
                    <div className="font-bold text-gray-800">Marketing Budget</div>
                    <div className="text-sm text-gray-600">Pro User für TikTok Engagement</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-pink-300">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-bold text-gray-800">Dein Level</div>
                    <div className="text-sm text-gray-600">Aktuell: Level {userData && getLevelAndExpRange(userData.expTotal || 0).level}</div>
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
            
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 mb-4">
              <p className="text-cyan-800 font-medium text-sm">
                ⚡ <strong>Aktuell:</strong> +{userData?.miningpower || 0} D.Faith pro TikTok
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-pink-400 to-cyan-500 hover:from-pink-500 hover:to-cyan-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Confirm Before Modal */}
      {showConfirmBefore && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowConfirmBefore(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800">System Check starten</h2>
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-4">
              <p className="text-pink-800 leading-relaxed">Like, kommentiere, teile und speichere das TikTok Video. Danach klicke auf &quot;Engagement prüfen&quot;.</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
              <p className="text-yellow-700 font-bold text-sm">⚠️ Führe alle Aktionen durch für maximale Belohnung!</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmBefore(false);
                  // checkBefore() function would go here
                }}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ Check starten
              </button>
              <button 
                onClick={() => setShowConfirmBefore(false)}
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
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowConfirmAfter(false)}
              aria-label="Schließen"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800">Finale Bestätigung</h2>
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 mb-4">
              <p className="text-cyan-800 leading-relaxed">Bitte like, kommentiere, teile und speichere das TikTok Video erneut, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
              <p className="text-yellow-700 font-bold text-sm">⚠️ Diese Aktion ist nur einmal möglich pro Video!</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  // checkAfter() function would go here
                }}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-pink-600 hover:from-cyan-600 hover:to-pink-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
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
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">🔒</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-700 bg-clip-text text-transparent">Profil nicht gefunden</h2>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Dein Profil ist nur durch die <strong className="text-purple-600">Teilnahme an den TikTok Videos</strong> von <strong className="text-purple-600">Dawid Faith</strong> erreichbar.
              </p>
              <p className="text-gray-600 text-sm">
                💡 Like, kommentiere, teile und speichere seine Videos, um Zugang zu erhalten!
              </p>
            </div>
            
            <div className="space-y-3 mb-6">
              <p className="text-gray-700 font-medium">📱 Folge Dawid Faith auf TikTok:</p>
              
              <a 
                href="https://www.tiktok.com/@dawidfaith"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3 block"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.43z"/>
                </svg>
                <span>TikTok Profil</span>
              </a>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-yellow-800 font-medium text-sm">
                ⚡ <strong>Tipp:</strong> Nach dem Engagement kannst du über den speziellen Link auf dein Profil zugreifen!
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
    </div>
  );
}