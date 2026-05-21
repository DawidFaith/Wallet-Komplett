'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook, FaYoutube,
  FaCheck, FaCoins, FaStar, FaLock, FaPlus, FaChevronDown,
  FaPen, FaMusic, FaTimes, FaInfoCircle, FaTrophy,
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
    displayPlatform: string | null;
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
  onNavigate?: (tab: string) => void;
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

export default function ProfileTab({ language: _language, onNavigate }: ProfileTabProps) {
  const { user: _clerkUser } = useUser();
  const account = _clerkUser?.id ? { address: _clerkUser.id } : null;
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
  const [claimModal, setClaimModal] = useState<{ sentAmount: number } | null>(null);
  const [repData, setRepData] = useState<{ reputation: number; level: number; levelName: string; progress: number; nextLevelRep: number | null } | null>(null);
  // Reputation des Users bei ausgewähltem Artist laden
  useEffect(() => {
    if (!account?.address || !selectedArtist) { setRepData(null); return; }
    fetch(`/api/reputation?wallet=${account.address}&artistWallet=${selectedArtist.walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setRepData(d && !d.error ? d : null))
      .catch(() => setRepData(null));
  }, [account?.address, selectedArtist?.walletAddress]);
  const [artistSaving, setArtistSaving] = useState(false);
  // Meta Business Partner
  const [metaIgVerified, setMetaIgVerified] = useState(false);
  const [metaFbVerified, setMetaFbVerified] = useState(false);
  const [metaBusinessId, setMetaBusinessId] = useState<string | null>(null);
  const [metaIgLoading, setMetaIgLoading] = useState(false);
  const [metaFbLoading, setMetaFbLoading] = useState(false);
  const [metaIgMsg, setMetaIgMsg] = useState('');
  const [metaFbMsg, setMetaFbMsg] = useState('');
  // Artist-Profil bearbeiten
  const [editingArtist, setEditingArtist] = useState(false);
  const [artistTypeInput, setArtistTypeInput] = useState('');
  const [artistBioInput, setArtistBioInput] = useState('');
  const [artistRewardTokenInput, setArtistRewardTokenInput] = useState('');
  const [artistDisplayPlatformInput, setArtistDisplayPlatformInput] = useState<string | null>(null);

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

  const loadMetaPartnerStatus = useCallback(async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`/api/artist/meta-partner-check?wallet=${account.address}`);
      if (res.ok) {
        const d = await res.json();
        setMetaIgVerified(d.igVerified ?? false);
        setMetaFbVerified(d.fbVerified ?? false);
        if (d.businessId) setMetaBusinessId(d.businessId);
      }
    } catch { /* ignorieren */ }
  }, [account?.address]);

  const handleMetaCheck = useCallback(async (type: 'instagram' | 'facebook') => {
    if (!account?.address) return;
    const setLoading = type === 'instagram' ? setMetaIgLoading : setMetaFbLoading;
    const setMsg     = type === 'instagram' ? setMetaIgMsg     : setMetaFbMsg;
    const setVerified = type === 'instagram' ? setMetaIgVerified : setMetaFbVerified;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(
        `/api/artist/meta-partner-check?wallet=${account.address}&type=${type}`,
        { method: 'POST' },
      );
      const d = await res.json();
      console.log('[meta-partner-check]', type, d);
      if (d.businessId) setMetaBusinessId(d.businessId);
      setVerified(d.verified ?? false);
      setMsg(d.hint ?? (d.error ? `❌ ${d.error}` : ''));
    } catch {
      setMsg('❌ Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  const handleClaim = useCallback(async () => {
    if (!account?.address || !data || data.credits <= 0) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/youtube-quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address, amount: data.credits }),
      });
      if (res.ok) {
        const json = await res.json();
        const sentAmount: number = json.sentAmount ?? data.credits;
        await loadProfile();
        setClaimModal({ sentAmount });
      }
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
          displayPlatform: artistDisplayPlatformInput,
        }),
      });
      setEditingArtist(false);
      await loadProfile();
    } finally {
      setArtistSaving(false);
    }
  }, [account?.address, artistTypeInput, artistBioInput, artistRewardTokenInput, artistDisplayPlatformInput, loadProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { loadMetaPartnerStatus(); }, [loadMetaPartnerStatus]);

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
        <div className="w-20 h-20 rounded-full bg-[#231e12] border-2 border-white/[0.1] flex items-center justify-center mb-5">
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
    return { name: 'Nicht verbunden', picture: null };
  })();

  const noSocials = linkedPlatforms.length === 0;
  const initials = noSocials ? '?' : (p?.displayName?.slice(0, 2) ?? '??').toUpperCase();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-16 space-y-5">

      {/* ── Page Title ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <img src="/D.FAITH.png" alt="D.FAITH" className="w-10 h-10 rounded-full object-contain shrink-0" />
        <div>
          <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
          <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">Unterstütze Artists · Verdiene Rewards</p>
        </div>
      </div>

      {/* ── Supporter ─────────────────────────────────────────── */}
      <div className="bg-white/[0.06] rounded-2xl border border-white/[0.1] p-5 space-y-4">
        <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em] mb-1">Supporter</p>

        {/* Avatar + Name (Clerk-Profil) */}
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            {_clerkUser?.imageUrl ? (
              <Image
                src={_clerkUser.imageUrl}
                alt="Profil"
                width={64}
                height={64}
                unoptimized
                className="w-16 h-16 rounded-full object-cover ring-2 ring-amber-500/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-2xl select-none">
                {(_clerkUser?.fullName ?? _clerkUser?.username ?? '?').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-white truncate">
              {_clerkUser?.fullName ?? _clerkUser?.username ?? shortenAddress(account.address)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.1]" />

        {/* ── Artist-Info (nur wenn is_artist) ── */}
        {p?.isArtist && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em] flex items-center gap-1.5">
                <FaMusic size={10} className="text-amber-400" /> Artist-Profil
              </p>
              {!editingArtist && (
                <button
                  onClick={() => {
                    setArtistTypeInput(p.artistType ?? '');
                    setArtistBioInput(p.artistBio ?? '');
                    setArtistRewardTokenInput(p.rewardToken ?? 'D.FAITH');
                    setArtistDisplayPlatformInput(p.displayPlatform ?? null);
                    setEditingArtist(true);
                  }}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/[0.1] px-2 py-1 rounded-lg transition-colors"
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
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-500/50 transition-colors"
                />
                <textarea
                  value={artistBioInput}
                  onChange={(e) => setArtistBioInput(e.target.value)}
                  placeholder="Warum solltest du supported werden? (Bio)"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-500/50 transition-colors resize-none"
                />
                {/* Öffentliches Profil-Bild wählen */}
                {(() => {
                  const options: { key: string; icon: React.ReactNode; label: string; available: boolean }[] = [
                    { key: 'youtube',   icon: <FaYoutube className="text-red-500" size={12} />,    label: 'YouTube',   available: !!(p?.youtubeVerified) },
                    { key: 'instagram', icon: <FaInstagram className="text-pink-500" size={12} />, label: 'Instagram', available: !!(p?.instagramHandle) },
                    { key: 'tiktok',    icon: <FaTiktok className="text-zinc-200" size={11} />,    label: 'TikTok',    available: !!(p?.tiktokHandle) },
                    { key: 'facebook',  icon: <FaFacebook className="text-blue-500" size={12} />,  label: 'Facebook',  available: !!(p?.facebookHandle) },
                  ].filter(o => o.available);
                  if (options.length === 0) return null;
                  return (
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1.5">Angezeigtes Profil-Bild</p>
                      <div className="flex gap-2 flex-wrap">
                        {options.map(o => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setArtistDisplayPlatformInput(artistDisplayPlatformInput === o.key ? null : o.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              artistDisplayPlatformInput === o.key
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {o.icon} {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingArtist(false)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-zinc-400 hover:bg-white/10 transition-colors">
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveArtistInfo}
                    disabled={artistSaving}
                    className="text-xs px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold disabled:opacity-50 transition-colors"
                  >
                    {artistSaving ? 'Speichern…' : 'Speichern'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#231e12]/50 rounded-xl p-3 space-y-1.5">
                {p.artistType && (
                  <p className="text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                    <FaMusic size={9} /> {p.artistType}
                  </p>
                )}
                {p.artistBio ? (
                  <p className="text-zinc-400 text-xs leading-relaxed">{p.artistBio}</p>
                ) : (
                  <p className="text-zinc-400 text-xs italic">Noch keine Bio eingetragen</p>
                )}
                {!p.artistType && !p.artistBio && (
                  <p className="text-zinc-400 text-xs italic">Klicke &bdquo;Bearbeiten&ldquo; um dein Artist-Profil auszufüllen</p>
                )}
                {/* Vorschau: welches Profilbild Fans sehen */}
                {(() => {
                  const dp = p.displayPlatform;
                  let pic: string | null = null;
                  let label = 'Kein Profilbild gewählt';
                  let icon: React.ReactNode = null;
                  if (dp === 'youtube' && p.youtubeVerified) {
                    pic = p.youtubeChannelThumbnail ?? null;
                    label = p.youtubeChannelName ?? 'YouTube';
                    icon = <FaYoutube className="text-red-500" size={10} />;
                  } else if (dp === 'instagram' && p.instagramHandle) {
                    pic = p.instagramPicture ?? null;
                    label = p.instagramName ?? `@${p.instagramHandle}`;
                    icon = <FaInstagram className="text-pink-500" size={10} />;
                  } else if (dp === 'tiktok' && p.tiktokHandle) {
                    pic = p.tiktokPicture ?? null;
                    label = p.tiktokName ?? `@${p.tiktokHandle}`;
                    icon = <FaTiktok className="text-zinc-200" size={10} />;
                  } else if (dp === 'facebook' && p.facebookHandle) {
                    pic = p.facebookPicture ?? null;
                    label = p.facebookName ?? `@${p.facebookHandle}`;
                    icon = <FaFacebook className="text-blue-500" size={10} />;
                  }
                  return (
                    <div className="pt-1.5 border-t border-white/[0.06] flex items-center gap-2">
                      <p className="text-zinc-600 text-[10px] uppercase tracking-widest shrink-0">Öffentlich:</p>
                      {pic
                        ? <img src={pic} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                        : <div className="w-6 h-6 rounded-full bg-zinc-700 shrink-0" />}
                      <span className="text-zinc-400 text-xs flex items-center gap-1">{icon} {label}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Meta Quest-Freischaltung: Instagram + Facebook (kombiniert) ── */}
            {(() => {
              const bothVerified = metaIgVerified && metaFbVerified;
              const igVerified = metaIgVerified;
              const fbVerified = metaFbVerified;
              const hasIg = !!p?.instagramHandle;
              const hasFb = !!p?.facebookHandle;
              return (
                <div className={`rounded-xl p-3 space-y-2.5 border ${bothVerified ? 'bg-green-950/30 border-green-500/20' : 'bg-[#0d1020]/60 border-white/[0.08]'}`}>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] flex items-center gap-1.5 text-zinc-400">
                      <FaInstagram size={10} className="text-pink-400" />
                      <span className="text-zinc-600">/</span>
                      <FaFacebook size={10} className="text-blue-400" />
                      Instagram &amp; Facebook Quests
                    </p>
                    {bothVerified
                      ? <span className="text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full flex items-center gap-1"><FaCheck size={7} /> Freigeschaltet</span>
                      : <span className="text-[10px] text-zinc-600 flex items-center gap-1"><FaLock size={8} /> Gesperrt</span>
                    }
                  </div>

                  {/* Voraussetzungen-Box */}
                  {(!igVerified || !fbVerified) && (
                    <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg px-2.5 py-2 text-[10px] text-amber-400/80 space-y-1">
                      <p className="font-bold text-amber-400">⚠️ Voraussetzungen (einmalig):</p>
                      <p>› <strong className="text-amber-300">Facebook Page erstellen</strong> — nur über eine Page bekommst du Zugang zur Meta Business Suite. Eine leere Page reicht.</p>
                      <p>› Instagram muss ein <strong className="text-amber-300">Business- oder Creator-Konto</strong> sein (IG → Einstellungen → Konto → Zu Professional-Konto wechseln)</p>
                      <p>› Instagram mit der Facebook Page verknüpfen (IG → Einstellungen → Verknüpfte Konten → Facebook)</p>
                    </div>
                  )}

                  {/* Schritt-für-Schritt-Anleitung */}
                  {(!igVerified || !fbVerified) && (
                    <ol className="text-zinc-500 text-[11px] space-y-1 pl-0">
                      {([
                        <React.Fragment key={0}>Öffne <a href="https://business.facebook.com/settings/partners/add" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline underline-offset-2 hover:text-violet-300">dein Meta Business Center → Partner hinzufügen</a> <span className="text-amber-500/80">(business.facebook.com — Zugang nur mit Facebook Page möglich)</span></React.Fragment>,
                        <React.Fragment key={1}>Business-ID von D.Faith Ecosystem eingeben{metaBusinessId ? <span className="ml-1 font-mono text-white bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{metaBusinessId}</span> : ''}</React.Fragment>,
                        <React.Fragment key={2}>Einem Partner <strong className="text-zinc-300">Zugriff auf deine Assets gestatten</strong> auswählen</React.Fragment>,
                        <React.Fragment key={3}>
                          <span>Deine <strong className="text-zinc-300">Facebook Page</strong> auswählen <span className="text-amber-500/80">(nicht das IG-Konto direkt!)</span> — alle Berechtigungen aktivieren:
                            <ul className="mt-1 space-y-0.5 pl-1 text-zinc-600">
                              <li className="flex gap-1.5 items-start"><span className="text-violet-500/70 shrink-0">›</span><span><span className="text-zinc-400">Inhalte</span> — Beiträge, <strong className="text-pink-400/80">Stories</strong> &amp; mehr</span></li>
                              <li className="flex gap-1.5 items-start"><span className="text-violet-500/70 shrink-0">›</span><span><span className="text-zinc-400">Nachrichten</span> — DMs senden &amp; beantworten</span></li>
                              <li className="flex gap-1.5 items-start"><span className="text-violet-500/70 shrink-0">›</span><span><span className="text-zinc-400">Community-Interaktionen</span> — Kommentare verwalten</span></li>
                              <li className="flex gap-1.5 items-start"><span className="text-violet-500/70 shrink-0">›</span><span><span className="text-zinc-400">Werbeanzeigen</span> — Anzeigen erstellen &amp; verwalten</span></li>
                              <li className="flex gap-1.5 items-start"><span className="text-violet-500/70 shrink-0">›</span><span><span className="text-zinc-400">Insights</span> — Performance einsehen</span></li>
                            </ul>
                          </span>
                        </React.Fragment>,
                        <React.Fragment key={4}>Unten die beiden Buttons &bdquo;IG prüfen&ldquo; &amp; &bdquo;FB prüfen&ldquo; klicken &mdash; System-Zugriff wird automatisch eingerichtet</React.Fragment>,
                      ] as React.ReactNode[]).map((step, i) => (
                        <li key={i} className="flex gap-2"><span className="text-zinc-600 shrink-0 font-bold">{i + 1}.</span><span>{step}</span></li>
                      ))}
                    </ol>
                  )}

                  {/* Status + Prüfen-Buttons */}
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    {/* Instagram */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleMetaCheck('instagram')}
                        disabled={metaIgLoading || !hasIg}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-semibold disabled:opacity-40 transition-colors ${igVerified ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-pink-500/15 hover:bg-pink-500/25 border-pink-500/25 text-pink-300'}`}
                      >
                        {metaIgLoading
                          ? <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                          : igVerified ? <FaCheck size={9} /> : <FaInstagram size={10} />}
                        {igVerified ? 'IG ✓' : 'IG prüfen'}
                      </button>
                      {!hasIg && <span className="text-amber-500/70 text-[10px]">⚠️ Instagram-Konto verbinden</span>}
                      {metaIgMsg && !igVerified && <span className="text-[11px] text-zinc-400 flex-1 leading-relaxed">{metaIgMsg}</span>}
                    </div>

                    {/* Facebook */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleMetaCheck('facebook')}
                        disabled={metaFbLoading || !hasFb}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-semibold disabled:opacity-40 transition-colors ${fbVerified ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/25 text-blue-300'}`}
                      >
                        {metaFbLoading
                          ? <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                          : fbVerified ? <FaCheck size={9} /> : <FaFacebook size={10} />}
                        {fbVerified ? 'FB ✓' : 'FB prüfen'}
                      </button>
                      {!hasFb && <span className="text-amber-500/70 text-[10px]">⚠️ Facebook-Konto verbinden</span>}
                      {metaFbMsg && !fbVerified && <span className="text-[11px] text-zinc-400 flex-1 leading-relaxed">{metaFbMsg}</span>}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Divider vor Sozialen Profilen (nur wenn Artist-Sektion sichtbar) */}
        {p?.isArtist && <div className="border-t border-white/[0.1]" />}

        {/* Soziale Profile – kompakte Icon-Reihe */}
        <div>
          <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em] mb-3">Deine Plattformen</p>
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
        <div className="bg-white/[0.06] rounded-2xl border border-white/[0.1] p-5">
          <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em] mb-4">Artists</p>
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
                        className={`w-14 h-14 rounded-full object-cover transition-transform group-hover:scale-105 ${isSelected ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : hasQuests ? 'ring-2 ring-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'ring-2 ring-white/10'}`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-amber-700 to-amber-400 flex items-center justify-center text-black font-bold text-lg select-none transition-transform group-hover:scale-105 ${isSelected ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : hasQuests ? 'ring-2 ring-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'ring-2 ring-white/10'}`}>
                        {artist.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {hasQuests && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-amber-400 text-black text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-lg animate-pulse">
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
              <div className="mt-4 pt-4 border-t border-white/[0.1] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedArtist.picture ? (
                    <Image src={selectedArtist.picture} alt={selectedArtist.name} width={44} height={44} unoptimized
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-500/40" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-700 to-amber-400 flex items-center justify-center text-black font-bold text-sm">
                      {selectedArtist.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{selectedArtist.name}</p>
                    {selectedArtist.artistType && (
                      <p className="text-amber-400 text-xs flex items-center gap-1"><FaMusic size={8} /> {selectedArtist.artistType}</p>
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
                <span className="text-white font-bold tracking-wide">Reward Token</span>
                <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
                <span className="text-white font-bold tracking-wide">{selectedArtist.rewardToken ?? 'D.FAITH'}</span>
              </div>
              <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-3 py-1.5">
                  <Image src="/D.FAITH.png" alt="D.FAITH" width={16} height={16} className="w-4 h-4 rounded-full shrink-0" />
                  <span className="text-yellow-300 font-semibold text-xs flex-1">
                    {(data?.credits ?? 0).toFixed(2)} D.FAITH Credits
                  </span>
                  <button
                    onClick={handleClaim}
                    disabled={claiming || (data?.credits ?? 0) <= 0}
                    className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-xs px-3 py-1 rounded-lg transition-colors"
                  >
                    {claiming ? '…' : 'Einlösen'}
                  </button>
                </div>
              {/* Reputation bei diesem Artist */}
              {repData && (
                <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-700/20 rounded-xl px-3 py-2">
                  <FaTrophy className="text-amber-400 shrink-0" size={14} />
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-300 text-xs font-semibold">
                      Lv.{repData.level} &ndash; {repData.levelName}
                    </p>
                    <p className="text-zinc-500 text-[10px]">{repData.reputation.toLocaleString()} REP bei diesem Artist</p>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('reputation')}
                      className="text-amber-400 hover:text-amber-300 text-xs font-semibold shrink-0 transition-colors"
                    >
                      Details →
                    </button>
                  )}
                </div>
              )}
              {onNavigate && (
                <button
                  onClick={() => onNavigate('reputation')}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-colors"
                >
                  <FaTrophy size={11} /> Zum Reputation-Tab
                </button>
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
          <div className="w-full max-w-md bg-[#1a150a] border border-white/8 rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <FaYoutube className="text-red-500" size={20} />
                <span className="text-white font-bold text-base">YouTube</span>
              </div>
              <button onClick={() => setShowYoutubeManage(false)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
            </div>
            {/* Kanal-Info */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/[0.1] rounded-xl p-3">
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
                className="flex-1 bg-white/5 border border-white/8 hover:bg-white/10 text-zinc-300 font-semibold text-sm py-2.5 rounded-xl transition-colors"
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

      {/* Einlösen-Erfolgs-Modal */}
      {claimModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setClaimModal(null)}
        >
          <div
            className="w-full max-w-sm bg-[#1a150a] border border-amber-700/40 rounded-2xl p-6 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto">
              <Image src="/D.FAITH.png" alt="D.FAITH" width={64} height={64} className="w-16 h-16 object-contain" />
            </div>
            <h3 className="text-white font-bold text-lg">Erfolgreich eingelöst!</h3>
            <p className="text-zinc-400 text-sm">Folgende Menge wurde an deine Wallet gesendet:</p>
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl py-3 px-4 flex items-center justify-center gap-2">
              <Image src="/D.FAITH.png" alt="D.FAITH" width={28} height={28} className="w-7 h-7 object-contain" />
              <span className="text-yellow-300 font-bold text-2xl">{claimModal.sentAmount.toFixed(2)}</span>
              <span className="text-yellow-500 font-semibold text-sm">D.FAITH</span>
            </div>
            <button
              onClick={() => setClaimModal(null)}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors"
            >
              OK
            </button>
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
          onDone={() => { loadProfile(); }}
          onClose={() => { setVerifyModal(null); loadProfile(); }}
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
        className="flex items-center gap-1.5 bg-[#231e12]/60 border border-white/[0.1] hover:border-zinc-500 text-zinc-400 hover:text-white rounded-xl px-3 py-2 text-xs font-semibold transition-all"
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
        className="flex items-center gap-1.5 bg-[#231e12]/60 border border-green-700/40 hover:border-green-500/60 text-white rounded-xl px-3 py-2 text-xs font-semibold transition-all"
      >
        {icon}
        {label}
        <FaCheck size={9} className="text-green-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-[#1a150a] border border-white/8 rounded-2xl p-3 shadow-xl w-52 space-y-3">
          {/* Name + Bild */}
          <div className="flex items-center gap-2">
            {picture ? (
              <Image src={picture} alt={displayText ?? label} width={32} height={32} unoptimized
                className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#2d2615] flex items-center justify-center shrink-0">{icon}</div>
            )}
            <p className="text-white text-xs font-semibold truncate flex-1">{displayText ?? label}</p>
          </div>
          {/* Aktionen */}
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); onChange(); }}
              className="flex-1 text-xs px-2 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 text-zinc-300 font-semibold transition-colors"
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
