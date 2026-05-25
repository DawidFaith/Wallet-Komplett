'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaLayerGroup, FaCheck, FaTimes, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaExternalLinkAlt, FaGift } from 'react-icons/fa';
import type { QuestBundleWithItems } from '../../../lib/questDb';
import type { Platform, QuestType } from '../types';

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube:   <FaYoutube   className="text-red-500"  size={12} />,
  instagram: <FaInstagram className="text-pink-500" size={12} />,
  tiktok:    <FaTiktok    className="text-white"    size={11} />,
  facebook:  <FaFacebook  className="text-blue-500" size={12} />,
};

const TYPE_LABELS: Record<QuestType, string> = {
  comment:    'Kommentieren',
  like:       'Liken',
  save:       'Speichern',
  repost:     'Reposten',
  dm_share:   'Story teilen',
  engagement: 'Engagement',
  secret:     'Geheimcode',
};

const TYPE_ICONS: Record<QuestType, string> = {
  comment: '💬', like: '❤️', save: '🔖', repost: '🔁',
  dm_share: '📤', engagement: '🎯', secret: '🔑',
};

interface BundleCardProps {
  bundle: QuestBundleWithItems;
  fanWallet: string;
  /** Refresh-Callback nach Bonus-Claim */
  onBonusClaimed: () => void;
}

export default function BundleCard({ bundle, fanWallet, onBonusClaimed }: BundleCardProps) {
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [justClaimed, setJustClaimed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // YouTube Video-ID aus URL extrahieren
  const ytVideoId = bundle.platform === 'youtube' && bundle.videoUrl
    ? (bundle.videoUrl.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1] ?? bundle.videoUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ?? null)
    : null;

  const completedSet    = new Set<string>(bundle.fanCompletedTypes ?? []);
  const completedCount  = bundle.fanCompletedTypes?.length ?? 0;
  const totalCount      = bundle.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const canClaimBonus   = bundle.fanAllCompleted && !bundle.fanBonusClaimed && !justClaimed && bundle.bundleCompletionBonus > 0;
  const bonusAlreadyDone = (bundle.fanBonusClaimed || justClaimed) && bundle.bundleCompletionBonus > 0;

  const handleClaimBonus = async () => {
    setClaiming(true);
    setClaimError('');
    try {
      const res  = await fetch(`/api/quest-bundles/${bundle.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fanWallet }),
      });
      const data = await res.json() as { success?: boolean; bonusAmount?: number; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Fehler');
      setJustClaimed(true);
      onBonusClaimed();
    } catch (e) {
      setClaimError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      bundle.fanAllCompleted
        ? 'bg-gradient-to-br from-[#1a1228] to-[#0d1a12] border-green-700/50'
        : 'bg-[#1a1228] border-purple-900/40'
    }`}>
      {/* Thumbnail + Meta */}
      <div className="relative">
        {showVideo && ytVideoId ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              title={bundle.videoTitle}
            />
            <button
              onClick={() => setShowVideo(false)}
              className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs transition-all"
            >×</button>
          </div>
        ) : bundle.videoThumbnail ? (
          <div
            className={`relative w-full h-28 ${ytVideoId ? 'cursor-pointer group' : ''}`}
            onClick={() => ytVideoId && setShowVideo(true)}
          >
            <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1a1228]" />
            {ytVideoId && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-11 h-11 rounded-full bg-red-600/80 group-hover:bg-red-500 flex items-center justify-center transition-all shadow-lg">
                  <FaYoutube size={18} className="text-white" />
                </div>
              </div>
            )}
          </div>
        ) : null}
        <div className={`px-4 ${bundle.videoThumbnail ? '-mt-12 relative z-10' : 'pt-4'} pb-0`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 bg-purple-900/70 rounded-lg px-2 py-0.5 text-xs text-purple-300 font-semibold">
              <FaLayerGroup size={9} /> Bundle
            </span>
            <span className="flex items-center gap-1 bg-black/40 rounded-lg px-2 py-0.5 text-xs text-zinc-400">
              {PLATFORM_ICONS[bundle.platform]}
            </span>
            {bundle.videoUrl && (
              <a href={bundle.videoUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
                <FaExternalLinkAlt size={10} className="text-zinc-500 hover:text-white" />
              </a>
            )}
          </div>
          <p className="text-white font-bold text-sm line-clamp-1">{bundle.videoTitle}</p>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span>{completedCount}/{totalCount} Aufgaben</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bundle.fanAllCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-purple-600 to-violet-400'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Task-Liste */}
      <div className="px-4 pt-3 space-y-1.5">
        {bundle.items.map((item) => {
          const done = completedSet.has(item.questType);
          const full = item.completions >= item.maxCompletions;
          return (
            <div
              key={item.questId}
              className={`flex items-center justify-between rounded-xl px-3 py-2 transition-all ${
                done
                  ? 'bg-green-950/40 border border-green-800/40'
                  : full
                    ? 'bg-zinc-900/60 border border-zinc-800 opacity-50'
                    : 'bg-purple-950/30 border border-purple-800/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{TYPE_ICONS[item.questType]}</span>
                <span className={`text-sm ${done ? 'text-green-300 line-through' : full ? 'text-zinc-500' : 'text-zinc-200'}`}>
                  {TYPE_LABELS[item.questType]}
                </span>
                {full && !done && <span className="text-xs text-zinc-600">(voll)</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono ${done ? 'text-green-400' : 'text-purple-300'}`}>
                  +{item.rewardAmount.toFixed(2)}
                </span>
                {done
                  ? <FaCheck size={10} className="text-green-400" />
                  : <FaTimes size={10} className="text-zinc-600" />
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Bonus-Bereich */}
      <div className="px-4 pt-3 pb-4">
        {canClaimBonus ? (
          <div className="space-y-2">
            <div className="bg-yellow-950/40 border border-yellow-700/40 rounded-xl p-3 text-center">
              <p className="text-yellow-300 text-sm font-semibold">
                🎉 Alle Aufgaben erledigt!
              </p>
              <p className="text-yellow-400/80 text-xs mt-0.5">
                +{bundle.bundleCompletionBonus.toFixed(2)} D.FAITH Abschluss-Bonus wartet auf dich!
              </p>
            </div>
            {claimError && <p className="text-red-400 text-xs text-center">{claimError}</p>}
            <button
              onClick={handleClaimBonus}
              disabled={claiming}
              className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              <FaGift size={14} />
              {claiming ? 'Einlösen...' : `🎁 Bonus einlösen (+${bundle.bundleCompletionBonus.toFixed(2)} D.FAITH)`}
            </button>
          </div>
        ) : bonusAlreadyDone ? (
          <div className="bg-green-950/30 border border-green-800/30 rounded-xl px-3 py-2 flex items-center gap-2">
            <FaCheck size={12} className="text-green-400" />
            <span className="text-green-400 text-xs font-semibold">
              Bundle-Bonus bereits eingelöst (+{bundle.bundleCompletionBonus.toFixed(2)} D.FAITH) ✓
            </span>
          </div>
        ) : bundle.bundleCompletionBonus > 0 ? (
          <div className="bg-purple-950/20 border border-purple-800/20 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-zinc-500 text-xs">Abschluss-Bonus</span>
            <span className="text-purple-400 text-xs font-mono font-semibold">+{bundle.bundleCompletionBonus.toFixed(2)} D.FAITH</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
