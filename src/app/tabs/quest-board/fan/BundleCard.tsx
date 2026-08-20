'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaCheck, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaStar, FaTrophy, FaHeart, FaComment, FaBookmark, FaShareAlt, FaKey, FaThumbsUp, FaLock, FaClock } from 'react-icons/fa';
import type { QuestBundleWithItems } from '../../../lib/questDb';
import type { Platform, QuestType, QuestIndexEntry, VerifiedPlatforms } from '../types';
import { formatExpiry, formatCredits } from '../utils';
import { t, tFmt, type Lang } from '../../../utils/i18n';
import { useLang } from '../../../components/LangContext';
import Modal from '../components/Modal';

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube:   <FaYoutube   className="text-red-500"  size={12} />,
  instagram: <FaInstagram className="text-pink-500" size={12} />,
  tiktok:    <FaTiktok    className="text-white"    size={11} />,
  facebook:  <FaFacebook  className="text-blue-500" size={12} />,
};

const PLATFORM_CONFIG: Record<Platform, {
  button: string;
  progress: string;
  badge: string;
  badgeIcon: React.ReactNode;
  lockText: string;
}> = {
  youtube: {
    button:       'from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 shadow-red-900/30',
    progress:     'from-red-500 to-rose-400',
    badge:        'bg-red-600/90',
    badgeIcon:    <FaYoutube size={12} />,
    lockText:     'YouTube verknüpfen',
  },
  instagram: {
    button:       'from-pink-600 to-violet-500 hover:from-pink-500 hover:to-violet-400 shadow-pink-900/30',
    progress:     'from-pink-500 to-violet-400',
    badge:        'bg-gradient-to-r from-pink-600 to-violet-600',
    badgeIcon:    <FaInstagram size={12} />,
    lockText:     'Instagram verknüpfen',
  },
  tiktok: {
    button:       'from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 shadow-cyan-900/30',
    progress:     'from-cyan-500 to-teal-400',
    badge:        'bg-cyan-600/90',
    badgeIcon:    <FaTiktok size={11} />,
    lockText:     'TikTok verknüpfen',
  },
  facebook: {
    button:       'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-900/30',
    progress:     'from-blue-500 to-blue-400',
    badge:        'bg-blue-600/90',
    badgeIcon:    <FaFacebook size={12} />,
    lockText:     'Facebook verknüpfen',
  },
};

const TYPE_ICONS: Record<QuestType, React.ReactNode> = {
  comment:    <FaComment   size={11} />,
  like:       <FaHeart     size={11} />,
  save:       <FaBookmark  size={11} />,
  repost:     <FaShareAlt  size={11} />,
  dm_share:   <FaShareAlt  size={11} />,
  share:      <FaShareAlt  size={11} />,
  engagement: <FaThumbsUp  size={11} />,
  secret:     <FaKey       size={11} />,
};

interface BundleCardProps {
  bundle: QuestBundleWithItems;
  fanWallet: string;
  verified: VerifiedPlatforms;
  levelBonusPercent?: number;
  creditBonusPct?: number;
  shardBonusPct?: number;
  repBonusPercent?: number;
  onBonusClaimed: (bonusAmount: number, bundleTitle: string, shardDropped?: boolean) => void;
  /** Öffnet das passende Verifikations-Modal (z.B. InstagramDmShareModal) für eine Bundle-Quest */
  onOpenQuest?: (quest: QuestIndexEntry) => void;
  language?: Lang;
}

function questConfigFor(type: QuestType, lang: Lang) {
  switch (type) {
    case 'secret':
      return { badge: { icon: '🔑', label: t('bc.secretBadge', lang) }, description: t('bc.secretDesc', lang) };
    case 'dm_share':
      return { badge: { icon: <FaShareAlt size={10} />, label: t('bc.storyBadge', lang) }, description: t('bc.storyDesc', lang) };
    case 'like':
      return { badge: { icon: <FaHeart size={10} />, label: t('bc.likeBadge', lang) }, description: t('bc.likeDesc', lang) };
    case 'comment':
      return { badge: { icon: <FaComment size={10} />, label: t('bc.commentBadge', lang) }, description: t('bc.commentDesc', lang) };
    case 'save':
      return { badge: { icon: <FaBookmark size={10} />, label: t('bc.saveBadge', lang) }, description: t('bc.saveDesc', lang) };
    case 'repost':
      return { badge: { icon: <FaShareAlt size={10} />, label: t('bc.repostBadge', lang) }, description: t('bc.repostDesc', lang) };
    case 'engagement':
      return { badge: { icon: <FaThumbsUp size={10} />, label: t('bc.engagementBadge', lang) }, description: t('bc.engagementDesc', lang) };
    case 'share':
      return { badge: { icon: <FaShareAlt size={10} />, label: t('bc.repostBadge', lang) }, description: t('bc.repostTiktokDesc', lang) };
    default:
      return { badge: { icon: <FaTrophy size={10} />, label: t('bc.questBadge', lang) }, description: t('bc.questDefault', lang) };
  }
}

export default function BundleCard({ bundle, fanWallet, verified, levelBonusPercent = 0, creditBonusPct = 0, shardBonusPct = 0, repBonusPercent = 0, onBonusClaimed, onOpenQuest, language = 'de' }: BundleCardProps) {
  const lang = useLang();
  const [showDetail, setShowDetail] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [justClaimed, setJustClaimed] = useState(false);

  // Bundle-Item → QuestIndexEntry konvertieren (für Modal-Aufruf)
  const buildQuestEntry = (item: typeof bundle.items[number]): QuestIndexEntry => ({
    id:               item.questId,
    platform:         bundle.platform,
    type:             item.questType,
    creatorWallet:    bundle.creatorWallet,
    videoId:          bundle.videoId ?? '',
    videoTitle:       bundle.videoTitle ?? '',
    videoThumbnail:   bundle.videoThumbnail ?? '',
    videoUrl:         bundle.videoUrl ?? '',
    rewardAmount:     item.rewardAmount,
    reputationReward: item.reputationReward,
    maxCompletions:   item.maxCompletions,
    completions:      item.completions,
    isActive:         item.isActive,
    createdAt:        bundle.createdAt ?? new Date().toISOString(),
    expiresAt:        bundle.expiresAt ?? null,
    storyToken:       item.storyToken ?? null,
  });

  const ytVideoId = bundle.platform === 'youtube' && bundle.videoUrl
    ? (bundle.videoUrl.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1] ?? bundle.videoUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ?? null)
    : null;

  const completedSet    = new Set<string>(bundle.fanCompletedTypes ?? []);
  const completedCount  = bundle.fanCompletedTypes?.length ?? 0;
  const totalCount      = bundle.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const canClaimBonus    = bundle.fanAllCompleted && !bundle.fanBonusClaimed && !justClaimed;
  const bonusAlreadyDone = bundle.fanBonusClaimed || justClaimed;
  const shardDropChance  = (bundle.shardDropChance ?? 20) + shardBonusPct;

  const rewardWithBonus = (baseReward: number) => {
    const bonus = Math.round(baseReward * levelBonusPercent) / 100;
    return baseReward + bonus;
  };

  const totalReward = bundle.items.reduce((sum, it) => sum + rewardWithBonus(it.rewardAmount), 0);
  const totalRepBase = bundle.items.reduce((sum, it) => sum + (it.reputationReward ?? 0), 0);
  const totalRep = Math.round(totalRepBase * (1 + repBonusPercent / 100));
  const isVerified = verified[bundle.platform];
  const pc = PLATFORM_CONFIG[bundle.platform];
  const expiry = formatExpiry(bundle.expiresAt);

  const lockTexts: Record<string, string> = {
    youtube:   t('bc.lockYT', lang),
    instagram: t('bc.lockIG', lang),
    tiktok:    t('bc.lockTT', lang),
    facebook:  t('bc.lockFB', lang),
  };

  const handleClaimBonus = async () => {
    setClaiming(true);
    setClaimError('');
    try {
      const res  = await fetch('/api/quest-bundles/' + bundle.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fanWallet }),
      });
      const data = await res.json() as { success?: boolean; bonusAmount?: number; shardDropped?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Fehler');
      setJustClaimed(true);
      onBonusClaimed(data.bonusAmount ?? 0, bundle.videoTitle, data.shardDropped ?? false);
    } catch (e) {
      setClaimError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      {/* ── Kompakte Karte (Shop-Stil) ── */}
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className={`group relative flex flex-col bg-zinc-900 rounded-xl overflow-hidden border ${bonusAlreadyDone ? 'border-green-600/40' : 'border-amber-600/40'} text-left transition-all hover:bg-zinc-800/70 ${bonusAlreadyDone ? 'opacity-60' : ''}`}
      >
        <div className="relative w-full aspect-square">
          {bundle.videoThumbnail ? (
            <>
              <Image src={bundle.videoThumbnail} alt="" fill unoptimized className="object-cover scale-110 blur-xl opacity-40" />
              <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-contain" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-950 to-zinc-900" />
          )}
          <div className={`absolute top-1.5 left-1.5 ${pc.badge} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1`}>
            {pc.badgeIcon} {t('quest.seriesLabel', language)}
          </div>
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={12} height={12} className="w-3 h-3 rounded-full" unoptimized /> {formatCredits(totalReward)}
          </div>
          {bonusAlreadyDone && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-green-500 rounded-full w-8 h-8 flex items-center justify-center">
                <FaCheck size={14} className="text-black" />
              </div>
            </div>
          )}
          {!isVerified && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <FaLock size={16} className="text-zinc-300" />
            </div>
          )}
        </div>
        <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1">
          <p className="text-white font-semibold text-xs leading-snug line-clamp-2">{bundle.videoTitle}</p>
          <span className="text-zinc-500 text-[10px]">{completedCount}/{totalCount} {t('quest.tasks', language)} · ✨ {shardDropChance}% Shard-Chance</span>
        </div>
      </button>

      {/* ── Detail-Modal ── */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={bundle.videoTitle}>
        <div className="relative h-40 rounded-xl overflow-hidden -mt-1 mb-3">
          {showVideo && ytVideoId ? (
            <>
              <iframe
                src={'https://www.youtube.com/embed/' + ytVideoId + '?autoplay=1'}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                title={bundle.videoTitle}
              />
              <button
                onClick={(e) => { e.stopPropagation(); setShowVideo(false); }}
                className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs transition-all"
              >✕</button>
            </>
          ) : (
            <div
              className={`absolute inset-0 ${ytVideoId ? 'cursor-pointer' : ''}`}
              onClick={() => ytVideoId && setShowVideo(true)}
            >
              {bundle.videoThumbnail ? (
                <>
                  <Image src={bundle.videoThumbnail} alt="" fill unoptimized className="object-cover scale-110 blur-xl opacity-40" />
                  <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-contain" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-950 to-zinc-900" />
              )}
              {ytVideoId && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center shadow-2xl">
                    <FaYoutube size={22} className="text-white" />
                  </div>
                </div>
              )}
              <div className={`absolute top-2 left-2 ${pc.badge} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
                {pc.badgeIcon} {t('quest.seriesLabel', language)}
              </div>
              <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="rounded-full" unoptimized />
                  +{formatCredits(totalReward)} D.FAITH{levelBonusPercent > 0 && <span className="text-green-400 font-bold text-xs"> inkl. {levelBonusPercent}%</span>}
                </div>
                {totalRep > 0 && (
                  <div className="bg-black/70 text-amber-300 text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <FaStar size={8} /> +{totalRep} REP{repBonusPercent > 0 && <span className="text-green-400 font-bold text-xs"> inkl. {repBonusPercent}%</span>}
                  </div>
                )}
              </div>
              {expiry && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-zinc-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <FaClock size={9} /> {expiry}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {!isVerified && (
            <div className="rounded-xl bg-black/40 border border-zinc-700/50 px-3 py-2.5 flex items-center gap-2">
              <FaLock size={14} className="text-zinc-400 shrink-0" />
              <p className="text-zinc-300 text-xs">{lockTexts[bundle.platform] ?? pc.lockText}</p>
            </div>
          )}

          {/* Bonus-Erklärung – explizit Shards */}
          <div className="bg-amber-950/30 border border-amber-700/30 rounded-xl px-3 py-2.5">
            <p className="text-amber-300 text-xs font-semibold">
              ✨ {tFmt('quest.allCompleteDesc', language, { n: String(totalCount) })}
            </p>
            <p className="text-zinc-400 text-[11px] mt-0.5">{tFmt('bc.shardBonusHint', lang, { pct: String(shardDropChance) })}</p>
          </div>

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>{completedCount}/{totalCount} {t('quest.tasks', language)}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${pc.progress} rounded-full transition-all duration-500`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {canClaimBonus ? (
            <>
              {claimError && <p className="text-amber-400 text-xs text-center">{claimError}</p>}
              <button
                onClick={handleClaimBonus}
                disabled={claiming}
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 disabled:opacity-50 active:scale-[0.98] text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md"
              >
                ✨ {claiming ? t('btn.claiming', language) : tFmt('btn.completeSeriesLabel', language, { pct: String(shardDropChance) })}
              </button>
            </>
          ) : bonusAlreadyDone ? (
            <div className="w-full bg-green-950/30 border border-green-800/30 rounded-xl px-3 py-2.5 flex items-center justify-center gap-2">
              <FaCheck size={12} className="text-green-400" />
              <span className="text-green-400 text-sm font-semibold">{t('btn.bonusClaimed', language)}</span>
            </div>
          ) : null}

          {/* Einzelne Quest-Items */}
          <div className="space-y-2 pt-1">
            {bundle.items.map((item) => {
              const entry = buildQuestEntry(item);
              const isDone = completedSet.has(item.questType);
              const full = item.completions >= item.maxCompletions;
              const cfg = questConfigFor(item.questType, lang);
              return (
                <div key={item.questId} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${isDone ? 'bg-green-950/20 border-green-800/30' : 'bg-zinc-800/60 border-zinc-700/40'}`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isDone ? 'bg-green-600/30 text-green-300' : 'bg-zinc-700 text-zinc-300'}`}>
                    {isDone ? <FaCheck size={12} /> : TYPE_ICONS[item.questType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">{cfg.badge.label}</p>
                    <p className="text-zinc-500 text-[11px] truncate">{cfg.description}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-yellow-400 text-[11px] font-bold flex items-center gap-1">
                      <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full" unoptimized /> +{formatCredits(rewardWithBonus(item.rewardAmount))}
                    </span>
                    {isDone ? (
                      <span className="text-green-400 text-[10px] font-semibold">{t('btn.done', language)}</span>
                    ) : full ? (
                      <span className="text-zinc-500 text-[10px] font-semibold">{t('btn.unavailable', language)}</span>
                    ) : (
                      <button
                        onClick={() => { setShowDetail(false); onOpenQuest?.(entry); }}
                        disabled={!onOpenQuest || !isVerified}
                        className={`bg-gradient-to-r ${pc.button} disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold px-2.5 py-1 rounded-full transition-all`}
                      >
                        {t('btn.start', language)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
