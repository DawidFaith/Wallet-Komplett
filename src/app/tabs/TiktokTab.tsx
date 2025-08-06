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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              TikTok Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Adresse
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              disabled={isLoading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading || !username.trim() || !walletAddress.trim()}
            >
              {isLoading ? 'Lädt...' : 'Bestätigen'}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">D.FAITH TikTok Claim</h1>
          <p className="text-gray-400 text-lg">Verbinden Sie Ihr TikTok-Konto und beanspruchen Sie Ihre D.FAITH Token</p>
        </div>

        {/* Main Dashboard */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Check Section */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-lg p-6 border border-blue-500/30">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Claim Prüfen</h3>
                <p className="text-gray-300 mb-4">
                  Überprüfen Sie Ihren aktuellen Claim-Status und verfügbare Token
                </p>
                <button
                  onClick={() => setIsCheckModalOpen(true)}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-lg"
                >
                  Status Prüfen
                </button>
              </div>
            </div>

            {/* Login Section */}
            <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 rounded-lg p-6 border border-green-500/30">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V11L19 9H21ZM19 21H5V3H13V9H19V21Z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Anmelden</h3>
                <p className="text-gray-300 mb-4">
                  Melden Sie sich an, um Zugang zu Ihrem Dashboard zu erhalten
                </p>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-lg"
                >
                  Jetzt Anmelden
                </button>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`mt-6 p-4 rounded-lg text-center ${
              message.includes('erfolgreich') 
                ? 'bg-green-600/20 border border-green-500/30 text-green-300' 
                : 'bg-red-600/20 border border-red-500/30 text-red-300'
            }`}>
              {message}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 p-6 bg-gray-700/30 rounded-lg border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">Wie funktioniert es?</h4>
            <div className="space-y-2 text-gray-300">
              <p>• <strong>Claim Prüfen:</strong> Überprüfen Sie Ihren aktuellen Token-Status</p>
              <p>• <strong>Anmelden:</strong> Verbinden Sie Ihr TikTok-Konto mit Ihrer Wallet</p>
              <p>• Stellen Sie sicher, dass Ihre Wallet-Adresse korrekt ist</p>
              <p>• TikTok-Username sollte mit @ beginnen (z.B. @username)</p>
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
        title="TikTok Konto Anmelden"
        onSubmit={handleLogin}
        isLoading={isLoading}
      />
    </div>
  );
}