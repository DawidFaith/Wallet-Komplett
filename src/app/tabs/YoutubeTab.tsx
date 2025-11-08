'use client';

import React, { useState, useEffect } from 'react';
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
  wallet: string;
  image: string;
  expTotal: string;
  liveExp: string;
  miningpower: number;
  expYoutube: string; // YouTube-spezifische XP
  expTiktok: string;
  expInstagram: string;
  expFacebook: string;
  commented: string;
  liked: string;
  shared: string;
  saved: string; // YouTube verwendet "saved" nicht "subscribed"
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <p className="text-red-200 text-sm font-medium mb-3 text-center">
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
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center">
                <span className="text-red-300 font-medium text-center">
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
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <h4 className="text-red-300 font-bold mb-2">🔒 Wichtiger Hinweis</h4>
                <p className="text-red-200 text-sm leading-relaxed mb-3">
                  <TranslatedText text="Deine Wallet-Adresse wird " language={language} /><strong><TranslatedText text="dauerhaft" language={language} /></strong><TranslatedText text=" mit deinem Account verbunden und kann nicht mehr geändert werden." language={language} />
                </p>
                <div className="bg-red-600/20 border border-red-600/40 rounded-lg p-3">
                  <p className="text-red-100 text-xs">
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
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWalletInfoModal, setShowWalletInfoModal] = useState(false);
  const [showMiningPowerModal, setShowMiningPowerModal] = useState(false);
  const [showConfirmInitial, setShowConfirmInitial] = useState(false);
  const [showConfirmAfter, setShowConfirmAfter] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showLikesVerificationModal, setShowLikesVerificationModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretMessage, setSecretMessage] = useState('');
  const [walletInput, setWalletInput] = useState(userData.wallet || '');
  const [claimStatus, setClaimStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<{likes: number, shares: number, subscribes: number} | null>(null);
  const [afterValues, setAfterValues] = useState<{likes: number, shares: number, subscribes: number} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [expGained, setExpGained] = useState<{likes: number, shares: number, subscribes: number, total: number} | null>(null);

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

  // Konvertiere String-Werte zu Zahlen für Berechnungen
  const totalExp = parseInt(userData.expTotal) || 0;
  const youtubeExp = parseInt(userData.expYoutube) || 0;
  
  const { level, minExp, maxExp } = getLevelAndExpRange(totalExp);
  const currentLevelExp = totalExp - minExp;
  const levelRange = maxExp - minExp;
  const progressPercent = Math.round((currentLevelExp / levelRange) * 100);

  // YouTube Check Funktionen
  const getUUID = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('uuid') || 'Dawidfaithtest3736TT';
    }
    return 'Dawidfaithtest3736TT';
  };

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

  // LocalStorage laden beim Start
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const likeStored = localStorage.getItem("dfaith_youtube_likeStart");

      if (likeStored) {
        setInitialValues({
          likes: parseInt(likeStored),
          shares: 0,
          subscribes: 0
        });
        console.log('YouTube - LocalStorage Initial Values loaded:', {
          likes: parseInt(likeStored),
          shares: 0,
          subscribes: 0
        });
      }
    }
  }, []);

  // YouTube Like Check Functions (vereinfacht, nur Likes)
  const checkInitial = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      console.log('YouTube Initial Check - Request Data:', {
        uuid: uuid,
        username: userData.username,
        walletAddress: userData.wallet,
        action: 'initial_check',
        timestamp: new Date().toISOString(),
      });
      
      const response = await fetch('https://hook.eu2.make.com/fbjgkp7gpk51953fltejow1s47gq56cj', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: uuid,
          username: userData.username,
          walletAddress: userData.wallet,
          action: 'initial_check',
          timestamp: new Date().toISOString(),
        }),
      });
      
      console.log('YouTube Initial Check - Response Status:', response.status);
      console.log('YouTube Initial Check - Response OK:', response.ok);
      
      // Jetzt sollte die API korrektes JSON zurückgeben
      const data = await response.json();
      
      console.log('YouTube Initial Check - Response Data:', data);
      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);
      
      console.log('YouTube Initial Check - Parsed Data:', data);
      
      const likes = parseInt(data.likes) || 0;
      console.log('YouTube Initial Check - Processed Data:', {
        rawLikes: data.likes,
        likes: likes
      });
      
      setInitialValues({ likes, shares: 0, subscribes: 0 }); // Nur Likes relevant
      
      // LocalStorage setzen
      if (typeof window !== 'undefined') {
        localStorage.setItem("dfaith_youtube_likeStart", likes.toString());
      }
    } catch (error) {
      console.error('Fehler beim YouTube Check:', error);
    } finally {
      setLoading(false);
    }
  };

  // YouTube Claim Funktion (wie TikTok)
  const handleClaim = async () => {
    if (!userData.wallet && !walletInput) {
      setClaimStatus(language === 'de' ? '⚠️ Bitte hinterlege zuerst eine Wallet-Adresse.' : language === 'en' ? '⚠️ Please add a wallet address first.' : '⚠️ Najpierw dodaj adres portfela.');
      setTimeout(() => setClaimStatus(''), 3000);
      return;
    }

    setLoading(true);
    setClaimStatus(language === 'de' ? '🔄 Claim wird verarbeitet...' : language === 'en' ? '🔄 Processing claim...' : '🔄 Przetwarzanie nagrody...');
    
    try {
      const response = await fetch('https://hook.eu2.make.com/asb2kdhvudeqq4g56qeoxmbbqjyfwgwf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: userData.username,
          walletAddress: userData.wallet || walletInput,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('YouTube Claim Response Data:', responseData);
        
        // Status normalisieren
        const normalizedStatus = responseData.status?.toString().trim().toLowerCase();
        
        if (normalizedStatus === 'success') {
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
      setClaimStatus(language === 'de' ? '❌ Netzwerkfehler. Bitte überprüfe deine Verbindung.' : language === 'en' ? '❌ Network error. Please check your connection.' : '❌ Błäd sieci. Sprawdź połączenie.');
      setTimeout(() => {
        setClaimStatus('');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const checkAfter = async () => {
    setLoading(true);
    try {
      const uuid = getUUID();
      console.log('YouTube After Check - Request Data:', {
        uuid: uuid,
        username: userData.username,
        walletAddress: userData.wallet,
        action: 'after_check',
        timestamp: new Date().toISOString(),
      });
      
      const response = await fetch('https://hook.eu2.make.com/fbjgkp7gpk51953fltejow1s47gq56cj', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: uuid,
          username: userData.username,
          walletAddress: userData.wallet,
          action: 'after_check',
          timestamp: new Date().toISOString(),
        }),
      });
      
      // Jetzt sollte die API korrektes JSON zurückgeben
      const data = await response.json();
      
      console.log('YouTube After Check - Response Data:', data);
      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);
      
      const newLikes = parseInt(data.likes) || 0;
      console.log('YouTube After Check - Processed Data:', {
        rawLikes: data.likes,
        newLikes: newLikes,
        initialLikes: initialValues?.likes || 0,
        likeDiff: Math.max(0, newLikes - (initialValues?.likes || 0))
      });
      
      setAfterValues({ likes: newLikes, shares: 0, subscribes: 0 }); // Nur Likes relevant
      
      // EXP Berechnung (nur für Likes)
      const initialLikes = initialValues?.likes || 0;
      const likeDiff = Math.max(0, newLikes - initialLikes);
      
      const likeExp = likeDiff * 10; // 10 EXP pro Like
      const totalExp = likeExp;
      
      console.log('YouTube EXP Calculation:', {
        initialLikes,
        newLikes,
        likeDiff,
        likeExp,
        totalExp
      });
      
      // Nur EXP anzeigen wenn auch welche erhalten wurden
      if (totalExp > 0) {
        setExpGained({
          likes: likeExp,
          shares: 0,
          subscribes: 0,
          total: totalExp
        });
        setConfirmationMessage(language === 'de' ? '🎉 Glückwunsch! Du hast erfolgreich EXP gesammelt!' : language === 'en' ? '🎉 Congratulations! You have successfully collected EXP!' : '🎉 Gratulacje! Pomyślnie zebrałeś EXP!');
      } else {
        // Bei 0 EXP keine expGained setzen, sondern Fehlermeldung
        setConfirmationMessage(language === 'de' ? '❌ Keine neuen Likes gefunden! Bitte like das Video und versuche es erneut.' : language === 'en' ? '❌ No new likes found! Please like the video and try again.' : '❌ Nie znaleziono nowych polubień! Polub film i spróbuj ponownie.');
      }
      
      // Ergebnis-Modal öffnen
      setShowResultModal(true);
      
      // LocalStorage aktualisieren
      if (typeof window !== 'undefined') {
        localStorage.setItem("dfaith_youtube_likeEnd", newLikes.toString());
      }
    } catch (error) {
      console.error('Fehler beim YouTube After Check:', error);
    } finally {
      setLoading(false);
    }
  };

  // Secret Code Handler
  const handleSecretCheck = async () => {
    if (!secretCode.trim()) {
      setSecretMessage(language === 'de' ? '❌ Bitte gib einen Secret-Code ein!' : language === 'en' ? '❌ Please enter a secret code!' : '❌ Wprowadź kod secret!');
      return;
    }

    setSecretLoading(true);
    setSecretMessage('');

    try {
      // Hier wird später die API-Integration ergänzt
      const response = await fetch('/api/verify-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: secretCode.trim(),
          platform: 'youtube'
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setSecretMessage(language === 'de' ? '✅ Secret-Code erfolgreich bestätigt!' : language === 'en' ? '✅ Secret code successfully verified!' : '✅ Kod secret pomyślnie zweryfikowany!');
        // Hier könnte weitere Logik für erfolgreiche Verification ergänzt werden
      } else {
        setSecretMessage(language === 'de' ? '❌ Ungültiger Secret-Code!' : language === 'en' ? '❌ Invalid secret code!' : '❌ Nieprawidłowy kod secret!');
      }
    } catch (error) {
      console.error('Secret verification error:', error);
      setSecretMessage(language === 'de' ? '❌ Fehler bei der Überprüfung. Versuche es erneut.' : language === 'en' ? '❌ Verification failed. Try again.' : '❌ Weryfikacja nie powiodła się. Spróbuj ponownie.');
    } finally {
      setSecretLoading(false);
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
        <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-3xl p-6 w-full max-w-sm text-center text-white shadow-2xl relative">
          {/* Zurück Button auf der Karte */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 bg-red-600/20 border border-red-500/50 rounded-full text-white hover:bg-red-600/40 transition-all duration-200 flex items-center justify-center z-10 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* Username */}
          <div className="text-2xl font-bold mb-4 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">{userData.username}</div>
          
          {/* Profile Image */}
          <img 
            src={userData.image || 'https://via.placeholder.com/100'} 
            alt="Profilbild"
            className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
            loading="lazy"
          />
          
          {/* Level Box */}
          <div className="bg-black/50 border border-red-500/50 rounded-2xl p-4 mb-4">
            {/* Level und EXP Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-baseline gap-2">
                <TranslatedText text="Level" language={language} className="text-xl font-bold text-white" />
                <span className="text-2xl font-black bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">{level}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">{totalExp.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
                aria-label="Deine EXP-Quellen"
                title="Deine EXP-Quellen"
              >
                <FaInfoCircle className="w-3.5 h-3.5 text-white animate-bounce" />
              </button>
            </div>
            
            {/* Progress Bar mit Animation */}
            <div className="relative bg-black/60 border border-red-500/30 rounded-full h-4 overflow-hidden mb-4 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600 transition-all duration-1000 ease-out relative shadow-lg"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                {progressPercent}%
              </div>
            </div>
            
            {/* Mining Power mit YouTube Design */}
            <button 
              onClick={() => setShowMiningPowerModal(true)}
              className="w-full bg-black/50 border border-red-500/50 rounded-xl p-3 hover:bg-black/70 hover:border-red-500/70 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl animate-bounce">⛏</span>
                <div className="text-center">
                  <div className="text-red-300 text-sm font-medium">
                    <TranslatedText text="Mining Power" language={language} />
                  </div>
                  <div className="text-red-200 text-lg font-bold">+{userData.miningpower} D.Faith</div>
                </div>
              </div>
            </button>
          </div>
          
          {/* YouTube Check */}
          <div className="bg-black/50 border border-red-500/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center font-bold text-lg bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                <svg className="w-6 h-6 mr-2 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <TranslatedText text="YouTube Check" language={language} />
              </div>
              {!showLeaderboardModal && (
                <button
                  type="button"
                  onClick={() => setShowLeaderboardModal(true)}
                  className="relative group w-8 h-8 rounded-full bg-white text-red-600 shadow-lg hover:bg-red-50 active:scale-95 hover:scale-105 transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 hover:ring-4 hover:ring-red-200/60 hover:shadow-red-300/60"
                  aria-label={language === 'de' ? "Leaderboard öffnen" : language === 'en' ? "Open Leaderboard" : "Otwórz ranking"}
                  title={language === 'de' ? "Leaderboard öffnen" : language === 'en' ? "Open Leaderboard" : "Otwórz ranking"}
                >
                  <span className="absolute -inset-1 rounded-full bg-red-400/20 blur-sm opacity-60 group-hover:opacity-80 transition pointer-events-none"></span>
                  <span className="inline-block animate-bounce">🏆</span>
                </button>
              )}
            </div>
            
            <div className="space-y-2 text-sm text-white">
              <div className="flex justify-between">
                <span>👍 <TranslatedText text="Like" language={language} /></span>
                <span>{userData.liked === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span>💬 <TranslatedText text="Kommentar" language={language} /></span>
                <span>{userData.commented === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
              <div className="flex justify-between">
                <span> <TranslatedText text="Secret" language={language} /></span>
                <span>{userData.saved === 'true' ? '✅' : '❌'} +10 EXP</span>
              </div>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowLikesVerificationModal(true)}
              className="relative flex-1 bg-gradient-to-r from-red-500 via-red-600 to-orange-600 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-red-500/25 border border-red-400/30"
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

      {/* Sammle EXP (Like Check) Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                ✨ <TranslatedText text="YouTube Shorts Verification" language={language} />
              </h2>
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="text-gray-400 hover:text-red-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="font-semibold mb-3 text-red-200">
                1️⃣ <TranslatedText text="Bestätige zuerst deine aktuellen Like-Anzahl" language={language} />
              </p>
              <button 
                onClick={() => setShowConfirmInitial(true)}
                disabled={initialValues !== null || loading}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  initialValues !== null || loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-white rounded-full"></div>
                    <span>Erfasse Daten...</span>
                  </div>
                ) : initialValues !== null ? '✅ Werte bereits erfasst' : <TranslatedText text="✅ Check aktuelle Likes" language={language} />}
              </button>
              {initialValues && (
                <div className="bg-black/30 border border-red-500/30 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-300">👍 Likes:</span>
                    <span className="font-bold text-red-200">{initialValues.likes}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="font-semibold mb-3 text-red-200">
                2️⃣ <TranslatedText text="Like das YouTube Short!" language={language} />
              </p>
              <button 
                onClick={() => setShowConfirmAfter(true)}
                disabled={loading || !initialValues || !!afterValues}
                className={`w-full p-3 rounded-xl font-bold transition-all duration-300 ${
                  loading || !initialValues
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : afterValues ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white transform hover:scale-105'
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
                    (language === 'de' ? '✅ Neue Likes erfasst' : language === 'en' ? '✅ New likes recorded' : '✅ Nowe lajki zarejestrowane') : 
                    (language === 'de' ? '✅ Check neue Likes' : language === 'en' ? '✅ Check new likes' : '✅ Sprawdź nowe lajki')}
              </button>
              {afterValues && (
                <div className="bg-black/30 border border-orange-500/30 rounded-xl p-3 mt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-300">👍 Likes:</span>
                    <span className="font-bold text-red-200">{afterValues.likes}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-300/30 rounded-2xl p-4 mb-6">
              <p className="text-sm text-red-200 font-medium">
                💡 <TranslatedText text="Like das neueste YouTube Short auf" language={language} /> <strong>@dawidfaith</strong>!
              </p>
              <a 
                href="https://www.youtube.com/@dawidfaith"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 text-red-300 hover:text-red-200 transition-colors"
              >
                📺 YouTube besuchen
              </a>
            </div>
            
            <button 
              onClick={() => setShowSubscribeModal(false)}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl py-3 font-bold transition-all hover:from-red-600 hover:to-orange-600"
            >
              ✅ <TranslatedText text="Schließen" language={language} />
            </button>
          </div>
        </div>
      )}

      {/* Claim Modal (TikTok Style) */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                <TranslatedText text="D.FAITH Claimen" language={language} />
              </h2>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-gray-400 hover:text-red-400 text-2xl transition-colors"
                disabled={loading}
              >
                ×
              </button>
            </div>
            
            <div className="text-center mb-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <img
                  src="/D.FAITH.png"
                  alt="D.FAITH Logo"
                  className="w-20 h-20 coin-flip"
                  style={{ animation: 'coin-flip 2s linear infinite' }}
                />
                <style>{`
                  @keyframes coin-flip {
                    0% { transform: rotateY(0deg); }
                    100% { transform: rotateY(360deg); }
                  }
                `}</style>
              </div>
              <p className="text-gray-300 mb-4">
                <TranslatedText text="Claime deine verdienten D.FAITH Token für YouTube Aktivitäten!" language={language} />
              </p>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <p className="text-red-200 text-sm">
                  ⛏️ <strong><TranslatedText text="Mining Power:" language={language} /></strong> +{userData.miningpower} D.FAITH <TranslatedText text="pro Claim" language={language} />
                </p>
              </div>
              
              {/* Status Message */}
              {claimStatus && (
                <div className="mb-6 p-3 bg-black/40 border border-gray-600 rounded-lg">
                  <p className="text-white text-sm font-medium">{claimStatus}</p>
                </div>
              )}
              
              {/* Wallet Warning */}
              {!userData.wallet && !walletInput && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                  <p className="text-yellow-200 text-sm">
                    ⚠️ <TranslatedText text="Bitte hinterlege zuerst eine Wallet-Adresse im Wallet Tab" language={language} />
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClaimModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-3 font-bold transition-all"
                disabled={loading}
              >
                <TranslatedText text="Abbrechen" language={language} />
              </button>
              <button 
                disabled={(!userData.wallet && !walletInput) || loading}
                onClick={handleClaim}
                className={`flex-1 rounded-xl py-3 font-bold transition-all ${
                  (!userData.wallet && !walletInput) || loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                }`}
              >
                {loading ? '🔄' : '🪙'} <TranslatedText text="Claimen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal (EXP Info) */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                <TranslatedText text="EXP Information" language={language} />
              </h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-red-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <h3 className="text-red-300 font-bold mb-4"><TranslatedText text="✨ Deine EXP-Quellen" language={language} /></h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 border-l-4 border-red-600 pl-3 bg-red-500/10 py-2 rounded-r-xl">
                    <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <div>
                      <div className="font-bold text-red-300">YouTube</div>
                      <div className="text-red-200 font-semibold">{youtubeExp} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-red-600 pl-3 bg-red-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-6 h-6" />
                    <div>
                      <div className="font-bold text-red-300">Facebook</div>
                      <div className="text-red-200 font-semibold">{userData.expFacebook} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-red-600 pl-3 bg-red-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-red-300">TikTok</div>
                      <div className="text-red-200 font-semibold">{userData.expTiktok} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-red-600 pl-3 bg-red-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-red-300">Instagram</div>
                      <div className="text-red-200 font-semibold">{userData.expInstagram} EXP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-l-4 border-red-600 pl-3 bg-red-500/10 py-2 rounded-r-xl">
                    <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Live" className="w-6 h-6 rounded-full" />
                    <div>
                      <div className="font-bold text-red-300">Live</div>
                      <div className="text-red-200 font-semibold">{userData.liveExp} EXP</div>
                    </div>
                  </div>
                  <div className="border-t border-gray-600 pt-3 mt-4">
                    <div className="flex justify-between">
                      <span className="text-white font-bold"><TranslatedText text="Gesamt EXP" language={language} /></span>
                      <span className="text-white font-bold">{totalExp}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-300/30 rounded-2xl p-4 mb-6">
                <p className="text-sm text-red-200 font-medium">💡 <TranslatedText text="Mehr EXP = schnelleres Level-Up. Nutze alle Plattformen!" language={language} /> 🚀</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl py-3 font-bold transition-all hover:from-red-600 hover:to-orange-600"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
            </button>
          </div>
        </div>
      )}

      {/* Mining Power Modal */}
      {showMiningPowerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                ⛏️ <TranslatedText text="Mining Power" language={language} />
              </h2>
              <button
                onClick={() => setShowMiningPowerModal(false)}
                className="text-gray-400 hover:text-red-400 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
              <p className="text-red-200 leading-relaxed mb-4">
                <TranslatedText text="Deine" language={language} /> <strong className="text-red-400">Mining Power</strong> <TranslatedText text="bestimmt, wie viele D.FAITH Token du pro YouTube Claim erhältst." language={language} />
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <span className="text-xl text-green-400">$</span>
                  <div>
                    <div className="font-bold text-red-300"><TranslatedText text="Marketing Budget" language={language} /></div>
                    <div className="text-sm text-red-400"><TranslatedText text="Budget pro User für YouTube" language={language} /></div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <img 
                    src={userData.image} 
                    alt="Profile" 
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-bold text-orange-300"><TranslatedText text="Dein Level" language={language} /></div>
                    <div className="text-sm text-orange-400">Level {level}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                  <img src="/D.FAITH.png" alt="D.FAITH" className="w-5 h-5 object-contain" />
                  <div>
                    <div className="font-bold text-yellow-300"><TranslatedText text="D.FAITH Kurs" language={language} /></div>
                    <div className="text-sm text-yellow-400"><TranslatedText text="Aktueller Marktpreis" language={language} /></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6">
              <p className="text-red-200 font-medium text-center">
                ⚡ <strong><TranslatedText text="Aktuell:" language={language} /></strong> +{userData.miningpower} D.FAITH <TranslatedText text="pro Claim" language={language} />
              </p>
            </div>
            
            <button 
              onClick={() => setShowMiningPowerModal(false)}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl py-3 font-bold transition-all hover:from-red-600 hover:to-orange-600"
            >
              ✅ <TranslatedText text="Verstanden" language={language} />
            </button>
          </div>
        </div>
      )}

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
                  const names = [e.instagram, e.tiktok, e.facebook, e.name, e.handle].filter(Boolean) as string[];
                  const q = lbSearch.toLowerCase();
                  return names.some(n => n.toLowerCase().includes(q));
                }).map((e: any) => {
                  const namesDetailed = [
                    e.instagram ? { label: e.instagram as string } : null,
                    e.tiktok ? { label: e.tiktok as string } : null,
                    e.facebook ? { label: e.facebook as string } : null,
                    e.name ? { label: e.name as string } : null,
                    e.handle ? { label: e.handle as string } : null,
                  ].filter(Boolean) as { label: string }[];
                  const primary = (e.instagram || e.tiktok || e.facebook || e.name || e.handle || '-') as string;
                  const prize = (lbData?.prizes || []).find((p: any) => p.position === e.rank);
                  const prizeText = prize ? (prize.value || prize.description || '') : '';
                  const prizeDisplay = prizeText ? prizeText : '-';
                  return (
                    <div key={e.rank} className="border-b border-zinc-800/70 last:border-b-0">
                      <div className="px-3 py-2 grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_5.25rem] gap-3 items-center">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono">#{e.rank}</span>
                        <div className="flex items-center gap-2 w-full">
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
                        <span className="text-amber-300 text-sm font-mono tabular-nums text-center">{e.expTotal.toLocaleString()}</span>
                        <span className="text-emerald-300 text-xs font-medium tabular-nums text-right truncate max-w-full" title={prizeDisplay}>
                          {prizeDisplay}
                        </span>
                      </div>
                      {lbOpenRow === e.rank && namesDetailed.length > 1 && (
                        <div className="pl-[3.25rem] pr-3 pb-2 flex flex-col gap-1 items-start">
                          {namesDetailed.map((n, idx) => (
                            <div key={idx} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-[11px] w-full text-left whitespace-normal break-words">
                              {n.label}
                            </div>
                          ))}
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

      {/* Confirm Initial Modal */}
      {showConfirmInitial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">⚠️</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">
              <TranslatedText text="Bestätigung erforderlich" language={language} />
            </h2>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-red-200 leading-relaxed">
                <TranslatedText text="Deine aktuellen Like-Zahlen werden jetzt gespeichert. Danach kannst du das Video liken." language={language} />
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmInitial(false);
                  checkInitial();
                }}
                className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
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
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-orange-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">🎯</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">
              <TranslatedText text="Finale Bestätigung" language={language} />
            </h2>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-4">
              <p className="text-orange-200 leading-relaxed">
                <TranslatedText text="Jetzt werden die neuen Like-Zahlen überprüft. Stelle sicher, dass du das Video geliked hast!" language={language} />
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmAfter(false);
                  checkAfter();
                }}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
              >
                ✅ <TranslatedText text="Ja, check Likes" language={language} />
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

      {/* Result Modal (Erfolg/Misserfolg) */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`bg-gradient-to-br from-black via-gray-900 to-black border ${expGained ? 'border-green-500/30' : 'border-red-500/30'} rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl`}>
            <div className="text-5xl mb-4 text-center">
              {expGained ? '🎉' : '❌'}
            </div>
            <h2 className={`text-xl font-bold mb-4 text-white text-center`}>
              {expGained ? (
                <TranslatedText text="EXP Erfolgreich Erhalten!" language={language} />
              ) : (
                <TranslatedText text="Keine Neuen Likes Gefunden" language={language} />
              )}
            </h2>
            
            {expGained ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-green-300">👍 Like Bonus:</span>
                    <span className="font-bold text-green-200">+{expGained.likes} EXP</span>
                  </div>
                  <div className="border-t border-gray-600 pt-2 flex justify-between">
                    <span className="text-green-300 font-bold">Gesamt:</span>
                    <span className="text-green-200 font-bold">+{expGained.total} EXP</span>
                  </div>
                </div>
                <p className="text-green-200 text-sm text-center">
                  <TranslatedText text="Glückwunsch! Du hast erfolgreich EXP gesammelt!" language={language} />
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <p className="text-red-200 leading-relaxed text-center">
                  {confirmationMessage}
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    // Nur EXP-Verification Daten löschen, Login-Daten behalten
                    localStorage.removeItem("dfaith_youtube_likeStart");
                    localStorage.removeItem("dfaith_youtube_likeEnd");
                    
                    // Seite neu laden
                    window.location.href = window.location.pathname + '?tab=youtube' + (window.location.search.includes('uuid=') ? '&' + window.location.search.split('?')[1] : '');
                  }
                }}
                className={`flex-1 bg-gradient-to-r ${expGained ? 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' : 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'} text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105`}
              >
                🔄 <TranslatedText text="Neu laden" language={language} />
              </button>
              <button 
                onClick={() => {
                  setShowResultModal(false);
                  setExpGained(null);
                  setConfirmationMessage('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ <TranslatedText text="Schließen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Likes Verification Modal - Auswahl */}
      {showLikesVerificationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-red-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">✨</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">
              <TranslatedText text="Sammle EXP" language={language} />
            </h2>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-red-200 leading-relaxed text-center mb-4">
                <TranslatedText text="Wähle eine Option zum EXP sammeln:" language={language} />
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setShowLikesVerificationModal(false);
                    setShowSubscribeModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
                >
                  👍 <TranslatedText text="Likes Verification" language={language} />
                </button>
                <button 
                  onClick={() => {
                    setShowLikesVerificationModal(false);
                    setShowSecretModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105"
                >
                    <TranslatedText text="Secret finden" language={language} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLikesVerificationModal(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ <TranslatedText text="Schließen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-purple-500/30 rounded-2xl p-8 w-96 max-w-md mx-4 shadow-2xl">
            <div className="text-5xl mb-4 text-center">🔐</div>
            <h2 className="text-xl font-bold mb-4 text-white text-center">
              <TranslatedText text="Secret Code eingeben" language={language} />
            </h2>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
              <div className="text-center mb-4">
                <p className="text-purple-200 font-semibold mb-2">
                  🔍 <TranslatedText text="Suche die versteckten Buchstaben im YouTube Short!" language={language} />
                </p>
                <p className="text-purple-300 text-sm leading-relaxed">
                  <TranslatedText text="Füge die gefundenen Buchstaben zusammen und gib den Code hier ein, um zusätzliche EXP zu erhalten!" language={language} />
                </p>
              </div>
              <input
                type="text"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder={language === 'de' ? 'Gefundenen Code hier eingeben...' : language === 'en' ? 'Enter found code here...' : 'Wprowadź znaleziony kod...'}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                disabled={secretLoading}
              />
              {secretMessage && (
                <div className={`mt-3 p-2 rounded-xl text-sm text-center ${secretMessage.includes('✅') ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                  {secretMessage}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleSecretCheck}
                disabled={secretLoading || !secretCode.trim()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white p-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
              >
                {secretLoading ? (
                  <>🔄 <TranslatedText text="Überprüfe..." language={language} /></>
                ) : (
                  <>✅ <TranslatedText text="Code prüfen" language={language} /></>
                )}
              </button>
              <button 
                onClick={() => {
                  setShowSecretModal(false);
                  setSecretCode('');
                  setSecretMessage('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all duration-300"
              >
                ❌ <TranslatedText text="Schließen" language={language} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
          setMessage(language === 'de' ? '❌ Teilnahme noch nicht erkannt. Bitte like, kommentiere und abonniere das neueste YouTube Short.' : language === 'en' ? '❌ Participation not detected yet. Please like, comment and subscribe to the latest YouTube Short.' : '❌ Udział nie został jeszcze wykryty. Polub, skomentuj i zasubskrybuj najnowszy YouTube Short.');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-red-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Kompakter Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-full mb-4 shadow-xl">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent mb-2">
            YouTube Creator Hub
          </h1>
          
          <p className="text-sm text-gray-300 leading-relaxed">
            <TranslatedText text="Interagiere mit YouTube Shorts und verdiene D.FAITH Token!" language={language} />
          </p>
        </div>

        {/* Kompakte Action Cards */}
        <div className="space-y-4 mb-6">
          {/* Schritt 1 - Teilnahme bestätigen */}
          <button
            onClick={() => setIsCheckModalOpen(true)}
            className="w-full bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all duration-300 transform hover:scale-105"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <div className="text-left flex-1">
                <h3 className="text-white font-bold text-base mb-1">
                  <TranslatedText text="Teilnahme Bestätigen" language={language} />
                </h3>
                <p className="text-gray-400 text-xs leading-tight">
                  <TranslatedText text="YouTube Short kommentiert? Bestätige deine Teilnahme!" language={language} />
                </p>
              </div>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* YouTube Link - Kompakt */}
        <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <div className="text-center">
            <p className="text-red-300 text-sm font-medium mb-3">
            <TranslatedText text="Neueste YouTube Shorts ansehen:" language={language} />
            </p>
            <a 
              href="https://www.youtube.com/@dawidfaith"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span>@dawidfaith</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 7h8.586L5.293 17.293l1.414 1.414L17 8.414V17h2V5H7v2z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Anleitung - Kompakt */}
        <div className="bg-gradient-to-r from-red-600/10 to-red-800/10 border border-red-500/20 rounded-xl p-4">
          <h3 className="text-base font-semibold text-red-300 mb-3 flex items-center gap-2">
            <FaInfoCircle />
            <TranslatedText text="So funktioniert's:" language={language} />
          </h3>
          <div className="space-y-2 text-gray-300 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-red-400 font-bold">1.</span>
              <TranslatedText text="YouTube Short liken & kommentieren" language={language} />
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-400 font-bold">2.</span>
              <TranslatedText text="Teilnahme bestätigen" language={language} />
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-400 font-bold">3.</span>
              <TranslatedText text="Dashboard login & Token claimen" language={language} />
            </div>
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