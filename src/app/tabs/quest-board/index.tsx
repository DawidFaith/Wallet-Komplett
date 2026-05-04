'use client';

import React, { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { FaTrophy, FaYoutube } from 'react-icons/fa';
import FanBoard from './fan/FanBoard';
import CreatorBoard from './creator/CreatorBoard';
import type { YouTubeBinding, QuestBoardView } from './types';
import type { SupportedLanguage } from '../../utils/deepLTranslation';

interface QuestBoardProps {
  language: SupportedLanguage;
}

export default function QuestBoard({ language: _language }: QuestBoardProps) {
  const account = useActiveAccount();
  const [view, setView] = useState<QuestBoardView>('fan');
  const [binding, setBinding] = useState<YouTubeBinding | null>(null);
  const [bindingLoaded, setBindingLoaded] = useState(false);

  useEffect(() => {
    if (!account?.address) { setBindingLoaded(false); return; }
    fetch(`/api/youtube-quests/verify-channel?wallet=${account.address}`)
      .then((r) => r.json())
      .then((data) => { setBinding(data.binding ?? null); setBindingLoaded(true); })
      .catch(() => setBindingLoaded(true));
  }, [account?.address]);

  if (!account?.address) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-20 text-center px-4">
        <FaTrophy size={48} className="text-yellow-400 mb-4 opacity-80" />
        <h2 className="text-white text-xl font-bold mb-2">Quest Board</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verbinde deine Wallet, um Quests abzuschließen und DFAITH Tokens zu verdienen.
        </p>
      </div>
    );
  }

  if (!bindingLoaded) {
    return (
      <div className="flex justify-center py-20">
        <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-12 h-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-12">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FaTrophy size={24} className="text-yellow-400" />
            <h1 className="text-white font-bold text-xl">Quest Board</h1>
          </div>
          {/* Fan / Creator Switch */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setView('fan')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === 'fan' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Fan
            </button>
            <button
              onClick={() => setView('creator')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === 'creator' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Creator
            </button>
          </div>
        </div>
      </div>

      {/* Inhalt */}
      {view === 'fan' ? (
        binding ? (
          <FanBoard walletAddress={account.address} binding={binding} />
        ) : (
          <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-20 text-center px-4 space-y-4">
            <FaYoutube size={48} className="text-red-500 opacity-80" />
            <h2 className="text-white text-xl font-bold">YouTube Kanal verknüpfen</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Verknüpfe deinen YouTube Kanal in deinen sozialen Profilen, um Quests abzuschließen.
            </p>
          </div>
        )
      ) : (
        // Creator-View: ebenfalls Kanal-Verifikation voraussetzen
        binding ? (
          <CreatorBoard walletAddress={account.address} binding={binding} />
        ) : (
          <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-20 text-center px-4 space-y-4">
            <FaYoutube size={48} className="text-red-500 opacity-80" />
            <h2 className="text-white text-xl font-bold">YouTube Kanal verknüpfen</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Verknüpfe deinen YouTube Kanal in deinen sozialen Profilen, um Quests zu erstellen.
            </p>
          </div>
        )
      )}
    </div>
  );
}
