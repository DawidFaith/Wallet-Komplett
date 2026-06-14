'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaTimes, FaUsers, FaCheckCircle, FaClock, FaChartLine, FaUpload, FaCamera } from 'react-icons/fa';
import { upload } from '@vercel/blob/client';
import { t, tFmt } from '../../../utils/i18n';
import { useLang } from '../../../components/LangContext';
import type { StreamingQuest, StreamingQuestUpdate } from '../fan/StreamingQuestCard';

const PLATFORM_LABELS: Record<string, string> = {
  spotify:       'Spotify',
  apple_music:   'Apple Music',
  youtube_music: 'YouTube Music',
  amazon_music:  'Amazon Music',
  deezer:        'Deezer',
  tidal:         'Tidal',
  other:         'Andere',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function deriveLabel(status: StreamingQuest['status']): string {
  const m: Record<string, string> = {
    enrollment: '🎟️ Anmeldung offen',
    active: '🚀 Aktiv',
    completed: '✅ Abgeschlossen',
    expired: '⌛ Abgelaufen',
  };
  return m[status] ?? status;
}

// ─── Update-Dialog ───────────────────────────────────────────────────────────
interface UpdateDialogProps {
  questId: string;
  creatorWallet: string;
  currentStreams: number;
  isConfirm?: boolean;
  onClose: () => void;
  onDone: () => void;
}

function UpdateDialog({ questId, creatorWallet, currentStreams, isConfirm = false, onClose, onDone }: UpdateDialogProps) {
  const lang = useLang();
  const [streams, setStreams]   = useState(currentStreams);
  const [note, setNote]         = useState('');
  const [imgUrl, setImgUrl]     = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await upload(
        `streaming-quests/${questId}/${Date.now()}-${file.name}`,
        file,
        {
          access: 'public',
          handleUploadUrl: '/api/streaming-quests/upload',
          clientPayload: JSON.stringify({ wallet: creatorWallet }),
        },
      );
      setImgUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (isConfirm && !imgUrl && !window.confirm(t('sq.confirmNoProof', lang))) return;
    setSaving(true);
    setError(null);
    const action = isConfirm ? 'confirm' : 'update';
    try {
      const res = await fetch(`/api/streaming-quests/${questId}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: creatorWallet,
          streamsCount: streams,
          screenshotUrl: imgUrl || undefined,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">
            {isConfirm ? t('sq.confirmTitle', lang) : t('sq.updateTitle', lang)}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><FaTimes /></button>
        </div>

        {/* Stream-Anzahl */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">{t('sq.currentStreams', lang)}</label>
          <input
            type="number"
            value={streams}
            onChange={e => setStreams(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Screenshot-Upload */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">{t('sq.proofUpload', lang)}</label>
          <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-white/10 hover:border-purple-500/50 cursor-pointer transition-colors text-sm text-gray-400 hover:text-white">
            <FaCamera />
            {uploading ? t('sq.uploading', lang) : imgUrl ? t('sq.uploadDone', lang) : t('sq.uploadHint', lang)}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {imgUrl && (
            <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
              <img src={imgUrl} alt="Screenshot" className="w-full max-h-40 object-cover" />
            </div>
          )}
        </div>

        {/* Notiz */}
        {!isConfirm && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.note', lang)}</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={200}
              placeholder={t('sq.notePlaceholder', lang)}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
        )}

        {isConfirm && (
          <div className="rounded-lg bg-yellow-900/20 border border-yellow-500/30 p-3 text-xs text-yellow-400">
            {t('sq.confirmWarning', lang)}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">
            {t('sq.cancel', lang)}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className={`flex-1 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-opacity ${
              isConfirm
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90'
            }`}
          >
            {saving
              ? (isConfirm ? t('sq.confirming', lang) : t('sq.updating', lang))
              : (isConfirm ? t('sq.confirmBtn', lang) : t('sq.updateBtn', lang))}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Artist Management Card ──────────────────────────────────────────────────
interface Props {
  quest: StreamingQuest & { participant_count: number; paid_count?: number };
  creatorWallet: string;
  onRefresh: () => void;
}

export default function StreamingQuestManageCard({ quest, creatorWallet, onRefresh }: Props) {
  const lang = useLang();
  const [showUpdate, setShowUpdate]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100))
    : 0;

  const canUpdate  = quest.status === 'enrollment' || quest.status === 'active';
  const canConfirm = canUpdate && quest.status !== 'expired';

  return (
    <>
      {showUpdate && (
        <UpdateDialog
          questId={quest.id}
          creatorWallet={creatorWallet}
          currentStreams={quest.current_streams}
          onClose={() => setShowUpdate(false)}
          onDone={onRefresh}
        />
      )}
      {showConfirm && (
        <UpdateDialog
          questId={quest.id}
          creatorWallet={creatorWallet}
          currentStreams={quest.current_streams}
          isConfirm
          onClose={() => setShowConfirm(false)}
          onDone={onRefresh}
        />
      )}

      <div className="rounded-2xl bg-gray-900 border border-white/10 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">
                {PLATFORM_LABELS[quest.platform] ?? quest.platform}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">
                {deriveLabel(quest.status)}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white truncate">{quest.title}</h3>
          </div>
        </div>

        {/* Fortschritt */}
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

        {/* Infos */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-gray-400">
          <div>
            <p className="text-gray-600">{t('sq.participants', lang)}</p>
            <p className="text-white font-semibold">{quest.participant_count}/{quest.max_participants}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sq.reward', lang)}</p>
            <p className="text-white font-semibold">{quest.reward_per_participant.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sq.deadline', lang)}</p>
            <p className="text-white font-semibold">{new Date(quest.deadline).toLocaleDateString('de-DE')}</p>
          </div>
        </div>

        {/* Aktionsbuttons */}
        {canUpdate && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpdate(true)}
              className="flex-1 py-2 rounded-lg bg-gray-800 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <FaChartLine size={11} /> {t('sq.updateBtn', lang)}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-green-700 to-emerald-700 text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
            >
              <FaCheckCircle size={11} /> {t('sq.confirmBtn', lang)}
            </button>
          </div>
        )}

        {quest.status === 'completed' && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-green-900/20 border border-green-500/30 text-xs text-green-400">
            <FaCheckCircle />
            <span>{tFmt('sq.completedInfo', lang, { count: quest.paid_count ?? quest.participant_count })}</span>
          </div>
        )}
        {quest.status === 'expired' && (
          <div className="py-2 px-3 rounded-lg bg-gray-800/50 text-xs text-gray-500">
            {t('sq.expiredInfo', lang)}
          </div>
        )}
      </div>
    </>
  );
}
