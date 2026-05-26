'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { FaLayerGroup, FaCheck, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaExternalLinkAlt, FaGift, FaStar } from 'react-icons/fa';
import type { QuestBundleWithItems } from '../../../lib/questDb';
import type { Platform, QuestType, QuestIndexEntry } from '../types';

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
  onBonusClaimed: () => void;
  /** Öffnet das passende Verifikations-Modal (z.B. InstagramDmShareModal) für eine Bundle-Quest */
  onOpenQuest?: (quest: QuestIndexEntry) => void;
  /** Rendert die richtige Quest-Card für ein Item (vom Parent geliefert, damit Logik wie bei „Verfügbare Quests“ identisch ist) */
  renderQuestCard?: (quest: QuestIndexEntry) => React.ReactNode;
}

export default function BundleCard({ bundle, fanWallet, onBonusClaimed, onOpenQuest, renderQuestCard }: BundleCardProps) {
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

  const [activeSecretQuestId, setActiveSecretQuestId] = useState<string | null>(null);
  const [secretCode, setSecretCode] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretError, setSecretError] = useState('');

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

  const handleSecretSubmit = async (e: React.FormEvent, questId: string) => {
    e.preventDefault();
    if (!secretCode.trim()) return;
    setSecretLoading(true);
    setSecretError('');
    try {
      const res = await fetch('/api/' + bundle.platform + '-quests/secret-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId, walletAddress: fanWallet, code: secretCode.trim().toUpperCase() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Falscher Code');
      setActiveSecretQuestId(null);
      setSecretCode('');
      onBonusClaimed();
    } catch (err) {
      setSecretError((err as Error).message);
    } finally {
      setSecretLoading(false);
    }
  };

  const ytVideoId = bundle.platform === 'youtube' && bundle.videoUrl
    ? (bundle.videoUrl.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1] ?? bundle.videoUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ?? null)
    : null;

  const completedSet    = new Set<string>(bundle.fanCompletedTypes ?? []);
  const completedCount  = bundle.fanCompletedTypes?.length ?? 0;
  const totalCount      = bundle.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const canClaimBonus    = bundle.fanAllCompleted && !bundle.fanBonusClaimed && !justClaimed && bundle.bundleCompletionBonus > 0;
  const bonusAlreadyDone = (bundle.fanBonusClaimed || justClaimed) && bundle.bundleCompletionBonus > 0;

  const totalReward = bundle.items.reduce((sum, it) => sum + it.rewardAmount, 0);
  const totalRep    = bundle.items.reduce((sum, it) => sum + (it.reputationReward ?? 0), 0);
  const totalSlides = 1 + bundle.items.length;

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
      {/* ─── Fortschrittsbalken (ab Slide 1 sichtbar) ─── */}
      {currentSlide > 0 && (
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
      )}

      {/* ─── Horizontaler Swipe-Container ─── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {/* Slide 0: Eingangstor */}
        <div className="min-w-full snap-start">
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
                  : <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-violet-800" />
                }
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
                {ytVideoId && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center shadow-xl">
                      <FaYoutube size={20} className="text-white" />
                    </div>
                  </div>
                )}
              </>
            )}
            {!showVideo && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                <span className="flex items-center gap-1 bg-purple-600/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white font-semibold">
                  <FaLayerGroup size={9} /> Quest-Reihe
                </span>
                <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-zinc-200">
                  {PLATFORM_ICONS[bundle.platform]}
                </span>
              </div>
            )}
            {!showVideo && bundle.videoUrl && (
              <a
                href={bundle.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
              >
                <FaExternalLinkAlt size={9} /> Video
              </a>
            )}
          </div>
          {/* Body – gleiche Struktur wie Quest-Karten */}
          <div className="p-4 space-y-3">
            <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{bundle.videoTitle}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="bg-black/40 border border-purple-700/40 rounded-full px-2 py-0.5 text-xs text-purple-300 font-mono font-bold">
                +{totalReward.toFixed(2)} D.FAITH
              </span>
              {totalRep > 0 && (
                <span className="bg-black/40 border border-amber-700/40 rounded-full px-2 py-0.5 text-xs text-amber-300 font-bold flex items-center gap-1">
                  <FaStar size={9} /> +{totalRep} REP
                </span>
              )}
              <span className="bg-black/40 border border-yellow-700/40 rounded-full px-2 py-0.5 text-xs text-yellow-300 font-bold flex items-center gap-1">
                <FaGift size={9} /> +{bundle.bundleCompletionBonus.toFixed(2)} Bonus
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bundle.items.map((it) => (
                <span key={it.questId} className="bg-zinc-800 border border-zinc-700/50 rounded-md px-2 py-0.5 text-[11px] text-zinc-300 flex items-center gap-1">
                  <span>{TYPE_ICONS[it.questType]}</span>
                  <span>{TYPE_LABELS[it.questType]}</span>
                </span>
              ))}
            </div>
            <button
              onClick={handleStart}
              className="w-full bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 active:scale-[0.98] text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              🚀 Quest-Reihe starten
            </button>
          </div>
        </div>

        {/* Slides 1..n: je ein Quest-Item als volle Karte */}
        {bundle.items.map((item) => {
          const done = completedSet.has(item.questType);
          const entry = buildQuestEntry(item);
          return (
            <div key={item.questId} className="min-w-full snap-start px-4 pt-3 pb-4">
              {done ? (
                <div className="flex items-center justify-between rounded-xl px-4 py-4 bg-green-950/40 border border-green-800/40">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TYPE_ICONS[item.questType]}</span>
                    <span className="text-sm text-green-300 line-through">{TYPE_LABELS[item.questType]}</span>
                  </div>
                  <FaCheck size={14} className="text-green-400" />
                </div>
              ) : item.questType === 'secret' ? (
                (() => {
                  const full = item.completions >= item.maxCompletions;
                  const progress = Math.round((item.completions / Math.max(item.maxCompletions, 1)) * 100);
                  return (
                    <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden transition-all ${full ? 'opacity-60' : ''}`}>
                      <div className="relative h-40">
                        {bundle.videoThumbnail
                          ? <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-cover" />
                          : <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/50 to-zinc-900" />
                        }
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
                        <div className="absolute top-2 left-2 bg-yellow-600/90 text-white text-xs font-bold px-2 py-1 rounded-full">
                          🔑 Geheimcode
                        </div>
                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                          <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="rounded-full" unoptimized />
                            +{item.rewardAmount.toFixed(2)} D.FAITH
                          </div>
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
                            <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <p className="text-zinc-400 text-xs">Aufgabe: <span className="text-zinc-300">🔑 Finde den geheimen Code und gib ihn ein!</span></p>
                        {full ? (
                          <button disabled className="w-full bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default">Nicht mehr verfügbar</button>
                        ) : activeSecretQuestId === item.questId ? (
                          <form onSubmit={(e) => handleSecretSubmit(e, item.questId)} className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <input
                                value={secretCode}
                                onChange={(e) => setSecretCode(e.target.value)}
                                placeholder="Code eingeben..."
                                autoFocus
                                className="flex-1 bg-zinc-800 border border-zinc-600 focus:border-yellow-500 rounded-lg px-3 py-2 text-white text-sm outline-none uppercase"
                              />
                              <button
                                type="submit"
                                disabled={secretLoading || !secretCode.trim()}
                                className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                              >{secretLoading ? '...' : 'OK'}</button>
                              <button
                                type="button"
                                onClick={() => { setActiveSecretQuestId(null); setSecretCode(''); setSecretError(''); }}
                                className="text-zinc-500 hover:text-zinc-300 px-2 text-sm"
                              >✕</button>
                            </div>
                            {secretError && <p className="text-red-400 text-xs">{secretError}</p>}
                          </form>
                        ) : (
                          <button
                            onClick={() => { setActiveSecretQuestId(item.questId); setSecretCode(''); setSecretError(''); }}
                            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            🔑 Code eingeben
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : item.questType === 'dm_share' && item.storyToken && onOpenQuest ? (
                (() => {
                  const full = item.completions >= item.maxCompletions;
                  const progress = Math.round((item.completions / Math.max(item.maxCompletions, 1)) * 100);
                  return (
                    <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden transition-all ${full ? 'opacity-60' : ''}`}>
                      <div className="relative h-40">
                        {bundle.videoThumbnail
                          ? <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-cover" />
                          : <div className="absolute inset-0 bg-gradient-to-br from-pink-900/50 to-zinc-900" />
                        }
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
                        <div className="absolute top-2 left-2 bg-pink-600/90 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <FaInstagram size={10} /> Story teilen
                        </div>
                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                          <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Image src="/D.FAITH.png" alt="D.FAITH" width={14} height={14} className="rounded-full" unoptimized />
                            +{item.rewardAmount.toFixed(2)} D.FAITH
                          </div>
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
                            <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <p className="text-zinc-400 text-xs">Aufgabe: <span className="text-zinc-300">📤 Teile dieses Video als Instagram Story und schick sie an unseren Account!</span></p>
                        {full ? (
                          <button disabled className="w-full bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default">Nicht mehr verfügbar</button>
                        ) : (
                          <button
                            onClick={() => onOpenQuest(entry)}
                            className="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            <FaInstagram size={13} /> Story Quest starten
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : renderQuestCard ? (
                renderQuestCard(entry)
              ) : null}
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
                ? 'w-4 h-1.5 bg-purple-400'
                : 'w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-400'
            }`}
          />
        ))}
      </div>

      {/* ─── Bonus-Claim (immer unten sichtbar) ─── */}
      {(canClaimBonus || bonusAlreadyDone || bundle.bundleCompletionBonus > 0) && (
        <div className="px-4 pb-4">
          {canClaimBonus ? (
            <div className="space-y-2">
              <div className="bg-yellow-950/40 border border-yellow-700/40 rounded-xl p-3 text-center">
                <p className="text-yellow-300 text-sm font-semibold">Alle Aufgaben erledigt!</p>
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
                {claiming ? 'Einlösen...' : 'Bonus einlösen (+' + bundle.bundleCompletionBonus.toFixed(2) + ' D.FAITH)'}
              </button>
            </div>
          ) : bonusAlreadyDone ? (
            <div className="bg-green-950/30 border border-green-800/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <FaCheck size={12} className="text-green-400" />
              <span className="text-green-400 text-xs font-semibold">
                Bundle-Bonus bereits eingelöst (+{bundle.bundleCompletionBonus.toFixed(2)} D.FAITH)
              </span>
            </div>
          ) : bundle.bundleCompletionBonus > 0 ? (
            <div className="bg-purple-950/20 border border-purple-800/20 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-zinc-500 text-xs">Abschluss-Bonus</span>
              <span className="text-purple-400 text-xs font-mono font-semibold">+{bundle.bundleCompletionBonus.toFixed(2)} D.FAITH</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
