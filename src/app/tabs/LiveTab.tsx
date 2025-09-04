"use client";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Button } from "../../../components/ui/button";
import { FaTicketAlt, FaLock, FaTimes } from "react-icons/fa";

export default function LiveTab() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const account = useActiveAccount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account?.address) {
      setResult({
        success: false,
        message: "Bitte verbinde zuerst deine Wallet"
      });
      return;
    }

    if (!code.trim()) {
      setResult({
        success: false,
        message: "Bitte gib einen Code ein"
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('https://livecodes-gules.vercel.app/api/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          walletAddress: account.address
        })
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setCode(''); // Reset form on success
        // Modal nach erfolgreichem Code automatisch nach 3 Sekunden schließen
        setTimeout(() => {
          setShowCodeModal(false);
          setResult(null);
        }, 3000);
      }
      
    } catch (error) {
      setResult({
        success: false,
        message: 'Verbindungsfehler. Bitte versuche es später erneut.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Iframe Bereich */}
      <div className="flex-1 min-h-0">
        <iframe 
          src="https://bnds.us/9u4nop"
          className="w-full h-full border-0"
          title="Live Auftritte"
          allowFullScreen
          style={{ minHeight: 'calc(100vh - 200px)' }}
        />
      </div>

      {/* Schwebendes Code-Symbol - Unten rechts */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowCodeModal(!showCodeModal)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white relative shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 rounded-full w-16 h-16 p-0 flex items-center justify-center border border-purple-400/20"
        >
          <FaTicketAlt className="text-xl" />
          {/* Pulsierender Effekt für Aufmerksamkeit */}
          <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping"></div>
        </Button>
      </div>

      {/* Code-Eingabe Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ position: 'fixed' }}>
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setShowCodeModal(false)}
          ></div>
          <div className="relative bg-zinc-900 border border-zinc-700 w-full max-w-md mx-4 rounded-xl shadow-2xl">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <FaTicketAlt className="text-purple-400 text-xl" />
                  <h3 className="text-xl font-bold text-white">Live Code Einlösen</h3>
                </div>
                <Button
                  onClick={() => setShowCodeModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 border border-zinc-600 hover:border-red-500 p-2 rounded-lg transition-all duration-200"
                >
                  <FaTimes className="text-lg" />
                </Button>
              </div>

              {/* Wichtiger Hinweis für Social Media Teilnahme */}
              <div className="mb-4 p-4 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-amber-400 text-lg mt-0.5">⚠️</span>
                  <div className="text-amber-200 text-sm">
                    <p className="font-semibold mb-2">Wichtiger Hinweis:</p>
                    <p>Mindestens 1 Teilnahme bei TikTok, Instagram oder Facebook ist erforderlich, um Live Codes einzulösen.</p>
                  </div>
                </div>
              </div>

              {/* Info über Live Code Vergabe */}
              <div className="mb-6 p-4 bg-purple-900/30 border border-purple-600/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-purple-400 text-lg mt-0.5">🎤</span>
                  <div className="text-purple-200 text-sm">
                    <p className="font-semibold mb-2">Live Codes Info:</p>
                    <p>Live Codes werden exklusiv bei Live Konzerten und Auftritten von Dawid Faith vergeben. Sei dabei um deine Codes zu erhalten!</p>
                  </div>
                </div>
              </div>

              {/* Wallet-Verbindungswarnung */}
              {!account?.address && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-600/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaLock className="text-red-400 text-lg" />
                    <div className="text-red-200 text-sm">
                      <p className="font-semibold">Keine Wallet verbunden</p>
                      <p>Bitte verbinde deine Wallet, um Codes einzulösen.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Code-Eingabe Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white font-medium mb-2">🎫 Live Code</label>
                  <input
                    type="text"
                    placeholder="Code eingeben (DF12345678)"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 transition-all duration-200"
                    maxLength={20}
                    disabled={loading}
                  />
                </div>
                
        <Button
                  type="submit"
                  disabled={loading || !account?.address}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Verarbeite...
                    </div>
                  ) : !account?.address ? (
                    <div className="flex items-center gap-2 justify-center">
                      <FaLock className="text-lg" />
                      Wallet verbinden erforderlich
                    </div>
                  ) : (
          '🎫 Code einlösen (+150 Live EXP)'
                  )}
                </Button>
              </form>
              
              {/* Ergebnis Anzeige */}
              {result && (
                <div className={`mt-6 p-4 rounded-lg border-2 ${
                  result.success 
                    ? 'bg-green-900/30 border-green-500 text-green-400' 
                    : 'bg-red-900/30 border-red-500 text-red-400'
                }`}>
                  {result.success ? (
                    <div className="text-center">
                      <p className="text-lg font-bold">🎉 Erfolgreich!</p>
                      <p className="text-xl font-bold text-green-300 mt-2">
                        +150 Live EXP wurde deinem Konto gutgeschrieben! 🎵
                      </p>
                      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded text-blue-200 text-sm">
                        <p className="font-semibold">ℹ️ Hinweis:</p>
                        <p>Die EXP werden erst bei der nächsten Teilnahme auf TikTok, Instagram oder Facebook sichtbar.</p>
                      </div>
                      {result.data && (
                        <p className="text-sm mt-3 opacity-80">
                          📊 Gesamt Live EXP: {result.data.newValueK}
                        </p>
                      )}
                      <p className="text-xs mt-3 text-green-300/70">
                        Modal schließt automatisch in 3 Sekunden...
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-lg font-bold">❌ Fehler</p>
                      <p className="text-sm font-medium mt-1">{result.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}