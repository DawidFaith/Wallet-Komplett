"use client";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Button } from "../../../components/ui/button";
import { FaTicketAlt, FaLock } from "react-icons/fa";

export default function LiveTab() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
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
    <div className="w-full h-full flex flex-col">
      {/* Live Code Eingabe Bereich */}
      <div className="bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <FaTicketAlt className="text-purple-400" />
            <h3 className="text-lg font-bold text-white">Live Code Einlösen</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Code eingeben (LC12345678)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                maxLength={20}
                disabled={loading}
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading || !account?.address}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Verarbeite...
                </div>
              ) : !account?.address ? (
                <div className="flex items-center gap-2">
                  <FaLock className="text-sm" />
                  Wallet verbinden erforderlich
                </div>
              ) : (
                '🎫 Code einlösen (+50 Live EXP)'
              )}
            </Button>
          </form>
          
          {/* Ergebnis Anzeige */}
          {result && (
            <div className={`mt-3 p-3 rounded-lg border ${
              result.success 
                ? 'bg-green-900/30 border-green-600 text-green-400' 
                : 'bg-red-900/30 border-red-600 text-red-400'
            }`}>
              <p className="text-sm font-medium">{result.message}</p>
              {result.success && result.data && (
                <div className="mt-2 text-xs space-y-1">
                  <p>✅ +{result.data.addedAmount} Live EXP hinzugefügt!</p>
                  <p>📊 Spalte K: {result.data.oldValueK} → {result.data.newValueK}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Iframe Bereich */}
      <div className="flex-1">
        <iframe 
          src="https://bnds.us/9u4nop"
          className="w-full h-full border-0"
          title="Live Auftritte"
          allowFullScreen
        />
      </div>
    </div>
  );
}