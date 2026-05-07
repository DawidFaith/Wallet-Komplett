'use client';

import React, { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { FaTrophy, FaYoutube, FaInstagram, FaTiktok, FaFacebookF } from 'react-icons/fa';
import FanBoard from './fan/FanBoard';
import CreatorBoard from './creator/CreatorBoard';
import type { YouTubeBinding, QuestBoardView, VerifiedPlatforms } from './types';
import type { SupportedLanguage } from '../../utils/deepLTranslation';

interface QuestBoardProps {
  language: SupportedLanguage;
}

interface ProfileResponse {
  profile?: {
    youtubeVerified?: boolean;
    youtubeChannelId?: string | null;
    youtubeChannelName?: string | null;
    youtubeChannelThumbnail?: string | null;
    instagramVerified?: boolean;
    tiktokVerified?: boolean;
    facebookVerified?: boolean;
  };
}

export default function QuestBoard({ language: _language }: QuestBoardProps) {
  const account = useActiveAccount();
  const [view, setView] = useState<QuestBoardView>('fan');
  const [binding, setBinding] = useState<YouTubeBinding | null>(null);
  const [verified, setVerified] = useState<VerifiedPlatforms>({
    youtube: false, instagram: false, tiktok: false, facebook: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!account?.address) { setLoaded(false); return; }
    setLoaded(false);
    fetch(`/api/youtube-quests/profile?wallet=${account.address}`)
      .then((r) => r.json())
      .then((data: ProfileResponse) => {
        const p = data.profile ?? {};
        setVerified({
          youtube: !!p.youtubeVerified,
          instagram: !!p.instagramVerified,
          tiktok: !!p.tiktokVerified,
          facebook: !!p.facebookVerified,
        });
        if (p.youtubeVerified && p.youtubeChannelId) {
          setBinding({
            walletAddress: account.address,
            channelId: p.youtubeChannelId,
            channelName: p.youtubeChannelName ?? '',
            channelThumbnail: p.youtubeChannelThumbnail ?? '',
            verifiedAt: '',
          });
        } else {
          setBinding(null);
        }
      })
      .catch(() => { /* still mark loaded */ })
      .finally(() => setLoaded(true));
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

  if (!loaded) {
    return (
      <div className="flex justify-center py-20">
        <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-12 h-12 animate-spin" />
      </div>
    );
  }

  const anyVerified = verified.youtube || verified.instagram || verified.tiktok || verified.facebook;

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
      {!anyVerified ? (
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-16 text-center px-4 space-y-4">
          <FaTrophy size={40} className="text-yellow-400 opacity-80" />
          <h2 className="text-white text-xl font-bold">Social-Konto verknüpfen</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Verknüpfe mindestens eines deiner Social-Media-Konten in deinem Profil,
            um passende Quests zu sehen.
          </p>
          <div className="flex items-center justify-center gap-4 text-zinc-500 pt-2">
            <FaYoutube size={22} className="text-red-500" />
            <FaInstagram size={20} className="text-pink-500" />
            <FaTiktok size={18} className="text-cyan-400" />
            <FaFacebookF size={18} className="text-blue-500" />
          </div>
        </div>
      ) : view === 'fan' ? (
        <FanBoard walletAddress={account.address} verified={verified} />
      ) : (
        <CreatorBoard walletAddress={account.address} binding={binding} verified={verified} />
      )}
    </div>
  );
}

