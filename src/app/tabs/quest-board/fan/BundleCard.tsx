'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { FaLayerGroup, FaCheck, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaGift, FaStar, FaTrophy, FaHeart, FaComment, FaBookmark, FaShareAlt, FaKey, FaThumbsUp, FaLock, FaClock } from 'react-icons/fa';
import type { QuestBundleWithItems } from '../../../lib/questDb';
import type { Platform, QuestType, QuestIndexEntry, VerifiedPlatforms } from '../types';
import { formatExpiry } from '../utils';

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube:   <FaYoutube   className="text-red-500"  size={12} />,
  instagram: <FaInstagram className="text-pink-500" size={12} />,
  tiktok:    <FaTiktok    className="text-white"    size={11} />,
  facebook:  <FaFacebook  className="text-blue-500" size={12} />,
};

const PLATFORM_NAMES: Record<Platform, string> = {
  youtube:   'YouTube',
  instagram: 'Instagram',
  tiktok:    'TikTok',
  facebook:  'Facebook',
};

const PLATFORM_CONFIG: Record<Platform, {
  outerBorder: string;
  innerBorder: string;
  innerBg: string;
  button: string;
  progress: string;
  dot: string;
  badge: string;
  badgeIcon: React.ReactNode;
  lockText: string;
}> = {
  youtube: {
    outerBorder:  'border-red-700/40',
    innerBorder:  'border-red-700/50',
    innerBg:      'from-zinc-900 via-red-950/30 to-zinc-900',
    button:       'from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 shadow-red-900/30',
    progress:     'from-red-500 to-rose-400',
    dot:          'bg-red-400',
    badge:        'bg-red-600/90',
    badgeIcon:    <FaYoutube size={12} />,
    lockText:     'YouTube verknüpfen',
  },
  instagram: {
    outerBorder:  'border-pink-700/40',
    innerBorder:  'border-pink-700/50',
    innerBg:      'from-zinc-900 via-pink-950/30 to-zinc-900',
    button:       'from-pink-600 to-violet-500 hover:from-pink-500 hover:to-violet-400 shadow-pink-900/30',
    progress:     'from-pink-500 to-violet-400',
    dot:          'bg-pink-400',
    badge:        'bg-gradient-to-r from-pink-600 to-violet-600',
    badgeIcon:    <FaInstagram size={12} />,
    lockText:     'Instagram verknüpfen',
  },
  tiktok: {
    outerBorder:  'border-cyan-700/40',
    innerBorder:  'border-cyan-700/50',
    innerBg:      'from-zinc-900 via-cyan-950/20 to-zinc-900',
    button:       'from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 shadow-cyan-900/30',
    progress:     'from-cyan-500 to-teal-400',
    dot:          'bg-cyan-400',
    badge:        'bg-cyan-600/90',
    badgeIcon:    <FaTiktok size={11} />,
    lockText:     'TikTok verknüpfen',
  },
  facebook: {
    outerBorder:  'border-blue-700/40',
    innerBorder:  'border-blue-700/50',
    innerBg:      'from-zinc-900 via-blue-950/30 to-zinc-900',
    button:       'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-900/30',
    progress:     'from-blue-500 to-blue-400',
    dot:          'bg-blue-400',
    badge:        'bg-blue-600/90',
    badgeIcon:    <FaFacebook size={12} />,
    lockText:     'Facebook verknüpfen',
  },
};

const TYPE_ICONS: Record<QuestType, React.ReactNode> = {
  comment:    <FaComment   size={12} />,
  like:       <FaHeart     size={12} />,
  save:       <FaBookmark  size={12} />,
  repost:     <FaShareAlt  size={12} />,
  dm_share:   <FaShareAlt  size={12} />,
  share:      <FaShareAlt  size={12} />,
  engagement: <FaThumbsUp  size={12} />,
  secret:     <FaKey       size={12} />,
};

interface BundleCardProps {
  bundle: QuestBundleWithItems;
  fanWallet: string;
  verified: VerifiedPlatforms;
  levelBonusPercent?: number;
  onBonusClaimed: (bonusAmount: number, bundleTitle: string) => void;
  /** Öffnet das passende Verifikations-Modal (z.B. InstagramDmShareModal) für eine Bundle-Quest */
  onOpenQuest?: (quest: QuestIndexEntry) => void;
  /** Rendert die richtige Quest-Card für ein Item (vom Parent geliefert, damit Logik wie bei „Verfügbare Quests" identisch ist) */
  renderQuestCard?: (quest: QuestIndexEntry) => React.ReactNode;
}

export default function BundleCard({ bundle, fanWallet, verified, levelBonusPercent = 0, onBonusClaimed, onOpenQuest, renderQuestCard }: BundleCardProps) {
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [justClaimed, setJustClaimed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startedKey = 'bundle-started:' + bundle.id + ':' + fanWallet.toLowerCase();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(startedKey) === '1') setStarted(true);
  }, [startedKey]);

  const handleStart = () => {
    setStarted(true);
    try { window.localStorage.setItem(startedKey, '1'); } catch { /* ignore */ }
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.clientWidth, behavior: 'smooth' });
    }
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    setCurrentSlide(idx);
    if (idx > 0) {
      setStarted(true);
      try { window.localStorage.setItem(startedKey, '1'); } catch { /* ignore */ }
    }
  }, [startedKey]);

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

  const canClaimBonus    = bundle.fanAllCompleted && !bundle.fanBonusClaimed && !justClaimed && bundle.bundleCompletionBonus > 0;
  const bonusAlreadyDone = (bundle.fanBonusClaimed || justClaimed) && bundle.bundleCompletionBonus > 0;

  const rewardWithBonus = (baseReward: number) => {
    const bonus = Math.round(baseReward * levelBonusPercent) / 100;
    return baseReward + bonus;
  };

  const totalReward = bundle.items.reduce((sum, it) => sum + rewardWithBonus(it.rewardAmount), 0);
  const totalRep    = bundle.items.reduce((sum, it) => sum + (it.reputationReward ?? 0), 0);
  const visibleItems = bundle.items.filter((item) => !completedSet.has(item.questType));
  const totalSlides = 1 + visibleItems.length;
  const isVerified = verified[bundle.platform];
  const pc = PLATFORM_CONFIG[bundle.platform];

  const handleClaimBonus = async () => {
    setClaiming(true);
    setClaimError('');
    try {
      const res  = await fetch('/api/quest-bundles/' + bundle.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fanWallet }),
      });
      const data = await res.json() as { success?: boolean; bonusAmount?: number; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Fehler');
      setJustClaimed(true);
      onBonusClaimed(data.bonusAmount ?? 0, bundle.videoTitle);
    } catch (e) {
      setClaimError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all relative ${
      bundle.fanAllCompleted
        ? 'bg-gradient-to-br from-[#1a1228] to-[#0d1a12] border-green-700/50'
        : `bg-[#1a1228] ${pc.outerBorder}`
    }`}>
      {/* Lock-Overlay wenn Plattform nicht verifiziert */}
      {!isVerified && (
        <div className="absolute inset-0 z-20 rounded-2xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-zinc-700/50">
          <FaLock size={18} className="text-zinc-400" />
          <p className="text-zinc-300 text-sm font-semibold">{pc.lockText}</p>
          <p className="text-zinc-500 text-xs">Verifiziere dein Konto im Profil</p>
        </div>
      )}
      {/* ─── Fortschrittsbalken (ab Slide 1 sichtbar) ─── */}
      {currentSlide > 0 && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>{completedCount}/{totalCount} Aufgaben</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${bundle.fanAllCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-400' : `bg-gradient-to-r ${pc.progress}`}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Horizontaler Swipe-Container ─── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {/* Slide 0: Eingangstor */}
        <div className="min-w-full snap-start px-4 pt-3 pb-4">
          <div className={`bg-gradient-to-br ${pc.innerBg} rounded-2xl border ${pc.innerBorder} overflow-hidden transition-all shadow-lg shadow-amber-900/10`}>
            {/* Thumbnail h-40 – identisch mit Quest-Karten */}
            <div className={`relative h-40 ${ytVideoId ? 'cursor-pointer group' : ''}`} onClick={() => ytVideoId && !showVideo && setShowVideo(true)}>
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
                <>
                  {bundle.videoThumbnail
                    ? <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-cover" />
                    : <div className="absolute inset-0 bg-gradient-to-br from-amber-950 to-zinc-900" />
                  }
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80" />
                  {ytVideoId && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-red-600/90 group-hover:scale-110 flex items-center justify-center shadow-2xl transition-transform">
                        <FaYoutube size={26} className="text-white" />
                      </div>
                    </div>
                  )}
                </>
              )}
              {!showVideo && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                  <span className={`flex items-center gap-1.5 ${pc.badge} text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md`}>
                    {pc.badgeIcon} Quest-Reihe
                  </span>
                </div>
              )}
              {!showVideo && (
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                  <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="rounded-full" unoptimized />
                    +{totalReward.toFixed(2)} D.FAITH
                  </div>
                  {levelBonusPercent > 0 && (
                    <div className="bg-black/70 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      inkl. +{levelBonusPercent}% Level-Bonus
                    </div>
                  )}
                  {totalRep > 0 && (
                    <div className="bg-black/70 text-amber-300 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <FaStar size={9} /> +{totalRep} REP
                    </div>
                  )}
                </div>
              )}
              {/* Bonus-Highlight unten links auf dem Thumbnail */}
              {!showVideo && bundle.bundleCompletionBonus > 0 && (
                <div className="absolute bottom-2 left-2 z-10">
                  <span className="flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                    <FaGift size={10} /> +{bundle.bundleCompletionBonus.toFixed(2)} Bonus
                  </span>
                </div>
              )}
              {/* Timer unten rechts */}
              {!showVideo && (() => { const exp = formatExpiry(bundle.expiresAt); return exp ? (
                <div className="absolute bottom-2 right-2 z-10 bg-black/70 text-zinc-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <FaClock size={9} /> {exp}
                </div>
              ) : null; })()}
            </div>
            {/* Body */}
            <div className="p-4 space-y-3">
              <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{bundle.videoTitle}</h3>

              {/* Fortschritt */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>{completedCount} von {totalCount} Aufgaben erledigt</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${bundle.fanAllCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-400' : `bg-gradient-to-r ${pc.progress}`}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Quest-Vorschau – visualisiert Reihenfolge mit Status */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
                  {bundle.items.map((it, idx) => {
                    const itDone = completedSet.has(it.questType);
                    return (
                      <React.Fragment key={it.questId}>
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          itDone
                            ? 'bg-green-600/30 border-green-500 text-green-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}>
                          {itDone ? <FaCheck size={10} /> : TYPE_ICONS[it.questType]}
                        </div>
                        {idx < bundle.items.length - 1 && (
                          <div className={`h-0.5 w-2 shrink-0 ${itDone ? 'bg-green-500' : 'bg-zinc-700'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <p className="text-zinc-400 text-xs">
                Aufgabe: <span className="text-zinc-300">🎯 Schließe alle <strong className="text-white">{totalCount} Quests</strong> ab und sicher dir den <strong className="text-yellow-400">Abschluss-Bonus</strong>!</span>
              </p>

              {canClaimBonus ? (
                <>
                  {claimError && <p className="text-amber-400 text-xs text-center">{claimError}</p>}
                  <button
                    onClick={handleClaimBonus}
                    disabled={claiming}
                    className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <FaGift size={14} />
                    {claiming ? 'Einlösen...' : 'Bonus einlösen (+' + bundle.bundleCompletionBonus.toFixed(2) + ' D.FAITH)'}
                  </button>
                </>
              ) : bonusAlreadyDone ? (
                <div className="w-full bg-green-950/30 border border-green-800/30 rounded-xl px-3 py-2.5 flex items-center justify-center gap-2">
                  <FaCheck size={12} className="text-green-400" />
                  <span className="text-green-400 text-sm font-semibold">Bundle-Bonus eingelöst (+{bundle.bundleCompletionBonus.toFixed(2)} D.FAITH)</span>
                </div>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={!isVerified}
                  className={`w-full bg-gradient-to-r ${pc.button} active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md`}
                >
                  <FaTrophy size={12} /> Starten
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Slides 1..n: je ein Quest-Item als volle Karte */}
        {visibleItems.map((item) => {
          const entry = buildQuestEntry(item);
          const full = item.completions >= item.maxCompletions;
          const progress = Math.round((item.completions / Math.max(item.maxCompletions, 1)) * 100);
          
          // Quest-Typ-spezifische Konfiguration
          const questConfig = (() => {
            switch (item.questType) {
              case 'secret':
                return {
                  badge: { icon: '🔑', label: 'Geheimcode', bg: 'bg-yellow-600/90' },
                  description: '🔑 Finde den geheimen Code und gib ihn ein!',
                  buttonColor: 'bg-yellow-500 hover:bg-yellow-400 text-black',
                  progressColor: 'from-yellow-500 to-yellow-400',
                  bgGradient: 'from-yellow-900/50',
                };
              case 'dm_share':
                return {
                  badge: { icon: <FaShareAlt size={10} />, label: 'Story teilen', bg: 'bg-pink-600/90' },
                  description: <><FaShareAlt size={10} className="text-pink-400" /> Teile dieses Video als Instagram Story und schick sie an unseren Account!</>,
                  buttonColor: 'bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white',
                  progressColor: 'from-pink-500 to-rose-500',
                  bgGradient: 'from-pink-900/50',
                };
              case 'like':
                return {
                  badge: { icon: <FaHeart size={10} />, label: 'Liken', bg: 'bg-amber-500/90' },
                  description: <><FaHeart size={10} className="text-amber-400" /> Like dieses Video!</>,
                  buttonColor: 'bg-gradient-to-r from-amber-600 to-rose-500 hover:from-amber-500 hover:to-rose-400 text-white',
                  progressColor: 'from-amber-500 to-rose-500',
                  bgGradient: 'from-amber-900/50',
                };
              case 'comment':
                return {
                  badge: { icon: <FaComment size={10} />, label: 'Kommentieren', bg: 'bg-blue-600/90' },
                  description: <><FaComment size={10} className="text-blue-400" /> Kommentiere dieses Video!</>,
                  buttonColor: 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white',
                  progressColor: 'from-blue-500 to-cyan-500',
                  bgGradient: 'from-blue-900/50',
                };
              case 'save':
                return {
                  badge: { icon: <FaBookmark size={10} />, label: 'Speichern', bg: 'bg-indigo-600/90' },
                  description: <><FaBookmark size={10} className="text-indigo-400" /> Speichere dieses Video!</>,
                  buttonColor: 'bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 text-white',
                  progressColor: 'from-indigo-500 to-purple-500',
                  bgGradient: 'from-indigo-900/50',
                };
              case 'repost':
                return {
                  badge: { icon: <FaShareAlt size={10} />, label: 'Reposten', bg: 'bg-green-600/90' },
                  description: <><FaShareAlt size={10} className="text-green-400" /> Reposte dieses Video!</>,
                  buttonColor: 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white',
                  progressColor: 'from-green-500 to-emerald-500',
                  bgGradient: 'from-green-900/50',
                };
              case 'engagement':
                return {
                  badge: { icon: <FaThumbsUp size={10} />, label: 'Engagement', bg: 'bg-purple-600/90' },
                  description: <><FaThumbsUp size={10} className="text-purple-400" /> Führe das Engagement-Paket aus!</>,
                  buttonColor: 'bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white',
                  progressColor: 'from-purple-500 to-violet-500',
                  bgGradient: 'from-purple-900/50',
                };
              case 'share':
                return {
                  badge: { icon: <FaShareAlt size={10} />, label: 'Repost', bg: 'bg-teal-600/90' },
                  description: <><FaShareAlt size={10} className="text-teal-400" /> Reposte dieses Video auf TikTok!</>,
                  buttonColor: 'bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 text-white',
                  progressColor: 'from-teal-500 to-cyan-500',
                  bgGradient: 'from-teal-900/50',
                };
              default:
                return {
                  badge: { icon: <FaTrophy size={10} />, label: 'Quest', bg: 'bg-zinc-600/90' },
                  description: 'Schließe diese Quest ab!',
                  buttonColor: 'bg-gradient-to-r from-zinc-600 to-zinc-500 hover:from-zinc-500 hover:to-zinc-400 text-white',
                  progressColor: 'from-zinc-500 to-zinc-400',
                  bgGradient: 'from-zinc-900/50',
                };
            }
          })();

          return (
            <div key={item.questId} className="min-w-full snap-start px-4 pt-3 pb-4">
              <div className={`bg-zinc-900 rounded-2xl border ${pc.outerBorder} overflow-hidden transition-all ${full ? 'opacity-60' : ''}`}>
                <div className={`h-1 bg-gradient-to-r ${pc.progress}`} />
                <div className="relative h-40">
                  {bundle.videoThumbnail
                    ? <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-cover" />
                    : <div className={`absolute inset-0 bg-gradient-to-br ${questConfig.bgGradient} to-zinc-900`} />
                  }
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
                  <div className={`absolute top-2 left-2 ${questConfig.badge.bg} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
                    {questConfig.badge.icon} {questConfig.badge.label}
                  </div>
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="rounded-full" unoptimized />
                      +{rewardWithBonus(item.rewardAmount).toFixed(2)} D.FAITH
                    </div>
                    {levelBonusPercent > 0 && (
                      <div className="bg-black/70 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        inkl. +{levelBonusPercent}% Level-Bonus
                      </div>
                    )}
                    {(item.reputationReward ?? 0) > 0 && (
                      <div className="bg-black/70 text-amber-300 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <FaStar size={9} /> +{item.reputationReward} REP
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{bundle.videoTitle}</h3>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>{item.completions} von {item.maxCompletions} Plätzen belegt</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${pc.progress} rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-zinc-400 text-xs">
                    Aufgabe: <span className="text-zinc-300 inline-flex items-center gap-1">{questConfig.description}</span>
                  </p>
                  {full ? (
                    <button disabled className="w-full bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default">Nicht mehr verfügbar</button>
                  ) : (
                    <button
                      onClick={() => onOpenQuest?.(entry)}
                      disabled={!onOpenQuest || !isVerified}
                      className={`w-full bg-gradient-to-r ${pc.button} disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2`}
                    >
                      <FaTrophy size={12} /> Starten
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Dot-Navigation ─── */}
      <div className="flex justify-center items-center gap-1.5 py-2">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: 'smooth' });
              }
            }}
            className={`rounded-full transition-all duration-300 ${
              i === currentSlide
                ? `w-4 h-1.5 ${pc.dot}`
                : 'w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-400'
            }`}
          />
        ))}
      </div>


    </div>
  );
}
