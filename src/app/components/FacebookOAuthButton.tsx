'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaFacebook, FaCheck, FaUnlink, FaSync } from 'react-icons/fa';
import { inAppWallet } from 'thirdweb/wallets';
import { getProfiles } from 'thirdweb/wallets/in-app';
import { client } from '../client';

interface FacebookOAuthButtonProps {
  walletAddress: string;
  currentName: string | null;
  currentPicture: string | null;
  currentVerified: boolean;
  onDone: () => void;
}

export default function FacebookOAuthButton({
  walletAddress,
  currentName,
  currentPicture,
  currentVerified,
  onDone,
}: FacebookOAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    const wallet = inAppWallet();
    try {
      const account = await wallet.connect({
        client,
        strategy: 'facebook',
      });

      // Facebook-Profildaten aus Thirdweb holen
      let name: string | null = null;
      let picture: string | null = null;
      const facebookId = account.address;

      try {
        const profiles = await getProfiles({ client });
        const fbProfile = profiles.find((p) => p.type === 'facebook');
        if (fbProfile?.details) {
          name = (fbProfile.details as { name?: string }).name ?? null;
        }
      } catch {
        // Profil-Details nicht verfügbar – facebookId reicht zur Verifikation
      }

      // In DB speichern verknüpft mit der Haupt-Wallet
      const res = await fetch('/api/youtube-quests/facebook-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, facebookId, name, picture }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Speichern');
        return;
      }

      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abbruch')) {
        setError('Anmeldung abgebrochen.');
      } else {
        setError('Facebook-Login fehlgeschlagen. Bitte versuche es erneut.');
      }
    } finally {
      // Temp-Wallet immer trennen
      try { await wallet.disconnect(); } catch { /* ignore */ }
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError('');
    try {
      await fetch(`/api/youtube-quests/facebook-oauth?wallet=${walletAddress}`, {
        method: 'DELETE',
      });
      onDone();
    } catch {
      setError('Fehler beim Trennen.');
    } finally {
      setLoading(false);
    }
  };

  if (currentVerified && currentName) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
          {currentPicture ? (
            <Image src={currentPicture} alt={currentName} width={40} height={40} unoptimized className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center">
              <FaFacebook className="text-blue-500" size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{currentName}</p>
            <span className="flex items-center gap-1 text-green-400 text-xs font-semibold">
              <FaCheck size={9} /> Via Facebook verifiziert
            </span>
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Ändern
          </button>
          <button
            onClick={handleUnlink}
            disabled={loading}
            className="flex-1 bg-red-900/40 hover:bg-red-800/60 text-red-400 text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="border-2 border-red-400/30 border-t-red-400 rounded-full w-3 h-3 animate-spin" /> : <FaUnlink size={11} />}
            Trennen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 space-y-1.5">
        <p className="font-semibold text-yellow-400">So funktioniert es:</p>
        <p>1. Klicke auf &quot;Mit Facebook anmelden&quot;</p>
        <p>2. Melde dich in dem Popup bei Facebook an</p>
        <p>3. Fertig – keine Bio-Änderung nötig!</p>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <FaSync className="animate-spin" size={16} />
        ) : (
          <FaFacebook size={16} />
        )}
        {loading ? 'Verbinde…' : 'Mit Facebook anmelden'}
      </button>
    </div>
  );
}
