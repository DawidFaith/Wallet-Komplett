'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook, FaYoutube,
  FaCheck, FaCoins, FaStar, FaLock, FaPlus, FaCrown,
} from 'react-icons/fa';
import SocialVerifyModal from './profile/SocialVerifyModal';
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

interface ProfileTabProps {
  language: SupportedLanguage;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const LS_KEY = 'dfaith_primary_platform';

export default function ProfileTab({ language: _language }: ProfileTabProps) {
  const account = useActiveAccount();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState<SocialPlatform | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [unlinkPending, setUnlinkPending] = useState<AnyPlatform | null>(null);

  const [primaryPlatform, setPrimaryPlatformState] = useState<AnyPlatform | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LS_KEY) as AnyPlatform | null;
      setPrimaryPlatformState(stored);
    }
  }, []);

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
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

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

  useEffect(() => { loadProfile(); }, [loadProfile]);

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

      {/* ── UserBoard ─────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">

        {/* Avatar + Name + Credits + Level */}
        <div className="flex items-center gap-4">
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
            <p className="text-white font-bold text-lg truncate">{profileInfo.name}</p>
            {!primaryPlatform && (
              <p className="text-zinc-600 text-xs mb-1">Wähle ein Profil als Anzeigename ↓</p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <FaCoins className="text-yellow-400" size={13} />
              <span className="text-yellow-300 font-bold text-sm">
                {loading ? '–' : (data?.credits ?? 0).toFixed(2)} DFAITH Credits
              </span>
            </div>
          </div>

          {data && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-red-600 flex items-center justify-center">
                <span className="text-white font-black text-sm">{data.level}</span>
              </div>
              <span className="text-zinc-500 text-xs font-semibold">Level</span>
            </div>
          )}
        </div>

        {/* XP-Balken */}
        {data && (
          <div>
            <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
              <span className="flex items-center gap-1">
                <FaStar size={10} className="text-yellow-500" />
                {data.currentXp} / {data.nextLevelXp} XP bis Level {data.level + 1}
              </span>
              <span>{data.xp} XP gesamt</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-700"
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800" />

        {/* Soziale Profile 2×2 Grid */}
        <div>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">Soziale Profile</p>
          <div className="grid grid-cols-2 gap-3">

            <SocialTile
              platform="youtube"
              icon={<FaYoutube className="text-red-500" size={14} />}
              label="YouTube"
              bgColor="bg-red-900/20"
              borderColor="border-red-800/30"
              name={p?.youtubeChannelName ?? null}
              handle={p?.youtubeChannelName ?? null}
              picture={p?.youtubeChannelThumbnail ?? null}
              verified={p?.youtubeVerified ?? false}
              isPrimary={primaryPlatform === 'youtube'}
              onSetPrimary={() => setPrimaryPlatform('youtube')}
              onVerify={() => setShowYoutubeModal(true)}
              onUnlink={p?.youtubeChannelId ? handleUnlinkYoutube : undefined}
              unlinkLoading={unlinkPending === 'youtube'}
            />

            <SocialTile
              platform="instagram"
              icon={<FaInstagram className="text-pink-500" size={14} />}
              label="Instagram"
              bgColor="bg-pink-900/20"
              borderColor="border-pink-800/30"
              name={p?.instagramName ?? null}
              handle={p?.instagramHandle ?? null}
              picture={p?.instagramPicture ?? null}
              verified={p?.instagramVerified ?? false}
              isPrimary={primaryPlatform === 'instagram'}
              onSetPrimary={() => setPrimaryPlatform('instagram')}
              onVerify={() => setVerifyModal('instagram')}
              onUnlink={p?.instagramHandle ? () => handleUnlink('instagram') : undefined}
              unlinkLoading={unlinkPending === 'instagram'}
            />

            <SocialTile
              platform="tiktok"
              icon={<FaTiktok className="text-zinc-200" size={13} />}
              label="TikTok"
              bgColor="bg-zinc-800/60"
              borderColor="border-zinc-700/30"
              name={p?.tiktokName ?? null}
              handle={p?.tiktokHandle ?? null}
              picture={p?.tiktokPicture ?? null}
              verified={p?.tiktokVerified ?? false}
              isPrimary={primaryPlatform === 'tiktok'}
              onSetPrimary={() => setPrimaryPlatform('tiktok')}
              onVerify={() => setVerifyModal('tiktok')}
              onUnlink={p?.tiktokHandle ? () => handleUnlink('tiktok') : undefined}
              unlinkLoading={unlinkPending === 'tiktok'}
            />

            <SocialTile
              platform="facebook"
              icon={<FaFacebook className="text-blue-500" size={14} />}
              label="Facebook"
              bgColor="bg-blue-900/20"
              borderColor="border-blue-800/30"
              name={p?.facebookName ?? null}
              handle={p?.facebookHandle ?? null}
              picture={p?.facebookPicture ?? null}
              verified={p?.facebookVerified ?? false}
              isPrimary={primaryPlatform === 'facebook'}
              onSetPrimary={() => setPrimaryPlatform('facebook')}
              onVerify={() => setVerifyModal('facebook')}
              onUnlink={p?.facebookHandle ? () => handleUnlink('facebook') : undefined}
              unlinkLoading={unlinkPending === 'facebook'}
            />

          </div>
        </div>
      </div>

      {/* ── Quest Board ────────────────────────────────────────── */}
      <QuestBoardTab language={_language} />

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

interface SocialTileProps {
  platform: AnyPlatform;
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  borderColor: string;
  name: string | null;
  handle: string | null;
  picture: string | null;
  verified: boolean;
  isPrimary: boolean;
  onSetPrimary: () => void;
  onVerify: () => void;
  onUnlink?: () => void;
  unlinkLoading?: boolean;
}

function SocialTile({
  icon, label, bgColor, borderColor,
  name, handle, picture, verified,
  isPrimary, onSetPrimary, onVerify, onUnlink, unlinkLoading,
}: SocialTileProps) {
  const isLinked = !!handle;
  const displayText = name ?? (handle ? `@${handle}` : null);

  return (
    <div className={`relative ${bgColor} border ${isPrimary ? 'border-red-500/60 ring-1 ring-red-500/30' : borderColor} rounded-xl p-3 flex flex-col gap-2 transition-all`}>
      {isPrimary && (
        <div className="absolute top-2 right-2">
          <FaCrown size={11} className="text-yellow-400" />
        </div>
      )}

      <div className="flex items-center gap-1.5 pr-4">
        {icon}
        <span className="text-zinc-400 text-xs font-semibold flex-1">{label}</span>
        {verified && <FaCheck size={9} className="text-green-400 shrink-0" />}
      </div>

      <div className="flex items-center gap-2">
        {isLinked && picture ? (
          <Image src={picture} alt={displayText ?? label} width={28} height={28} unoptimized
            className="w-7 h-7 rounded-full shrink-0 object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-zinc-700/60 shrink-0 flex items-center justify-center">
            {icon}
          </div>
        )}
        <p className={`text-xs font-semibold truncate flex-1 ${isLinked ? 'text-white' : 'text-zinc-600 italic'}`}>
          {displayText ?? 'Nicht verknüpft'}
        </p>
      </div>

      <div className="flex items-center gap-1 mt-auto flex-wrap">
        {isLinked ? (
          <>
            {!isPrimary && (
              <button
                onClick={onSetPrimary}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-300 transition-colors"
              >
                <FaCrown size={8} /> Wählen
              </button>
            )}
            <button
              onClick={onVerify}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Ändern
            </button>
            {onUnlink && (
              <button
                onClick={onUnlink}
                disabled={unlinkLoading}
                className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/50 text-red-400 disabled:opacity-40 transition-colors"
                title="Trennen"
              >
                {unlinkLoading ? '…' : '✕'}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onVerify}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <FaPlus size={8} /> Verknüpfen
          </button>
        )}
      </div>
    </div>
  );
}
