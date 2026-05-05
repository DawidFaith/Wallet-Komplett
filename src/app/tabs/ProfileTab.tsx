'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook, FaYoutube,
  FaCheck, FaCoins, FaStar, FaLock, FaPlus,
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
        />

        <SocialRow
          icon={<FaInstagram className="text-pink-500" size={18} />}
          label="Instagram"
          name={p?.instagramName ?? null}
          handle={p?.instagramHandle ?? null}
          picture={p?.instagramPicture ?? null}
          verified={p?.instagramVerified ?? false}
          onVerify={() => setVerifyModal('instagram')}
        />

        <SocialRow
          icon={<FaTiktok className="text-zinc-200" size={17} />}
          label="TikTok"
          name={p?.tiktokName ?? null}
          handle={p?.tiktokHandle ?? null}
          picture={p?.tiktokPicture ?? null}
          verified={p?.tiktokVerified ?? false}
          onVerify={() => setVerifyModal('tiktok')}
        />

        <SocialRow
          icon={<FaFacebook className="text-blue-500" size={18} />}
          label="Facebook"
          name={p?.facebookName ?? null}
          handle={p?.facebookHandle ?? null}
          picture={p?.facebookPicture ?? null}
          verified={p?.facebookVerified ?? false}
          onVerify={() => setVerifyModal('facebook')}
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
  hint?: string;
}

function SocialRow({ icon, label, name, handle, picture, verified, onVerify, hint }: SocialRowProps) {
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
      <div className="shrink-0">
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
      </div>
    </div>
  );
}
