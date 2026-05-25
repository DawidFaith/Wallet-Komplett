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

  // Geheimcode-Eingabe
  const [activeSecretQuestId, setActiveSecretQuestId] = useState<string | null>(null);
  const [secretCode, setSecretCode] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretError, setSecretError] = useState('');
  // Story-Link kopiert-Anzeige
  const [copiedQuestId, setCopiedQuestId] = useState<string | null>(null);

  const handleSecretSubmit = async (e: React.FormEvent, questId: string) => {
    e.preventDefault();
    if (!secretCode.trim()) return;
    setSecretLoading(true);
    setSecretError('');
    try {
      const res = await fetch(`/api/${bundle.platform}-quests/secret-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId, walletAddress: fanWallet, code: secretCode.trim().toUpperCase() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Falscher Code');
      setActiveSecretQuestId(null);
      setSecretCode('');
      onBonusClaimed(); // Refresh
    } catch (err) {
      setSecretError((err as Error).message);
    } finally {
      setSecretLoading(false);
    }
  };

  const handleCopyStoryLink = (questId: string, token: string) => {
    navigator.clipboard.writeText(
      `https://app.dawidfaith.de/api/instagram-quests/story-click?token=${token}`
    );
    setCopiedQuestId(questId);
    setTimeout(() => setCopiedQuestId(null), 2000);
  };

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
          <div c key={item.questId}>
              <div
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
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-xs font-mono ${done ? 'text-green-400' : 'text-purple-300'}`}>
                      +{effective.toFixed(2)}
                      {bonus > 0 && <span className="text-yellow-400/80 text-[10px] ml-0.5">(+{bonus}%)</span>}
                    </span>
                    {item.reputationReward > 0 && (
                      <span className="text-[10px] text-amber-400/80">+{item.reputationReward} REP</span>
                    )}
                  </div>
                  {done
                    ? <FaCheck size={10} className="text-green-400" />
                    : <FaTimes size={10} className="text-zinc-600" />
                  }
                </div>
              </div>

              {/* Geheimcode-Eingabe für 'secret'-Typ */}
              {item.questType === 'secret' && !done && !full && (
                activeSecretQuestId === item.questId ? (
                  <form onSubmit={(e) => handleSecretSubmit(e, item.questId)} className="mt-1.5 ml-2 flex flex-col gap-1">
                    <div className="flex gap-2">
                      <input
                        value={secretCode}
                        onChange={(e) => setSecretCode(e.target.value)}
                        placeholder="Code eingeben..."
                        autoFocus
                        className="flex-1 bg-zinc-800 border border-zinc-600 focus:border-yellow-500 rounded-lg px-3 py-1.5 text-white text-sm outline-none uppercase"
                      />
                      <button
                        type="submit"
                        disabled={secretLoading || !secretCode.trim()}
                        className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                      >
                        {secretLoading ? '…' : '✓'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveSecretQuestId(null); setSecretCode(''); setSecretError(''); }}
                        className="text-zinc-500 hover:text-zinc-300 px-2 py-1.5 rounded-lg text-sm"
                      >✕</button>
                    </div>
                    {secretError && <p className="text-red-400 text-xs ml-1">{secretError}</p>}
                  </form>
                ) : (
                  <button
                    onClick={() => { setActiveSecretQuestId(item.questId); setSecretCode(''); setSecretError(''); }}
                    className="mt-1 ml-2 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    🔑 Code eingeben
                  </button>
                )
              )}

              {/* Story-Link für 'dm_share'-Typ */}
              {item.questType === 'dm_share' && !done && !full && item.storyToken && (
                <button
                  onClick={() => handleCopyStoryLink(item.questId, item.storyToken!)}
                  className="mt-1 ml-2 text-xs text-pink-400 hover:text-pink-300 transition-colors"
                >
                  {copiedQuestId === item.questId ? '✓ Link kopiert!' : '📤 Story-Link kopieren'}
                </button>
              )} */}
      <div className="px-4 pt-3 space-y-1.5">
        {bundle.items.map((item) => {
          const done       = completedSet.has(item.questType);
          const full       = item.completions >= item.maxCompletions;
          const bonus      = bundle.fanBonusPercent ?? 0;
          const effective  = bonus > 0 ? item.rewardAmount * (1 + bonus / 100) : item.rewardAmount;
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
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-xs font-mono ${done ? 'text-green-400' : 'text-purple-300'}`}>
                    +{effective.toFixed(2)}
                    {bonus > 0 && <span className="text-yellow-400/80 text-[10px] ml-0.5">(+{bonus}%)</span>}
                  </span>
                  {item.reputationReward > 0 && (
                    <span className="text-[10px] text-amber-400/80">+{item.reputationReward} REP</span>
                  )}
                </div>
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
