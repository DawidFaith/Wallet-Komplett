'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaInstagram, FaCoins, FaExternalLinkAlt, FaRedo, FaShareAlt } from 'react-icons/fa';
import { FiThumbsUp, FiBookmark } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';

interface InstagramLikeVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  onCompleted: (rewardAmount: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function InstagramLikeVerifyModal({
  quest,
  walletAddress,
  onCompleted,
  onClose,
}: InstagramLikeVerifyModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [likeVerified, setLikeVerified] = useState(false);
  const [saveVerified, setSaveVerified] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isEngagement = quest?.type === 'engagement';
  const isLike = quest?.type === 'like';
  const isRepost = quest?.type === 'repost';

  // For single-action quests (like / save / repost)
  const ActionIcon = isLike ? FiThumbsUp : isRepost ? FaShareAlt : FiBookmark;
  const accentColor = isLike ? 'text-pink-400' : isRepost ? 'text-blue-400' : 'text-yellow-400';
  const accentBg = isLike ? 'bg-pink-600 hover:bg-pink-500' : isRepost ? 'bg-blue-600 hover:bg-blue-500' : 'bg-yellow-500 hover:bg-yellow-400';

  const rewardPer = quest ? Math.floor(quest.rewardAmount / 2) : 0;

  const engagementActions = [
    { key: 'like', icon: <FiThumbsUp size={18} />, label: 'Like', color: 'text-pink-400', verified: likeVerified },
    { key: 'save', icon: <FiBookmark size={18} />, label: 'Speichern', color: 'text-yellow-400', verified: saveVerified },
  ];

  // Countdown
  useEffect(() => {
    if (step !== 'pending' && step !== 'not_yet') {
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
    async (action: 'start' | 'check') => {
      if (!quest) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/instagram-quests/like-verify', {
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
          setStep('pending');
        } else {
          if (data.expired) {
            setStep('expired');
          } else if (data.notYet) {
            if (data.likeVerified !== undefined) setLikeVerified(data.likeVerified);
            if (data.saveVerified !== undefined) setSaveVerified(data.saveVerified);
            setExpiresAt(data.expiresAt ?? expiresAt);
            setStep('not_yet');
          } else if (data.success) {
            if (data.likeVerified !== undefined) setLikeVerified(data.likeVerified);
            if (data.saveVerified !== undefined) setSaveVerified(data.saveVerified);
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

  useEffect(() => {
    if (quest) {
      setStep('loading');
      setError('');
      setExpiresAt(null);
      setLikeVerified(false);
      setSaveVerified(false);
      callApi('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const title =
    step === 'success'
      ? isEngagement ? '🎉 Engagement bestätigt!' : isRepost ? '🎉 Repost bestätigt!' : `🎉 ${isLike ? 'Like' : 'Speichern'} bestätigt!`
    : step === 'expired' ? '⏰ Zeit abgelaufen'
    : step === 'error'   ? '❌ Fehler'
    : isEngagement ? '❤️🔖 Engagement verifizieren'
    : isRepost ? '🔁 Repost verifizieren'
    : `${isLike ? '❤️' : '🔖'} ${isLike ? 'Like' : 'Speichern'} verifizieren`;

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>

      {/* ── Reward-Banner (überall sichtbar außer Fehler/Ablauf) ─────────────── */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">Belohnung</span>
          {isEngagement ? (
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-xs">pro Aktion:</span>
              <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
                <FaCoins size={12} /> +{rewardPer} DFAITH
              </span>
              <span className="text-zinc-600 text-xs">×2 max</span>
            </div>
          ) : (
            <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
              <FaCoins size={12} /> +{quest.rewardAmount} DFAITH
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-pink-500/30 border-t-pink-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">Baseline wird geladen…</p>
        </div>
      )}

      {/* ── Pending / not_yet — ENGAGEMENT ─────────────────────────────────── */}
      {(step === 'pending' || step === 'not_yet') && quest && isEngagement && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-red-900/30 border border-red-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">Verbleibende Zeit</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-red-400' : 'text-pink-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">
                Aktionen noch nicht erkannt. Instagram braucht manchmal kurz – warte etwas und prüfe erneut.
              </p>
            </div>
          )}

          {/* Aktionen */}
          <div className="grid grid-cols-2 gap-3">
            {engagementActions.map(({ key, icon, label, color, verified }) => (
              <div
                key={key}
                className={`rounded-xl p-3 flex flex-col items-center gap-2 border ${
                  step === 'not_yet' && verified
                    ? 'bg-green-900/30 border-green-700/40'
                    : 'bg-zinc-800 border-zinc-700'
                }`}
              >
                <span className={verified ? 'text-green-400' : color}>{icon}</span>
                <span className="text-white text-xs font-semibold">{label}</span>
                <span className="text-yellow-400 text-xs">+{rewardPer} DFAITH</span>
                {step === 'not_yet' && (
                  <span className={`text-xs ${verified ? 'text-green-400' : 'text-zinc-500'}`}>
                    {verified ? '✓' : '–'}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
            <p className="text-amber-300 text-xs font-semibold mb-1">⚠️ Hinweis</p>
            <p className="text-amber-200/80 text-xs">
              Falls du das Reel bereits geliked oder gespeichert hast, mache dies zuerst rückgängig und dann
              erneut – nur so wird ein Delta erkannt.
            </p>
          </div>

          {quest.videoUrl && (
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
            >
              <FaInstagram size={20} className="text-pink-400 shrink-0" />
              <span className="text-white text-sm font-medium line-clamp-1 flex-1">{quest.videoTitle}</span>
              <FaExternalLinkAlt size={12} className="text-zinc-500 shrink-0" />
            </a>
          )}

          <button
            onClick={() => callApi('check')}
            disabled={loading || secondsLeft === 0}
            className="w-full bg-gradient-to-r from-pink-600 to-yellow-600 hover:from-pink-500 hover:to-yellow-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" />
              : <><FiThumbsUp size={14} /><FiBookmark size={14} /> Prüfen</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors">
            Abbrechen
          </button>
        </div>
      )}

      {/* ── Pending / not_yet — SINGLE ACTION (like/save) ───────────────────── */}
      {(step === 'pending' || step === 'not_yet') && quest && !isEngagement && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-red-900/30 border border-red-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">Verbleibende Zeit</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-red-400' : accentColor}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">Noch nicht erkannt. Warte kurz und versuche es erneut.</p>
            </div>
          )}

          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <ActionIcon size={16} className={accentColor} />
              So funktioniert es:
            </p>
            <ol className="space-y-1 text-zinc-400 text-sm">
              <li className="flex gap-2">
                <span className={`${accentColor} font-bold shrink-0`}>1.</span>
                Öffne das Reel unten
              </li>
              <li className="flex gap-2">
                <span className={`${accentColor} font-bold shrink-0`}>2.</span>
                {isLike
                  ? 'Tippe auf das Herz um das Reel zu liken'
                  : isRepost
                  ? 'Tippe auf das Teilen-Symbol und wähle "Auf Deinen Kanal posten" (Repost)'
                  : 'Tippe auf das Lesezeichen-Symbol um das Reel zu speichern'}
              </li>
              <li className="flex gap-2">
                <span className={`${accentColor} font-bold shrink-0`}>3.</span>
                Klicke auf &bdquo;Prüfen&ldquo;
              </li>
            </ol>
          </div>

          {quest.videoUrl && (
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
            >
              <FaInstagram size={20} className="text-pink-400 shrink-0" />
              <span className="text-white text-sm font-medium line-clamp-1 flex-1">{quest.videoTitle}</span>
              <FaExternalLinkAlt size={12} className="text-zinc-500 shrink-0" />
            </a>
          )}

          <button
            onClick={() => callApi('check')}
            disabled={loading || secondsLeft === 0}
            className={`w-full ${accentBg} disabled:opacity-50 ${isLike ? 'text-white' : 'text-black'} text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2`}
          >
            {loading
              ? <div className="border-2 border-current/30 border-t-current rounded-full w-4 h-4 animate-spin" />
              : <><ActionIcon size={14} /> {isLike ? 'geliked' : isRepost ? 'geteilt' : 'gespeichert'}? – Prüfen</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors">
            Abbrechen
          </button>
        </div>
      )}

      {/* Abgelaufen */}
      {step === 'expired' && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-300 text-sm">Das 10-Minuten-Fenster ist abgelaufen.</p>
            <p className="text-zinc-500 text-xs mt-1">Starte die Verifizierung neu.</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className={`w-full ${isEngagement ? 'bg-gradient-to-r from-pink-600 to-yellow-600 hover:from-pink-500 hover:to-yellow-500 text-white' : `${accentBg} ${isLike ? 'text-white' : 'text-black'}`} disabled:opacity-50 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2`}
          >
            {loading
              ? <div className="border-2 border-current/30 border-t-current rounded-full w-4 h-4 animate-spin" />
              : <><FaRedo size={13} /> Neu starten</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}

      {/* Fehler */}
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

      {/* ── Erfolg — ENGAGEMENT ─────────────────────────────────────────────── */}
      {step === 'success' && isEngagement && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {engagementActions.map(({ key, icon, label, verified }) => (
              <div
                key={key}
                className={`rounded-xl p-3 flex flex-col items-center gap-2 border ${
                  verified ? 'bg-green-900/30 border-green-700/40' : 'bg-zinc-800 border-zinc-700'
                }`}
              >
                <span className={verified ? 'text-green-400' : 'text-zinc-500'}>{icon}</span>
                <span className="text-white text-xs font-semibold">{label}</span>
                {verified
                  ? <span className="text-green-400 text-xs">✓ +{rewardPer} DFAITH</span>
                  : <span className="text-zinc-500 text-xs">–</span>
                }
              </div>
            ))}
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <FaCoins size={24} className="text-yellow-400" />
            <div>
              <p className="text-white font-bold text-lg">{rewardAmount} DFAITH</p>
              <p className="text-zinc-400 text-xs">Zu deinem DFAITH Credits Guthaben hinzugefügt</p>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}

      {/* ── Erfolg — EINZELNE AKTION (like/save) ────────────────────────────── */}
      {step === 'success' && !isEngagement && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
            <ActionIcon size={32} className={`${accentColor} mx-auto mb-2`} />
            <p className="text-green-300 font-semibold">
              {isLike ? 'Like' : 'Speichern'} erfolgreich verifiziert!
            </p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <FaCoins size={24} className="text-yellow-400" />
            <div>
              <p className="text-white font-bold text-lg">{rewardAmount} DFAITH</p>
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
