'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaInfoCircle, FaInstagram, FaFacebookF, FaYoutube } from 'react-icons/fa';
import { FaTiktok } from 'react-icons/fa6';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { TranslatedText } from '../components/TranslatedText';
import type { SupportedLanguage } from "../utils/deepLTranslation";

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
  language: SupportedLanguage;
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

function Modal({ isOpen, onClose, title, onSubmit, isLoading, router, confirmationMessage, account, language }: ModalProps) {
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
        setWalletError(language === 'de' ? 'Ungültige Base Chain Wallet-Adresse' : language === 'en' ? 'Invalid Base Chain wallet address' : 'Nieprawidłowy adres portfela Base Chain');
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

        <div className="text-xs text-gray-400 mb-4 text-center">
          💡 <TranslatedText text="Wallet ändern? Schreib mir eine DM mit &quot;Wallet&quot; auf TikTok" language={language} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-pink-300 mb-3">
              <TranslatedText text="TikTok Username" language={language} />
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
                <TranslatedText text="Verbundene Wallet" language={language} />
              </label>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-green-400 text-sm">✅ <TranslatedText text="Wallet verbunden" language={language} /></span>
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
              <TranslatedText text="Abbrechen" language={language} />
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
                language === 'de' ? 'Bestätigen' : language === 'en' ? 'Confirm' : 'Potwierdź'
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
                  <TranslatedText text="Deine Wallet-Adresse wird " language={language} /><strong><TranslatedText text="dauerhaft" language={language} /></strong><TranslatedText text=" mit deinem Account verbunden und kann nicht mehr geändert werden." language={language} />
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
                  ⚠️ <TranslatedText text="Bitte überprüfe deine Wallet-Adresse sorgfältig vor der Bestätigung!" language={language} />
                </p>
              </div>
              
              <button 
                onClick={() => setShowWalletInfoModal(false)}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 rounded-xl transition-all duration-300"
              >
                <TranslatedText text="Verstanden" language={language} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({ userData, onBack, language }: { userData: UserData; onBack: () => void; language: SupportedLanguage }) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showLikeSaveModal, setShowLikeSaveModal] = useState(false);
  const [showExpSelectionModal, setShowExpSelectionModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretMessage, setSecretMessage] = useState('');
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

  // Leaderboard state (UserCard-scope)
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

  const handleSecretCheck = async () => {
    if (!secretCode.trim()) return;
    
    setSecretLoading(true);
    setSecretMessage('');
    
    try {
      const response = await fetch('https://secret-tiktok.vercel.app/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: secretCode.toUpperCase(),
          walletAddress: userData.wallet
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSecretMessage('✅ Secret Code erfolgreich eingegeben! +30 EXP erhalten.');
      } else {
        setSecretMessage(data.error || 'Fehler beim Überprüfen des Secret Codes.');
      }
    } catch (error) {
      console.error('Secret check error:', error);
      setSecretMessage('Fehler beim Überprüfen des Secret Codes. Bitte versuche es erneut.');
    } finally {
      setSecretLoading(false);
    }
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
          setConfirmationMessage(language === 'de' ? '🎉 Glückwunsch! Du hast erfolgreich EXP gesammelt!' : language === 'en' ? '🎉 Congratulations! You have successfully collected EXP!' : '🎉 Gratulacje! Pomyślnie zebrałeś EXP!');
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

  // Leaderboard fetch when modal opens
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (!showLeaderboardModal) return;
    const id = setInterval(() => setLbNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showLeaderboardModal]);

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
          setClaimStatus(language === 'de' ? '✅ Claim erfolgreich gesendet!' : language === 'en' ? '✅ Claim sent successfully!' : '✅ Claim wysłany pomyślnie!');
          setTimeout(() => {
            setShowClaimModal(false);
            setClaimStatus('');
            // KEINE Weiterleitung - User bleibt in der UserCard
          }, 2000);
        } else if (responseData.status === 'Info') {
          // Info Response - bereits geclaimed
          setClaimStatus(language === 'de' ? 'ℹ️ Du hast bereits geclaimed! Warte bis zum nächsten Claim-Zeitraum.' : language === 'en' ? 'ℹ️ You have already claimed! Wait for the next claim period.' : 'ℹ️ Już odebrałeś nagrodę! Poczekaj do następnego okresu.');
          setTimeout(() => {
            setClaimStatus('');
          }, 4000);
          // KEINE Weiterleitung bei Info!
        } else {
          // Fallback für andere Success-Responses
          setClaimStatus(language === 'de' ? '✅ Claim erfolgreich gesendet!' : language === 'en' ? '✅ Claim sent successfully!' : '✅ Claim wysłany pomyślnie!');
          setTimeout(() => {
            setShowClaimModal(false);
            setClaimStatus('');
          }, 2000);
        }
      } else {
        setClaimStatus(language === 'de' ? '❌ Fehler beim Claim. Bitte versuche es erneut.' : language === 'en' ? '❌ Claim error. Please try again.' : '❌ Błąd podczas odbioru. Spróbuj ponownie.');
        setTimeout(() => {
          setClaimStatus('');
        }, 3000);
      }
    } catch (error) {
      console.error('Fehler beim Claim:', error);
      setClaimStatus(language === 'de' ? '❌ Netzwerkfehler. Bitte überprüfe deine Verbindung.' : language === 'en' ? '❌ Network error. Please check your connection.' : '❌ Błąd sieci. Sprawdź połączenie.');
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
        className="min-h-screen flex items-center justify-center p-4 bg-black"
        style={{ 
          fontFamily: 'Poppins, Segoe UI, sans-serif'
        }}
      >
        <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-3xl p-6 w-full max-w-sm text-center text-white shadow-2xl relative">
          {/* Zurück Button auf der Karte */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 bg-pink-600/20 border border-pink-500/50 rounded-full text-white hover:bg-pink-600/40 transition-all duration-200 flex items-center justify-center z-10 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* Username */}
          <div className="text-2xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">@{userData.username}</div>
          
          {/* Profile Image */}
          <Image
            src={userData.image || 'https://via.placeholder.com/100'}
            alt="Profilbild"
            width={96}
            height={96}
            className="rounded-full object-cover mx-auto mb-4"
            priority={false}
          />
          
          {/* Level Box */}
          <div className="bg-black/50 border border-pink-500/50 rounded-2xl p-4 mb-4">
            {/* Level und EXP Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-baseline gap-2">
                <TranslatedText text="Level" language={language} className="text-xl font-bold text-white" />
                <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">{level}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">{userData.expTotal.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-pink-500 hover:bg-pink-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
                aria-label="Deine EXP-Quellen"
                title="Deine EXP-Quellen"
              >
                <FaInfoCircle className="w-3.5 h-3.5 text-white animate-bounce" />
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
                  <div className="text-pink-300 text-sm font-medium">
                    <TranslatedText text="Mining Power" language={language} />
                  </div>
                  <div className="text-pink-200 text-lg font-bold">+{userData.miningpower} D.Faith</div>
                </div>
              </div>
            </button>
          </div>
          
          {/* System Check */}
          <div className="bg-black/50 border border-pink-500/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-lg bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                <span className="inline-block align-middle mr-2" style={{width:'1.5em',height:'1.5em',verticalAlign:'middle'}}>
                  <svg viewBox="0 0 32 32" width="1.5em" height="1.5em" fill="#fff" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
                    <path d="M21.5 4c.2 3.2 2.5 5.7 5.5 6.1v4.1c-2.1-.2-4.1-.8-5.9-1.8v9.2c0 4.1-3.3 7.4-7.4 7.4S6.3 25.7 6.3 21.6c0-4.1 3.3-7.4 7.4-7.4.3 0 .7 0 1 .1v4.2c-.3-.1-.7-.2-1-.2-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V4h4.6z"/>
                  </svg>
                </span>
                <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                  <TranslatedText text="TikTok Check" language={language} />
                </span>
              </div>
              {!showLeaderboardModal && (
                <button
                  type="button"
                  onClick={() => setShowLeaderboardModal(true)}
                  className="relative group w-8 h-8 rounded-full bg-yellow-400 text-black shadow-lg hover:bg-yellow-300 active:scale-95 hover:scale-105 transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 hover:ring-4 hover:ring-yellow-200/60 hover:shadow-yellow-300/60"
                  aria-label={language === 'de' ? "Leaderboard öffnen" : language === 'en' ? "Open Leaderboard" : "Otwórz ranking"}
                  title={language === 'de' ? "Leaderboard öffnen" : language === 'en' ? "Open Leaderboard" : "Otwórz ranking"}
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
                <span className="text-green-400 font-bold">🔗 <TranslatedText text="Share" language={language} /></span>
                <span>{userData.shared === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-400 font-bold">💾 <TranslatedText text="Save" language={language} /></span>
                <span>{userData.saved === true || userData.saved === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-400 font-bold">🔐 <TranslatedText text="Secret" language={language} /></span>
                <span>❓ +30 EXP</span>
              </div>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowExpSelectionModal(true)}
              className="relative flex-1 bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-400/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-pulse">✨</span>
                <span className="tracking-wider">
                  <TranslatedText text="Sammle EXP" language={language} />
                </span>
              </div>
            </button>
            <button 
              onClick={() => setShowClaimModal(true)}
              className="relative flex-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 px-4 py-4 rounded-2xl font-bold text-sm text-gray-900 overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 border border-cyan-300/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center justify-center gap-1">
                <span className="text-xl animate-bounce">🪙</span>
                <span className="tracking-wider">
                  <TranslatedText text="Claim" language={language} />
                </span>
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
                <h3 className="text-white font-semibold">
                  <TranslatedText text="Leaderboard" language={language} />
                </h3>
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
                <span className="text-zinc-400 text-xs">Suche</span>
                <input
                  value={lbSearch}
                  onChange={(e) => setLbSearch(e.target.value)}
                  placeholder={language === 'de' ? "@handle oder Name" : language === 'en' ? "@handle or name" : "@handle lub nazwa"}
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
                  const names = [e.instagram, e.tiktok, e.facebook, e.youtube, e.name, e.handle].filter(Boolean) as string[];
                  const q = lbSearch.toLowerCase();
                  return names.some(n => n.toLowerCase().includes(q));
                }).map((e: any) => {
                  const namesDetailed = [
                    e.youtube ? { label: e.youtube, platform: 'youtube' } : null,
                    e.instagram ? { label: e.instagram, platform: 'instagram' } : null,
                    e.tiktok ? { label: e.tiktok, platform: 'tiktok' } : null,
                    e.facebook ? { label: e.facebook, platform: 'facebook' } : null,
                    e.name ? { label: e.name, platform: 'generic' } : null,
                    e.handle ? { label: e.handle, platform: 'generic' } : null,
                  ].filter(Boolean) as { label: string; platform: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'generic' }[];
                  const primary = (e.youtube || e.instagram || e.tiktok || e.facebook || e.name || e.handle || '-') as string;
                  const primaryPlatform: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'generic' = e.youtube ? 'youtube' : e.instagram ? 'instagram' : e.tiktok ? 'tiktok' : e.facebook ? 'facebook' : 'generic';
                  const PlatformIcon = primaryPlatform === 'youtube' ? FaYoutube : primaryPlatform === 'instagram' ? FaInstagram : primaryPlatform === 'tiktok' ? FaTiktok : primaryPlatform === 'facebook' ? FaFacebookF : null;
                  const prize = (lbData?.prizes || []).find((p: any) => p.position === e.rank);
                  const prizeText = prize ? (prize.value || prize.description || '') : '';
                  const prizeDisplay = prizeText ? prizeText : '-';
                  // EXP-Wert: Zeige expTotal aus dem Eintrag, wo expTotal==0 ist
                  const expValue = e.expTotal === 0 ? 0 : e.expTotal;
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
                              aria-label="Weitere Namen anzeigen"
                              title="Weitere Namen anzeigen"
                            >
                              {lbOpenRow === e.rank ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        <span className="text-amber-300 text-sm font-mono tabular-nums text-center">{expValue.toLocaleString()}</span>
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
              <div className="text-[10px] text-zinc-500 mt-2 text-right"><TranslatedText text="Letztes Update:" language={language} /> {lbData?.lastUpdated ? new Date(lbData.lastUpdated).toLocaleString() : '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* UserCard Modals */}
      {/* Sammle EXP (LikeSave) Modal */}
      {showLikeSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                ✨ <TranslatedText text="TikTok Verification" language={language} />
              </h2>
              <button
                onClick={() => setShowLikeSaveModal(false)}
                className="text-gray-400 hover:text-pink-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-4 mb-4">
              <p className="font-semibold mb-3 text-pink-200">
                1️⃣ <TranslatedText text="Entferne alle Likes, Shares und Saves von meinem Video" language={language} />
              </p>
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
                ) : initialValues !== null ? '✅ Werte bereits erfasst' : <TranslatedText text="✅ Check aktuelle Werte" language={language} />}
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
              <p className="font-semibold mb-3 text-cyan-200">
                2️⃣ <TranslatedText text="Like, Share und Save das Video erneut!" language={language} />
              </p>
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
                ) : !initialValues ? 
                  (language === 'de' ? '⚠️ Zuerst Schritt 1 ausführen' : language === 'en' ? '⚠️ Complete step 1 first' : '⚠️ Najpierw wykonaj krok 1') : 
                  afterValues ? 
                    (language === 'de' ? '✅ Neue Werte erfasst' : language === 'en' ? '✅ New values recorded' : '✅ Nowe wartości zarejestrowane') : 
                    (language === 'de' ? '✅ Check neue Werte' : language === 'en' ? '✅ Check new values' : '✅ Sprawdź nowe wartości')}
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
                  <p className="text-green-200 text-sm"><TranslatedText text="Du hast erfolgreich EXP gesammelt:" language={language} /></p>
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
                ❌ <TranslatedText text="Schließen" language={language} />
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
                <TranslatedText text="D.FAITH Claim" language={language} />
              </h2>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-gray-400 hover:text-cyan-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Image
                  src="/D.FAITH.png"
                  alt="D.FAITH Logo"
                  width={80}
                  height={80}
                  className="coin-flip"
                  style={{ animation: 'coin-flip 5s linear infinite' }}
                />
                <style>{`
                  @keyframes coin-flip {
                    0% { transform: rotateY(0deg); }
                    100% { transform: rotateY(360deg); }
                  }
                `}</style>
              </div>
              <p className="text-cyan-200 leading-relaxed mb-4">
                <TranslatedText text="Du kannst" language={language} /> <strong className="text-cyan-400">+{userData.miningpower} D.FAITH</strong> <TranslatedText text="für deine TikTok Aktivität claimen!" language={language} />
              </p>
              <div className="bg-black/30 border border-cyan-500/20 rounded-lg p-3 mb-4">
                <div className="text-xs text-cyan-300 mb-1"><TranslatedText text="Wallet Adresse:" language={language} /></div>
                <div className="font-mono text-sm text-cyan-100 break-all">
                  {userData.walletAddress || walletInput || (language === 'de' ? 'Nicht verfügbar' : language === 'en' ? 'Not available' : 'Niedostępne')}
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
                <TranslatedText text="Abbrechen" language={language} />
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
                � <TranslatedText text="EXP Information" language={language} />
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
                <h3 className="text-purple-300 font-bold mb-4"><TranslatedText text="✨ Deine EXP-Quellen" language={language} /></h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3 bg-blue-500/10 py-2 rounded-r-xl">
                    <Image src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width={24} height={24} className="w-6 h-6" unoptimized />
                    <div>
                      <div className="font-bold text-blue-300">Facebook</div>
                      <div className="text-blue-200 font-semibold">{userData.expFacebook} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-pink-600 pl-3 bg-pink-500/10 py-2 rounded-r-xl">
                    <Image src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" width={24} height={24} className="w-6 h-6 rounded-full" unoptimized />
                    <div>
                      <div className="font-bold text-pink-300">TikTok</div>
                      <div className="text-pink-200 font-semibold">{userData.expTiktok} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-purple-600 pl-3 bg-purple-500/10 py-2 rounded-r-xl">
                    <Image src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width={24} height={24} className="w-6 h-6 rounded-full" unoptimized />
                    <div>
                      <div className="font-bold text-purple-300">Instagram</div>
                      <div className="text-purple-200 font-semibold">{userData.expInstagram} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-red-600 pl-3 bg-red-500/10 py-2 rounded-r-xl">
                    <Image src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" width={24} height={24} className="w-6 h-6 rounded-full" unoptimized />
                    <div>
                      <div className="font-bold text-red-300">YouTube</div>
                      <div className="text-red-200 font-semibold">{userData.expStream} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-yellow-600 pl-3 bg-yellow-500/10 py-2 rounded-r-xl">
                    <Image src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Live" width={24} height={24} className="w-6 h-6 rounded-full" unoptimized />
                    <div>
                      <div className="font-bold text-yellow-300">Live</div>
                      <div className="text-yellow-200 font-semibold">{userData.liveNFTBonus} EXP</div>
                    </div>
                  </div>
                  <div className="border-t border-gray-600 pt-3 mt-4">
                    <div className="flex justify-between">
                      <span className="text-white font-bold"><TranslatedText text="Gesamt EXP" language={language} /></span>
                      <span className="text-white font-bold">{userData.expTotal}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-300/30 rounded-2xl p-4 mb-6">
                <p className="text-sm text-purple-200 font-medium">💡 <TranslatedText text="Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen!" language={language} /> 🚀</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl py-3 font-bold transition-all hover:from-purple-600 hover:to-pink-600"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
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
                ⛏️ <TranslatedText text="Mining Power" language={language} />
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
                <TranslatedText text="Deine" language={language} /> <strong className="text-cyan-400">Mining Power</strong> <TranslatedText text="bestimmt, wie viele D.FAITH Token du pro TikTok Claim erhältst." language={language} />
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <span className="text-xl text-green-500">$</span>
                  <div>
                    <div className="font-bold text-cyan-300"><TranslatedText text="Marketing Budget" language={language} /></div>
                    <div className="text-sm text-cyan-400"><TranslatedText text="Budget pro User für TikTok" language={language} /></div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  {userData?.image ? (
                      <Image
                        src={userData.image}
                        alt="Profilbild"
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                  <div>
                    <div className="font-bold text-orange-300"><TranslatedText text="Dein Level" language={language} /></div>
                    <div className="text-sm text-orange-400">Level {getLevelAndExpRange(userData.expTotal).level}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <Image src="/D.FAITH.png" alt="D.FAITH Logo" width={28} height={28} className="object-contain bg-transparent" />
                  <div>
                    <div className="font-bold text-yellow-300"><TranslatedText text="D.FAITH Kurs" language={language} /></div>
                    <div className="text-sm text-yellow-400"><TranslatedText text="Aktueller Marktpreis" language={language} /></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 mb-6">
              <p className="text-pink-200 font-medium text-center">
                ⚡ <strong><TranslatedText text="Aktuell:" language={language} /></strong> +{userData.miningpower} D.FAITH <TranslatedText text="pro Claim" language={language} />
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 text-white rounded-xl py-3 font-bold transition-all hover:from-cyan-600 hover:to-pink-600"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Initial Modal */}
      {showConfirmInitial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">⚠️</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">
              <TranslatedText text="Bestätigung erforderlich" language={language} />
            </h2>
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-4 mb-4">
              <p className="text-pink-200 leading-relaxed">
                <TranslatedText text="Bitte entferne alle Likes, Shares und Saves von meinem Video – danach werden alle aktuellen Zahlen gespeichert." language={language} />
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmInitial(false);
                  checkInitial();
                }}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ <TranslatedText text="Ja, fortfahren" language={language} />
              </button>
              <button 
                onClick={() => setShowConfirmInitial(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ <TranslatedText text="Abbrechen" language={language} />
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
            <h2 className="text-xl font-bold mb-4 text-white text-center">
              <TranslatedText text="Finale Bestätigung" language={language} />
            </h2>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4">
              <p className="text-cyan-200 leading-relaxed">
                <TranslatedText text="Bitte Like, Share und Save den TikTok erneut, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert." language={language} />
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  checkAfter();
                }}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ <TranslatedText text="Ja, fortfahren" language={language} />
              </button>
              <button 
                onClick={() => setShowConfirmAfter(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ <TranslatedText text="Abbrechen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXP Selection Modal */}
      {showExpSelectionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-6 w-full max-w-md animate-in slide-in-from-bottom-5 duration-300 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl text-white">⚡</span>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">
              <TranslatedText text="EXP Sammeln" language={language} />
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={() => {
                  setShowExpSelectionModal(false);
                  setShowSecretModal(true);
                }}
                className="relative w-full bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600 hover:from-purple-600 hover:via-purple-700 hover:to-pink-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25 border border-purple-400/30 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="flex items-center justify-between relative z-10">
                  <span className="flex items-center gap-2">🔐 <TranslatedText text="Secret Code" language={language} /></span>
                  <span className="text-yellow-300 font-bold">+30 EXP</span>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowExpSelectionModal(false);
                  setShowLikeSaveModal(true);
                }}
                className="relative w-full bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 hover:from-pink-600 hover:via-pink-700 hover:to-purple-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-400/30 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="flex items-center justify-between relative z-10">
                  <span className="flex items-center gap-2">❤️ <TranslatedText text="Like, Share & Save" language={language} /></span>
                  <span className="text-yellow-300 font-bold">+30 EXP</span>
                </div>
              </button>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowExpSelectionModal(false)}
                className="w-full bg-black/50 border border-gray-600/50 hover:bg-gray-800 hover:border-gray-500 text-gray-300 hover:text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ <TranslatedText text="Abbrechen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TikTok Secret Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-pink-500/30 rounded-2xl p-6 w-full max-w-md animate-in slide-in-from-bottom-5 duration-300 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl text-white">🔐</span>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">
              <TranslatedText text="TikTok Secret Code" language={language} />
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-pink-300 mb-2">
                  <TranslatedText text="Secret Code eingeben:" language={language} />
                </label>
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-black/50 border border-pink-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300 uppercase"
                  placeholder="GEHEIMCODE"
                  disabled={secretLoading}
                />
              </div>
              
              {secretMessage && (
                <div className={`p-3 rounded-xl border ${secretMessage.includes('erfolgreich') ? 'bg-green-900/50 border-green-500/50 text-green-300' : 'bg-red-900/50 border-red-500/50 text-red-300'}`}>
                  {secretMessage}
                  {secretMessage.includes('erfolgreich') && (
                    <div className="mt-3">
                      <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-2 rounded-lg font-bold transition-all duration-300"
                      >
                        🔄 <TranslatedText text="Seite neu laden" language={language} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSecretModal(false);
                  setSecretCode('');
                  setSecretMessage('');
                }}
                className="flex-1 bg-black/50 border border-gray-600/50 hover:bg-gray-800 hover:border-gray-500 text-gray-300 hover:text-white p-3 rounded-xl font-bold transition-all duration-300"
                disabled={secretLoading}
              >
                ❌ <TranslatedText text="Abbrechen" language={language} />
              </button>
              <button
                onClick={handleSecretCheck}
                className="relative flex-1 bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600 hover:from-purple-600 hover:via-purple-700 hover:to-pink-700 text-white p-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 overflow-hidden group"
                disabled={secretLoading || !secretCode.trim()}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <span className="relative z-10">
                  {secretLoading ? '🔄' : '🔐'} <TranslatedText text="Prüfen" language={language} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface TiktokTabProps {
  language: SupportedLanguage;
}

export default function TiktokTab({ language }: TiktokTabProps) {
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
        setMessage(language === 'de' ? 'Anfrage erfolgreich gesendet!' : language === 'en' ? 'Request sent successfully!' : 'Żądanie wysłane pomyślnie!');
      } else {
        setMessage(language === 'de' ? 'Fehler beim Senden der Anfrage. Bitte versuchen Sie es erneut.' : language === 'en' ? 'Error sending request. Please try again.' : 'Błąd wysyłania żądania. Spróbuj ponownie.');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setMessage(language === 'de' ? 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.' : language === 'en' ? 'Network error. Please check your connection.' : 'Błąd sieci. Sprawdź połączenie.');
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
          setConfirmationMessage(language === 'de' ? '✅ Teilnahme erfolgreich bestätigt!' : language === 'en' ? '✅ Participation successfully confirmed!' : '✅ Uczestnictwo potwierdzone pomyślnie!');
          // Modal bleibt geöffnet - User kann manuell schließen
        } else if (normalizedStatus === 'wallet account') {
          setConfirmationMessage(language === 'de' ? '⚠️ Die angegebene Wallet stimmt nicht mit deinem Account überein. Falls du die Adresse ändern möchtest, schreibe eine DM an @dawidfaith mit dem Stichwort "Wallet".' : language === 'en' ? '⚠️ The provided wallet does not match your account. If you want to change the address, send a DM to @dawidfaith with the keyword "Wallet".' : '⚠️ Podany portfel nie pasuje do Twojego konta. Jeśli chcesz zmienić adres, wyślij wiadomość do @dawidfaith ze słowem "Wallet".');
        } else if (normalizedStatus === 'wallet in use') {
          setConfirmationMessage('❌ Diese Wallet wird bereits verwendet. Bitte verwende eine andere Wallet-Adresse.');
        } else if (normalizedStatus === 'comment') {
          setConfirmationMessage('💬 Es wurde noch kein Kommentar von dir gefunden. Bitte kommentiere den Beitrag und versuche es erneut.');
        } else if (normalizedStatus === 'evalued') {
          setConfirmationMessage(language === 'de' ? 'ℹ️ Du hast deine Teilnahme bereits bestätigt.' : language === 'en' ? 'ℹ️ You have already confirmed your participation.' : 'ℹ️ Już potwierdziłeś swój udział.');
        } else {
          setConfirmationMessage('❌ Teilnahme fehlgeschlagen. Bitte versuche es erneut.');
        }
      } else {
        setConfirmationMessage('❌ Teilnahme fehlgeschlagen. Bitte versuche es erneut.');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setConfirmationMessage(language === 'de' ? '❌ Netzwerkfehler. Bitte überprüfe deine Verbindung.' : language === 'en' ? '❌ Network error. Please check your connection.' : '❌ Błąd sieci. Sprawdź połączenie.');
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
          setMessage(language === 'de' ? '❌ Falsche Kombination: Benutzer nicht gefunden' : language === 'en' ? '❌ Wrong combination: User not found' : '❌ Błędna kombinacja: Użytkownik nie znaleziony');
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
          setMessage(language === 'de' ? 'Login erfolgreich!' : language === 'en' ? 'Login successful!' : 'Logowanie udane!');
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
          setMessage(language === 'de' ? 'Login erfolgreich!' : language === 'en' ? 'Login successful!' : 'Logowanie udane!');
          setIsLoginModalOpen(false); // Modal nur bei erfolgreichem Login schließen
        }
      } else {
        // API Antwort war nicht erfolgreich
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'Benutzer nicht gefunden') {
          setMessage(language === 'de' ? '❌ Falsche Kombination: Benutzer nicht gefunden' : language === 'en' ? '❌ Wrong combination: User not found' : '❌ Błędna kombinacja: Użytkownik nie znaleziony');
        } else {
          setMessage(language === 'de' ? '❌ Fehler beim Login. Bitte versuche es erneut.' : language === 'en' ? '❌ Login error. Please try again.' : '❌ Błąd logowania. Spróbuj ponownie.');
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
    return <UserCard userData={userData} onBack={() => setIsLoggedIn(false)} language={language} />;
  }

  // Standard Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Kompakter Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-700 rounded-full mb-4 shadow-xl">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-600 bg-clip-text text-transparent mb-2">
            TikTok Creator Hub
          </h1>
          
          <p className="text-sm text-gray-300 leading-relaxed">
            <TranslatedText text="Interagiere mit TikTok Videos und verdiene D.FAITH Token!" language={language} />
          </p>
        </div>

        {/* Kompakte Action Cards */}
        <div className="space-y-4 mb-6">
          {/* Schritt 1 - Teilnahme bestätigen */}
          <button
            onClick={() => setIsCheckModalOpen(true)}
            className="w-full bg-gradient-to-r from-pink-500/20 to-purple-600/20 border border-pink-500/30 rounded-xl p-4 hover:border-pink-500/50 transition-all duration-300 transform hover:scale-105"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <div className="text-left flex-1">
                <h3 className="text-white font-bold text-base mb-1">
                  <TranslatedText text="Teilnahme Bestätigen" language={language} />
                </h3>
                <p className="text-gray-400 text-xs leading-tight">
                  <TranslatedText text="TikTok Video kommentiert? Bestätige deine Teilnahme!" language={language} />
                </p>
              </div>
              <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Schritt 2 - Dashboard Login */}
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="w-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-xl p-4 hover:border-cyan-500/50 transition-all duration-300 transform hover:scale-105"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">2</span>
              </div>
              <div className="text-left flex-1">
                <h3 className="text-white font-bold text-base mb-1">
                  <TranslatedText text="Dashboard Login" language={language} />
                </h3>
                <p className="text-gray-400 text-xs leading-tight">
                  <TranslatedText text="Tokens claimen nach Bestätigung" language={language} />
                </p>
              </div>
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* TikTok Link - Kompakt */}
        <div className="bg-gradient-to-r from-pink-500/10 to-purple-600/10 border border-pink-500/30 rounded-xl p-4 mb-4">
          <div className="text-center">
            <p className="text-pink-300 text-sm font-medium mb-3">
              <TranslatedText text="Neueste TikTok Videos ansehen:" language={language} />
            </p>
            <a 
              href="https://www.tiktok.com/@dawidfaith"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
              <span>@dawidfaith</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 7h8.586L5.293 17.293l1.414 1.414L17 8.414V17h2V5H7v2z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Anleitung - Kompakt */}
        <div className="bg-gradient-to-r from-pink-600/10 to-purple-800/10 border border-pink-500/20 rounded-xl p-4">
          <h3 className="text-base font-semibold text-pink-300 mb-3 flex items-center gap-2">
            <FaInfoCircle />
            <TranslatedText text="So funktioniert's:" language={language} />
          </h3>
          <div className="space-y-2 text-gray-300 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-pink-400 font-bold">1.</span>
              <TranslatedText text="TikTok Video liken & kommentieren" language={language} />
            </div>
            <div className="flex items-start gap-2">
              <span className="text-pink-400 font-bold">2.</span>
              <TranslatedText text="Teilnahme bestätigen" language={language} />
            </div>
            <div className="flex items-start gap-2">
              <span className="text-pink-400 font-bold">3.</span>
              <TranslatedText text="Dashboard login & Token claimen" language={language} />
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-xl text-center text-sm ${
            message.includes('erfolgreich') 
              ? 'bg-green-500/10 border border-green-500/30 text-green-300' 
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal
        isOpen={isCheckModalOpen}
        onClose={() => {
          setIsCheckModalOpen(false);
          setConfirmationMessage('');
        }}
        title={language === 'de' ? "Bestätige deine Teilnahme" : language === 'en' ? "Confirm your participation" : "Potwierdź swój udział"}
        onSubmit={handleCheck}
        isLoading={isLoading}
        router={router}
        confirmationMessage={confirmationMessage}
        account={account}
        language={language}
      />

      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setMessage(''); // Message zurücksetzen beim Schließen
        }}
        title={language === 'de' ? "Dashboard Login" : "Dashboard Login"}
        onSubmit={handleLogin}
        isLoading={isLoading}
        router={router}
        confirmationMessage={message} // Fehlermeldungen im Modal anzeigen
        account={account}
        language={language}
      />

      {/* Additional TikTok Modals */}
      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowUpgradeModal(false)}
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">⭐</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent"><TranslatedText text="Level Upgrade!" language={language} /></h2>
            </div>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                <strong className="text-pink-600"><TranslatedText text="Herzlichen Glückwunsch!" language={language} /></strong> <TranslatedText text="Du hast ein neues Level erreicht!" language={language} />
              </p>
              <div className="text-2xl font-bold text-purple-600 mb-2">Level {userData && getLevelAndExpRange(userData.expTotal || 0).level}</div>
              <p className="text-gray-600 text-sm">
                <TranslatedText text="Deine Mining Power wurde erhöht!" language={language} /> 🚀
              </p>
            </div>
            
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✨ <TranslatedText text="Awesome!" language={language} />
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
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">💰</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent"><TranslatedText text="Claim erfolgreich!" language={language} /></h2>
            </div>
            
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                <TranslatedText text="Du hast erfolgreich " language={language} /><strong className="text-pink-600">+{userData?.miningpower || 0} D.FAITH</strong><TranslatedText text=" für deine TikTok Aktivität erhalten!" language={language} />
              </p>
              <div className="text-sm text-gray-600">
                <TranslatedText text="💎 Weiter so und sammle mehr Token!" language={language} />
              </div>
            </div>
            
            <button 
              onClick={() => setShowClaimModal(false)}
              className="w-full bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-500 hover:to-pink-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              🚀 <TranslatedText text="Weiter claimen!" language={language} />
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
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-cyan-400 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">❤️</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-cyan-600 bg-clip-text text-transparent">✨ <TranslatedText text="TikTok Engagement" language={language} /></h2>
            </div>
            
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                <TranslatedText text="Bitte führe die folgenden Aktionen auf dem TikTok Video durch:" language={language} />
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-pink-500">❤️</span>
                  <span className="text-gray-700"><TranslatedText text="Like das Video" language={language} /></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-500">💬</span>
                  <span className="text-gray-700"><TranslatedText text="Kommentiere" language={language} /></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-500">🔄</span>
                  <span className="text-gray-700"><TranslatedText text="Teile das Video" language={language} /></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-pink-500">🔖</span>
                  <span className="text-gray-700"><TranslatedText text="Speichere ihn" language={language} /></span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-yellow-800 font-medium text-sm">
                <TranslatedText text="⚡ Nach dem Engagement kannst du deine D.FAITH Token claimen!" language={language} />
              </p>
            </div>
            
            <button 
              onClick={() => setShowLikeSaveModal(false)}
              className="w-full bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-600 hover:to-cyan-500 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
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
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
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
                <TranslatedText text="Das " language={language} /><strong className="text-purple-600">TikTok Dashboard</strong><TranslatedText text=" ermöglicht es dir, D.FAITH Token durch TikTok Engagement zu verdienen." language={language} />
              </p>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-300">
                  <span className="text-xl">⛏️</span>
                  <div>
                    <div className="font-bold text-gray-800">Mining Power</div>
                    <div className="text-sm text-gray-600"><TranslatedText text="Mehr D.FAITH pro Claim" language={language} /></div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-300">
                  <span className="text-xl">🎯</span>
                  <div>
                    <div className="font-bold text-gray-800"><TranslatedText text="Daily Claims" language={language} /></div>
                    <div className="text-sm text-gray-600"><TranslatedText text="Täglich neue Möglichkeiten" language={language} /></div>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
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
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
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
                <div className="text-xs text-gray-500 mb-1"><TranslatedText text="Wallet Adresse:" language={language} /></div>
                <div className="font-mono text-sm text-gray-800 break-all">
                  {userData?.walletAddress || (language === 'de' ? 'Nicht verfügbar' : language === 'en' ? 'Not available' : 'Niedostępne')}
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                <TranslatedText text="💎 Alle D.FAITH Token werden automatisch hierhin gesendet" language={language} />
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
      {/* ...existing code... */}

      {/* Confirm Before Modal */}
      {showConfirmBefore && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-200 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-xl font-bold focus:outline-none"
              onClick={() => setShowConfirmBefore(false)}
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800"><TranslatedText text="System Check starten" language={language} /></h2>
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
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
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
              aria-label={language === 'de' ? "Schließen" : language === 'en' ? "Close" : "Zamknij"}
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