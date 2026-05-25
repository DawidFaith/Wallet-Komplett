'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { FaTrophy, FaYoutube, FaInstagram, FaTiktok, FaFacebookF, FaCheck, FaMusic, FaTimes, FaChevronLeft } from 'react-icons/fa';
import Image from 'next/image';
import FanBoard from './fan/FanBoard';
import CreatorBoard from './creator/CreatorBoard';
import type { YouTubeBinding, QuestBoardView, VerifiedPlatforms } from './types';
import type { SupportedLanguage } from '../../utils/deepLTranslation';

interface ArtistInfo {
  walletAddress: string;
  name: string;
  picture: string | null;
  artistType: string | null;
  artistBio: string | null;
  rewardToken: string | null;
  questCount: number;
  socials: {
    youtubeChannelId: string | null;
    youtubeChannelName: string | null;
    instagramHandle: string | null;
    instagramVerified: boolean;
    tiktokHandle: string | null;
    tiktokVerified: boolean;
    facebookHandle: string | null;
    facebookVerified: boolean;
  };
}

interface QuestBoardProps {
  language: SupportedLanguage;
  filterArtist?: ArtistInfo | null;
  onClearArtist?: () => void;
}

// ─── Artist-Selektor ────────────────────────────────────────────────────────

function ArtistSelector({ onSelect }: { onSelect: (artist: ArtistInfo) => void }) {
  const [artists, setArtists] = useState<ArtistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/artists')
      .then(r => {
        if (!r.ok) return r.json().then((e: { error?: string }) => { throw new Error(e?.error || `HTTP ${r.status}`); });
        return r.json();
      })
      .then((data: { artists?: ArtistInfo[] }) => setArtists((data.artists ?? []).filter(a => a.questCount > 0)))
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || artists.length === 0) {
    return (
      <div className="mx-4 bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
        {fetchError
          ? <span className="text-red-400">Fehler: {fetchError}</span>
          : 'Noch keine Künstler haben aktive Quests.'}
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Künstler</p>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        {artists.map(artist => (
          <button
            key={artist.walletAddress}
            onClick={() => onSelect(artist)}
            className="flex flex-col items-center gap-2 shrink-0 w-[68px] group"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full ring-2 ring-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.25)] transition-all group-hover:scale-105">
                {artist.picture
                  ? <img src={artist.picture} alt="" className="w-14 h-14 rounded-full object-cover" />
                  : <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                      <FaTrophy className="text-red-400" size={18} />
                    </div>}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                <span className="text-[8px] font-bold">{artist.questCount}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-300 text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">
              {artist.name}
            </p>
          </button>
        ))}
      </div>
      <p className="text-zinc-600 text-xs">Tippe auf einen Künstler um seine Quests zu sehen.</p>
    </div>
  );
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
    metaFbPartnerVerified?: boolean;
    rewardToken?: string | null;
    isArtist?: boolean;
  };
}

export default function QuestBoard({ language: _language, filterArtist, onClearArtist }: QuestBoardProps) {
  const { user: _clerkUser } = useUser();
  const account = _clerkUser?.id ? { address: _clerkUser.id } : null;
  const [view, setView] = useState<QuestBoardView>('fan');
  const [binding, setBinding] = useState<YouTubeBinding | null>(null);
  const [verified, setVerified] = useState<VerifiedPlatforms>({
    youtube: false, instagram: false, tiktok: false, facebook: false,
  });
  const [myRewardToken, setMyRewardToken] = useState<string | null>(null);
  const [isArtist, setIsArtist] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [internalFilterArtist, setInternalFilterArtist] = useState<ArtistInfo | null>(null);

  useEffect(() => {
    if (!account?.address) { setLoaded(false); return; }
    setLoaded(false);
    Promise.all([
      fetch(`/api/youtube-quests/profile?wallet=${account.address}`).then((r) => r.json()),
    ])
      .then(([profileRes]: [ProfileResponse]) => {
        const p = profileRes.profile ?? {};
        setVerified({
          youtube: !!p.youtubeVerified,
          instagram: !!p.instagramVerified,
          tiktok: !!p.tiktokVerified,
          facebook: !!p.metaFbPartnerVerified || !!p.facebookVerified,
        });
        setMyRewardToken(p.rewardToken ?? null);
        setIsArtist(!!p.isArtist);
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
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [account?.address]);

  if (!account?.address) {
    return (
      <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
        <div className="max-w-2xl mx-auto w-full">
          <div className="px-4 pt-6 pb-4">
            <div className="flex items-center gap-3 pt-1">
              <img src="/D.FAITH.png" alt="D.FAITH" className="w-10 h-10 rounded-full object-contain shrink-0" />
              <div>
                <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
                <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">Quest Board · Missions</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
            <FaTrophy size={40} className="text-yellow-400 mb-4 opacity-80" />
            <p className="text-white font-semibold">Quest Board</p>
            <p className="text-zinc-400 text-sm mt-2">
              Verbinde deine Wallet, um Quests abzuschließen und DFAITH Tokens zu verdienen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-12 h-12 animate-spin" />
        </div>
      </div>
    );
  }

  const anyVerified = verified.youtube || verified.instagram || verified.tiktok || verified.facebook;

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">

        {/* ─── Header ─── */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 pt-1">
            <img src="/D.FAITH.png" alt="D.FAITH" className="w-10 h-10 rounded-full object-contain shrink-0" />
            <div>
              <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
              <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                Quest Board · Missions
              </p>
            </div>
          </div>
        </div>

        {/* ─── Fan/Artist Toggle – nur für Künstler sichtbar ─── */}
        {isArtist && (
          <div className="px-4 mb-4">
            <div className="flex bg-zinc-900/70 rounded-xl p-1 border border-white/[0.07]">
              <button
                onClick={() => setView('fan')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${view === 'fan' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                <FaTrophy size={11} />
                Supporter
              </button>
              <button
                onClick={() => setView('artist')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${view === 'artist' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                <FaMusic size={11} />
                Künstler
              </button>
            </div>
          </div>
        )}

        {/* ─── Inhalt ─── */}
        {view === 'artist' ? (
          <CreatorBoard walletAddress={account.address} binding={binding} verified={verified} rewardToken={myRewardToken} />
        ) : !anyVerified ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16 space-y-4">
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
        ) : (() => {
          // Aktiver Artist: entweder per Prop (von Profil-Tab) oder intern gewählt
          const activeArtist = filterArtist ?? internalFilterArtist;
          if (!activeArtist) {
            return <ArtistSelector onSelect={setInternalFilterArtist} />;
          }
          return (
            <>
              {/* Zurück-Button + Artist-Header */}
              <div className="px-4 space-y-3">
                <button
                  onClick={() => {
                    if (filterArtist && onClearArtist) onClearArtist();
                    else setInternalFilterArtist(null);
                  }}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
                >
                  <FaChevronLeft size={12} />
                  Alle Künstler
                </button>
                <div className="flex items-center gap-3 bg-zinc-900/60 border border-white/[0.06] rounded-2xl px-4 py-3">
                  {activeArtist.picture
                    ? <img src={activeArtist.picture} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-red-500/50" />
                    : <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center ring-2 ring-red-500/30">
                        <FaTrophy size={16} className="text-red-400" />
                      </div>}
                  <div>
                    <p className="text-white font-semibold text-sm">{activeArtist.name}</p>
                    <p className="text-zinc-500 text-xs">{activeArtist.questCount} Ques{activeArtist.questCount !== 1 ? 'ts' : 't'}</p>
                  </div>
                </div>
              </div>
              {/* Fan Board */}
              <FanBoard
                walletAddress={account.address}
                verified={verified}
                filterCreator={activeArtist.walletAddress}
                rewardToken={activeArtist.rewardToken ?? null}
                onQuestCompleted={() => {
                  setInternalFilterArtist((prev) =>
                    prev ? { ...prev, questCount: Math.max(0, prev.questCount - 1) } : prev
                  );
                }}
              />
            </>
          );
        })()}

      </div>
    </div>
  );
}

