'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaThumbsUp, FaExternalLinkAlt, FaCoins, FaRedo } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';

interface LikeVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  onCompleted: (rewardAmount: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'await_like' | 'not_yet' | 'success' | 'expired' | 'error';

export default function LikeVerifyModal({
  quest,
  walletAddress,
  onCompleted,
  onClose,
}: LikeVerifyModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rewardAmount, setRewardAmount] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown aktualisieren
  useEffect(() => {
    if (step !== 'await_like' && step !== 'not_yet') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const update = () => {
      if (!expiresAt) return;
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStep('expired');
      }
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [step, expiresAt]);

  const callApi = useCallback(
    async (action: 'start' | 'check-like') => {
      if (!quest) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/youtube-quests/like-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, questId: quest.id, walletAddress }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Unbekannter Fehler');
          setStep('error');
          return;
        }

        if (action === 'start') {
          setExpiresAt(data.expiresAt);
          setStep('await_like');
        } else if (action === 'check-like') {
          if (data.expired) {
            setStep('expired');
          } else if (data.notYet) {
            setExpiresAt(data.expiresAt ?? expiresAt);
            setStep('not_yet');
          } else if (data.success) {
            setRewardAmount(data.rewardAmount);
            setStep('success');
            onCompleted(data.rewardAmount);
          }
        }
      } catch {
        setError('Netzwerkfehler. Bitte versuche es erneut.');
        setStep('error');
      } finally {
        setLoading(false);
      }
    },
    [quest, walletAddress, expiresAt, onCompleted]
  );

  // Automatisch starten wenn Modal geöffnet wird
  useEffect(() => {
    if (quest) {
      setStep('loading');
      setError('');
      setExpiresAt(null);
      callApi('start');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const title =
    step === 'success' ? '🎉 Like bestätigt!'
    : step === 'expired' ? '⏰ Zeit abgelaufen'
    : step === 'error' ? '❌ Fehler'
    : '👍 Like verifizieren';

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>
      {/* Reward-Banner */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">Belohnung</span>
          <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
            <FaCoins size={12} /> +{formatCredits(quest.rewardAmount)} DFAITH
          </span>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-yellow-500/30 border-t-yellow-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">Wird vorbereitet…</p>
        </div>
      )}

      {/* ── Liken ───────────────────────────────────────────── */}
      {(step === 'await_like' || step === 'not_yet') && quest && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-red-900/30 border border-red-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">Verbleibende Zeit</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-red-400' : 'text-yellow-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">
                Like noch nicht erkannt. YouTube braucht manchmal einen Moment &ndash; kurz warten und erneut prüfen.
              </p>
            </div>
          )}

          <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-3">
            <p className="text-blue-200 text-xs">
              <strong>Hinweis:</strong> Hast du das Video bereits geliked? Dann entferne den Like zuerst, kehre zurück und like es erneut – nur so kann die Verifizierung einen neuen Like erkennen.
            </p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-4 space-y-2">
            <p className="text-white text-sm font-semibold">{quest.videoTitle}</p>
            <p className="text-zinc-400 text-xs flex items-center gap-1">
              <FaThumbsUp className="text-yellow-400" size={11} />
              Like das Video und klicke dann auf &bdquo;Geliked &ndash; Prüfen&ldquo;
            </p>
          </div>

          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={13} /> Zum Short (Liken)
          </a>
          <button
            onClick={() => callApi('check-like')}
            disabled={loading || secondsLeft === 0}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="border-2 border-black/30 border-t-black rounded-full w-4 h-4 animate-spin" />
              : <><FaThumbsUp size={14} /> Geliked &ndash; Prüfen</>
            }
          </button>
        </div>
      )}

      {/* ── Abgelaufen ──────────────────────────────────────── */}
      {step === 'expired' && quest && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-300 text-sm">Das 5-Minuten-Fenster ist abgelaufen.</p>
            <p className="text-zinc-500 text-xs mt-1">Starte die Verifizierung neu.</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="border-2 border-black/30 border-t-black rounded-full w-4 h-4 animate-spin" />
              : <><FaRedo size={13} /> Neu starten</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}

      {/* ── Fehler ──────────────────────────────────────────── */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}

      {/* ── Erfolg ──────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
            <FaThumbsUp size={32} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-green-300 font-semibold">Like erfolgreich verifiziert!</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <FaCoins size={24} className="text-yellow-400" />
            <div>
              <p className="text-white font-bold text-lg">{formatCredits(rewardAmount)} DFAITH</p>
              <p className="text-zinc-400 text-xs">Zu deinem DFAITH Credits Guthaben hinzugefügt</p>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}
    </Modal>
  );
}
