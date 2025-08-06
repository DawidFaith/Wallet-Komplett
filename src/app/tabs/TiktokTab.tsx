'use client';

import { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (username: string, walletAddress: string) => void;
  isLoading: boolean;
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

export default function TiktokTab() {
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

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
    await sendWebhookRequest(
      username,
      walletAddress,
      'https://hook.eu2.make.com/gz8xf59sl63lb5gtdirwcrvvs0f17u7f'
    );
    setIsLoginModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-2xl">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                D.FAITH
              </h1>
              <p className="text-xl text-gray-300 font-medium">TikTok Claim Dashboard</p>
            </div>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Verbinden Sie Ihr TikTok-Konto und beanspruchen Sie Ihre D.FAITH Token mit unserem innovativen Claim-System
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Check Status Card */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-black/80 border border-pink-500/30 rounded-3xl p-8 backdrop-blur-sm hover:border-pink-500/50 transition-all duration-300">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Claim Status Prüfen</h3>
                  <p className="text-gray-300 mb-8 leading-relaxed">
                    Überprüfen Sie Ihren aktuellen Claim-Status und sehen Sie verfügbare Token-Belohnungen
                  </p>
                  <button
                    onClick={() => setIsCheckModalOpen(true)}
                    className="w-full px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-2xl hover:from-pink-600 hover:to-purple-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                  >
                    Status Überprüfen
                  </button>
                </div>
              </div>
            </div>

            {/* Login Card */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-black/80 border border-cyan-500/30 rounded-3xl p-8 backdrop-blur-sm hover:border-cyan-500/50 transition-all duration-300">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Dashboard Login</h3>
                  <p className="text-gray-300 mb-8 leading-relaxed">
                    Melden Sie sich an und erhalten Sie Zugang zu Ihrem persönlichen TikTok-Wallet Dashboard
                  </p>
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-2xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                  >
                    Jetzt Anmelden
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`mb-8 p-6 rounded-2xl text-center border backdrop-blur-sm ${
              message.includes('erfolgreich') 
                ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <div className="flex items-center justify-center space-x-3">
                {message.includes('erfolgreich') ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                )}
                <span className="font-medium">{message}</span>
              </div>
            </div>
          )}

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-black/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Schnell & Sicher</h4>
              <p className="text-gray-400 text-sm">Blitzschnelle Verarbeitung mit höchster Sicherheit für Ihre Token</p>
            </div>

            <div className="bg-black/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Automatisch</h4>
              <p className="text-gray-400 text-sm">Vollautomatische Claim-Verarbeitung ohne manuelle Eingriffe</p>
            </div>

            <div className="bg-black/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Verifiziert</h4>
              <p className="text-gray-400 text-sm">Alle Transaktionen werden blockchain-verifiziert und dokumentiert</p>
            </div>
          </div>
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