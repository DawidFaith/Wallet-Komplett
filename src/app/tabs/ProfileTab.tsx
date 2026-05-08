'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook, FaYoutube,
  FaCheck, FaCoins, FaStar, FaLock, FaPlus, FaPen, FaTimes,
} from 'react-icons/fa';
import SocialVerifyModal from './profile/SocialVerifyModal';
import LinkChannelView from './quest-board/fan/LinkChannelView';
import QuestBoardTab from './QuestBoardTab';
import type { SupportedLanguage } from '../utils/deepLTranslation';

type SocialPlatform = 'instagram' | 'tiktok' | 'facebook';

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

export default function ProfileTab({ language: _language }: ProfileTabProps) {
  const account = useActiveAccount();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState<SocialPlatform | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [unlinkPending, setUnlinkPending] = useState<SocialPlatform | null>(null);

  // Profilname bearbeiten
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

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

  const handleSaveName = useCallback(async () => {
    if (!account?.address) return;
    setSavingName(true);
    try {
      await fetch('/api/youtube-quests/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: account.address, displayName: nameInput.trim() || null }),
      });
      setEditingName(false);
      await loadProfile();
    } finally {
      setSavingName(false);
    }
  }, [account?.address, nameInput, loadProfile]);

  const handleUnlink = useCallback(async (platform: SocialPlatform) => {
    if (!account?.address) return;
    setUnlinkPending(platform);
    try {
      await fetch('/api/youtube-quests/social-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address, platform, action: 'unlink' }),
      });
      await loadProfile();
    } finally {
      setUnlinkPending(null);
    }
  }, [account?.address, loadProfile]);

  const handleUnlinkYoutube = useCallback(async () => {
    if (!account?.address) return;
    setUnlinkPending('youtube' as SocialPlatform);
    try {
      await fetch('/api/youtube-quests/verify-channel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address }),
      });
      await loadProfile();
    } finally {
      setUnlinkPending(null);
    }
  }, [account?.address, loadProfile]);

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
  const displayName = p?.displayName || shortenAddress(account.address);
  const initials = account.address.slice(2, 4).toUpperCase();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-16 space-y-5">

      {/* ── UserBoard ─────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">

        {/* Avatar + Name + Credits */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 flex items-center justify-center shrink-0 text-white font-bold text-2xl select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {/* Editierbarer Name */}
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  maxLength={32}
                  placeholder="Dein Name…"
                  className="bg-zinc-800 border border-zinc-600 focus:border-red-500 outline-none text-white font-bold text-base rounded-lg px-3 py-1 w-full"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="shrink-0 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {savingName ? '…' : 'Speichern'}
                </button>
                <button onClick={() => setEditingName(false)} className="shrink-0 text-zinc-500 hover:text-white">
                  <FaTimes size={14} />
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 group mb-0.5"
                onClick={() => { setNameInput(p?.displayName ?? ''); setEditingName(true); }}
              >
                <span className="text-white font-bold text-lg truncate">{displayName}</span>
                <FaPen size={11} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
              </button>
            )}
            <p className="text-zinc-600 text-xs font-mono truncate">{account.address}</p>
            {/* Credits */}
            <div className="flex items-center gap-1.5 mt-2">
              <FaCoins className="text-yellow-400" size={13} />
              <span className="text-yellow-300 font-bold text-sm">
                {loading ? '–' : (data?.credits ?? 0).toFixed(2)} DFAITH Credits
              </span>
            </div>
          </div>
          {/* Level Badge (rechts) */}
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
              <span className="flex items-center gap-1"><FaStar size={10} className="text-yellow-500" />{data.currentXp} / {data.nextLevelXp} XP bis Level {data.level + 1}</span>
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
              icon={<FaYoutube className="text-red-500" size={14} />}
              label="YouTube"
              bgColor="bg-red-900/20"
              borderColor="border-red-800/30"
              name={p?.youtubeChannelName ?? null}
              handle={p?.youtubeChannelName ?? null}
              picture={p?.youtubeChannelThumbnail ?? null}
              verified={p?.youtubeVerified ?? false}
              onVerify={() => setShowYoutubeModal(true)}
              onUnlink={p?.youtubeChannelId ? handleUnlinkYoutube : undefined}
              unlinkLoading={unlinkPending === ('youtube' as SocialPlatform)}
            />

            <SocialTile
              icon={<FaInstagram className="text-pink-500" size={14} />}
              label="Instagram"
              bgColor="bg-pink-900/20"
              borderColor="border-pink-800/30"
              name={p?.instagramName ?? null}
              handle={p?.instagramHandle ?? null}
              picture={p?.instagramPicture ?? null}
              verified={p?.instagramVerified ?? false}
              onVerify={() => setVerifyModal('instagram')}
              onUnlink={p?.instagramHandle ? () => handleUnlink('instagram') : undefined}
              unlinkLoading={unlinkPending === 'instagram'}
            />

            <SocialTile
              icon={<FaTiktok className="text-zinc-200" size={13} />}
              label="TikTok"
              bgColor="bg-zinc-800/60"
              borderColor="border-zinc-700/30"
              name={p?.tiktokName ?? null}
              handle={p?.tiktokHandle ?? null}
              picture={p?.tiktokPicture ?? null}
              verified={p?.tiktokVerified ?? false}
              onVerify={() => setVerifyModal('tiktok')}
              onUnlink={p?.tiktokHandle ? () => handleUnlink('tiktok') : undefined}
              unlinkLoading={unlinkPending === 'tiktok'}
            />

            <SocialTile
              icon={<FaFacebook className="text-blue-500" size={14} />}
              label="Facebook"
              bgColor="bg-blue-900/20"
              borderColor="border-blue-800/30"
              name={p?.facebookName ?? null}
              handle={p?.facebookHandle ?? null}
              picture={p?.facebookPicture ?? null}
              verified={p?.facebookVerified ?? false}
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
              <button
                onClick={() => setShowYoutubeModal(false)}
                className="text-zinc-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
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

// ─── SocialTile (2×2 Grid) ────────────────────────────────────────────────────

interface SocialTileProps {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  borderColor: string;
  name: string | null;
  handle: string | null;
  picture: string | null;
  verified: boolean;
  onVerify: (() => void) | null;
  onUnlink?: () => void;
  unlinkLoading?: boolean;
}

function SocialTile({ icon, label, bgColor, borderColor, name, handle, picture, verified, onVerify, onUnlink, unlinkLoading }: SocialTileProps) {
  const isLinked = !!handle;
  const displayText = name ?? (handle ? `@${handle}` : null);

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-3 flex flex-col gap-2`}>
      {/* Header: Icon + Label + Verified */}
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-zinc-400 text-xs font-semibold flex-1">{label}</span>
        {verified && <FaCheck size={9} className="text-green-400 shrink-0" />}
      </div>

      {/* Avatar + Name */}
      <div className="flex items-center gap-2">
        {isLinked && picture ? (
          <Image
            src={picture}
            alt={displayText ?? label}
            width={28}
            height={28}
            unoptimized
            className="w-7 h-7 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-zinc-700/60 shrink-0 flex items-center justify-center">
            {icon}
          </div>
        )}
        <p className={`text-xs font-semibold truncate flex-1 ${isLinked ? 'text-white' : 'text-zinc-600 italic'}`}>
          {displayText ?? 'Nicht verknüpft'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 mt-auto">
        {!verified && onVerify && (
          <button
            onClick={onVerify}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors bg-zinc-700/60 hover:bg-zinc-700 text-zinc-300 flex-1 justify-center"
          >
            {isLinked ? 'Ändern' : <><FaPlus size={8} /> Verknüpfen</>}
          </button>
        )}
        {verified && (
          <span className="flex items-center gap-1 text-green-400 text-xs font-semibold flex-1">
            <FaCheck size={9} /> Verifiziert
          </span>
        )}
        {isLinked && onUnlink && (
          <button
            onClick={onUnlink}
            disabled={unlinkLoading}
            className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors bg-red-900/30 hover:bg-red-900/60 text-red-400 disabled:opacity-40"
            title="Trennen"
          >
            {unlinkLoading ? '…' : '✕'}
          </button>
        )}
      </div>
    </div>
  );
}


type SocialPlatform = 'instagram' | 'tiktok' | 'facebook';

interface ProfileData {
  xp: number;
  credits: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
  profile: {
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

export default function ProfileTab({ language: _language }: ProfileTabProps) {
  const account = useActiveAccount();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState<SocialPlatform | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [unlinkPending, setUnlinkPending] = useState<SocialPlatform | null>(null);

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
      await loadProfile();
    } finally {
      setUnlinkPending(null);
    }
  }, [account?.address, loadProfile]);

  const handleUnlinkYoutube = useCallback(async () => {
    if (!account?.address) return;
    setUnlinkPending('youtube' as SocialPlatform);
    try {
      await fetch('/api/youtube-quests/verify-channel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address }),
      });
      await loadProfile();
    } finally {
      setUnlinkPending(null);
    }
  }, [account?.address, loadProfile]);

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

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-16 space-y-5">

      {/* ── Profil-Header ─────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 flex items-center justify-center shrink-0 text-white font-bold text-2xl select-none">
            {account.address.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">{shortenAddress(account.address)}</p>
            <p className="text-zinc-600 text-xs font-mono truncate">{account.address}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <FaCoins className="text-yellow-400" size={13} />
              <span className="text-yellow-300 font-bold text-sm">
                {loading ? '–' : (data?.credits ?? 0)} DFAITH Credits
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Level / XP ────────────────────────────────────────── */}
      {data && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaStar className="text-yellow-400" size={16} />
              <span className="text-white font-bold">Level {data.level}</span>
            </div>
            <span className="text-zinc-500 text-xs">{data.xp} XP gesamt</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
              <span>{data.currentXp} / {data.nextLevelXp} XP</span>
              <span>Level {data.level + 1}</span>
            </div>
            <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-700"
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>
          <p className="text-zinc-600 text-xs">1 DFAITH Reward = 10 XP</p>
        </div>
      )}

      {/* ── Soziale Profile ───────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-3">
        <h3 className="text-white font-bold text-base mb-1">Soziale Profile</h3>

        <SocialRow
          icon={<FaYoutube className="text-red-500" size={18} />}
          label="YouTube"
          name={p?.youtubeChannelName ?? null}
          handle={p?.youtubeChannelName ?? null}
          picture={p?.youtubeChannelThumbnail ?? null}
          verified={p?.youtubeVerified ?? false}
          onVerify={() => setShowYoutubeModal(true)}
          onUnlink={p?.youtubeChannelId ? handleUnlinkYoutube : undefined}
          unlinkLoading={unlinkPending === ('youtube' as SocialPlatform)}
        />

        <SocialRow
          icon={<FaInstagram className="text-pink-500" size={18} />}
          label="Instagram"
          name={p?.instagramName ?? null}
          handle={p?.instagramHandle ?? null}
          picture={p?.instagramPicture ?? null}
          verified={p?.instagramVerified ?? false}
          onVerify={() => setVerifyModal('instagram')}
          onUnlink={p?.instagramHandle ? () => handleUnlink('instagram') : undefined}
          unlinkLoading={unlinkPending === 'instagram'}
        />

        <SocialRow
          icon={<FaTiktok className="text-zinc-200" size={17} />}
          label="TikTok"
          name={p?.tiktokName ?? null}
          handle={p?.tiktokHandle ?? null}
          picture={p?.tiktokPicture ?? null}
          verified={p?.tiktokVerified ?? false}
          onVerify={() => setVerifyModal('tiktok')}
          onUnlink={p?.tiktokHandle ? () => handleUnlink('tiktok') : undefined}
          unlinkLoading={unlinkPending === 'tiktok'}
        />

        <SocialRow
          icon={<FaFacebook className="text-blue-500" size={18} />}
          label="Facebook"
          name={p?.facebookName ?? null}
          handle={p?.facebookHandle ?? null}
          picture={p?.facebookPicture ?? null}
          verified={p?.facebookVerified ?? false}
          onVerify={() => setVerifyModal('facebook')}
          onUnlink={p?.facebookHandle ? () => handleUnlink('facebook') : undefined}
          unlinkLoading={unlinkPending === 'facebook'}
        />
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
              <button
                onClick={() => setShowYoutubeModal(false)}
                className="text-zinc-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
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

// ─── SocialRow ────────────────────────────────────────────────────────────────

interface SocialRowProps {
  icon: React.ReactNode;
  label: string;
  name: string | null;
  handle: string | null;
  picture: string | null;
  verified: boolean;
  onVerify: (() => void) | null;
  onUnlink?: () => void;
  unlinkLoading?: boolean;
  hint?: string;
}

function SocialRow({ icon, label, name, handle, picture, verified, onVerify, onUnlink, unlinkLoading, hint }: SocialRowProps) {
  const isLinked = !!handle;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-8 flex justify-center shrink-0">{icon}</div>
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        {isLinked && picture ? (
          <Image src={picture} alt={name ?? label} width={32} height={32} unoptimized className="w-8 h-8 rounded-full shrink-0 object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-800 shrink-0" />
        )}
        <div className="min-w-0">
          {isLinked ? (
            <>
              <p className="text-white text-sm font-semibold truncate">{name ?? handle}</p>
              {name && handle && name !== handle && (
                <p className="text-zinc-500 text-xs truncate">@{handle}</p>
              )}
            </>
          ) : (
            <p className="text-zinc-600 text-sm italic">{hint ?? 'Nicht verknüpft'}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {verified ? (
          <span className="flex items-center gap-1 text-green-400 text-xs font-semibold bg-green-900/30 px-2 py-1 rounded-full">
            <FaCheck size={9} /> Verifiziert
          </span>
        ) : onVerify ? (
          <button
            onClick={onVerify}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            {isLinked ? 'Ändern' : <><FaPlus size={9} /> Verknüpfen</>}
          </button>
        ) : null}
        {isLinked && onUnlink && (
          <button
            onClick={onUnlink}
            disabled={unlinkLoading}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors bg-red-900/30 hover:bg-red-900/60 text-red-400 disabled:opacity-40"
            title="Trennen"
          >
            {unlinkLoading ? '…' : '✕'}
          </button>
        )}
      </div>
    </div>
  );
}
