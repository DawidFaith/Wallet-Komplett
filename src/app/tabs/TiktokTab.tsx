'use client';

import { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (username: string, walletAddress: string) => void;
  isLoading: boolean;
}

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

function Modal({ isOpen, onClose, title, onSubmit, isLoading }: ModalProps) {
  const [username, setUsername] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && walletAddress.trim()) {
      onSubmit(username.trim(), walletAddress.trim());
    }
  };

  const handleClose = () => {
    setUsername('');
    setWalletAddress('');
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
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="w-full px-4 py-3 bg-black/50 border border-pink-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-pink-300 mb-3">
              Wallet Adresse
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-black/50 border border-pink-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              required
              disabled={isLoading}
            />
          </div>
          
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
              disabled={isLoading || !username.trim() || !walletAddress.trim()}
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
      </div>
    </div>
  );
}

function UserCard({ userData }: { userData: UserData }) {
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

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-8"
      style={{ 
        background: 'linear-gradient(135deg, #ff0050, #fe2d92, #25f4ee)',
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
              <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">{level}</span>
            </div>
            
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white">{userData.expTotal.toLocaleString()}</span>
              <span className="text-sm text-gray-400">/ {maxExp.toLocaleString()}</span>
            </div>
            
            <button className="bg-pink-500 hover:bg-pink-600 text-white w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200">
              i
            </button>
          </div>
          
          {/* Progress Bar mit Animation */}
          <div className="relative bg-gray-800/60 rounded-full h-4 overflow-hidden mb-4 shadow-inner border border-gray-700/50">
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
          <button className="w-full bg-gradient-to-r from-pink-500/20 to-cyan-500/20 rounded-xl p-3 border border-pink-500/30 hover:from-pink-500/30 hover:to-cyan-500/30 hover:border-pink-500/50 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer">
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
          <div className="font-bold text-lg mb-3 text-white">✅ TikTok Check</div>
          
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
          <button className="relative flex-1 bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 px-4 py-4 rounded-2xl font-bold text-sm text-white overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 border border-pink-400/30">
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center gap-1">
              <span className="text-xl animate-pulse">✨</span>
              <span className="tracking-wider">Sammle EXP</span>
            </div>
          </button>
          <button className="relative flex-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 px-4 py-4 rounded-2xl font-bold text-sm text-gray-900 overflow-hidden group transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 border border-cyan-300/50">
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center gap-1">
              <span className="text-xl animate-bounce">🪙</span>
              <span className="tracking-wider">Claim</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TiktokTab() {
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

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
    await sendWebhookRequest(
      username,
      walletAddress,
      'https://hook.eu2.make.com/6bp285kr8y9hoxk39j1v52qt2k4rt4id'
    );
    setIsCheckModalOpen(false);
  };

  const handleLogin = async (username: string, walletAddress: string) => {
    try {
      setIsLoading(true);
      setMessage('');

      const response = await fetch('https://hook.eu2.make.com/gz8xf59sl63lb5gtdirwcrvvs0f17u7f', {
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
        
        // Prüfe ob Benutzerdaten im Response sind
        if (responseData && responseData.username) {
          // Lade echte Userdaten aus der Response
          setUserData({
            username: responseData.username || username.replace('@', ''),
            image: responseData.image?.startsWith("http://") 
              ? responseData.image.replace("http://", "https://") 
              : responseData.image || "https://via.placeholder.com/100",
            expTotal: parseInt(responseData.expTotal) || 0,
            expTiktok: responseData.expTiktok || 0,
            expFacebook: responseData.expFacebook || 0,
            expStream: responseData.expStream || 0,
            liveNFTBonus: responseData.liveNFTBonus || 0,
            miningpower: responseData.miningpower || 0,
            liked: responseData.liked || 'false',
            commented: responseData.commented || 'false',
            saved: responseData.saved || false,
            wallet: responseData.wallet || walletAddress
          });
          
          setIsLoggedIn(true);
          setMessage('Login erfolgreich! Dashboard wird geladen...');
          
          // Kurz warten dann Message ausblenden
          setTimeout(() => {
            setMessage('');
          }, 1500);
        } else {
          setMessage('Login erfolgreich gesendet!');
        }
      } else {
        setMessage('Fehler beim Senden der Anfrage. Bitte versuchen Sie es erneut.');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setMessage('Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.');
    } finally {
      setIsLoading(false);
    }
    
    setIsLoginModalOpen(false);
  };

  // Wenn eingeloggt, zeige Userkarte
  if (isLoggedIn && userData) {
    return <UserCard userData={userData} />;
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
        {/* Compact Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              D.FAITH TikTok Claim
            </h1>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-black/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
          {/* Action Buttons */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setIsCheckModalOpen(true)}
              className="flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl hover:border-pink-500/50 transition-all group"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-white font-bold">Claim Prüfen</h3>
                <p className="text-gray-400 text-sm">Status überprüfen</p>
              </div>
            </button>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-xl hover:border-cyan-500/50 transition-all group"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-white font-bold">Dashboard Login</h3>
                <p className="text-gray-400 text-sm">Anmelden & Zugang</p>
              </div>
            </button>
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
        onClose={() => setIsCheckModalOpen(false)}
        title="Claim Status Prüfen"
        onSubmit={handleCheck}
        isLoading={isLoading}
      />

      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        title="Dashboard Login"
        onSubmit={handleLogin}
        isLoading={isLoading}
      />
    </div>
  );
}