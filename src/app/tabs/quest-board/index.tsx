'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { FaTrophy, FaYoutube, FaInstagram, FaTiktok, FaFacebookF, FaUser, FaStar } from 'react-icons/fa';
import FanBoard from './fan/FanBoard';
import CreatorBoard from './creator/CreatorBoard';
import type { YouTubeBinding, QuestBoardView, VerifiedPlatforms, QuestIndexEntry } from './types';
import type { SupportedLanguage } from '../../utils/deepLTranslation';
import { formatCredits, shortenWallet } from './utils';

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
  credits?: number;
  xp?: number;
  level?: number;
  currentXp?: number;
  nextLevelXp?: number;
  progress?: number;
}

interface ArtistChip {
  wallet: string;
  questCount: number;
}

export default function QuestBoard({ language: _language }: QuestBoardProps) {
  const account = useActiveAccount();
  const [view, setView] = useState<QuestBoardView>('fan');
  const [binding, setBinding] = useState<YouTubeBinding | null>(null);
  const [verified, setVerified] = useState<VerifiedPlatforms>({
    youtube: false, instagram: false, tiktok: false, facebook: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Profil-Daten für UserProfileCard
  const [credits, setCredits] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentXp, setCurrentXp] = useState(0);
  const [nextLevelXp, setNextLevelXp] = useState(100);
  const [xpProgress, setXpProgress] = useState(0);

  // Quest-Daten für Artist-Auswahl
  const [allQuests, setAllQuests] = useState<QuestIndexEntry[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address) { setLoaded(false); return; }
    setLoaded(false);
    Promise.all([
      fetch(`/api/youtube-quests/profile?wallet=${account.address}`).then((r) => r.json()),
      fetch('/api/youtube-quests/quests').then((r) => r.json()),
    ])
      .then(([profileRes, questsRes]: [ProfileResponse, { quests?: QuestIndexEntry[] }]) => {
        const p = profileRes.profile ?? {};
        setVerified({
          youtube: !!p.youtubeVerified,
          instagram: !!p.instagramVerified,
          tiktok: !!p.tiktokVerified,
          facebook: !!p.facebookVerified,
        });
        if (p.youtubeVerified && p.youtubeChannelId) {
          setBinding({
            walletAddress: account.address,
            channelId: p.youtubeChannelId!,
            channelName: p.youtubeChannelName ?? '',
            channelThumbnail: p.youtubeChannelThumbnail ?? '',
            verifiedAt: '',
          });
        } else {
          setBinding(null);
        }
        setCredits(profileRes.credits ?? 0);
        setLevel(profileRes.level ?? 1);
        setCurrentXp(profileRes.currentXp ?? 0);
        setNextLevelXp(profileRes.nextLevelXp ?? 100);
        setXpProgress(profileRes.progress ?? 0);
        setAllQuests(questsRes.quests ?? []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [account?.address]);

  // Artist-Chips aus aktiven Quests ableiten
  const artistChips = useMemo((): ArtistChip[] => {
    const map = new Map<string, number>();
    allQuests
      .filter((q) => q.isActive)
      .forEach((q) => {
        const w = q.creatorWallet.toLowerCase();
        map.set(w, (map.get(w) ?? 0) + 1);
      });
    return Array.from(map.entries()).map(([wallet, questCount]) => ({ wallet, questCount }));
  }, [allQuests]);

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
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ─── Header: Titel + Fan/Artist Toggle ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaTrophy size={22} className="text-yellow-400" />
            <h1 className="text-white font-bold text-xl">Quest Board</h1>
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setView('fan')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === 'fan' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Fan
            </button>
            <button
              onClick={() => setView('artist')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === 'artist' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Artist
            </button>
          </div>
        </div>

        {/* ─── User Profile Card ─── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <FaUser size={14} className="text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-300 font-bold text-sm">{formatCredits(credits)} DFAITH</span>
                <span className="text-yellow-700 text-xs">Credits</span>
                <span className="ml-auto bg-red-900/40 border border-red-700/40 text-red-300 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0">
                  Lv. {level}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full transition-all"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <p className="text-zinc-600 text-xs mt-0.5">{currentXp} / {nextLevelXp} XP</p>
            </div>
          </div>
          {/* Social Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {verified.youtube && (
              <span className="flex items-center gap-1 bg-red-900/30 border border-red-700/30 text-red-400 text-xs px-2 py-0.5 rounded-full">
                <FaYoutube size={10} /> YouTube
              </span>
            )}
            {verified.instagram && (
              <span className="flex items-center gap-1 bg-pink-900/30 border border-pink-700/30 text-pink-400 text-xs px-2 py-0.5 rounded-full">
                <FaInstagram size={10} /> Instagram
              </span>
            )}
            {verified.tiktok && (
              <span className="flex items-center gap-1 bg-cyan-900/30 border border-cyan-700/30 text-cyan-400 text-xs px-2 py-0.5 rounded-full">
                <FaTiktok size={10} /> TikTok
              </span>
            )}
            {verified.facebook && (
              <span className="flex items-center gap-1 bg-blue-900/30 border border-blue-700/30 text-blue-400 text-xs px-2 py-0.5 rounded-full">
                <FaFacebookF size={10} /> Facebook
              </span>
            )}
            {!anyVerified && (
              <p className="text-zinc-600 text-xs">Kein Social-Konto verknüpft</p>
            )}
          </div>
        </div>

        {/* ─── Inhalt ─── */}
        {view === 'artist' ? (
          <CreatorBoard walletAddress={account.address} binding={binding} verified={verified} />
        ) : !anyVerified ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-4">
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
        ) : (
          <>
            {/* Artist-Filter Chips */}
            {artistChips.length > 0 && (
              <div>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">Artist wählen</p>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => setSelectedArtist(null)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedArtist === null
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    Alle
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedArtist === null ? 'bg-red-700/60 text-red-100' : 'bg-zinc-800 text-zinc-500'}`}>
                      {artistChips.reduce((s, a) => s + a.questCount, 0)}
                    </span>
                  </button>
                  {artistChips.map((artist) => (
                    <button
                      key={artist.wallet}
                      onClick={() => setSelectedArtist(selectedArtist === artist.wallet ? null : artist.wallet)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        selectedArtist === artist.wallet
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      <FaStar size={9} />
                      {shortenWallet(artist.wallet)}
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedArtist === artist.wallet ? 'bg-red-700/60 text-red-100' : 'bg-zinc-800 text-zinc-500'}`}>
                        {artist.questCount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fan Board */}
            <FanBoard
              walletAddress={account.address}
              verified={verified}
              filterCreator={selectedArtist ?? undefined}
            />
          </>
        )}

      </div>
    </div>
  );
}

