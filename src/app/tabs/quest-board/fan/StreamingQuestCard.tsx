'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaTimes, FaUsers, FaCheckCircle, FaClock, FaChartLine, FaImages } from 'react-icons/fa';
import { t, tFmt } from '../../../utils/i18n';
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
  enrollment_ends_at: string;
  deadline: string;
  status: 'enrollment' | 'active' | 'completed' | 'expired';
  confirmed_at?: string;
  proof_url?: string;
  created_at: string;
  participant_count: number;
  has_joined: boolean;
}

export interface StreamingQuestUpdate {
  id: number;
  quest_id: string;
  streams_count: number;
  screenshot_url?: string;
  note?: string;
  posted_at: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify:       'Spotify',
  apple_music:   'Apple Music',
  youtube_music: 'YouTube Music',
  amazon_music:  'Amazon Music',
  deezer:        'Deezer',
  tidal:         'Tidal',
  other:         'Andere',
};

const PLATFORM_COLORS: Record<string, string> = {
  spotify:       'bg-green-500/20 text-green-400 border-green-500/30',
  apple_music:   'bg-pink-500/20 text-pink-400 border-pink-500/30',
  youtube_music: 'bg-red-500/20 text-red-400 border-red-500/30',
  amazon_music:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  deezer:        'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tidal:         'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  other:         'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: StreamingQuest['status'] }) {
  const styles: Record<string, string> = {
    enrollment: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    active:     'bg-green-500/20 text-green-400 border-green-500/30',
    completed:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
    expired:    'bg-gray-500/20 text-gray-500 border-gray-500/30',
  };
  const labels: Record<string, string> = {
    enrollment: '🎟️ Anmeldung offen',
    active:     '🚀 Aktiv',
    completed:  '✅ Abgeschlossen',
    expired:    '⌛ Abgelaufen',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Detail-Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  quest: StreamingQuest;
  walletAddress: string;
  onClose: () => void;
  onJoined: () => void;
}

function StreamingQuestDetailModal({ quest, walletAddress, onClose, onJoined }: DetailModalProps) {
  const lang = useLang();
  const [updates, setUpdates]       = useState<StreamingQuestUpdate[]>([]);
  const [loadedUpdates, setLoadedUpdates] = useState(false);
  const [joining, setJoining]       = useState(false);
  const [joinError, setJoinError]   = useState<string | null>(null);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);

  const loadUpdates = async () => {
    if (loadedUpdates) return;
    try {
      const res = await fetch(`/api/streaming-quests/${quest.id}`, { cache: 'no-store' });
      const data = await res.json();
      setUpdates(data.updates ?? []);
    } catch { /* ignore */ }
    setLoadedUpdates(true);
  };

  React.useEffect(() => { loadUpdates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100))
    : 0;

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/streaming-quests/${quest.id}?action=join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onJoined();
      onClose();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setJoining(false);
    }
  };

  const canJoin = quest.status === 'enrollment' && !quest.has_joined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Fullscreen Bild-Overlay */}
        {selectedImg && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 cursor-zoom-out"
            onClick={() => setSelectedImg(null)}
          >
            <img src={selectedImg} alt="Screenshot" className="max-w-full max-h-full rounded-xl object-contain" />
            <button onClick={() => setSelectedImg(null)} className="absolute top-4 right-4 text-white text-2xl">
              <FaTimes />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <StatusBadge status={quest.status} />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${PLATFORM_COLORS[quest.platform] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                {PLATFORM_LABELS[quest.platform] ?? quest.platform}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{quest.title}</h2>
            {quest.description && <p className="text-sm text-gray-400 mt-1">{quest.description}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stream-Fortschritt */}
          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span className="flex items-center gap-1"><FaChartLine size={12} /> {t('sq.progress', lang)}</span>
              <span>{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()}</span>
            </div>
            <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-500 mt-0.5">{progress}%</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-xl p-3">
              <p className="text-xs text-gray-500">{t('sq.reward', lang)}</p>
              <p className="text-white font-bold">{quest.reward_per_participant.toLocaleString()} D.FAITH</p>
              {quest.reputation_reward > 0 && (
                <p className="text-xs text-yellow-400">+{quest.reputation_reward} REP</p>
              )}
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><FaUsers size={11} /> {t('sq.participants', lang)}</p>
              <p className="text-white font-bold">{quest.participant_count} / {quest.max_participants}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><FaClock size={11} /> {t('sq.enrollEnds', lang)}</p>
              <p className="text-white text-xs font-medium">{formatDate(quest.enrollment_ends_at)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><FaClock size={11} /> {t('sq.deadline', lang)}</p>
              <p className="text-white text-xs font-medium">{formatDate(quest.deadline)}</p>
            </div>
          </div>

          {/* Updates / Screenshots */}
          {updates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <FaImages size={13} /> {t('sq.updates', lang)}
              </h3>
              <div className="space-y-3">
                {updates.map(u => (
                  <div key={u.id} className="rounded-xl bg-gray-800/50 border border-white/5 p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">
                          {u.streams_count.toLocaleString()} Streams
                        </p>
                        {u.note && <p className="text-gray-400 text-xs mt-0.5">{u.note}</p>}
                        <p className="text-gray-600 text-xs mt-1">{formatDate(u.posted_at)}</p>
                      </div>
                      {u.screenshot_url && (
                        <button
                          onClick={() => setSelectedImg(u.screenshot_url!)}
                          className="flex-shrink-0 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors"
                        >
                          <img
                            src={u.screenshot_url}
                            alt="Screenshot"
                            className="w-20 h-14 object-cover"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abschluss-Proof */}
          {quest.status === 'completed' && quest.proof_url && (
            <div className="rounded-xl bg-green-900/20 border border-green-500/30 p-3">
              <p className="text-green-400 text-sm font-semibold mb-2 flex items-center gap-2">
                <FaCheckCircle /> {t('sq.completed', lang)}
              </p>
              <button
                onClick={() => setSelectedImg(quest.proof_url!)}
                className="rounded-lg overflow-hidden border border-green-500/30 hover:border-green-400/60 transition-colors"
              >
                <img src={quest.proof_url} alt="Beweis" className="w-full max-h-40 object-cover" />
              </button>
              <p className="text-gray-500 text-xs mt-2">{formatDate(quest.confirmed_at!)}</p>
            </div>
          )}

          {/* Join-Button */}
          {canJoin && (
            <div>
              {joinError && (
                <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2 mb-3">{joinError}</p>
              )}
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {joining ? t('sq.joining', lang) : t('sq.joinBtn', lang)}
              </button>
            </div>
          )}
          {quest.has_joined && quest.status !== 'completed' && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-900/20 border border-green-500/30">
              <FaCheckCircle className="text-green-400" />
              <span className="text-green-400 font-semibold text-sm">{t('sq.joined', lang)}</span>
            </div>
          )}
          {quest.has_joined && quest.status === 'completed' && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-900/20 border border-purple-500/30">
              <FaCheckCircle className="text-purple-400" />
              <span className="text-purple-400 font-semibold text-sm">{t('sq.rewardPaid', lang)}</span>
            </div>
          )}
          {quest.status === 'enrollment' && !quest.has_joined && walletAddress && (
            <p className="text-center text-xs text-gray-600">
              {quest.max_participants - quest.participant_count} {t('sq.slotsLeft', lang)}
            </p>
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
}

export default function StreamingQuestCard({ quest, walletAddress, onJoined }: CardProps) {
  const lang = useLang();
  const [showDetail, setShowDetail] = useState(false);

  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100))
    : 0;

  const platformColor = PLATFORM_COLORS[quest.platform] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <>
      {showDetail && (
        <StreamingQuestDetailModal
          quest={quest}
          walletAddress={walletAddress}
          onClose={() => setShowDetail(false)}
          onJoined={() => { onJoined(); setShowDetail(false); }}
        />
      )}

      <div
        className="rounded-2xl bg-gray-900 border border-white/10 hover:border-purple-500/30 transition-colors p-4 cursor-pointer group"
        onClick={() => setShowDetail(true)}
      >
        {/* Obere Reihe: Status + Plattform */}
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusBadge status={quest.status} />
          <span className={`text-xs px-2 py-0.5 rounded-full border ${platformColor}`}>
            {PLATFORM_LABELS[quest.platform] ?? quest.platform}
          </span>
        </div>

        {/* Titel */}
        <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2 mb-1">
          {quest.title}
        </h3>
        {quest.description && (
          <p className="text-xs text-gray-500 line-clamp-1 mb-3">{quest.description}</p>
        )}

        {/* Fortschrittsbalken */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()} Streams</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Rewards + Teilnehmer */}
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-yellow-400 font-semibold">{quest.reward_per_participant.toLocaleString()} D.FAITH</span>
            {quest.reputation_reward > 0 && (
              <span className="text-gray-500 ml-1">+{quest.reputation_reward} REP</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <FaUsers size={11} />
            <span>{quest.participant_count}/{quest.max_participants}</span>
          </div>
        </div>

        {/* Joined-Badge */}
        {quest.has_joined && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
            <FaCheckCircle size={11} />
            <span>{t('sq.joined', lang)}</span>
          </div>
        )}
      </div>
    </>
  );
}
