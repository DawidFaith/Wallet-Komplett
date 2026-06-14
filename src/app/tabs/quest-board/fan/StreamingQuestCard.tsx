'use client';

import React, { useState } from 'react';
import { FaTimes, FaUsers, FaCheckCircle, FaClock, FaChartLine, FaImages, FaTrophy, FaStar, FaGift } from 'react-icons/fa';
import { t } from '../../../utils/i18n';
import { useLang } from '../../../components/LangContext';

export interface StreamingQuest {
  id: string;
  creator_wallet: string;
  title: string;
  description?: string;
  platform: string;
  target_streams: number;
  current_streams: number;
  reward_per_participant: number;
  max_participants: number;
  reputation_reward: number;
  shard_drop_chance: number;
  enrollment_ends_at: string;
  deadline: string;
  status: 'enrollment' | 'active' | 'completed' | 'expired';
  confirmed_at?: string;
  proof_url?: string;
  created_at: string;
  participant_count: number;
  has_joined: boolean;
  reward_paid: boolean;
}

export interface StreamingQuestUpdate {
  id: number;
  quest_id: string;
  streams_count: number;
  screenshot_url?: string;
  note?: string;
  posted_at: string;
}

const PLATFORM_CONFIG: Record<string, {
  label: string; color: string; border: string;
  accent: string; button: string; progress: string;
}> = {
  spotify:       { label: 'Spotify',       color: 'bg-green-500/20 text-green-400',   border: 'border-green-700/40',  accent: 'from-green-600 to-emerald-500',  button: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500',   progress: 'from-green-500 to-emerald-400' },
  apple_music:   { label: 'Apple Music',   color: 'bg-pink-500/20 text-pink-400',     border: 'border-pink-700/40',   accent: 'from-pink-600 to-rose-500',      button: 'from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500',         progress: 'from-pink-500 to-rose-400' },
  youtube_music: { label: 'YouTube Music', color: 'bg-red-500/20 text-red-400',       border: 'border-red-700/40',    accent: 'from-red-600 to-orange-500',     button: 'from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500',       progress: 'from-red-500 to-orange-400' },
  amazon_music:  { label: 'Amazon Music',  color: 'bg-blue-500/20 text-blue-400',     border: 'border-blue-700/40',   accent: 'from-blue-600 to-cyan-500',      button: 'from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500',         progress: 'from-blue-500 to-cyan-400' },
  deezer:        { label: 'Deezer',        color: 'bg-purple-500/20 text-purple-400', border: 'border-purple-700/40', accent: 'from-purple-600 to-violet-500',  button: 'from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500', progress: 'from-purple-500 to-violet-400' },
  tidal:         { label: 'Tidal',         color: 'bg-cyan-500/20 text-cyan-400',     border: 'border-cyan-700/40',   accent: 'from-cyan-600 to-teal-500',      button: 'from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500',         progress: 'from-cyan-500 to-teal-400' },
  other:         { label: 'Streaming',     color: 'bg-gray-500/20 text-gray-400',     border: 'border-gray-700/40',   accent: 'from-gray-600 to-gray-500',      button: 'from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400',         progress: 'from-gray-500 to-gray-400' },
};
const DEFAULT_CFG = PLATFORM_CONFIG.other;
function getCfg(p: string) { return PLATFORM_CONFIG[p] ?? DEFAULT_CFG; }

const STATUS_LABELS: Record<string, string> = {
  enrollment: '🎟️ Anmeldung offen',
  active:     '🚀 Läuft',
  completed:  '✅ Abgeschlossen',
  expired:    '⌛ Abgelaufen',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'abgelaufen';
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}d ${h % 24}h` : `${h}h`;
}

// ─── Erfolgs-Banner ────────────────────────────────────────────────────────────
interface ClaimSuccessProps { reward: number; rep: number; shardDropped: boolean; onDone: () => void; }
function ClaimSuccess({ reward, rep, shardDropped, onDone }: ClaimSuccessProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center pb-10 pointer-events-none">
      <div className="pointer-events-auto bg-zinc-900 border border-green-600/50 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 text-center animate-bounce-once">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-white font-bold text-lg mb-1">Belohnung erhalten!</h3>
        <p className="text-green-400 font-semibold text-base">+{reward.toLocaleString()} D.FAITH</p>
        {rep > 0 && <p className="text-amber-400 text-sm mt-0.5">+{rep} Reputation</p>}
        {shardDropped && (
          <p className="text-purple-300 text-sm mt-0.5 flex items-center justify-center gap-1">
            <FaStar size={12} /> Shard erhalten!
          </p>
        )}
        <button
          onClick={onDone}
          className="mt-4 px-6 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ─── Detail-Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  quest: StreamingQuest;
  walletAddress: string;
  onClose: () => void;
  onJoined: () => void;
  onClaimed: () => void;
}

function StreamingQuestDetailModal({ quest, walletAddress, onClose, onJoined, onClaimed }: DetailModalProps) {
  const lang = useLang();
  const cfg  = getCfg(quest.platform);
  const [updates, setUpdates]             = useState<StreamingQuestUpdate[]>([]);
  const [loadedUpdates, setLoadedUpdates] = useState(false);
  const [joining, setJoining]             = useState(false);
  const [joinError, setJoinError]         = useState<string | null>(null);
  const [claiming, setClaiming]           = useState(false);
  const [claimError, setClaimError]       = useState<string | null>(null);
  const [claimResult, setClaimResult]     = useState<{ reward: number; rep: number; shardDropped: boolean } | null>(null);
  const [selectedImg, setSelectedImg]     = useState<string | null>(null);

  React.useEffect(() => {
    if (loadedUpdates) return;
    fetch(`/api/streaming-quests/${quest.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setUpdates(d.updates ?? []); setLoadedUpdates(true); })
      .catch(() => setLoadedUpdates(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100)) : 0;

  const handleJoin = async () => {
    setJoining(true); setJoinError(null);
    try {
      const res = await fetch(`/api/streaming-quests/${quest.id}?action=join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onJoined();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Fehler');
    } finally { setJoining(false); }
  };

  const handleClaim = async () => {
    setClaiming(true); setClaimError(null);
    try {
      const res = await fetch(`/api/streaming-quests/${quest.id}?action=claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setClaimResult({ reward: data.reward ?? 0, rep: data.rep ?? 0, shardDropped: Boolean(data.shardDropped) });
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Fehler');
    } finally { setClaiming(false); }
  };

  const canJoin   = quest.status === 'enrollment' && !quest.has_joined && !!walletAddress;
  const canClaim  = quest.status === 'completed' && quest.has_joined && !quest.reward_paid && !!walletAddress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      {claimResult && (
        <ClaimSuccess
          reward={claimResult.reward}
          rep={claimResult.rep}
          shardDropped={claimResult.shardDropped}
          onDone={() => { setClaimResult(null); onClaimed(); }}
        />
      )}
      <div className="relative w-full max-w-xl rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
        {selectedImg && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 cursor-zoom-out" onClick={() => setSelectedImg(null)}>
            <img src={selectedImg} alt="Screenshot" className="max-w-full max-h-full rounded-xl object-contain" />
            <button onClick={() => setSelectedImg(null)} className="absolute top-4 right-4 text-white text-2xl"><FaTimes /></button>
          </div>
        )}
        <div className={`h-1 w-full rounded-t-2xl bg-gradient-to-r ${cfg.accent}`} />
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>🎵 {cfg.label}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{STATUS_LABELS[quest.status] ?? quest.status}</span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{quest.title}</h2>
            {quest.description && <p className="text-sm text-zinc-400 mt-1">{quest.description}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"><FaTimes /></button>
        </div>
        <div className="px-5 pb-5 space-y-4">
          {/* Fortschritt */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1"><FaChartLine size={11} /> {t('sq.progress', lang)}</span>
              <span className="font-medium">{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()} Streams</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${cfg.progress} transition-all duration-500`} style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-xs text-zinc-500 mt-0.5">{progress}%</p>
          </div>

          {/* Info-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[11px] text-zinc-500 mb-1">{t('sq.reward', lang)}</p>
              <p className="text-white font-bold">{quest.reward_per_participant.toLocaleString()} D.FAITH</p>
              {quest.reputation_reward > 0 && <p className="text-xs text-amber-400 mt-0.5">+{quest.reputation_reward} REP</p>}
              {quest.shard_drop_chance > 0 && (
                <p className="text-xs text-purple-400 mt-0.5 flex items-center gap-1"><FaStar size={9} /> {quest.shard_drop_chance}% Shard</p>
              )}
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><FaUsers size={10} /> {t('sq.participants', lang)}</p>
              <p className="text-white font-bold">{quest.participant_count} / {quest.max_participants}</p>
              <div className="w-full h-1 bg-zinc-700 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${cfg.progress}`}
                  style={{ width: `${Math.min(100, (quest.participant_count / quest.max_participants) * 100)}%` }} />
              </div>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><FaClock size={10} /> {t('sq.enrollEnds', lang)}</p>
              <p className="text-white text-xs font-medium">{formatDate(quest.enrollment_ends_at)}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><FaClock size={10} /> {t('sq.deadline', lang)}</p>
              <p className="text-white text-xs font-medium">{formatDate(quest.deadline)}</p>
            </div>
          </div>

          {/* Anti-Sybil Hinweis */}
          {canJoin && (
            <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-3 py-2 text-xs text-zinc-400">
              🔒 {t('sq.antiSybilHint', lang)}
            </div>
          )}

          {/* Updates-Galerie */}
          {updates.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaImages size={11} /> {t('sq.updates', lang)}
              </h3>
              <div className="space-y-2">
                {updates.map(u => (
                  <div key={u.id} className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-white font-semibold">{u.streams_count.toLocaleString()} Streams</p>
                        {u.note && <p className="text-zinc-400 text-xs mt-0.5">{u.note}</p>}
                        <p className="text-zinc-600 text-xs mt-1">{formatDate(u.posted_at)}</p>
                      </div>
                      {u.screenshot_url && (
                        <button onClick={() => setSelectedImg(u.screenshot_url!)}
                          className="flex-shrink-0 rounded-lg overflow-hidden border border-zinc-700 hover:border-zinc-500 transition-colors">
                          <img src={u.screenshot_url} alt="Screenshot" className="w-20 h-14 object-cover" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Beweis-Foto */}
          {quest.status === 'completed' && quest.proof_url && (
            <div className="rounded-xl bg-green-900/20 border border-green-600/30 p-3">
              <p className="text-green-400 text-sm font-semibold mb-2 flex items-center gap-2"><FaCheckCircle /> {t('sq.completed', lang)}</p>
              <button onClick={() => setSelectedImg(quest.proof_url!)}
                className="rounded-lg overflow-hidden border border-green-600/30 hover:border-green-400/60 transition-colors w-full">
                <img src={quest.proof_url} alt="Beweis" className="w-full max-h-40 object-cover" />
              </button>
            </div>
          )}

          {/* Join */}
          {canJoin && (
            <div className="space-y-2">
              {joinError && <p className="text-red-400 text-sm bg-red-900/20 rounded-xl px-3 py-2">{joinError}</p>}
              <button onClick={handleJoin} disabled={joining}
                className={`w-full py-3 rounded-xl bg-gradient-to-r ${cfg.button} text-white font-bold disabled:opacity-50 transition-opacity flex items-center justify-center gap-2`}>
                <FaTrophy size={13} /> {joining ? t('sq.joining', lang) : t('sq.joinBtn', lang)}
              </button>
              <p className="text-center text-xs text-zinc-600">
                {quest.max_participants - quest.participant_count} {t('sq.slotsLeft', lang)}
              </p>
            </div>
          )}

          {/* Claim */}
          {canClaim && (
            <div className="space-y-2">
              {claimError && <p className="text-red-400 text-sm bg-red-900/20 rounded-xl px-3 py-2">{claimError}</p>}
              <button onClick={handleClaim} disabled={claiming}
                className={`w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold disabled:opacity-50 transition-opacity flex items-center justify-center gap-2`}>
                <FaGift size={14} /> {claiming ? t('sq.claiming', lang) : t('sq.claimBtn', lang)}
              </button>
              <p className="text-center text-xs text-zinc-500">{quest.reward_per_participant.toLocaleString()} D.FAITH + ggf. Shard</p>
            </div>
          )}

          {/* Beigetreten, wartet auf Abschluss */}
          {quest.has_joined && quest.status !== 'completed' && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-900/20 border border-green-600/30">
              <FaCheckCircle className="text-green-400" size={14} />
              <span className="text-green-400 font-semibold">{t('sq.joined', lang)}</span>
            </div>
          )}

          {/* Bereits abgeholt */}
          {quest.has_joined && quest.status === 'completed' && quest.reward_paid && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-900/20 border border-purple-600/30">
              <FaTrophy className="text-purple-400" size={14} />
              <span className="text-purple-400 font-semibold">{t('sq.rewardPaid', lang)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Karte ────────────────────────────────────────────────────────────────────
interface CardProps {
  quest: StreamingQuest;
  walletAddress: string;
  onJoined: () => void;
  onClaimed: () => void;
}

export default function StreamingQuestCard({ quest, walletAddress, onJoined, onClaimed }: CardProps) {
  const lang = useLang();
  const [showDetail, setShowDetail] = useState(false);
  const cfg = getCfg(quest.platform);
  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100)) : 0;
  const isExpired   = quest.status === 'expired';
  const canClaim    = quest.status === 'completed' && quest.has_joined && !quest.reward_paid;

  return (
    <>
      {showDetail && (
        <StreamingQuestDetailModal
          quest={quest}
          walletAddress={walletAddress}
          onClose={() => setShowDetail(false)}
          onJoined={() => { onJoined(); setShowDetail(false); }}
          onClaimed={() => { onClaimed(); setShowDetail(false); }}
        />
      )}
      <div
        onClick={() => setShowDetail(true)}
        className={`bg-zinc-900 rounded-2xl border ${cfg.border} overflow-hidden cursor-pointer transition-all hover:brightness-110 ${isExpired ? 'opacity-50' : ''}`}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.accent}`} />
        <div className="p-5 space-y-4">
          {/* Badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>🎵 {cfg.label}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400">{STATUS_LABELS[quest.status] ?? quest.status}</span>
            </div>
            {quest.has_joined && !quest.reward_paid && <FaCheckCircle className="text-green-400 flex-shrink-0" size={14} />}
            {quest.reward_paid && <FaTrophy className="text-purple-400 flex-shrink-0" size={14} />}
          </div>

          {/* Titel */}
          <h3 className="text-white font-bold text-base leading-snug line-clamp-2">{quest.title}</h3>

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()} Streams</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${cfg.progress} transition-all duration-500`} style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Reward + Teilnehmer */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-yellow-400 font-bold">{quest.reward_per_participant.toLocaleString()} D.FAITH</span>
              {quest.reputation_reward > 0 && (
                <span className="flex items-center gap-0.5 text-amber-300 text-xs"><FaStar size={10} /> +{quest.reputation_reward} REP</span>
              )}
              {quest.shard_drop_chance > 0 && (
                <span className="flex items-center gap-0.5 text-purple-300 text-xs"><FaStar size={10} /> {quest.shard_drop_chance}% Shard</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-zinc-500 text-xs">
              <FaUsers size={11} />
              <span>{quest.participant_count}/{quest.max_participants}</span>
            </div>
          </div>

          {/* Zeit */}
          {quest.status === 'enrollment' && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <FaClock size={11} /><span>Anmeldung noch {timeLeft(quest.enrollment_ends_at)}</span>
            </div>
          )}
          {quest.status === 'active' && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <FaClock size={11} /><span>Endet in {timeLeft(quest.deadline)}</span>
            </div>
          )}

          {/* Aktionsbutton */}
          {quest.status === 'enrollment' && !quest.has_joined && (
            <button
              onClick={e => { e.stopPropagation(); setShowDetail(true); }}
              className={`w-full py-3 rounded-xl bg-gradient-to-r ${cfg.button} text-white font-bold flex items-center justify-center gap-2`}
            >
              <FaTrophy size={13} /> {t('sq.joinBtn', lang)}
            </button>
          )}
          {canClaim && (
            <button
              onClick={e => { e.stopPropagation(); setShowDetail(true); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold flex items-center justify-center gap-2 animate-pulse"
            >
              <FaGift size={13} /> {t('sq.claimBtn', lang)}
            </button>
          )}
          {quest.has_joined && quest.status !== 'completed' && (
            <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-900/30 border border-green-700/30 text-green-400 font-semibold text-sm">
              <FaCheckCircle size={12} /> {t('sq.joined', lang)}
            </div>
          )}
          {quest.status === 'completed' && quest.has_joined && quest.reward_paid && (
            <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-900/30 border border-purple-700/30 text-purple-400 font-semibold text-sm">
              <FaTrophy size={12} /> {t('sq.rewardPaid', lang)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
