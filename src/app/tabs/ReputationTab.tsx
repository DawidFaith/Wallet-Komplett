'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { FaTrophy, FaStar, FaChevronDown, FaChevronUp, FaChevronLeft, FaEdit, FaCheck, FaTimes, FaUsers, FaMedal, FaPlus, FaGift } from 'react-icons/fa';
import { useLang } from '../components/LangContext';
import { t, tFmt } from '../utils/i18n';

interface ReputationEntry {
  artistWallet: string;
  reputation: number;
  level: number;
  levelName: string;
  nextLevelRep: number | null;
  progress: number;
  artistName?: string | null;
  artistPicture?: string | null;
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName: string | null;
  imageUrl?: string | null;
  reputation: number;
  level: number;
  levelName: string;
}

interface ReputationLevel {
  levelNumber: number;
  levelName: string;
  minReputation: number;
  prizeDescription: string;
  creditReward: number;
  maxRecipients: number;
  questRewardBonusPercent: number;
}

interface ReputationContest {
  id: string;
  artistWallet: string;
  endDate: string;
  distributed: boolean;
  createdAt: string;
  prizes: { rank: number; creditReward: number; shardReward: number }[];
  contestLeaderboard?: LeaderboardEntry[];
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, progress)}%` }}
      />
    </div>
  );
}

const shortenWallet = (w: string) =>
  w.length > 16 ? `${w.slice(0, 8)}\u2026${w.slice(-6)}` : w;

function useCountdown(targetDate: string | null): { label: string; urgent: boolean } {
  const [state, setState] = useState({ label: '', urgent: false });
  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setState({ label: 'Abgelaufen', urgent: true }); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      const urgent = diff < 3 * 3_600_000;
      if (d > 0)      setState({ label: `${d}T ${h}h ${m}m`, urgent });
      else if (h > 0) setState({ label: `${h}h ${m}m ${s}s`, urgent });
      else            setState({ label: `${m}m ${s}s`, urgent: true });
    };
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [targetDate]);
  return state;
}

// Supporter: Detail-Ansicht für einen Künstler
function ArtistDetailView({
  entry,
  walletAddress,
  userImageUrl,
  userName,
  onBack,
}: {
  entry: ReputationEntry;
  walletAddress: string;
  userImageUrl?: string | null;
  userName?: string | null;
  onBack: () => void;
}) {
  const lang = useLang();
  const [tab, setTab] = useState<'leaderboard' | 'contest'>('leaderboard');
  const [levels, setLevels] = useState<ReputationLevel[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [contest, setContest] = useState<ReputationContest | null | false>(false);
  const [quarterlyConfig, setQuarterlyConfig] = useState<{ prizes: { rank: number; creditReward: number; shardReward: number }[] } | null>(null);
  const [quarterlyInfo, setQuarterlyInfo] = useState<{ quarter: string; start: string; end: string } | null>(null);
  const [quarterlyAlreadyDistributed, setQuarterlyAlreadyDistributed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Countdowns auf Top-Level (Rules of Hooks)
  const quarterlyCountdown = useCountdown(quarterlyInfo?.end ?? null);
  const contestEndDate = contest && !contest.distributed && new Date((contest as ReputationContest).endDate) > new Date()
    ? (contest as ReputationContest).endDate : null;
  const contestCountdown = useCountdown(contestEndDate);

  // Unclaimed Rewards (Level, Contest, Leaderboard)
  const [unclaimedTotal, setUnclaimedTotal] = useState(0);
  const [unclaimedRewards, setUnclaimedRewards] = useState<{id:string;type:string;levelNumber:number;levelName:string;rank:number;amount:number}[]>([]);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());

  // Dismissed Contest-Notifications aus localStorage laden
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `dfaith_contest_dismissed_${entry.artistWallet}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try { setDismissedNotifs(new Set(JSON.parse(raw))); } catch { /* ignore */ }
    }
  }, [entry.artistWallet]);

  const dismissNotif = (rewardId: string) => {
    setDismissedNotifs(prev => {
      const next = new Set(prev);
      next.add(rewardId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`dfaith_contest_dismissed_${entry.artistWallet}`, JSON.stringify([...next]));
      }
      return next;
    });
  };
  const [claiming, setClaiming] = useState(false);
  const [celebration, setCelebration] = useState<{total:number;rewards:{levelNumber:number;levelName:string;amount:number}[]} | null>(null);

  const loadUnclaimed = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/reputation/unclaimed?wallet=${walletAddress}`);
      if (!res.ok) return;
      const data = await res.json();
      const filtered = (data.rewards as {id:string;type:string;artistWallet:string;levelNumber:number;levelName:string;rank:number;amount:number}[])
        .filter(r => r.artistWallet.toLowerCase() === entry.artistWallet.toLowerCase());
      setUnclaimedRewards(filtered);
      setUnclaimedTotal(filtered.reduce((s, r) => s + r.amount, 0));
    } catch { /* ignore */ }
  }, [walletAddress, entry.artistWallet]);

  const handleClaim = async () => {
    if (claiming || unclaimedTotal === 0) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/reputation/claim-level-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        const artistRewards = (data.rewards as {levelNumber:number;levelName:string;amount:number}[])
          .filter((_r, _i) => {
            // Alle claims dieser Artist (API gibt nur die von diesem wallet-address zurück)
            return true;
          });
        if (data.claimed > 0) {
          setCelebration({ total: data.claimed, rewards: artistRewards });
        }
        setUnclaimedRewards([]);
        setUnclaimedTotal(0);
      }
    } catch { /* ignore */ }
    finally { setClaiming(false); }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [lvRes, lbRes, ctRes, qlyRes] = await Promise.all([
          fetch(`/api/reputation/levels?artistWallet=${entry.artistWallet}`),
          fetch(`/api/reputation/leaderboard?artistWallet=${entry.artistWallet}&limit=50`),
          fetch(`/api/reputation/contest?artistWallet=${entry.artistWallet}`),
          fetch(`/api/reputation/leaderboard-quarterly?artistWallet=${entry.artistWallet}`),
        ]);
        if (cancelled) return;
        if (lvRes.ok) setLevels(await lvRes.json());
        if (lbRes.ok) setLeaderboard(await lbRes.json());
        setContest(ctRes.ok ? (await ctRes.json()) : null);
        if (qlyRes.ok) {
          const qly = await qlyRes.json();
          setQuarterlyConfig(qly.config ?? null);
          setQuarterlyInfo(qly.quarterInfo ?? null);
          const hist: { quarter: string }[] = qly.history ?? [];
          setQuarterlyAlreadyDistributed(hist.some(h => h.quarter === (qly.quarterInfo?.quarter ?? '')));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entry.artistWallet]);

  useEffect(() => { loadUnclaimed(); }, [loadUnclaimed]);

  const nextLevel = levels.find(l => l.levelNumber === entry.level + 1);
  const currentLevel = levels.find(l => l.levelNumber === entry.level);

  return (
    <div className="space-y-4">
      {/* Feier-Modal */}
      {celebration && (
        <div
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setCelebration(null)}
        >
          {/* Sternen-Partikel (CSS) */}
          <style>{`
            @keyframes celebFlyUp {
              0%   { transform: translateY(0) scale(1); opacity: 1; }
              100% { transform: translateY(-180px) scale(0.3); opacity: 0; }
            }
            @keyframes celebPop {
              0%   { transform: scale(0.3); opacity: 0; }
              60%  { transform: scale(1.15); opacity: 1; }
              100% { transform: scale(1); }
            }
            @keyframes celebGlow {
              0%, 100% { text-shadow: 0 0 20px #f59e0b, 0 0 40px #f59e0b; }
              50%       { text-shadow: 0 0 40px #fbbf24, 0 0 80px #fbbf24, 0 0 120px #fde68a; }
            }
            .celeb-star {
              position: absolute;
              animation: celebFlyUp 1.4s ease-out forwards;
              font-size: 1.3rem;
            }
          `}</style>
          {/* Partikel */}
          {['⭐','✨','🌟','💫','⭐','✨','🌟','⭐','💫','✨'].map((s, i) => (
            <span
              key={i}
              className="celeb-star"
              style={{
                left: `${10 + i * 9}%`,
                bottom: `${20 + (i % 3) * 15}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${1.2 + (i % 4) * 0.2}s`,
              }}
            >{s}</span>
          ))}
          <div
            className="relative bg-zinc-900 border border-amber-500/40 rounded-3xl p-8 mx-6 text-center shadow-2xl"
            style={{ animation: 'celebPop 0.5s ease-out forwards' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-5xl mb-3">🎉</p>
            <p
              className="text-amber-300 font-black text-5xl mb-1"
              style={{ animation: 'celebPop 0.6s ease-out forwards, celebGlow 2s ease-in-out infinite' }}
            >
              +{celebration.total}
            </p>
            <p className="text-amber-400 font-bold text-lg mb-4">D.FAITH Credits</p>
            <div className="space-y-1.5 mb-6">
              {celebration.rewards.map((r, i) => (
                <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
                  <span className="text-amber-300 text-sm font-semibold">Level {r.levelNumber}</span>
                  <span className="text-zinc-400 text-sm"> – {r.levelName}</span>
                  <span className="text-amber-400 text-sm font-bold ml-2">+{r.amount}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCelebration(null)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-2xl transition-colors text-sm"
            >
              Awesome! 🎊
            </button>
          </div>
        </div>
      )}

      {/* Zurück */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors px-4 pt-2"
      >
        <FaChevronLeft size={11} /> {t('common.allArtists', lang)}
      </button>

      {/* User-Profil + Meine Rep */}
      <div className="mx-4 bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-4">
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-3">
          {entry.artistName || shortenWallet(entry.artistWallet)}
        </p>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full shrink-0 ring-2 ring-amber-500/30">
            {userImageUrl
              ? <Image src={userImageUrl} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
              : <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center"><FaStar className="text-zinc-400" size={20} /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">
              {userName || shortenWallet(walletAddress)}
            </p>
            <p className="text-amber-400 text-sm font-medium">Lv.{entry.level} &ndash; {entry.levelName}</p>
            {currentLevel && currentLevel.questRewardBonusPercent > 0 && (
              <p className="text-green-400 text-xs font-semibold mt-0.5">⚡ +{currentLevel.questRewardBonusPercent}% {t('rep.questBonus', lang).replace('+{n}% ', '')}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-amber-300 font-bold text-xl">{entry.reputation.toLocaleString()}</p>
            <p className="text-zinc-500 text-xs">REP</p>
          </div>
        </div>
        {/* Contest- & Quartal-Ergebnis Notification */}
        {unclaimedRewards.filter(r => (r.type === 'contest' || r.type === 'leaderboard') && !dismissedNotifs.has(r.id)).map(r => (
          <div key={r.id} className={`mt-3 border rounded-xl px-3 py-2.5 flex items-center gap-3 ${
            r.type === 'leaderboard'
              ? 'bg-gradient-to-r from-blue-950/60 to-zinc-900/60 border-blue-500/30'
              : 'bg-gradient-to-r from-amber-950/60 to-zinc-900/60 border-amber-500/30'
          }`}>
            <span className="text-2xl shrink-0">
              {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '🏆'}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm ${r.type === 'leaderboard' ? 'text-blue-300' : 'text-amber-300'}`}>
                {r.type === 'leaderboard' ? t('rep.quarterlyWon', lang) : 'Contest beendet!'}
              </p>
              <p className="text-zinc-300 text-xs">Du hast <span className="font-bold text-white">Platz #{r.rank}</span> erreicht</p>
              {r.amount > 0 && (
                <p className={`text-xs font-semibold ${r.type === 'leaderboard' ? 'text-blue-400' : 'text-amber-400'}`}>
                  +{r.amount} Credits warten auf dich
                </p>
              )}
            </div>
            <button
              onClick={() => dismissNotif(r.id)}
              className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 p-1"
              title="Schließen"
            >
              <FaTimes size={12} />
            </button>
          </div>
        ))}

        <ProgressBar progress={entry.progress} />
        <div className="flex justify-between mt-1.5">
          <span className="text-zinc-600 text-xs">Lv.{entry.level}</span>
          <span className="text-zinc-500 text-xs">{entry.progress.toFixed(0)}%</span>
          {entry.nextLevelRep
            ? <span className="text-zinc-600 text-xs">{(entry.nextLevelRep - entry.reputation).toLocaleString()} REP bis Lv.{entry.level + 1}</span>
            : <span className="text-amber-500 text-xs">MAX LEVEL</span>}
        </div>
        {/* Nächster Reward */}
        {nextLevel && (nextLevel.creditReward > 0 || nextLevel.prizeDescription) && (
          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">
              {tFmt('rep.nextRewardAt', lang, { n: String(nextLevel.levelNumber), name: nextLevel.levelName })}
            </p>
            <div className="flex gap-2 flex-wrap">
              {nextLevel.creditReward > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
                  <span className="text-amber-300 font-bold text-xs">+{nextLevel.creditReward}</span>
                  <span className="text-zinc-400 text-xs">D.FAITH Credits</span>
                </div>
              )}
              {nextLevel.prizeDescription && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  <span className="text-amber-300/80 text-xs">🎁 {nextLevel.prizeDescription}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unclaimed Rewards (Level, Contest, Leaderboard) */}
        {unclaimedTotal > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
            {/* Auflistung nach Typ */}
            {unclaimedRewards.some(r => r.type === 'contest' || r.type === 'leaderboard') && (
              <div className="space-y-1">
                {unclaimedRewards.filter(r => r.type === 'contest' || r.type === 'leaderboard').map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
                    <span className="text-amber-200 text-xs font-semibold">{r.levelName}</span>
                    <span className="text-amber-400 text-xs font-bold">+{r.amount} Credits</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3 px-4 rounded-xl transition-all active:scale-95 animate-pulse"
            >
              <FaGift size={16} />
              {claiming ? t('rep.claiming', lang) : `🎁 ${tFmt('rep.claimCredits', lang, { n: String(unclaimedTotal) })}`}
            </button>
            <p className="text-zinc-500 text-[10px] text-center">
              {unclaimedRewards.filter(r => r.type === 'level').length > 0 && `${unclaimedRewards.filter(r => r.type === 'level').length} Level-Up`}
              {unclaimedRewards.filter(r => r.type === 'level').length > 0 && unclaimedRewards.filter(r => r.type !== 'level').length > 0 && ' + '}
              {unclaimedRewards.filter(r => r.type === 'contest').length > 0 && `${unclaimedRewards.filter(r => r.type === 'contest').length} Contest`}
              {unclaimedRewards.filter(r => r.type === 'leaderboard').length > 0 && `${unclaimedRewards.filter(r => r.type === 'leaderboard').length > 0 && unclaimedRewards.filter(r => r.type === 'contest').length > 0 ? ' + ' : ''}${unclaimedRewards.filter(r => r.type === 'leaderboard').length} Leaderboard`}
              {' '}{unclaimedRewards.length === 1 ? 'Reward' : 'Rewards'} bereit
            </p>
          </div>
        )}
      </div>

      {/* Tab-Navigation */}
      <div className="mx-4 flex bg-zinc-900/60 rounded-xl p-1 border border-white/[0.07]">
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'leaderboard' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaUsers size={11} /> Leaderboard
        </button>
        <button
          onClick={() => setTab('contest')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'contest' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaTrophy size={11} /> Contest
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="mx-4 pb-4 space-y-3">

          {/* ── Leaderboard ── */}
          {tab === 'leaderboard' && (
            <div className="space-y-3">
              {/* Quartal-Prizes + Countdown */}
              {quarterlyConfig && quarterlyConfig.prizes.length > 0 && quarterlyInfo && (() => {
                const countdown = quarterlyCountdown;
                return (
                  <div className="bg-gradient-to-br from-amber-950/40 to-zinc-900/60 border border-amber-500/20 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-amber-500/10 flex items-center justify-between">
                      <div>
                        <p className="text-amber-300 font-black text-sm tracking-wide">🏆 Quartal {quarterlyInfo.quarter}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {quarterlyAlreadyDistributed ? 'Rewards wurden ausgezahlt' : 'Top-Supporter gewinnen am Quartalsende'}
                        </p>
                      </div>
                      {quarterlyAlreadyDistributed ? (
                        <div className="text-right">
                          <p className="font-black text-sm text-zinc-400">✓ Abgeschlossen</p>
                          <p className="text-zinc-600 text-[10px]">nächstes Quartal bald</p>
                        </div>
                      ) : (
                        <div className={`text-right ${countdown.urgent ? 'animate-pulse' : ''}`}>
                          <p className={`font-black text-sm tabular-nums ${countdown.urgent ? 'text-red-400' : 'text-amber-300'}`}>{countdown.label}</p>
                          <p className="text-zinc-600 text-[10px]">verbleibend</p>
                        </div>
                      )}
                    </div>
                    <div className="p-3 grid grid-cols-3 gap-2">
                      {quarterlyConfig.prizes.slice(0, 3).map(p => {
                        const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉';
                        const currentLeader = leaderboard.find(lb => lb.rank === p.rank);
                        return (
                          <div key={p.rank} className={`rounded-xl p-2.5 flex flex-col gap-1 ${
                            p.rank === 1 ? 'bg-amber-500/10 border border-amber-500/25' :
                            p.rank === 2 ? 'bg-zinc-400/5 border border-zinc-400/15' :
                            'bg-amber-900/10 border border-amber-700/15'
                          }`}>
                            <span className="text-lg leading-none">{medal}</span>
                            {currentLeader && (
                              <p className="text-white text-[10px] font-semibold truncate">
                                {currentLeader.displayName || shortenWallet(currentLeader.walletAddress)}
                                {currentLeader.walletAddress === walletAddress && <span className="text-amber-400"> ★</span>}
                              </p>
                            )}
                            {!currentLeader && <p className="text-zinc-600 text-[10px] italic">Noch frei</p>}
                            <div className="flex flex-col gap-0.5 mt-auto">
                              {p.creditReward > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-300 font-bold text-[10px]">
                                  <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />
                                  {p.creditReward}
                                </span>
                              )}
                              {p.shardReward > 0 && (
                                <span className="text-cyan-300 font-bold text-[10px]">✦ {p.shardReward}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {quarterlyConfig.prizes.length > 3 && (
                      <div className="px-3 pb-3 flex gap-2 flex-wrap">
                        {quarterlyConfig.prizes.slice(3).map(p => (
                          <div key={p.rank} className="flex items-center gap-2 bg-zinc-800/40 rounded-lg px-2.5 py-1.5">
                            <span className="text-zinc-400 text-xs font-bold">#{p.rank}</span>
                            {p.creditReward > 0 && <span className="text-amber-300 text-xs font-bold">{p.creditReward} Credits</span>}
                            {p.shardReward > 0 && <span className="text-cyan-300 text-xs font-bold">✦ {p.shardReward}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Leaderboard-Liste */}
              <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.07]">
                  <p className="text-white font-semibold text-sm">All-Time Leaderboard</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{t('rep.leaderboardSubtitle', lang)}</p>
                </div>
                {leaderboard.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <FaUsers size={28} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">{t('rep.noArtists', lang)}</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-1.5">
                    {leaderboard.map(lb => (
                      <div key={lb.walletAddress} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        lb.walletAddress === walletAddress ? 'bg-amber-500/10 border border-amber-500/20' :
                        lb.rank <= 3 ? 'bg-zinc-800/70' : 'bg-zinc-800/40'
                      }`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          lb.rank === 1 ? 'bg-amber-400 text-black' :
                          lb.rank === 2 ? 'bg-zinc-400 text-black' :
                          lb.rank === 3 ? 'bg-amber-700 text-white' :
                          'bg-zinc-700 text-zinc-300'
                        }`}>
                          {lb.rank === 1 ? '🥇' : lb.rank === 2 ? '🥈' : lb.rank === 3 ? '🥉' : lb.rank}
                        </div>
                        {lb.imageUrl
                          ? <Image src={lb.imageUrl} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {lb.displayName || shortenWallet(lb.walletAddress)}
                            {lb.walletAddress === walletAddress && <span className="text-amber-400 ml-1 text-xs">(Du)</span>}
                          </p>
                          <p className="text-zinc-500 text-xs">{lb.levelName}</p>
                        </div>
                        <span className="text-amber-300 font-bold text-sm shrink-0">{lb.reputation.toLocaleString()} REP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Contest ── */}
          {tab === 'contest' && (
            <div className="space-y-3">
              {!contest ? (
                <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl px-4 py-8 text-center">
                  <FaTrophy size={28} className="text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">{t('rep.noContest', lang)}</p>
                  <p className="text-zinc-600 text-xs mt-1">{t('rep.noContestHint', lang)}</p>
                </div>
              ) : (() => {
                const isRunning = !contest.distributed && new Date(contest.endDate) > new Date();
                const isExpired = !contest.distributed && new Date(contest.endDate) <= new Date();
                const countdown = contestCountdown;
                const contestBoard = contest.contestLeaderboard ?? [];
                return (
                  <>
                    {/* Beendeter Contest — Ergebnisansicht */}
                    {contest.distributed && (
                      <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
                        <div className="px-4 py-4 text-center border-b border-white/[0.07]">
                          <p className="text-3xl mb-1">🏆</p>
                          <p className="text-white font-black text-base">Contest abgeschlossen</p>
                          <p className="text-zinc-500 text-xs mt-0.5">Beendet am {new Date(contest.endDate).toLocaleDateString('de-DE')}</p>
                        </div>
                        <div className="p-3 space-y-2">
                          {contest.prizes.map(p => {
                            const winner = contestBoard.find(lb => lb.rank === p.rank);
                            const isMe = winner?.walletAddress === walletAddress;
                            return (
                              <div key={p.rank} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                                isMe ? 'bg-amber-500/10 border border-amber-500/25' : 'bg-zinc-800/40'
                              }`}>
                                <span className="text-xl shrink-0">
                                  {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                                </span>
                                <div className="flex-1 min-w-0">
                                  {winner ? (
                                    <div className="flex items-center gap-2">
                                      {winner.imageUrl
                                        ? <Image src={winner.imageUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                        : <div className="w-6 h-6 rounded-full bg-zinc-700 shrink-0" />}
                                      <div>
                                        <p className={`text-sm font-semibold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                                          {winner.displayName || shortenWallet(winner.walletAddress)}
                                          {isMe && <span className="ml-1 text-xs">★ Du</span>}
                                        </p>
                                        <p className="text-zinc-500 text-xs">{winner.reputation.toLocaleString()} REP</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-zinc-600 text-sm italic">Kein Teilnehmer</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  {p.creditReward > 0 && (
                                    <span className="flex items-center gap-1 text-amber-300 font-bold text-xs">
                                      <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full shrink-0" />
                                      {p.creditReward}
                                    </span>
                                  )}
                                  {p.shardReward > 0 && <span className="text-cyan-300 font-bold text-xs">✦ {p.shardReward}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Laufender / abgelaufener Contest */}
                    {!contest.distributed && (<>
                    {/* Status-Header */}
                    <div className={`rounded-2xl overflow-hidden ${
                      isExpired ? 'bg-amber-950/40 border border-amber-700/30' :
                      'bg-gradient-to-br from-green-950/50 to-zinc-900/60 border border-green-600/25'
                    }`}>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            {isRunning && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                            <p className="text-white font-black text-sm">
                              {isExpired ? t('rep.contestExpiring', lang) : '🔥 ' + t('rep.contestRunning', lang)}
                            </p>
                          </div>
                          <p className="text-zinc-500 text-xs">
                            {isRunning ? 'Verdiene jetzt neuen REP und sichere dir einen Platz' : `Ende: ${new Date(contest.endDate).toLocaleString('de-DE')}`}
                          </p>
                        </div>
                        {isRunning && (
                          <div className={`text-right ${countdown.urgent ? 'animate-pulse' : ''}`}>
                            <p className={`font-black text-lg tabular-nums leading-none ${countdown.urgent ? 'text-red-400' : 'text-green-400'}`}>{countdown.label}</p>
                            <p className="text-zinc-600 text-[10px]">verbleibend</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prize + Live-Ranking Cards */}
                    <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.07]">
                        <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">{t('rep.prizesAndBoard', lang)}</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {contest.prizes.map(p => {
                          const winner = contestBoard.find(lb => lb.rank === p.rank);
                          const isMe = winner?.walletAddress === walletAddress;
                          return (
                            <div key={p.rank} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                              isMe ? 'bg-amber-500/15 border border-amber-500/30 ring-1 ring-amber-500/20' :
                              p.rank === 1 ? 'bg-zinc-800/70' : 'bg-zinc-800/40'
                            }`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                                p.rank === 1 ? 'bg-amber-400 text-black' :
                                p.rank === 2 ? 'bg-zinc-400 text-black' :
                                p.rank === 3 ? 'bg-amber-700 text-white' :
                                'bg-zinc-700 text-zinc-300'
                              }`}>
                                {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                              </div>
                              <div className="flex-1 min-w-0">
                                {winner ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      {winner.imageUrl
                                        ? <Image src={winner.imageUrl} alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                        : <div className="w-5 h-5 rounded-full bg-zinc-700 shrink-0" />}
                                      <p className="text-white text-sm font-semibold truncate">
                                        {winner.displayName || shortenWallet(winner.walletAddress)}
                                        {isMe && <span className="text-amber-400 ml-1">★ Du</span>}
                                      </p>
                                    </div>
                                    <p className="text-zinc-500 text-xs mt-0.5">{winner.reputation.toLocaleString()} neuer REP</p>
                                  </>
                                ) : (
                                  <p className="text-zinc-600 text-sm italic">Noch nicht besetzt — sei der Erste!</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                {p.creditReward > 0 && (
                                  <span className="flex items-center gap-1 text-amber-300 font-bold text-xs">
                                    <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full shrink-0" />
                                    {p.creditReward}
                                  </span>
                                )}
                                {p.shardReward > 0 && (
                                  <span className="text-cyan-300 font-bold text-xs">✦ {p.shardReward}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </>)}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Artist: Verwaltungs-Panel
// 100-Level-Default mit linearem 1 %-Bonus pro Level.
// Formel: minReputation(n) = 40 * (n - 1)^2, Bonus = n - 1.
const LEVEL_TIER_NAMES = [
  'Newcomer', 'Follower', 'Fan', 'Supporter', 'Loyalist',
  'True Fan', 'Advocate', 'VIP', 'Elite', 'Legend',
];
const DEFAULT_LEVELS: ReputationLevel[] = Array.from({ length: 100 }, (_, i) => {
  const levelNumber = i + 1;
  const tier = LEVEL_TIER_NAMES[Math.floor(i / 10)];
  const subLevel = (i % 10) + 1;
  return {
    levelNumber,
    levelName: `${tier} ${subLevel}`,
    minReputation: 40 * Math.pow(levelNumber - 1, 2),
    prizeDescription: '',
    creditReward: 0,
    maxRecipients: 0,
    questRewardBonusPercent: levelNumber - 1,
  };
});

function ArtistPanel({ walletAddress }: { walletAddress: string }) {
  const lang = useLang();
  const [levels, setLevels] = useState<ReputationLevel[]>([]);
  const [editLevels, setEditLevels] = useState<ReputationLevel[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [contest, setContest] = useState<ReputationContest | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeSection, setActiveSection] = useState<'levels' | 'leaderboard'>('levels');

  // Contest-Formular
  const [showContestForm, setShowContestForm] = useState(false);
  const [contestEndDate, setContestEndDate] = useState('');
  const [contestPrizes, setContestPrizes] = useState([
    { rank: 1, creditReward: 0, shardReward: 0 },
    { rank: 2, creditReward: 0, shardReward: 0 },
    { rank: 3, creditReward: 0, shardReward: 0 },
  ]);
  const [contestSaving, setContestSaving] = useState(false);
  const [contestError, setContestError] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [distributeResult, setDistributeResult] = useState<{ rank: number; walletAddress: string; credited: number }[] | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Quartals-Leaderboard-Rewards
  const [quarterlyConfig, setQuarterlyConfig] = useState<{ prizes: { rank: number; creditReward: number; shardReward: number }[]; creditsLocked?: number } | null>(null);
  const [quarterlyHistory, setQuarterlyHistory] = useState<{ id: string; quarter: string; prizes: { rank: number; creditReward: number; shardReward: number }[]; results: { rank: number; walletAddress: string; credited: number }[]; totalCredited: number; distributedAt: string }[]>([]);
  const [quarterlyInfo, setQuarterlyInfo] = useState<{ quarter: string; start: string; end: string } | null>(null);
  const [showQlyForm, setShowQlyForm] = useState(false);
  const [qlyPrizes, setQlyPrizes] = useState([
    { rank: 1, creditReward: 0, shardReward: 0 },
    { rank: 2, creditReward: 0, shardReward: 0 },
    { rank: 3, creditReward: 0, shardReward: 0 },
  ]);
  const [qlySaving, setQlySaving] = useState(false);
  const [qlyDistributing, setQlyDistributing] = useState(false);
  const [qlyDistResult, setQlyDistResult] = useState<{ quarter: string; distributed: { rank: number; walletAddress: string; credited: number }[] } | null>(null);
  const [qlyError, setQlyError] = useState('');

  const loadData = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const [lvs, lb, ct, profile, qly] = await Promise.all([
        fetch(`/api/reputation/levels?artistWallet=${walletAddress}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/reputation/leaderboard?artistWallet=${walletAddress}&limit=50`).then(r => r.ok ? r.json() : []),
        fetch(`/api/reputation/contest?artistWallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/reputation/leaderboard-quarterly?artistWallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
      ]);
      setLevels(Array.isArray(lvs) ? lvs : []);
      setLeaderboard(Array.isArray(lb) ? lb : []);
      setContest(ct);
      setCreditBalance(profile?.credits ?? null);
      if (qly) {
        setQuarterlyConfig(qly.config);
        setQuarterlyHistory(Array.isArray(qly.history) ? qly.history : []);
        setQuarterlyInfo(qly.quarterInfo ?? null);
        if (qly.config?.prizes?.length > 0) setQlyPrizes(qly.config.prizes.map((p: { rank: number; creditReward: number; shardReward?: number }) => ({ rank: p.rank, creditReward: p.creditReward, shardReward: p.shardReward ?? 0 })));
      }
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadData(); }, [loadData]);

  const startEdit = () => {
    setEditLevels(levels.map(l => ({ ...l })));
    setSaveError('');
    setEditing(true);
  };

  const loadDefaults = () => {
    setEditLevels(DEFAULT_LEVELS.map(l => ({ ...l })));
    setSaveError('');
    setEditing(true);
  };

  const addLevel = () => {
    const maxNum = editLevels.length > 0 ? Math.max(...editLevels.map(l => l.levelNumber)) : 0;
    const maxRep = editLevels.length > 0 ? Math.max(...editLevels.map(l => l.minReputation)) : 0;
    setEditLevels(prev => [...prev, {
      levelNumber: maxNum + 1,
      levelName: `Level ${maxNum + 1}`,
      minReputation: maxRep + 500,
      prizeDescription: '',
      creditReward: 0,
      maxRecipients: 0,
      questRewardBonusPercent: 0,
    }]);
  };

  const removeLevel = (idx: number) => {
    if (editLevels.length <= 1) return;
    setEditLevels(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((l, i) => ({ ...l, levelNumber: i + 1 }));
    });
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/reputation/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: walletAddress, levels: editLevels }),
      });
      if (res.ok) {
        setEditing(false);
        await loadData(); // Guthaben + Level neu laden (Rückerstattung sichtbar machen)
      } else {
        const d = await res.json();
        setSaveError(d.error || 'Fehler beim Speichern');
      }
    } finally {
      setSaving(false);
    }
  };

  const saveContest = async () => {
    setContestSaving(true);
    setContestError('');
    try {
      const res = await fetch('/api/reputation/contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: walletAddress, endDate: contestEndDate, prizes: contestPrizes }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowContestForm(false);
        await loadData();
      } else {
        setContestError(data.error || 'Fehler beim Speichern');
      }
    } finally {
      setContestSaving(false);
    }
  };

  const distributeContest = async (force = false) => {
    if (!contest) return;
    setDistributing(true);
    try {
      const res = await fetch('/api/reputation/contest', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestId: contest.id, artistWallet: walletAddress, force }),
      });
      const data = await res.json();
      if (res.ok) {
        setDistributeResult(data.distributed);
        await loadData();
      }
    } finally {
      setDistributing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const contestExpired = contest && !contest.distributed && new Date(contest.endDate) <= new Date();
  const contestRunning = contest && !contest.distributed && new Date(contest.endDate) > new Date();

  return (
    <div className="px-4 space-y-4">
      {/* Credit-Balance */}
      <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="text-zinc-400 text-sm">{t('rep.yourBalance', lang)}</span>
            <p className="text-zinc-600 text-xs mt-0.5">{t('rep.balanceHint', lang)}</p>
          </div>
          {creditBalance !== null ? (
            <span className="flex items-center gap-1.5 text-amber-300 font-bold text-sm">
              {creditBalance.toFixed(2)}
              <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
              D.FAITH Credits
            </span>
          ) : <span className="text-amber-300 font-bold text-sm">–</span>}
        </div>
      </div>
      {/* Sub-Navigation */}
      <div className="flex bg-zinc-900/60 rounded-xl p-1 border border-white/[0.07]">
        <button
          onClick={() => setActiveSection('levels')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeSection === 'levels' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaMedal size={13} />
          Level &amp; Rewards
        </button>
        <button
          onClick={() => setActiveSection('leaderboard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeSection === 'leaderboard' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaUsers size={13} />
          Leaderboard
          {leaderboard.length > 0 && (
            <span className="bg-white/20 text-xs rounded-full px-1.5 py-0.5 leading-none">
              {leaderboard.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Level & Rewards ── */}
      {activeSection === 'levels' && (
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <p className="text-white font-semibold text-sm">{t('rep.levelConfig', lang)}</p>
            {!editing ? (
              <div className="flex gap-3">
                <button onClick={loadDefaults} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-300 text-xs font-medium transition-colors">
                  {t('rep.btnLoadDefault', lang)}
                </button>
                <button onClick={startEdit} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors">
                  <FaEdit size={11} /> {t('common.edit', lang)}
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-medium disabled:opacity-50">
                  <FaCheck size={11} /> {saving ? t('btn.saving', lang) : t('common.save', lang)}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-medium">
                  <FaTimes size={11} /> {t('common.cancel', lang)}
                </button>
              </div>
            )}
          </div>
          {saveError && <p className="text-red-400 text-xs px-4 py-2">{saveError}</p>}
          {editing && <p className="text-zinc-500 text-xs px-4 pt-3 pb-1">{t('rep.levelEditHint', lang)}</p>}
          {!editing && <p className="text-zinc-600 text-xs px-4 pt-3 pb-1 italic">{t('rep.levelDefaultHint', lang)}</p>}
          <div className="p-4 space-y-2">
            {(editing ? editLevels : levels).map((lvl, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-xl overflow-hidden">
                {editing ? (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500/30 flex items-center justify-center shrink-0">
                          <span className="text-amber-400 text-[10px] font-bold">{idx + 1}</span>
                        </div>
                        <span className="text-zinc-500 text-xs">Level {idx + 1}</span>
                      </div>
                      {editLevels.length > 1 && (
                        <button onClick={() => removeLevel(idx)} className="text-red-500 hover:text-red-400 p-1">
                          <FaTimes size={10} />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">{t('rep.labelLevelName', lang)}</label>
                      <input
                        className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        value={editLevels[idx].levelName}
                        onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], levelName: e.target.value }; setEditLevels(u); }}
                        placeholder="z.B. Newcomer"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">{t('rep.labelMinRep', lang)}</label>
                      <input
                        type="number" min="0"
                        className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        value={editLevels[idx].minReputation}
                        onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], minReputation: Number(e.target.value) }; setEditLevels(u); }}
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">{t('rep.labelCreditsOnLevelUp', lang)}</label>
                      <div className="relative">
                        <input
                          type="number" min="0"
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 pr-14"
                          value={editLevels[idx].creditReward}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], creditReward: Number(e.target.value) }; setEditLevels(u); }}
                          placeholder="0"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                          <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3 h-3 rounded-full" />
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">{t('rep.labelMaxRecipients', lang)}</label>
                      <div className="relative">
                        <input
                          type="number" min="0"
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 pr-14"
                          value={editLevels[idx].maxRecipients}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], maxRecipients: Number(e.target.value) }; setEditLevels(u); }}
                          placeholder="0 = kein Reward"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">Fans</span>
                      </div>
                      {editLevels[idx].creditReward > 0 && editLevels[idx].maxRecipients > 0 && (
                        <p className="text-amber-400 text-[10px] mt-1">
                          {tFmt('rep.levelCosts', lang, { n: String(editLevels[idx].creditReward * editLevels[idx].maxRecipients) })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">{t('rep.labelQuestBonus', lang)}</label>
                      <div className="relative">
                        <input
                          type="number" min="0" max="100"
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 pr-8"
                          value={editLevels[idx].questRewardBonusPercent}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], questRewardBonusPercent: Number(e.target.value) }; setEditLevels(u); }}
                          placeholder="0 = kein Bonus"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
                      </div>
                      <p className="text-amber-400/70 text-[10px] mt-0.5">{t('rep.labelQuestBonusHint', lang)}</p>
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">{t('rep.labelRewardDesc', lang)}</label>
                      <input
                        className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        value={editLevels[idx].prizeDescription}
                        onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], prizeDescription: e.target.value }; setEditLevels(u); }}
                        placeholder="z.B. Exklusiver Discord-Zugang"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-amber-400 text-xs font-bold">{lvl.levelNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{lvl.levelName}</span>
                        <span className="text-zinc-500 text-xs">ab {lvl.minReputation} REP</span>
                        {lvl.creditReward > 0 && lvl.maxRecipients > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-semibold">
                            <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />
                            +{lvl.creditReward} D.FAITH Credits × {lvl.maxRecipients} Fans
                          </span>
                        )}
                        {lvl.questRewardBonusPercent > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold">
                            ⚡ +{lvl.questRewardBonusPercent}% Quest-Bonus
                          </span>
                        )}
                      </div>
                      {lvl.prizeDescription
                        ? <p className="text-amber-300/80 text-xs truncate mt-0.5">🎁 {lvl.prizeDescription}</p>
                        : <p className="text-zinc-600 text-xs mt-0.5 italic">{t('rep.noRewardDefined', lang)}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {editing && (
              <button
                onClick={addLevel}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-amber-500/40 text-amber-400 hover:border-amber-400 hover:bg-amber-500/5 text-xs font-medium transition-colors"
              >
                <FaPlus size={10} /> {t('rep.addLevel', lang)}
              </button>
            )}
            {editing && (() => {
              const totalCost = editLevels.reduce((sum, l) => sum + (l.creditReward || 0) * (l.maxRecipients || 0), 0);
              const enough = creditBalance !== null && totalCost <= creditBalance;
              const unknown = creditBalance === null;
              if (totalCost === 0) return null;
              return (
                <div className={`mt-2 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs ${
                  unknown ? 'bg-zinc-800/60 border border-zinc-700/40' :
                  enough  ? 'bg-green-950/40 border border-green-700/30' :
                            'bg-red-950/40 border border-red-700/40'
                }`}>
                  <div>
                    <p className="text-zinc-300 font-semibold">{t('rep.totalCosts', lang)}</p>
                    <p className="flex items-center gap-1 text-zinc-500 text-xs mt-0.5">
                      {t('rep.yourBalanceLabel', lang)}
                      {creditBalance !== null ? (
                        <>
                          <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />
                          <span>{creditBalance.toFixed(2)} D.FAITH Credits</span>
                        </>
                      ) : '–'}
                    </p>
                    <p className="text-zinc-600 text-[10px] mt-0.5">{t('rep.balanceDiff', lang)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`flex items-center justify-end gap-1 font-bold text-sm ${enough ? 'text-green-400' : unknown ? 'text-zinc-300' : 'text-red-400'}`}>
                      {totalCost}
                      <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3 h-3 rounded-full shrink-0" />
                      D.FAITH
                    </p>
                    <p className={`text-[10px] mt-0.5 ${enough ? 'text-green-500' : unknown ? 'text-zinc-500' : 'text-red-500'}`}>
                      {unknown ? t('rep.balanceUnknown', lang) : enough ? t('rep.balanceSufficient', lang) : t('rep.balanceInsufficient', lang)}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Leaderboard + Contest ── */}
      {activeSection === 'leaderboard' && (
        <div className="space-y-4">
          {/* Contest-Panel */}
          <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
              <div>
                <p className="text-white font-semibold text-sm">{t('rep.contestSectionTitle', lang)}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{t('rep.contestSubtitle', lang)}</p>
              </div>
              {!contest && !showContestForm && (
                <button
                  onClick={() => setShowContestForm(true)}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium"
                >
                  <FaPlus size={10} /> {t('rep.btnCreateContest', lang)}
                </button>
              )}
            </div>

            {/* Aktiver Contest */}
            {contest && !showContestForm && (
              <div className="p-4 space-y-3">
                <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                  contest.distributed ? 'bg-zinc-800/40' : contestExpired ? 'bg-amber-950/30 border border-amber-700/30' : 'bg-green-950/30 border border-green-700/30'
                }`}>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {contest.distributed ? t('rep.contestEnded', lang) : contestExpired ? t('rep.contestExpired', lang) : t('rep.contestRunning', lang)}
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Ende: {new Date(contest.endDate).toLocaleString('de-DE')}
                    </p>
                  </div>
                  {contestExpired && (
                    <button
                      onClick={() => distributeContest(false)}
                      disabled={distributing}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {distributing ? '…' : t('rep.btnDistribute', lang)}
                    </button>
                  )}
                  {contestRunning && (
                    <button
                      onClick={() => {
                        if (confirm(t('rep.contestConfirmEnd', lang))) {
                          distributeContest(true);
                        }
                      }}
                      disabled={distributing}
                      className="flex items-center gap-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {distributing ? '…' : t('rep.btnEndNow', lang)}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {contest.prizes.map(p => (
                    <div key={p.rank} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                      <span className="text-zinc-300 text-xs">
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`} Platz
                      </span>
                      <div className="flex items-center gap-2">
                        {p.creditReward > 0 && (
                          <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                            <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full shrink-0" />
                            {p.creditReward} Credits
                          </span>
                        )}
                        {p.shardReward > 0 && (
                          <span className="text-cyan-300 text-xs font-bold">✦ {p.shardReward} Shards</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {distributeResult && (
                  <div className="bg-green-950/30 border border-green-700/30 rounded-xl p-3 space-y-1">
                    <p className="text-green-400 text-xs font-semibold mb-1">{t('rep.distributed', lang)}</p>
                    {distributeResult.map(r => (
                      <p key={r.rank} className="text-zinc-300 text-xs">
                        #{r.rank}: {shortenWallet(r.walletAddress)} → {r.credited} D.FAITH Credits
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setShowContestForm(true); setContestError(''); }}
                  className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                >
                  {contest.distributed ? t('rep.btnNewContest', lang) : t('rep.btnUpdateContest', lang)}
                </button>
              </div>
            )}

            {/* Contest-Formular */}
            {showContestForm && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">{t('rep.labelEndDate', lang)}</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={contestEndDate}
                    onChange={e => setContestEndDate(e.target.value)}
                  />
                </div>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">{t('rep.labelPrizesPerRank', lang)}</p>
                {contestPrizes.map((p, i) => (
                  <div key={p.rank} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300 text-sm w-8 shrink-0">
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                      </span>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0"
                          placeholder="Credits"
                          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-amber-500 pr-10"
                          value={contestPrizes[i].creditReward || ''}
                          onChange={e => {
                            const u = [...contestPrizes];
                            u[i] = { ...u[i], creditReward: Number(e.target.value) || 0 };
                            setContestPrizes(u);
                          }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3 h-3 rounded-full" />
                        </span>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0"
                          placeholder="Shards"
                          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-cyan-500 pr-8"
                          value={contestPrizes[i].shardReward || ''}
                          onChange={e => {
                            const u = [...contestPrizes];
                            u[i] = { ...u[i], shardReward: Number(e.target.value) || 0 };
                            setContestPrizes(u);
                          }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-400 text-[10px] font-bold">✦</span>
                      </div>
                      {contestPrizes.length > 1 && (
                        <button
                          onClick={() => setContestPrizes(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))}
                          className="text-red-500 hover:text-red-400 shrink-0"
                        >
                          <FaTimes size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setContestPrizes(prev => [...prev, { rank: prev.length + 1, creditReward: 0, shardReward: 0 }])}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs"
                >
                  <FaPlus size={9} /> {t('rep.addSlot', lang)}
                </button>
                {contestError && <p className="text-red-400 text-xs">{contestError}</p>}
                {(() => {
                  const total = contestPrizes.reduce((s, p) => s + (p.creditReward || 0), 0);
                  if (total === 0) return null;
                  const enough = creditBalance !== null && total <= creditBalance;
                  return (
                    <div className={`rounded-xl px-3 py-2 flex items-center justify-between text-xs ${
                      enough ? 'bg-green-950/40 border border-green-700/30' : 'bg-red-950/40 border border-red-700/40'
                    }`}>
                      <p className={enough ? 'text-green-300' : 'text-red-300'}>
                        {t('rep.totalPrize', lang)}
                      </p>
                      <p className={`flex items-center gap-1 font-bold ${enough ? 'text-green-400' : 'text-red-400'}`}>
                        {total}
                        <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3 h-3 rounded-full shrink-0" />
                        D.FAITH Credits {enough ? '✓' : '⚠'}
                      </p>
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveContest}
                    disabled={contestSaving || !contestEndDate}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold py-2.5 rounded-xl transition-colors"
                  >
                    {contestSaving ? t('btn.saving', lang) : t('rep.btnStartContest', lang)}
                  </button>
                  <button
                    onClick={() => setShowContestForm(false)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs px-3"
                  >
                    <FaTimes size={11} />
                  </button>
                </div>
              </div>
            )}

            {!contest && !showContestForm && (
              <div className="px-4 py-6 text-center">
                <p className="text-zinc-500 text-sm">{t('rep.noContestActive', lang)}</p>
                <p className="text-zinc-600 text-xs mt-1">{t('rep.noContestActiveHint', lang)}</p>
              </div>
            )}
          </div>

          {/* Fan-Leaderboard */}
          <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <p className="text-white font-semibold text-sm">Fan Leaderboard</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t('rep.fanLeaderboardSubtitle', lang)}</p>
            </div>
            {leaderboard.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <FaUsers size={28} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">{t('rep.noArtists', lang)}</p>
                <p className="text-zinc-600 text-xs mt-1">{t('rep.noFansHint', lang)}</p>
              </div>
            ) : (
              <div className="p-4 space-y-1.5">
                {leaderboard.map(lb => (
                  <div key={lb.walletAddress} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/50">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      lb.rank === 1 ? 'bg-amber-400 text-black' :
                      lb.rank === 2 ? 'bg-zinc-400 text-black' :
                      lb.rank === 3 ? 'bg-amber-700 text-white' :
                      'bg-zinc-700 text-zinc-300'
                    }`}>
                      {lb.rank === 1 ? '🥇' : lb.rank === 2 ? '🥈' : lb.rank === 3 ? '🥉' : lb.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {lb.displayName || shortenWallet(lb.walletAddress)}
                      </p>
                      <p className="text-zinc-500 text-xs">{lb.levelName}</p>
                    </div>
                    <span className="text-amber-300 text-sm font-bold shrink-0">
                      {lb.reputation.toLocaleString()} REP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quartals-Leaderboard-Rewards */}
          <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
              <div>
                <p className="text-white font-semibold text-sm">{t('rep.quarterlyRewards', lang)}</p>
                {quarterlyInfo && (
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {quarterlyInfo.quarter} &bull; endet {new Date(quarterlyInfo.end).toLocaleDateString('de-DE')}
                  </p>
                )}
              </div>
              {!showQlyForm && (
                <button
                  onClick={() => {
                    if (quarterlyConfig) setQlyPrizes(quarterlyConfig.prizes.map(p => ({ rank: p.rank, creditReward: p.creditReward, shardReward: p.shardReward })));
                    setShowQlyForm(true); setQlyError(''); setQlyDistResult(null);
                  }}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium"
                >
                  <FaEdit size={10} /> {quarterlyConfig ? t('common.edit', lang) : t('rep.btnSetup', lang)}
                </button>
              )}
            </div>

            {/* Aktuelle Konfiguration + Verteilen */}
            {!showQlyForm && quarterlyConfig && (
              <div className="p-4 space-y-3">
                {quarterlyInfo && (() => {
                  const ended = new Date() > new Date(quarterlyInfo.end);
                  const alreadyDone = quarterlyHistory.some(h => h.quarter === quarterlyInfo.quarter);
                  const doneEntry = quarterlyHistory.find(h => h.quarter === quarterlyInfo.quarter);

                  // ── Verteilt: Ergebnisansicht (wie Contest) ──────────────────
                  if (alreadyDone && doneEntry) {
                    return (
                      <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
                        <div className="px-4 py-4 text-center border-b border-white/[0.07]">
                          <p className="text-3xl mb-1">🏆</p>
                          <p className="text-white font-black text-base">{t('rep.quarterlyEnded', lang)}</p>
                          <p className="text-zinc-500 text-xs mt-0.5">{quarterlyInfo.quarter} &bull; {new Date(doneEntry.distributedAt).toLocaleDateString('de-DE')}</p>
                        </div>
                        <div className="p-3 space-y-2">
                          {doneEntry.prizes.map(p => {
                            const winner = doneEntry.results.find(r => r.rank === p.rank);
                            return (
                              <div key={p.rank} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/40">
                                <span className="text-xl shrink-0">
                                  {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                                </span>
                                <div className="flex-1 min-w-0">
                                  {winner
                                    ? <p className="text-white text-sm font-semibold truncate">{shortenWallet(winner.walletAddress)}</p>
                                    : <p className="text-zinc-600 text-sm italic">Kein Teilnehmer</p>}
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  {p.creditReward > 0 && (
                                    <span className="flex items-center gap-1 text-amber-300 font-bold text-xs">
                                      <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full shrink-0" />
                                      {p.creditReward}
                                    </span>
                                  )}
                                  {p.shardReward > 0 && <span className="text-cyan-300 font-bold text-xs">✦ {p.shardReward}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="px-4 pb-4 flex flex-col gap-2">
                          <button
                            onClick={() => {
                              setQlyPrizes(doneEntry.prizes.map(p => ({ rank: p.rank, creditReward: p.creditReward, shardReward: p.shardReward })));
                              setShowQlyForm(true);
                              setQlyError('');
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold px-4 py-2.5 rounded-xl"
                          >
                            ✦ Neues Quartal konfigurieren
                          </button>
                          <p className="text-zinc-600 text-[10px] text-center">Credits werden beim Speichern für das neue Quartal reserviert</p>
                        </div>
                      </div>
                    );
                  }

                  // ── Laufend / abgelaufen: Status + Buttons ───────────────────
                  return (<>
                    <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${
                      ended ? 'bg-amber-950/30 border border-amber-700/30' : 'bg-green-950/30 border border-green-700/30'
                    }`}>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {ended ? tFmt('rep.quarterExpired', lang, { q: quarterlyInfo.quarter }) : tFmt('rep.quarterRunning', lang, { q: quarterlyInfo.quarter })}
                        </p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">
                          {new Date(quarterlyInfo.start).toLocaleDateString('de-DE')} – {new Date(quarterlyInfo.end).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {ended && (
                          <button
                            onClick={async () => {
                              setQlyDistributing(true); setQlyError('');
                              try {
                                const res = await fetch('/api/reputation/leaderboard-quarterly', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ artistWallet: walletAddress, force: false }),
                                });
                                const data = await res.json();
                                if (res.ok) { setQlyDistResult(data); await loadData(); }
                                else setQlyError(data.error || 'Fehler');
                              } finally { setQlyDistributing(false); }
                            }}
                            disabled={qlyDistributing}
                            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold px-3 py-1.5 rounded-lg"
                          >
                            {qlyDistributing ? '…' : t('rep.btnDistribute', lang)}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(t('rep.quarterConfirmEnd', lang))) {
                              setQlyDistributing(true); setQlyError('');
                              fetch('/api/reputation/leaderboard-quarterly', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ artistWallet: walletAddress, force: true }),
                              })
                                .then(r => r.json())
                                .then(data => { setQlyDistResult(data); return loadData(); })
                                .catch(err => setQlyError(err.message))
                                .finally(() => setQlyDistributing(false));
                            }
                          }}
                          disabled={qlyDistributing}
                          className="bg-zinc-700/60 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-lg"
                        >
                          {t('rep.btnNow', lang)}
                        </button>
                      </div>
                    </div>

                    {/* Preisliste (nur wenn Quartal läuft / abgelaufen aber noch nicht verteilt) */}
                    <div className="space-y-1.5">
                      {quarterlyConfig.prizes.map(p => (
                        <div key={p.rank} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                          <span className="text-zinc-300 text-xs">
                            {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`} Platz
                          </span>
                          <div className="flex items-center gap-2">
                            {p.creditReward > 0 && (
                              <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                                <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full shrink-0" />
                                {p.creditReward} Credits
                              </span>
                            )}
                            {p.shardReward > 0 && (
                              <span className="text-cyan-300 text-xs font-bold">✦ {p.shardReward} Shards</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>);
                })()}

                {qlyDistResult && !quarterlyHistory.some(h => h.quarter === qlyDistResult.quarter) && (
                  <div className="bg-green-950/30 border border-green-700/30 rounded-xl p-3 space-y-1">
                    <p className="text-green-400 text-xs font-semibold mb-1">{tFmt('rep.quarterDistributed', lang, { q: qlyDistResult.quarter })}</p>
                    {qlyDistResult.distributed.map(r => (
                      <p key={r.rank} className="text-zinc-300 text-xs">
                        #{r.rank}: {shortenWallet(r.walletAddress)} → {r.credited} D.FAITH Credits
                      </p>
                    ))}
                  </div>
                )}
                {qlyError && <p className="text-red-400 text-xs">{qlyError}</p>}
              </div>
            )}

            {/* Konfigurationsformular */}
            {showQlyForm && (
              <div className="p-4 space-y-3">
                <p className="text-zinc-400 text-xs">{t('rep.quarterlyDesc', lang)}</p>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">{t('rep.labelPrizesPerRank', lang)}</p>
                {qlyPrizes.map((p, i) => (
                  <div key={p.rank} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300 text-sm w-8 shrink-0">
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                      </span>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0" placeholder="Credits"
                          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-amber-500 pr-10"
                          value={qlyPrizes[i].creditReward || ''}
                          onChange={e => { const u = [...qlyPrizes]; u[i] = { ...u[i], creditReward: Number(e.target.value) || 0 }; setQlyPrizes(u); }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3 h-3 rounded-full" />
                        </span>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0" placeholder="Shards"
                          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-cyan-500 pr-8"
                          value={qlyPrizes[i].shardReward || ''}
                          onChange={e => { const u = [...qlyPrizes]; u[i] = { ...u[i], shardReward: Number(e.target.value) || 0 }; setQlyPrizes(u); }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-400 text-[10px] font-bold">✦</span>
                      </div>
                      {qlyPrizes.length > 1 && (
                        <button onClick={() => setQlyPrizes(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))} className="text-red-500 hover:text-red-400 shrink-0">
                          <FaTimes size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={() => setQlyPrizes(prev => [...prev, { rank: prev.length + 1, creditReward: 0, shardReward: 0 }])} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs">
                  <FaPlus size={9} /> {t('rep.addAnotherSlot', lang)}
                </button>
                {qlyError && <p className="text-red-400 text-xs">{qlyError}</p>}
                {(() => {
                  const total = qlyPrizes.reduce((s, p) => s + (p.creditReward || 0), 0);
                  if (total === 0) return null;
                  const enough = creditBalance !== null && total <= creditBalance;
                  return (
                    <div className="space-y-1.5">
                      <div className={`rounded-xl px-3 py-2 flex items-center justify-between text-xs ${
                        enough ? 'bg-green-950/40 border border-green-700/30' : 'bg-red-950/40 border border-red-700/40'
                      }`}>
                        <div>
                          <p className={enough ? 'text-green-300' : 'text-red-300'}>{t('rep.prizePerQuarter', lang)}</p>
                          <p className="text-zinc-600 text-[10px] mt-0.5">
                            {creditBalance !== null ? `Guthaben: ${creditBalance.toFixed(2)}` : ''}
                            {quarterlyConfig?.creditsLocked && quarterlyConfig.creditsLocked > 0
                              ? ` · ${quarterlyConfig.creditsLocked} ${t('rep.creditsReserved', lang)}`
                              : ''}
                          </p>
                        </div>
                        <p className={`flex items-center gap-1 font-bold ${enough ? 'text-green-400' : 'text-red-400'}`}>
                          {total}
                          <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3 h-3 rounded-full shrink-0" />
                          D.FAITH {enough ? '✓' : '⚠'}
                        </p>
                      </div>
                      <p className="text-zinc-600 text-[10px] px-1">💡 Credits werden beim Speichern sofort reserviert</p>
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={async () => {
                      setQlySaving(true); setQlyError('');
                      try {
                        const res = await fetch('/api/reputation/leaderboard-quarterly', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ artistWallet: walletAddress, prizes: qlyPrizes }),
                        });
                        const data = await res.json();
                        if (res.ok) { setShowQlyForm(false); await loadData(); }
                        else setQlyError(data.error || 'Fehler');
                      } finally { setQlySaving(false); }
                    }}
                    disabled={qlySaving || qlyPrizes.every(p => p.creditReward <= 0 && p.shardReward <= 0)}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold py-2.5 rounded-xl"
                  >
                    {qlySaving ? t('btn.saving', lang) : t('rep.btnSaveConfig', lang)}
                  </button>
                  <button onClick={() => setShowQlyForm(false)} className="text-zinc-400 hover:text-white text-xs px-3">
                    <FaTimes size={11} />
                  </button>
                </div>
              </div>
            )}

            {!showQlyForm && !quarterlyConfig && (
              <div className="px-4 py-6 text-center">
                <FaTrophy size={24} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">{t('rep.noQuarterlyConfig', lang)}</p>
                <p className="text-zinc-600 text-xs mt-1">{t('rep.noQuarterlyConfigHint', lang)}</p>
              </div>
            )}

            {/* Historie */}
            {quarterlyHistory.length > 0 && !showQlyForm && (
              <div className="border-t border-white/[0.07] px-4 py-3">
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">{t('rep.pastQuarters', lang)}</p>
                <div className="space-y-1.5">
                  {quarterlyHistory.slice(0, 4).map(h => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/40">
                      <span className="text-zinc-300 text-xs font-semibold">{h.quarter}</span>
                      <span className="flex items-center gap-1 text-amber-300/70 text-xs">
                        <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />
                        {h.totalCredited} {t('rep.distributedLabel', lang)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Tab
export default function ReputationTab({ artistWallet }: { artistWallet?: string | null }) {
  const { user } = useUser();
  const lang = useLang();
  const walletAddress = user?.id ?? '';

  const [mode, setMode] = useState<'supporter' | 'artist'>('supporter');
  const [reputations, setReputations] = useState<ReputationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArtist, setIsArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<ReputationEntry | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/reputation?wallet=${walletAddress}&all=true`).then(r => r.ok ? r.json() : []),
      fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([repData, profileData]) => {
        setReputations(Array.isArray(repData) ? repData : []);
        setIsArtist(!!(profileData?.profile?.isArtist));
      })
      .catch(() => setReputations([]))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  // Setze selectedArtist wenn artistWallet URL-Parameter vorhanden ist
  useEffect(() => {
    if (!artistWallet || reputations.length === 0) return;
    const artist = reputations.find(r => r.artistWallet.toLowerCase() === artistWallet.toLowerCase());
    if (artist) setSelectedArtist(artist);
  }, [artistWallet, reputations]);

  const supporterEntries = reputations.filter(r => r.artistWallet !== walletAddress);

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Image src="/D.FAITH.png" alt="D.FAITH" width={40} height={40} className="w-10 h-10 rounded-full object-contain shrink-0" />
          <div>
            <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
            <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
              {mode === 'supporter' ? t('rep.repRewards', lang) : t('rep.reputationSystem', lang)}
            </p>
          </div>
        </div>
      </div>

      {isArtist && (
        <div className="px-4 mb-4">
          <div className="flex bg-zinc-900/70 rounded-xl p-1 border border-white/[0.07]">
            <button
              onClick={() => { setMode('supporter'); setSelectedArtist(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'supporter' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FaStar size={13} />
              Supporter
            </button>
            <button
              onClick={() => setMode('artist')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'artist' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FaTrophy size={13} />
              Artist
            </button>
          </div>
        </div>
      )}

      {mode === 'supporter' && (
        loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedArtist ? (
          <ArtistDetailView
            entry={selectedArtist}
            walletAddress={walletAddress}
            userImageUrl={user?.imageUrl}
            userName={user?.fullName ?? user?.username}
            onBack={() => setSelectedArtist(null)}
          />
        ) : supporterEntries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
            <FaStar size={40} className="text-zinc-700 mb-4" />
            <p className="text-zinc-400 font-semibold">{t('rep.noArtists', lang)}</p>
            <p className="text-zinc-600 text-sm mt-2">
              {t('rep.noArtists', lang)}
            </p>
          </div>
        ) : (
          <div className="px-4 space-y-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">{t('rep.artistsLabel', lang)}</p>

            {/* Info-Banner */}
            <div className="bg-amber-400/[0.06] border border-amber-400/20 rounded-2xl p-4 flex gap-3 items-start">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center">
                <FaStar className="text-amber-400" size={16} />
              </div>
              <div>
                <p className="text-amber-300 font-black text-sm mb-1">{t('rep.infoTitle', lang)}</p>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  {t('rep.infoText', lang)}
                </p>
                <p className="text-zinc-400 text-[11px] leading-relaxed mt-1.5">
                  <span className="text-amber-400 font-semibold">{t('rep.infoWhyTitle', lang)}</span>{' '}{t('rep.infoWhyText', lang)}
                </p>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {supporterEntries.map(entry => (
                <button
                  key={entry.artistWallet}
                  onClick={() => setSelectedArtist(entry)}
                  className="flex flex-col items-center gap-2 shrink-0 w-[68px] group"
                >
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full ring-2 transition-all group-hover:scale-105 ${
                      entry.reputation > 0
                        ? 'ring-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'ring-white/25'
                    }`}>
                      {entry.artistPicture
                        ? <Image src={entry.artistPicture} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
                        : <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <FaStar className="text-amber-400" size={18} />
                          </div>}
                    </div>
                    {entry.reputation > 0 && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                        {entry.level}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">
                    {entry.artistName || shortenWallet(entry.artistWallet)}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-zinc-600 text-xs">{t('rep.tapArtistHint', lang)}</p>
          </div>
        )
      )}

      {mode === 'artist' && isArtist && (
        <ArtistPanel walletAddress={walletAddress} />
      )}
      </div>
    </div>
  );
}
