'use client';

import React, { useState } from 'react';
import { FaTimes, FaUsers, FaCheckCircle, FaClock, FaChartLine, FaImages, FaTrophy, FaStar, FaGift, FaShieldAlt } from 'react-icons/fa';
import { SiSpotify, SiApplemusic, SiYoutubemusic, SiAmazonmusic, SiTidal } from 'react-icons/si';
import { t, tFmt } from '../../../utils/i18n';
import { useLang } from '../../../components/LangContext';
import type { IconType } from 'react-icons';

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
  min_level: number;
  track_url?: string | null;
  enrollment_ends_at: string;
  deadline: string;
  status: 'enrollment' | 'active' | 'completed' | 'expired' | 'cancelled';
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

// Brand-genaue Farben (inline, nicht Tailwind-Klassen wegen Purge)
const PLATFORM_CONFIG: Record<string, {
  label: string;
  Icon: IconType;
  brandColor: string;       // für style={}
  bgClass: string;          // badge bg
  textClass: string;        // badge text
  borderClass: string;      // Karten-Border
  accentClass: string;      // Gradient-Streifen oben
  buttonClass: string;      // Aktionsbutton
  progressClass: string;    // Fortschrittsbalken
}> = {
  spotify: {
    label: 'Spotify', Icon: SiSpotify, brandColor: '#1DB954',
    bgClass: 'bg-[#1DB954]/15', textClass: 'text-[#1DB954]',
    borderClass: 'border-[#1DB954]/35',
    accentClass: 'from-[#1DB954] to-[#1ed760]',
    buttonClass: 'from-[#1DB954] to-[#17a349] hover:from-[#1ed760] hover:to-[#1DB954]',
    progressClass: 'from-[#1DB954] to-[#1ed760]',
  },
  apple_music: {
    label: 'Apple Music', Icon: SiApplemusic, brandColor: '#FC3C44',
    bgClass: 'bg-[#FC3C44]/15', textClass: 'text-[#FC3C44]',
    borderClass: 'border-[#FC3C44]/35',
    accentClass: 'from-[#FC3C44] to-[#ff6b6b]',
    buttonClass: 'from-[#FC3C44] to-[#e02a32] hover:from-[#ff6b6b] hover:to-[#FC3C44]',
    progressClass: 'from-[#FC3C44] to-[#ff6b6b]',
  },
  youtube_music: {
    label: 'YouTube Music', Icon: SiYoutubemusic, brandColor: '#FF0000',
    bgClass: 'bg-[#FF0000]/15', textClass: 'text-[#FF0000]',
    borderClass: 'border-[#FF0000]/35',
    accentClass: 'from-[#FF0000] to-[#ff4444]',
    buttonClass: 'from-[#FF0000] to-[#cc0000] hover:from-[#ff4444] hover:to-[#FF0000]',
    progressClass: 'from-[#FF0000] to-[#ff4444]',
  },
  amazon_music: {
    label: 'Amazon Music', Icon: SiAmazonmusic, brandColor: '#00A8E1',
    bgClass: 'bg-[#00A8E1]/15', textClass: 'text-[#00A8E1]',
    borderClass: 'border-[#00A8E1]/35',
    accentClass: 'from-[#00A8E1] to-[#00c4ff]',
    buttonClass: 'from-[#00A8E1] to-[#0090c8] hover:from-[#00c4ff] hover:to-[#00A8E1]',
    progressClass: 'from-[#00A8E1] to-[#00c4ff]',
  },
  deezer: {
    label: 'Deezer', Icon: FaShieldAlt, brandColor: '#A238FF',
    bgClass: 'bg-[#A238FF]/15', textClass: 'text-[#A238FF]',
    borderClass: 'border-[#A238FF]/35',
    accentClass: 'from-[#A238FF] to-[#bf6fff]',
    buttonClass: 'from-[#A238FF] to-[#8820e8] hover:from-[#bf6fff] hover:to-[#A238FF]',
    progressClass: 'from-[#A238FF] to-[#bf6fff]',
  },
  tidal: {
    label: 'Tidal', Icon: SiTidal, brandColor: '#00FFFF',
    bgClass: 'bg-[#00FFFF]/10', textClass: 'text-[#00e5e5]',
    borderClass: 'border-[#00FFFF]/30',
    accentClass: 'from-[#00FFFF] to-[#00cccc]',
    buttonClass: 'from-[#00cccc] to-[#009999] hover:from-[#00FFFF] hover:to-[#00cccc]',
    progressClass: 'from-[#00FFFF] to-[#00cccc]',
  },
  other: {
    label: 'Streaming', Icon: FaImages, brandColor: '#888888',
    bgClass: 'bg-zinc-700/20', textClass: 'text-zinc-400',
    borderClass: 'border-zinc-700/40',
    accentClass: 'from-zinc-600 to-zinc-500',
    buttonClass: 'from-zinc-600 to-zinc-500 hover:from-zinc-500 hover:to-zinc-400',
    progressClass: 'from-zinc-500 to-zinc-400',
  },
};
const DEFAULT_CFG = PLATFORM_CONFIG.other;
function getCfg(p: string) { return PLATFORM_CONFIG[p] ?? DEFAULT_CFG; }

/** Versucht, aus einer Track-URL einen Spotify-Embed zu generieren.
 * Gibt null zurück wenn kein Spotify-Track erkannt. */
function getSpotifyEmbedUrl(url: string): string | null {
  // https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?...
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/track/${m[1]}?utm_source=generator&theme=0` : null;
}

// Erkennt die Plattform anhand der URL für den Link-Button-Text
function getPlatformFromUrl(url: string, fallback: string): { label: string; color: string } {
  if (url.includes('spotify.com'))      return { label: 'Spotify',       color: '#1DB954' };
  if (url.includes('music.apple.com'))  return { label: 'Apple Music',   color: '#FC3C44' };
  if (url.includes('music.youtube.com') || url.includes('youtu')) return { label: 'YouTube Music', color: '#FF0000' };
  if (url.includes('music.amazon'))     return { label: 'Amazon Music',  color: '#00A8E1' };
  if (url.includes('tidal.com'))        return { label: 'Tidal',         color: '#00FFFF' };
  if (url.includes('deezer.com'))       return { label: 'Deezer',        color: '#A238FF' };
  return { label: fallback, color: '#888888' };
}

interface TrackDisplayProps { url: string; platformLabel: string; lang: string; compact?: boolean; }
function TrackDisplay({ url, platformLabel, lang, compact = false }: TrackDisplayProps) {
  const embedUrl = getSpotifyEmbedUrl(url);
  if (embedUrl && !compact) {
    return (
      <iframe
        src={embedUrl}
        width="100%"
        height="80"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="rounded-xl border-0"
        style={{ minHeight: 80 }}
      />
    );
  }
  const { label, color } = getPlatformFromUrl(url, platformLabel);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors hover:brightness-125"
      style={{ borderColor: `${color}55`, color, backgroundColor: `${color}15` }}
    >
      <FaChartLine size={12} />
      {t('sq.listenOnPlatform', lang as Parameters<typeof t>[1])} • {label}
    </a>
  );
}

function getStatusLabel(status: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    enrollment: { de: '🎟️ Anmeldung offen', en: '🎟️ Enrollment open', pl: '🎟️ Rejestracja otwarta' },
    active:     { de: '🚀 Läuft',           en: '🚀 Active',          pl: '🚀 Aktywny' },
    completed:  { de: '✅ Abgeschlossen',   en: '✅ Completed',       pl: '✅ Zakończono' },
    expired:    { de: '⌛ Abgelaufen',       en: '⌛ Expired',         pl: '⌛ Wygasł' },
    cancelled:  { de: '🚫 Storniert',       en: '🚫 Cancelled',       pl: '🚫 Anulowano' },
  };
  return labels[status]?.[lang] ?? labels[status]?.['de'] ?? status;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function timeLeft(iso: string, lang: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const expired = { de: 'abgelaufen', en: 'expired', pl: 'wygasł' };
  if (diff <= 0) return expired[lang as 'de'|'en'|'pl'] ?? expired.de;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}d ${h % 24}h` : `${h}h`;
}

// ─── Erfolgs-Banner ────────────────────────────────────────────────────────────
interface ClaimSuccessProps { reward: number; rep: number; shardDropped: boolean; onDone: () => void; }
function ClaimSuccess({ reward, rep, shardDropped, onDone }: ClaimSuccessProps) {
  const lang = useLang();
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center pb-10 pointer-events-none">
      <div className="pointer-events-auto bg-zinc-900 border border-green-600/50 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-white font-bold text-lg mb-1">{t('sq.claimSuccessTitle', lang)}</h3>
        <p className="text-green-400 font-semibold text-base">+{reward.toLocaleString()} D.FAITH</p>
        {rep > 0 && <p className="text-amber-400 text-sm mt-0.5">+{rep} Reputation</p>}
        {shardDropped && (
          <p className="text-purple-300 text-sm mt-0.5 flex items-center justify-center gap-1">
            <FaStar size={12} /> {t('sq.shardReceived', lang)}
          </p>
        )}
        <button onClick={onDone} className="mt-4 px-6 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-colors">OK</button>
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
  const { Icon } = cfg;
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

  const canJoin  = quest.status === 'enrollment' && !quest.has_joined && !!walletAddress;
  const canClaim = quest.status === 'completed' && quest.has_joined && !quest.reward_paid && !!walletAddress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      {claimResult && (
        <ClaimSuccess
          reward={claimResult.reward} rep={claimResult.rep} shardDropped={claimResult.shardDropped}
          onDone={() => { setClaimResult(null); onClaimed(); }}
        />
      )}
      <div className={`relative w-full max-w-xl rounded-2xl bg-zinc-900 border ${cfg.borderClass} shadow-2xl overflow-y-auto max-h-[90vh]`}>
        {selectedImg && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 cursor-zoom-out" onClick={() => setSelectedImg(null)}>
            <img src={selectedImg} alt="Screenshot" className="max-w-full max-h-full rounded-xl object-contain" />
            <button onClick={() => setSelectedImg(null)} className="absolute top-4 right-4 text-white text-2xl"><FaTimes /></button>
          </div>
        )}
        <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${cfg.accentClass}`} />
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${cfg.bgClass} ${cfg.textClass}`}>
                <Icon size={12} style={{ color: cfg.brandColor }} /> {cfg.label}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400">{getStatusLabel(quest.status, lang)}</span>
              {quest.min_level > 1 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900/30 text-amber-400 border border-amber-700/30">
                  Lvl {quest.min_level}+
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{quest.title}</h2>
            {quest.description && <p className="text-sm text-zinc-400 mt-1">{quest.description}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"><FaTimes /></button>
        </div>
        <div className="px-5 pb-5 space-y-4">
          {/* Track-Link / Embed */}
          {quest.track_url && (
            <div>
              <TrackDisplay url={quest.track_url} platformLabel={cfg.label} lang={lang} />
            </div>
          )}

          {/* Fortschritt */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1"><FaChartLine size={11} /> {t('sq.progress', lang)}</span>
              <span className="font-medium">{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()} Streams</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${cfg.progressClass} transition-all duration-500`} style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-xs text-zinc-500 mt-0.5">{progress}%</p>
          </div>
          {/* Info-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[11px] text-zinc-500 mb-1">{t('sq.reward', lang)}</p>
              <p className="text-white font-bold">{quest.reward_per_participant.toLocaleString()} D.FAITH</p>
              {quest.reputation_reward > 0 && <p className="text-xs text-amber-400 mt-0.5">+{quest.reputation_reward} REP</p>}
              {quest.shard_drop_chance > 0 && <p className="text-xs text-purple-400 mt-0.5 flex items-center gap-1"><FaStar size={9} /> {quest.shard_drop_chance}% Shard</p>}
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1"><FaUsers size={10} /> {t('sq.participants', lang)}</p>
              <p className="text-white font-bold">{quest.participant_count} / {quest.max_participants}</p>
              <div className="w-full h-1 bg-zinc-700 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${cfg.progressClass}`} style={{ width: `${Math.min(100, (quest.participant_count / quest.max_participants) * 100)}%` }} />
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
          {/* Level-Hinweis */}
          {canJoin && quest.min_level > 1 && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
              <FaShieldAlt size={11} /> {tFmt('sq.minLevelRequired', lang, { level: String(quest.min_level) })}
            </div>
          )}
          {/* Updates */}
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
                        <button onClick={() => setSelectedImg(u.screenshot_url!)} className="flex-shrink-0 rounded-lg overflow-hidden border border-zinc-700 hover:border-zinc-500 transition-colors">
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
              <button onClick={() => setSelectedImg(quest.proof_url!)} className="rounded-lg overflow-hidden border border-green-600/30 hover:border-green-400/60 transition-colors w-full">
                <img src={quest.proof_url} alt="Beweis" className="w-full max-h-40 object-cover" />
              </button>
            </div>
          )}
          {/* Join */}
          {canJoin && (
            <div className="space-y-2">
              {joinError && <p className="text-red-400 text-sm bg-red-900/20 rounded-xl px-3 py-2">{joinError}</p>}
              <button onClick={handleJoin} disabled={joining}
                className={`w-full py-3 rounded-xl bg-gradient-to-r ${cfg.buttonClass} text-white font-bold disabled:opacity-50 transition-opacity flex items-center justify-center gap-2`}>
                <FaTrophy size={13} /> {joining ? t('sq.joining', lang) : t('sq.joinBtn', lang)}
              </button>
              <p className="text-center text-xs text-zinc-600">{quest.max_participants - quest.participant_count} {t('sq.slotsLeft', lang)}</p>
            </div>
          )}
          {/* Claim */}
          {canClaim && (
            <div className="space-y-2">
              {claimError && <p className="text-red-400 text-sm bg-red-900/20 rounded-xl px-3 py-2">{claimError}</p>}
              <button onClick={handleClaim} disabled={claiming}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <FaGift size={14} /> {claiming ? t('sq.claiming', lang) : t('sq.claimBtn', lang)}
              </button>
              <p className="text-center text-xs text-zinc-500">{quest.reward_per_participant.toLocaleString()} {t('sq.claimSubHint', lang)}</p>
            </div>
          )}
          {quest.has_joined && quest.status !== 'completed' && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-900/20 border border-green-600/30">
              <FaCheckCircle className="text-green-400" size={14} />
              <span className="text-green-400 font-semibold">{t('sq.joined', lang)}</span>
            </div>
          )}
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
  const { Icon } = cfg;
  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100)) : 0;
  const isExpired  = quest.status === 'expired';
  const canClaim   = quest.status === 'completed' && quest.has_joined && !quest.reward_paid;

  return (
    <>
      {showDetail && (
        <StreamingQuestDetailModal
          quest={quest} walletAddress={walletAddress}
          onClose={() => setShowDetail(false)}
          onJoined={() => { onJoined(); setShowDetail(false); }}
          onClaimed={() => { onClaimed(); setShowDetail(false); }}
        />
      )}
      <div
        onClick={() => setShowDetail(true)}
        className={`bg-zinc-900 rounded-2xl border ${cfg.borderClass} overflow-hidden cursor-pointer transition-all hover:brightness-110 ${isExpired ? 'opacity-50' : ''}`}
      >
        {/* Brand-Accent-Streifen */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.accentClass}`} />
        <div className="p-5 space-y-4">
          {/* Badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${cfg.bgClass} ${cfg.textClass}`}>
                <Icon size={13} style={{ color: cfg.brandColor }} />
                {cfg.label}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">{getStatusLabel(quest.status, lang)}</span>
              {quest.min_level > 1 && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-900/30 text-amber-400 border border-amber-700/30 flex items-center gap-1">
                  <FaShieldAlt size={9} /> Lvl {quest.min_level}+
                </span>
              )}
            </div>
            {quest.has_joined && !quest.reward_paid && <FaCheckCircle className="text-green-400 flex-shrink-0" size={14} />}
            {quest.reward_paid && <FaTrophy className="text-purple-400 flex-shrink-0" size={14} />}
          </div>
          {/* Titel */}
          <h3 className="text-white font-bold text-base leading-snug line-clamp-2">{quest.title}</h3>
          {/* Track-Link (kompakt, kein Embed auf der Karte) */}
          {quest.track_url && (
            <TrackDisplay url={quest.track_url} platformLabel={cfg.label} lang={lang} compact />
          )}
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()} Streams</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${cfg.progressClass} transition-all duration-500`} style={{ width: `${progress}%` }} />
            </div>
          </div>
          {/* Reward + Teilnehmer */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-yellow-400 font-bold">{quest.reward_per_participant.toLocaleString()} D.FAITH</span>
              {quest.reputation_reward > 0 && <span className="flex items-center gap-0.5 text-amber-300 text-xs"><FaStar size={10} /> +{quest.reputation_reward}</span>}
              {quest.shard_drop_chance > 0 && <span className="flex items-center gap-0.5 text-purple-300 text-xs"><FaStar size={10} /> {quest.shard_drop_chance}%</span>}
            </div>
            <div className="flex items-center gap-1 text-zinc-500 text-xs">
              <FaUsers size={11} />
              <span>{quest.participant_count}/{quest.max_participants}</span>
            </div>
          </div>
          {/* Zeit */}
          {quest.status === 'enrollment' && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <FaClock size={11} /><span>{t('sq.enrollmentTimeLeft', lang)} {timeLeft(quest.enrollment_ends_at, lang)}</span>
            </div>
          )}
          {quest.status === 'active' && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <FaClock size={11} /><span>{t('sq.endsIn', lang)} {timeLeft(quest.deadline, lang)}</span>
            </div>
          )}
          {/* Aktionsbutton */}
          {quest.status === 'enrollment' && !quest.has_joined && (
            <button onClick={e => { e.stopPropagation(); setShowDetail(true); }}
              className={`w-full py-3 rounded-xl bg-gradient-to-r ${cfg.buttonClass} text-white font-bold flex items-center justify-center gap-2`}>
              <FaTrophy size={13} /> {t('sq.joinBtn', lang)}
            </button>
          )}
          {canClaim && (
            <button onClick={e => { e.stopPropagation(); setShowDetail(true); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold flex items-center justify-center gap-2 animate-pulse">
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
