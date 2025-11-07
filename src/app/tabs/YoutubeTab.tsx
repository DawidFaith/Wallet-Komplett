'use client';

import React, { useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
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
  expYoutube: number; // Changed from expTiktok
  expFacebook: number;
  expInstagram: number;
  expStream: number;
  liveNFTBonus: number;
  miningpower: number;
  liked: string;
  commented: string;
  subscribed: boolean | string; // Changed from saved to subscribed for YouTube
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
      const savedUsername = localStorage.getItem('youtube_saved_username');
      const savedWallet = localStorage.getItem('youtube_saved_wallet');
      
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
        localStorage.setItem('youtube_saved_username', formattedUsername);
        localStorage.setItem('youtube_saved_wallet', claimWalletAddress);
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
      <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-red-400 text-2xl transition-colors"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="text-xs text-gray-400 mb-4 text-center">
          💡 <TranslatedText text="Wallet ändern? Schreib mir eine DM mit &quot;Wallet&quot; auf YouTube" language={language} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-red-300 mb-3">
              <TranslatedText text="YouTube Username" language={language} />
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-red-400 font-bold pointer-events-none">
                @
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 bg-black/50 border border-red-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          
          {/* Wallet Bereich - nur verbundene Wallet anzeigen oder Verbindungshinweis */}
          {account?.address ? (
            /* Verbundene Wallet anzeigen */
            <div>
              <label className="block text-sm font-medium text-red-300 mb-3">
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium disabled:opacity-50 shadow-lg"
              disabled={isLoading || !username.trim() || !account?.address}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
              ) : (
                <TranslatedText text="Beitreten" language={language} />
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
  const [showSubscribeModal, setShowSubscribeModal] = useState(false); // Changed from showLikeSaveModal to showSubscribeModal
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
  const [showMiningPowerModal, setShowMiningPowerModal] = useState(false);
  const [showConfirmInitial, setShowConfirmInitial] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [walletInput, setWalletInput] = useState(userData.wallet || '');
  const [claimStatus, setClaimStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<{likes: number, shares: number, subscribes: number} | null>(null); // Changed saves to subscribes
  const [afterValues, setAfterValues] = useState<{likes: number, shares: number, subscribes: number} | null>(null); // Changed saves to subscribes
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [expGained, setExpGained] = useState<{likes: number, shares: number, subscribes: number, total: number} | null>(null); // Changed saves to subscribes

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

  // Level Funktionen (gleiche Logik wie TikTok)
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

  // Placeholder return für jetzt - wird in nächsten Schritten vervollständigt
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-lg mx-auto">
        {/* Header mit YouTube Design */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">YouTube Creator</h2>
            <button
              onClick={onBack}
              className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <TranslatedText text="Zurück" language={language} />
            </button>
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-2">{userData.username}</h3>
            <div className="bg-red-800/50 rounded-lg p-3">
              <p className="text-red-100 text-sm">
                Level {level} • {userData.expTotal} XP
              </p>
              <div className="w-full bg-red-900/50 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-white to-red-200 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="bg-gray-800/50 rounded-xl p-6 text-center">
          <p className="text-gray-300">
            <TranslatedText text="YouTube Funktionen werden in den nächsten Schritten hinzugefügt..." language={language} />
          </p>
        </div>
      </div>
    </div>
  );
}

export default function YouTubeTab({ language }: { language: SupportedLanguage }) {
  const router = useRouter();
  const account = useActiveAccount();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showUserCard, setShowUserCard] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [showNoUuidModal, setShowNoUuidModal] = useState(false);

  // Separate States für Check und Login Modals (wie TikTok)
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Handle Check (Teilnahme bestätigen) - entspricht TikTok handleCheck
  const handleCheck = async (username: string, walletAddress: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await fetch('https://hook.eu2.make.com/bw3y9tmjibj1f3mdm0tca0p1nh98xgw4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          walletAddress: walletAddress,
          timestamp: new Date().toISOString(),
          platform: 'youtube'
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('YouTube Check Response Data:', responseData);
        
        // Status normalisieren (Leerzeichen entfernen, lowercase)
        const normalizedStatus = responseData.status?.toString().trim().toLowerCase();
        
        if (normalizedStatus === 'success' || normalizedStatus === 'ok' || response.status === 200) {
          setMessage(language === 'de' ? '✅ Teilnahme bestätigt! Du kannst jetzt dein Dashboard aufrufen.' : language === 'en' ? '✅ Participation confirmed! You can now access your dashboard.' : '✅ Udział potwierdzony! Możesz teraz uzyskać dostęp do swojego dashboard.');
          setTimeout(() => {
            setIsCheckModalOpen(false);
            setMessage('');
          }, 3000);
        } else {
          setMessage(language === 'de' ? '❌ Teilnahme noch nicht erkannt. Bitte like, kommentiere und abonniere das neueste YouTube Video.' : language === 'en' ? '❌ Participation not detected yet. Please like, comment and subscribe to the latest YouTube video.' : '❌ Udział nie został jeszcze wykryty. Polub, skomentuj i zasubskrybuj najnowszy film YouTube.');
        }
      } else {
        setMessage(language === 'de' ? '❌ Fehler bei der Überprüfung. Bitte versuche es erneut.' : language === 'en' ? '❌ Check failed. Please try again.' : '❌ Sprawdzenie nie powiodło się. Spróbuj ponownie.');
      }
    } catch (error) {
      console.error('YouTube check error:', error);
      setMessage(language === 'de' ? 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.' : language === 'en' ? 'Network error. Please check your connection.' : 'Błąd sieci. Sprawdź połączenie.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login (Dashboard Login) - entspricht TikTok handleLogin  
  const handleLogin = async (username: string, walletAddress: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await fetch('https://youtube-userboard.vercel.app/api/userboard', {
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
        console.log('YouTube Login Response Data:', responseData);
        
        // Prüfe auf Fehlermeldung "Benutzer nicht gefunden"
        if (responseData.error === 'Benutzer nicht gefunden') {
          setMessage(language === 'de' ? '❌ Falsche Kombination: Benutzer nicht gefunden' : language === 'en' ? '❌ Wrong combination: User not found' : '❌ Błędna kombinacja: Użytkownik nie znaleziony');
          return;
        }
        
        setUserData(responseData);
        setShowUserCard(true);
        setIsLoginModalOpen(false);
        setMessage('');
      } else {
        setMessage(language === 'de' ? '❌ Login fehlgeschlagen. Bitte überprüfe deine Daten.' : language === 'en' ? '❌ Login failed. Please check your credentials.' : '❌ Logowanie nie powiodło się. Sprawdź swoje dane.');
      }
    } catch (error) {
      console.error('YouTube login error:', error);
      setMessage(language === 'de' ? 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.' : language === 'en' ? 'Network error. Please check your connection.' : 'Błąd sieci. Sprawdź połączenie.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToMain = () => {
    setShowUserCard(false);
    setUserData(null);
    setConfirmationMessage('');
  };

  if (showUserCard && userData) {
    return <UserCard userData={userData} onBack={handleBackToMain} language={language} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-red-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header mit YouTube Branding */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-full mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent mb-4">
            YouTube Creator Hub
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            <TranslatedText text="Verbinde deinen YouTube Account und verdiene D.FAITH Token durch deine Aktivitäten!" language={language} />
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
          {/* Action Buttons */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setIsCheckModalOpen(true)}
              className="flex items-center justify-center p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl hover:border-red-500/50 transition-all group"
            >
              <div className="text-center">
                <h3 className="text-white font-bold">
                  1. <TranslatedText text="Teilnahme Bestätigen" language={language} />
                </h3>
                <p className="text-gray-400 text-sm">
                  <TranslatedText text="Hast du schon kommentiert? Dann bestätige jetzt deine Teilnahme!" language={language} />
                </p>
              </div>
            </button>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center justify-center p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-xl hover:border-cyan-500/50 transition-all group"
            >
              <div className="text-center">
                <h3 className="text-white font-bold">
                  2. <TranslatedText text="Dashboard Login" language={language} />
                </h3>
                <p className="text-gray-400 text-sm">
                  <TranslatedText text="Tokens claimen - nur nach Teilnahme-Bestätigung möglich" language={language} />
                </p>
              </div>
            </button>
          </div>

          {/* YouTube Profil Link */}
          <div className="mb-6 p-4 bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-xl">
            <div className="text-center">
              <p className="text-red-300 font-medium mb-3">
                📱 Besuche mein YouTube-Kanal für das neueste Video:
              </p>
              <a 
                href="https://www.youtube.com/@dawidfaith"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>@dawidfaith auf YouTube</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 7h8.586L5.293 17.293l1.414 1.414L17 8.414V17h2V5H7v2z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Wie funktioniert es? */}
          <div className="bg-gradient-to-r from-red-600/10 to-red-800/10 border border-red-500/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-300 mb-3 flex items-center gap-2">
              <FaInfoCircle />
              <TranslatedText text="Wie es funktioniert" language={language} />
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <TranslatedText text="Like, kommentiere und abonniere das neueste YouTube Video" language={language} />
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <TranslatedText text="Bestätige deine Teilnahme über Button 1" language={language} />
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <TranslatedText text="Logge dich ins Dashboard ein und claime deine Tokens" language={language} />
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Check Modal (Teilnahme bestätigen) */}
      <Modal
        isOpen={isCheckModalOpen}
        onClose={() => {
          setIsCheckModalOpen(false);
          setMessage('');
        }}
        title={language === 'de' ? "Teilnahme Bestätigen" : language === 'en' ? "Confirm Participation" : "Potwierdź Udział"}
        onSubmit={handleCheck}
        isLoading={isLoading}
        router={router}
        confirmationMessage={message}
        account={account}
        language={language}
      />

      {/* Login Modal (Dashboard Login) */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setMessage('');
        }}
        title={language === 'de' ? "Dashboard Login" : "Dashboard Login"}
        onSubmit={handleLogin}
        isLoading={isLoading}
        router={router}
        confirmationMessage={message}
        account={account}
        language={language}
      />

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
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <span className="text-3xl text-white">🔒</span>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">Profil nicht gefunden</h2>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-800 leading-relaxed mb-4">
                Dein Profil ist nur durch die <strong className="text-red-600">Teilnahme an den YouTube Videos</strong> von <strong className="text-red-600">Dawid Faith</strong> erreichbar.
              </p>
              <p className="text-gray-600 text-sm">
                💡 Like, kommentiere, teile und abonniere seine Videos, um Zugang zu erhalten!
              </p>
            </div>
            
            <div className="space-y-3 mb-6">
              <p className="text-gray-700 font-medium">📱 Folge Dawid Faith auf YouTube:</p>
              
              <a 
                href="https://www.youtube.com/@dawidfaith"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white p-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center gap-3 block"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>YouTube Kanal</span>
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