'use client';

import React, { useState } from 'react';
import { FaTimes, FaUsers, FaCheckCircle, FaClock, FaChartLine, FaCamera, FaTrash, FaBan } from 'react-icons/fa';
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
};
function getPlatformLabel(platform: string, lang: string): string {
  return PLATFORM_LABELS[platform] ?? t('sq.platformOther', lang as 'de' | 'en' | 'pl');
}

function getStatusLabel(status: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    enrollment: { de: '🎟️ Anmeldung offen', en: '🎟️ Enrollment open', pl: '🎟️ Rejestracja otwarta' },
    active:     { de: '🚀 Aktiv',           en: '🚀 Active',            pl: '🚀 Aktywny' },
    completed:  { de: '✅ Abgeschlossen',   en: '✅ Completed',        pl: '✅ Zakończono' },
    expired:    { de: '⌛ Abgelaufen',       en: '⌛ Expired',          pl: '⌛ Wygasł' },
    cancelled:  { de: '🚫 Storniert',       en: '🚫 Cancelled',       pl: '🚫 Anulowano' },
  };
  return labels[status]?.[lang] ?? labels[status]?.['de'] ?? status;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Update/Confirm-Dialog ───────────────────────────────────────────────────
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
  const [streams, setStreams]       = useState(currentStreams);
  const [note, setNote]             = useState('');
  const [imgUrl, setImgUrl]         = useState('');
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await upload(
        `streaming-quests/${questId}/${Date.now()}-${file.name}`,
        file,
        { access: 'public', handleUploadUrl: '/api/streaming-quests/upload', clientPayload: JSON.stringify({ wallet: creatorWallet }) },
      );
      setImgUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sq.uploadFailed', lang));
    } finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (isConfirm && !imgUrl && !window.confirm(t('sq.confirmNoProof', lang))) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/streaming-quests/${questId}?action=${isConfirm ? 'confirm' : 'update'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: creatorWallet, streamsCount: streams, screenshotUrl: imgUrl || undefined, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onDone(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">{isConfirm ? t('sq.confirmTitle', lang) : t('sq.updateTitle', lang)}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><FaTimes /></button>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">{t('sq.currentStreams', lang)}</label>
          <input type="number" value={streams} onChange={e => setStreams(Math.max(0, parseInt(e.target.value) || 0))} min={0}
            className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">{t('sq.proofUpload', lang)}</label>
          <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-white/10 hover:border-purple-500/50 cursor-pointer transition-colors text-sm text-gray-400 hover:text-white">
            <FaCamera />
            {uploading ? t('sq.uploading', lang) : imgUrl ? t('sq.uploadDone', lang) : t('sq.uploadHint', lang)}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          {imgUrl && <div className="mt-2 rounded-lg overflow-hidden border border-white/10"><img src={imgUrl} alt="Screenshot" className="w-full max-h-40 object-cover" /></div>}
        </div>
        {!isConfirm && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.note', lang)}</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder={t('sq.notePlaceholder', lang)}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
          </div>
        )}
        {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        {isConfirm && (
          <div className="rounded-lg bg-yellow-900/20 border border-yellow-500/30 p-3 text-xs text-yellow-400">{t('sq.confirmWarning', lang)}</div>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">{t('sq.cancel', lang)}</button>
          <button onClick={handleSubmit} disabled={saving || uploading}
            className={`flex-1 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-opacity ${isConfirm ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-purple-600 to-pink-600'}`}>
            {saving ? (isConfirm ? t('sq.confirming', lang) : t('sq.updating', lang)) : (isConfirm ? t('sq.confirmBtn', lang) : t('sq.updateBtn', lang))}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel-Bestätigungsdialog ────────────────────────────────────────────────
interface CancelDialogProps { questId: string; creatorWallet: string; budget: number; onClose: () => void; onCancelled: () => void; }
function CancelDialog({ questId, creatorWallet, budget, onClose, onCancelled }: CancelDialogProps) {
  const lang = useLang();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleCancel = async () => {
    setCancelling(true); setError(null);
    try {
      const res = await fetch(`/api/streaming-quests/${questId}?action=cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: creatorWallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally { setCancelling(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-red-700/40 shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <FaBan className="text-red-400 flex-shrink-0" size={20} />
          <h3 className="text-white font-bold">{t('sq.cancelTitle', lang)}</h3>
        </div>
        <p className="text-gray-400 text-sm">{t('sq.cancelConfirm', lang)}</p>
        {budget > 0 && (
          <div className="rounded-xl bg-green-900/20 border border-green-600/30 px-3 py-2 text-sm text-green-400">
            {t('sq.cancelRefund', lang)}: <span className="font-bold">{budget.toLocaleString()} D.FAITH</span>
          </div>
        )}
        {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">{t('sq.cancel', lang)}</button>
          <button onClick={handleCancel} disabled={cancelling}
            className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
            {cancelling ? t('sq.cancelling', lang) : t('sq.cancelConfirmBtn', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Artist Management Card ──────────────────────────────────────────────────
interface Props {
  quest: StreamingQuest & { participant_count: number; paid_count?: number; status: string };
  creatorWallet: string;
  onRefresh: () => void;
  onRemove: () => void;
}

export default function StreamingQuestManageCard({ quest, creatorWallet, onRefresh, onRemove }: Props) {
  const lang = useLang();
  const [showUpdate, setShowUpdate]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancel, setShowCancel]   = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const progress = quest.target_streams > 0
    ? Math.min(100, Math.round((quest.current_streams / quest.target_streams) * 100)) : 0;

  const isDone    = quest.status === 'completed' || quest.status === 'expired' || quest.status === 'cancelled';
  const canUpdate = quest.status === 'enrollment' || quest.status === 'active';
  const canCancel = !isDone;

  // Nicht-ausgezahltes Budget für Storno-Dialog
  const paidCount   = quest.paid_count ?? 0;
  const refundBudget = Math.max(0, (Number(quest.max_participants) - paidCount) * Number(quest.reward_per_participant));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/streaming-quests/${quest.id}?wallet=${encodeURIComponent(creatorWallet)}`, { method: 'DELETE' });
      if (res.ok) { onRemove(); return; }
      const d = await res.json();
      alert(d.error ?? t('sq.deleteError', lang));
    } catch { alert(t('sq.deleteError', lang)); }
    finally { setDeleting(false); }
  };

  return (
    <>
      {showUpdate  && <UpdateDialog questId={quest.id} creatorWallet={creatorWallet} currentStreams={quest.current_streams} onClose={() => setShowUpdate(false)} onDone={onRefresh} />}
      {showConfirm && <UpdateDialog questId={quest.id} creatorWallet={creatorWallet} currentStreams={quest.current_streams} isConfirm onClose={() => setShowConfirm(false)} onDone={onRefresh} />}
      {showCancel  && <CancelDialog questId={quest.id} creatorWallet={creatorWallet} budget={refundBudget} onClose={() => setShowCancel(false)} onCancelled={() => { onRemove(); setShowCancel(false); }} />}

      <div className="rounded-2xl bg-gray-900 border border-white/10 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">{getPlatformLabel(quest.platform, lang)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">{getStatusLabel(quest.status as string, lang)}</span>
            </div>
            <h3 className="text-sm font-bold text-white truncate">{quest.title}</h3>
          </div>
          {/* Löschen-Button (nur wenn abgeschlossen/storniert/abgelaufen) */}
          {isDone && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={t('sq.deleteQuest', lang)}
              className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-1 disabled:opacity-50"
            >
              <FaTrash size={13} />
            </button>
          )}
        </div>

        {/* Fortschritt */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{quest.current_streams.toLocaleString()} / {quest.target_streams.toLocaleString()} Streams</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Infos */}
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
          <div>
            <p className="text-gray-600">{t('sq.participants', lang)}</p>
            <p className="text-white font-semibold">{quest.participant_count}/{quest.max_participants}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sq.reward', lang)}</p>
            <p className="text-white font-semibold">{Number(quest.reward_per_participant).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sq.deadline', lang)}</p>
            <p className="text-white font-semibold">{new Date(quest.deadline).toLocaleDateString('de-DE')}</p>
          </div>
        </div>

        {/* Aktionsbuttons */}
        {canUpdate && (
          <div className="flex gap-2">
            <button onClick={() => setShowUpdate(true)}
              className="flex-1 py-2 rounded-lg bg-gray-800 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-xs font-medium transition-colors flex items-center justify-center gap-1">
              <FaChartLine size={11} /> {t('sq.updateBtn', lang)}
            </button>
            <button onClick={() => setShowConfirm(true)}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-green-700 to-emerald-700 text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
              <FaCheckCircle size={11} /> {t('sq.confirmBtn', lang)}
            </button>
          </div>
        )}

        {/* Stornieren-Button */}
        {canCancel && (
          <button onClick={() => setShowCancel(true)}
            className="w-full py-1.5 rounded-lg border border-red-700/40 text-red-500 hover:text-red-400 hover:border-red-500/60 text-xs transition-colors flex items-center justify-center gap-1.5">
            <FaBan size={10} /> {t('sq.cancelBtn', lang)}
          </button>
        )}

        {/* Status-Banner */}
        {quest.status === 'completed' && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-green-900/20 border border-green-500/30 text-xs text-green-400">
            <FaCheckCircle />
            <span>{tFmt('sq.completedInfo', lang, { count: String(quest.paid_count ?? quest.participant_count) })}</span>
          </div>
        )}
        {quest.status === 'expired' && (
          <div className="py-2 px-3 rounded-lg bg-gray-800/50 text-xs text-gray-500">{t('sq.expiredInfo', lang)}</div>
        )}
        {quest.status === 'cancelled' && (
          <div className="py-2 px-3 rounded-lg bg-red-900/20 border border-red-700/30 text-xs text-red-400">{t('sq.cancelledInfo', lang)}</div>
        )}
      </div>
    </>
  );
}
