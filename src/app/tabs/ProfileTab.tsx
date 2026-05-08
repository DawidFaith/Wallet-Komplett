'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook, FaYoutube,
  FaCheck, FaCoins, FaStar, FaLock, FaPlus, FaChevronDown,
  FaPen, FaMusic, FaTimes,
} from 'react-icons/fa';import SocialVerifyModal from './profile/SocialVerifyModal';
import LinkChannelView from './quest-board/fan/LinkChannelView';
import QuestBoardTab from './QuestBoardTab';
import type { SupportedLanguage } from '../utils/deepLTranslation';

type SocialPlatform = 'instagram' | 'tiktok' | 'facebook';
type AnyPlatform = SocialPlatform | 'youtube';

interface ProfileData {
  xp: number;
  credits: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
  profile: {
    displayName: string | null;
    isArtist: boolean;
    artistType: string | null;
    artistBio: string | null;
    rewardToken: string | null;
    instagramHandle: string | null;
    instagramVerified: boolean;
    instagramName: string | null;
    instagramPicture: string | null;
    tiktokHandle: string | null;
    tiktokVerified: boolean;
    tiktokName: string | null;
    tiktokPicture: string | null;
    facebookHandle: string | null;
    facebookVerified: boolean;
    facebookName: string | null;
    facebookPicture: string | null;
    youtubeChannelId: string | null;
    youtubeChannelName: string | null;
    youtubeChannelThumbnail: string | null;
    youtubeVerified: boolean;
  };
}

interface ArtistEntry {
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
    youtubeChannelThumbnail: string | null;
    instagramHandle: string | null;
    instagramVerified: boolean;
    instagramName: string | null;
    instagramPicture: string | null;
    tiktokHandle: string | null;
    tiktokVerified: boolean;
    tiktokName: string | null;
    tiktokPicture: string | null;
    facebookHandle: string | null;
    facebookVerified: boolean;
    facebookName: string | null;
    facebookPicture: string | null;
  };
}

interface ProfileTabProps {
  language: SupportedLanguage;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const LS_KEY = 'dfaith_primary_platform';

const PLATFORM_META: Record<AnyPlatform, { label: string; icon: React.ReactNode }> = {
  youtube:   { label: 'YouTube',   icon: <FaYoutube  className="text-red-500"   size={13} /> },
  instagram: { label: 'Instagram', icon: <FaInstagram className="text-pink-500" size={13} /> },
  tiktok:    { label: 'TikTok',    icon: <FaTiktok   className="text-zinc-200"  size={12} /> },
  facebook:  { label: 'Facebook',  icon: <FaFacebook className="text-blue-500"  size={13} /> },
};

export default function ProfileTab({ language: _language }: ProfileTabProps) {
  const account = useActiveAccount();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState<SocialPlatform | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [unlinkPending, setUnlinkPending] = useState<AnyPlatform | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const questBoardRef = useRef<HTMLDivElement>(null);
  // YouTube: manage (already linked) vs. link-flow
  const [showYoutubeManage, setShowYoutubeManage] = useState(false);
  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<ArtistEntry | null>(null);
  const [claiming, setClaiming] = useState(false);
  // Artist-Profil bearbeiten
  const [editingArtist, setEditingArtist] = useState(false);
  const [artistTypeInput, setArtistTypeInput] = useState('');
  const [artistBioInput, setArtistBioInput] = useState('');
  const [artistRewardTokenInput, setArtistRewardTokenInput] = useState('');
  const [artistSaving, setArtistSaving] = useState(false);

  const [primaryPlatform, setPrimaryPlatformState] = useState<AnyPlatform | null>(null);

  const setPrimaryPlatform = useCallback((platform: AnyPlatform | null) => {
    setPrimaryPlatformState(platform);
    if (typeof window !== 'undefined') {
      if (platform) localStorage.setItem(LS_KEY, platform);
      else localStorage.removeItem(LS_KEY);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!account?.address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube-quests/profile?wallet=${account.address}`);
      if (res.ok) {
        const d: ProfileData = await res.json();
        setData(d);
        // Auto-set erste verifizierte Plattform falls noch keine gewählt
        const stored = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) as AnyPlatform | null : null;
        if (!stored) {
          const p = d.profile;
          const first: AnyPlatform | null =
            p.youtubeVerified ? 'youtube' :
            p.instagramVerified ? 'instagram' :
            p.tiktokVerified ? 'tiktok' :
            p.facebookVerified ? 'facebook' : null;
          if (first) setPrimaryPlatform(first);
        } else {
          setPrimaryPlatformState(stored);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [account?.address, setPrimaryPlatform]);

  const handleClaim = useCallback(async () => {
    if (!account?.address || !data || data.credits <= 0) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/youtube-quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address, amount: data.credits }),
      });
      if (res.ok) await loadProfile();
    } finally {
      setClaiming(false);
    }
  }, [account?.address, data, loadProfile]);

  const handleUnlink = useCallback(async (platform: SocialPlatform) => {
    if (!account?.address) return;
    setUnlinkPending(platform);
    try {
      await fetch('/api/youtube-quests/social-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address, platform, action: 'unlink' }),
      });
      if (primaryPlatform === platform) setPrimaryPlatform(null);
      await loadProfile();
    } finally {
      setUnlinkPending(null);
    }
  }, [account?.address, loadProfile, primaryPlatform, setPrimaryPlatform]);

  const handleUnlinkYoutube = useCallback(async () => {
    if (!account?.address) return;
    setUnlinkPending('youtube');
    try {
      await fetch('/api/youtube-quests/verify-channel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address }),
      });
      if (primaryPlatform === 'youtube') setPrimaryPlatform(null);
      await loadProfile();
    } finally {
      setUnlinkPending(null);
    }
  }, [account?.address, loadProfile, primaryPlatform, setPrimaryPlatform]);

  const handleSaveArtistInfo = useCallback(async () => {
    if (!account?.address) return;
    setArtistSaving(true);
    try {
      await fetch('/api/youtube-quests/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: account.address,
          artistType: artistTypeInput.trim() || null,
          artistBio: artistBioInput.trim() || null,
          rewardToken: artistRewardTokenInput.trim() || null,
        }),
      });
      setEditingArtist(false);
      await loadProfile();
    } finally {
      setArtistSaving(false);
    }
  }, [account?.address, artistTypeInput, artistBioInput, artistRewardTokenInput, loadProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    fetch(`/api/admin/artists${account?.address ? `?wallet=${account.address}` : ''}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.artists) setArtists(d.artists); })
      .catch(() => {});
  }, []);

  // Dropdown bei Klick außen schließen
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!account?.address) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center mb-5">
          <FaLock size={28} className="text-zinc-500" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Dein Profil</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verbinde deine Wallet um dein Profil, Level und Quests zu sehen.
        </p>
      </div>
    );
  }

  const p = data?.profile;

  // Verfügbare (verknüpfte) Plattformen für das Dropdown
  const linkedPlatforms: AnyPlatform[] = [
    ...(p?.youtubeVerified ? ['youtube' as const] : []),
    ...(p?.instagramHandle ? ['instagram' as const] : []),
    ...(p?.tiktokHandle ? ['tiktok' as const] : []),
    ...(p?.facebookHandle ? ['facebook' as const] : []),
  ];

  // Anzeige-Infos der gewählten Plattform
  const profileInfo: { name: string; picture: string | null } = (() => {
    switch (primaryPlatform) {
      case 'youtube':
        if (p?.youtubeVerified && p.youtubeChannelName)
          return { name: p.youtubeChannelName, picture: p.youtubeChannelThumbnail ?? null };
        break;
      case 'instagram':
        if (p?.instagramHandle)
          return { name: p.instagramName ?? `@${p.instagramHandle}`, picture: p.instagramPicture ?? null };
        break;
      case 'tiktok':
        if (p?.tiktokHandle)
          return { name: p.tiktokName ?? `@${p.tiktokHandle}`, picture: p.tiktokPicture ?? null };
        break;
      case 'facebook':
        if (p?.facebookHandle)
          return { name: p.facebookName ?? `@${p.facebookHandle}`, picture: p.facebookPicture ?? null };
        break;
    }
    return { name: shortenAddress(account.address), picture: null };
  })();

  const initials = account.address.slice(2, 4).toUpperCase();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-16 space-y-5">

      {/* ── Page Title ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-white font-bold text-2xl">Support &amp; Earn</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Unterstütze Artists und verdiene Rewards.</p>
      </div>

      {/* ── Supporter ─────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Supporter</p>

        {/* Avatar + Name + Dropdown */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="shrink-0">
            {profileInfo.picture ? (
              <Image
                src={profileInfo.picture}
                alt={profileInfo.name}
                width={64}
                height={64}
                unoptimized
                className="w-16 h-16 rounded-full object-cover ring-2 ring-red-600/50"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 flex items-center justify-center text-white font-bold text-2xl select-none">
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + Plattform-Dropdown */}
            <div className="flex items-center gap-2 mb-1" ref={dropdownRef}>
              <p className="text-white font-bold text-lg truncate">{profileInfo.name}</p>
              {linkedPlatforms.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-lg transition-colors"
                  >
                    {primaryPlatform && PLATFORM_META[primaryPlatform].icon}
                    <FaChevronDown size={9} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                      {linkedPlatforms.map((platform) => {
                        const meta = PLATFORM_META[platform];
                        const isActive = primaryPlatform === platform;
                        return (
                          <button
                            key={platform}
                            onClick={() => { setPrimaryPlatform(platform); setDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${isActive ? 'bg-red-900/40 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
                          >
                            {meta.icon}
                            <span className="font-medium">{meta.label}</span>
                            {isActive && <FaCheck size={9} className="ml-auto text-green-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800" />

        {/* ── Artist-Info (nur wenn is_artist) ── */}
        {p?.isArtist && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <FaMusic size={10} className="text-red-400" /> Artist-Profil
              </p>
              {!editingArtist && (
                <button
                  onClick={() => {
                    setArtistTypeInput(p.artistType ?? '');
                    setArtistBioInput(p.artistBio ?? '');
                    setArtistRewardTokenInput(p.rewardToken ?? 'D.FAITH');
                    setEditingArtist(true);
                  }}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-lg transition-colors"
                >
                  <FaPen size={9} /> Bearbeiten
                </button>
              )}
            </div>
            {editingArtist ? (
              <div className="space-y-2">
                <input
                  value={artistTypeInput}
                  onChange={(e) => setArtistTypeInput(e.target.value)}
                  placeholder="Künstlertyp (z.B. Musiker, Rapper, DJ…)"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-red-500 transition-colors"
                />
                <textarea
                  value={artistBioInput}
                  onChange={(e) => setArtistBioInput(e.target.value)}
                  placeholder="Warum solltest du supported werden? (Bio)"
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-red-500 transition-colors resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingArtist(false)} className="text-xs px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors">
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveArtistInfo}
                    disabled={artistSaving}
                    className="text-xs px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50 transition-colors"
                  >
                    {artistSaving ? 'Speichern…' : 'Speichern'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-800/50 rounded-xl p-3 space-y-1.5">
                {p.artistType && (
                  <p className="text-red-300 text-xs font-semibold flex items-center gap-1.5">
                    <FaMusic size={9} /> {p.artistType}
                  </p>
                )}
                {p.artistBio ? (
                  <p className="text-zinc-400 text-xs leading-relaxed">{p.artistBio}</p>
                ) : (
                  <p className="text-zinc-600 text-xs italic">Noch keine Bio eingetragen</p>
                )}
                {!p.artistType && !p.artistBio && (
                  <p className="text-zinc-600 text-xs italic">Klicke &bdquo;Bearbeiten&ldquo; um dein Artist-Profil auszufüllen</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Divider vor Sozialen Profilen (nur wenn Artist-Sektion sichtbar) */}
        {p?.isArtist && <div className="border-t border-zinc-800" />}

        {/* Soziale Profile – kompakte Icon-Reihe */}
        <div>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">Deine Plattformen</p>
          <div className="flex gap-3 flex-wrap">

            <SocialChip
              icon={<FaYoutube className="text-red-500" size={15} />}
              label="YouTube"
              name={p?.youtubeChannelName ?? null}
              handle={p?.youtubeChannelName ?? null}
              picture={p?.youtubeChannelThumbnail ?? null}
              verified={p?.youtubeVerified ?? false}
              unlinkLoading={unlinkPending === 'youtube'}
              onAdd={() => setShowYoutubeModal(true)}
              onChange={() => setShowYoutubeModal(true)}
              onUnlink={p?.youtubeChannelId ? handleUnlinkYoutube : undefined}
            />

            <SocialChip
              icon={<FaInstagram className="text-pink-500" size={15} />}
              label="Instagram"
              name={p?.instagramName ?? null}
              handle={p?.instagramHandle ?? null}
              picture={p?.instagramPicture ?? null}
              verified={p?.instagramVerified ?? false}
              unlinkLoading={unlinkPending === 'instagram'}
              onAdd={() => setVerifyModal('instagram')}
              onChange={() => setVerifyModal('instagram')}
              onUnlink={p?.instagramHandle ? () => handleUnlink('instagram') : undefined}
            />

            <SocialChip
              icon={<FaTiktok className="text-zinc-200" size={14} />}
              label="TikTok"
              name={p?.tiktokName ?? null}
              handle={p?.tiktokHandle ?? null}
              picture={p?.tiktokPicture ?? null}
              verified={p?.tiktokVerified ?? false}
              unlinkLoading={unlinkPending === 'tiktok'}
              onAdd={() => setVerifyModal('tiktok')}
              onChange={() => setVerifyModal('tiktok')}
              onUnlink={p?.tiktokHandle ? () => handleUnlink('tiktok') : undefined}
            />

            <SocialChip
              icon={<FaFacebook className="text-blue-500" size={15} />}
              label="Facebook"
              name={p?.facebookName ?? null}
              handle={p?.facebookHandle ?? null}
              picture={p?.facebookPicture ?? null}
              verified={p?.facebookVerified ?? false}
              unlinkLoading={unlinkPending === 'facebook'}
              onAdd={() => setVerifyModal('facebook')}
              onChange={() => setVerifyModal('facebook')}
              onUnlink={p?.facebookHandle ? () => handleUnlink('facebook') : undefined}
            />

          </div>
        </div>
      </div>

      {/* ── ArtistBoard ────────────────────────────────────────── */}
      {artists.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-4">Artists</p>
          <div className="flex gap-4 overflow-x-auto pt-2 pb-1 scrollbar-none">
            {artists.map((artist) => {
              const hasQuests = artist.questCount > 0;
              const isSelected = selectedArtist?.walletAddress === artist.walletAddress;
              return (
                <button
                  key={artist.walletAddress}
                  onClick={() => setSelectedArtist(isSelected ? null : artist)}
                  className="flex flex-col items-center gap-2 shrink-0 w-16 group"
                >
                  <div className="relative">
                    {artist.picture ? (
                      <Image
                        src={artist.picture}
                        alt={artist.name}
                        width={56}
                        height={56}
                        unoptimized
                        className={`w-14 h-14 rounded-full object-cover transition-transform group-hover:scale-105 ${isSelected ? 'ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.4)]' : hasQuests ? 'ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'ring-2 ring-zinc-700'}`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 flex items-center justify-center text-white font-bold text-lg select-none transition-transform group-hover:scale-105 ${isSelected ? 'ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.4)]' : hasQuests ? 'ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'ring-2 ring-zinc-700'}`}>
                        {artist.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {hasQuests && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-lg animate-pulse">
                        {artist.questCount}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-medium text-center leading-tight line-clamp-2 w-full ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                    {artist.name}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Artist-Info-Card (inline, expandiert beim Klick) */}
          {selectedArtist && (
            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedArtist.picture ? (
                    <Image src={selectedArtist.picture} alt={selectedArtist.name} width={44} height={44} unoptimized
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-red-500/50" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 flex items-center justify-center text-white font-bold text-sm">
                      {selectedArtist.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{selectedArtist.name}</p>
                    {selectedArtist.artistType && (
                      <p className="text-red-400 text-xs flex items-center gap-1"><FaMusic size={8} /> {selectedArtist.artistType}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedArtist(null)} className="text-zinc-500 hover:text-white transition-colors p-1">
                  <FaTimes size={14} />
                </button>
              </div>
              {selectedArtist.artistBio && (
                <p className="text-zinc-400 text-xs leading-relaxed">{selectedArtist.artistBio}</p>
              )}
              <div className="flex items-center gap-2 text-xs px-1">
                <span className="text-zinc-500">Reward Token</span>
                <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
                <span className="text-white font-bold tracking-wide">{selectedArtist.rewardToken ?? 'D.FAITH'}</span>
              </div>
              {(data?.credits ?? 0) > 0 && (
                <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-3 py-1.5">
                  <Image src="/D.FAITH.png" alt="D.FAITH" width={16} height={16} className="w-4 h-4 rounded-full shrink-0" />
                  <span className="text-yellow-300 font-semibold text-xs flex-1">
                    {(data?.credits ?? 0).toFixed(2)} D.FAITH Credits
                  </span>
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold text-xs px-3 py-1 rounded-lg transition-colors"
                  >
                    {claiming ? '…' : 'Einlösen'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Quest Board ────────────────────────────────────────── */}
      {selectedArtist && (
        <div ref={questBoardRef}>
          <QuestBoardTab
            language={_language}
            filterArtist={selectedArtist}
            onClearArtist={() => setSelectedArtist(null)}
          />
        </div>
      )}

      {/* YouTube Manage Modal (bereits verknüpft) */}
      {showYoutubeManage && p?.youtubeChannelId && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowYoutubeManage(false)}
        >
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <FaYoutube className="text-red-500" size={20} />
                <span className="text-white font-bold text-base">YouTube</span>
              </div>
              <button onClick={() => setShowYoutubeManage(false)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
            </div>
            {/* Kanal-Info */}
            <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
              {p.youtubeChannelThumbnail && (
                <Image src={p.youtubeChannelThumbnail} alt={p.youtubeChannelName ?? ''} width={40} height={40} unoptimized className="w-10 h-10 rounded-full object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{p.youtubeChannelName}</p>
                <p className="text-green-400 text-xs flex items-center gap-1 mt-0.5"><FaCheck size={9} /> Verifiziert</p>
              </div>
            </div>
            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowYoutubeManage(false); setShowYoutubeModal(true); }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                Ändern
              </button>
              <button
                onClick={async () => { setShowYoutubeManage(false); await handleUnlinkYoutube(); }}
                disabled={unlinkPending === 'youtube'}
                className="flex-1 bg-red-900/30 hover:bg-red-900/60 text-red-400 font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-40"
              >
                {unlinkPending === 'youtube' ? '…' : 'Trennen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Link Modal */}
      {showYoutubeModal && account?.address && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowYoutubeModal(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowYoutubeModal(false)} className="text-zinc-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <LinkChannelView
              walletAddress={account.address}
              onLinked={() => { setShowYoutubeModal(false); loadProfile(); }}
            />
          </div>
        </div>
      )}

      {/* Instagram / TikTok / Facebook Modal */}
      {verifyModal && (
        <SocialVerifyModal
          platform={verifyModal}
          walletAddress={account.address}
          currentHandle={
            verifyModal === 'instagram' ? (p?.instagramHandle ?? null)
            : verifyModal === 'tiktok' ? (p?.tiktokHandle ?? null)
            : (p?.facebookHandle ?? null)
          }
          currentVerified={
            verifyModal === 'instagram' ? (p?.instagramVerified ?? false)
            : verifyModal === 'tiktok' ? (p?.tiktokVerified ?? false)
            : (p?.facebookVerified ?? false)
          }
          currentName={
            verifyModal === 'instagram' ? (p?.instagramName ?? null)
            : verifyModal === 'tiktok' ? (p?.tiktokName ?? null)
            : (p?.facebookName ?? null)
          }
          currentPicture={
            verifyModal === 'instagram' ? (p?.instagramPicture ?? null)
            : verifyModal === 'tiktok' ? (p?.tiktokPicture ?? null)
            : (p?.facebookPicture ?? null)
          }
          onDone={() => loadProfile()}
          onClose={() => setVerifyModal(null)}
        />
      )}
    </div>
  );
}

// ─── SocialTile ───────────────────────────────────────────────────────────────

interface SocialChipProps {
  icon: React.ReactNode;
  label: string;
  name: string | null;
  handle: string | null;
  picture: string | null;
  verified: boolean;
  unlinkLoading?: boolean;
  onAdd: () => void;
  onChange: () => void;
  onUnlink?: () => void;
}

function SocialChip({
  icon, label, name, handle, picture, verified, unlinkLoading, onAdd, onChange, onUnlink,
}: SocialChipProps) {
  const [open, setOpen] = React.useState(false);
  const displayText = name ?? (handle ? `@${handle}` : null);

  if (!handle && !verified) {
    // Nicht verknüpft: Icon + Label + +
    return (
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-xl px-3 py-2 text-xs font-semibold transition-all"
      >
        {icon}
        {label}
        <FaPlus size={9} className="text-zinc-600" />
      </button>
    );
  }

  // Verknüpft: Icon + Label + grüner Haken, Klick öffnet Popup
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-zinc-800/60 border border-green-700/40 hover:border-green-500/60 text-white rounded-xl px-3 py-2 text-xs font-semibold transition-all"
      >
        {icon}
        {label}
        <FaCheck size={9} className="text-green-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl p-3 shadow-xl w-52 space-y-3">
          {/* Name + Bild */}
          <div className="flex items-center gap-2">
            {picture ? (
              <Image src={picture} alt={displayText ?? label} width={32} height={32} unoptimized
                className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">{icon}</div>
            )}
            <p className="text-white text-xs font-semibold truncate flex-1">{displayText ?? label}</p>
          </div>
          {/* Aktionen */}
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); onChange(); }}
              className="flex-1 text-xs px-2 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition-colors"
            >
              Ändern
            </button>
            {onUnlink && (
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); onUnlink(); }}
                disabled={unlinkLoading}
                className="flex-1 text-xs px-2 py-1.5 rounded-xl bg-red-900/30 hover:bg-red-900/60 text-red-400 font-semibold transition-colors disabled:opacity-40"
              >
                {unlinkLoading ? '…' : 'Trennen'}
              </button>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="absolute top-2 right-2 text-zinc-600 hover:text-white">
            <FaTimes size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
