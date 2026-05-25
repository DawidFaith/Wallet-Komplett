'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaExternalLinkAlt, FaRedo, FaCheck, FaStar } from 'react-icons/fa';
import { FiThumbsUp, FiShare2, FiBookmark } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';

interface TiktokEngagementVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function TiktokEngagementVerifyModal({
  quest,
  walletAddress,
  onCompleted,
  onClose,
}: TiktokEngagementVerifyModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [likeVerified, setLikeVerified] = useState(false);
  const [shareVerified, setShareVerified] = useState(false);
  const [saveVerified, setSaveVerified] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        const res = await fetch('/api/tiktok-quests/engagement-verify', {
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
        } else if (action === 'check') {
          if (data.expired) {
            setStep('expired');
          } else if (data.notYet) {
            setExpiresAt(data.expiresAt ?? expiresAt);
            setLikeVerified(data.likeVerified ?? false);
            setShareVerified(data.shareVerified ?? false);
            setSaveVerified(data.saveVerified ?? false);
            setStep('not_yet');
          } else if (data.success) {
            setLikeVerified(data.likeVerified);
            setShareVerified(data.shareVerified);
            setSaveVerified(data.saveVerified);
            setRewardAmount(data.rewardAmount);
            setStep('success');
            onCompleted(data.rewardAmount, data.levelBonus);
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
      setShareVerified(false);
      setSaveVerified(false);
      callApi('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const actions = [
    { key: 'like', icon: <FiThumbsUp size={18} />, label: 'Like', color: 'text-cyan-400', verified: likeVerified },
    { key: 'share', icon: <FiShare2 size={18} />, label: 'Share', color: 'text-purple-400', verified: shareVerified },
    { key: 'save', icon: <FiBookmark size={18} />, label: 'Speichern', color: 'text-yellow-400', verified: saveVerified },
  ];

  const title =
    step === 'success' ? '🎉 Engagement bestätigt!'
    : step === 'expired' ? '⏰ Zeit abgelaufen'
    : step === 'error' ? '❌ Fehler'
    : '📲 Engagement verifizieren';

  const rewardPer = quest ? Math.floor(quest.rewardAmount / 3) : 0;

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>
      {/* Reward-Banner */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">Belohnung</span>
          <div className="flex items-center gap-2.5">
            <span className="text-zinc-500 text-xs">pro Aktion:</span>
            <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
              <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" unoptimized /> +{rewardPer} D.FAITH
            </span>
            {(quest.reputationReward ?? 0) > 0 && (
              <span className="text-amber-300 font-bold text-sm flex items-center gap-1">
                <FaStar size={10} /> +{Math.floor((quest.reputationReward ?? 0) / 3)} REP
              </span>
            )}
            <span className="text-zinc-600 text-xs">×3 max</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-cyan-500/30 border-t-cyan-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">Baseline wird geladen…</p>
        </div>
      )}

      {/* Pending / not_yet */}
      {(step === 'pending' || step === 'not_yet') && quest && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-red-900/30 border border-red-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">Verbleibende Zeit</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-red-400' : 'text-cyan-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">
                Aktionen noch nicht erkannt. TikTok braucht manchmal kurz – warte etwas und prüfe erneut.
              </p>
            </div>
          )}

          {/* Aktionen */}
          <div className="grid grid-cols-3 gap-2">
            {actions.map(({ key, icon, label, color, verified }) => (
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
                <span className="text-yellow-400 text-xs flex items-center gap-0.5">
                  <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full" unoptimized /> +{rewardPer}
                </span>
                {step === 'not_yet' && (
                  <span className={`text-xs ${verified ? 'text-green-400' : 'text-zinc-500'}`}>
                    {verified ? '✓' : '–'}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="bg-zinc-800 rounded-xl p-3 space-y-1">
            <p className="text-white text-sm font-semibold">{quest.videoTitle}</p>
            <p className="text-zinc-400 text-xs">Führe alle 3 Aktionen durch und klicke auf &bdquo;Prüfen&ldquo;.</p>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
            <p className="text-amber-300 text-xs font-semibold mb-1">⚠️ Wichtiger Hinweis</p>
            <p className="text-amber-200/80 text-xs">
              Falls du das Video bereits vorher geliked, geteilt oder gespeichert hast, musst du diese Aktionen
              <span className="font-semibold"> zuerst rückgängig machen</span> und sie dann neu durchführen –
              nur so kann die Verifizierung einen Anstieg erkennen.
            </p>
          </div>

          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={12} /> TikTok-Video öffnen
          </a>

          <button
            onClick={() => callApi('check')}
            disabled={loading}
            className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" />
            ) : (
              <FaRedo size={13} />
            )}
            {loading ? 'Wird geprüft…' : 'Aktionen prüfen'}
          </button>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 space-y-3">
            <p className="text-green-300 font-semibold text-center">Engagement bestätigt!</p>
            <div className="grid grid-cols-3 gap-2">
              {actions.map(({ key, icon, label, color, verified }) => (
                <div
                  key={key}
                  className={`rounded-xl p-3 flex flex-col items-center gap-1 border ${
                    verified ? 'bg-green-900/30 border-green-700/40' : 'bg-zinc-800 border-zinc-700 opacity-50'
                  }`}
                >
                  <span className={verified ? 'text-green-400' : color}>{icon}</span>
                  <span className="text-white text-xs font-semibold">{label}</span>
                  {verified ? (
                    <FaCheck size={10} className="text-green-400" />
                  ) : (
                    <span className="text-zinc-500 text-xs">–</span>
                  )}
                </div>
              ))}
            </div>
            <div className="text-center space-y-1">
              <p className="text-zinc-400 text-sm">Verdient:</p>
              <p className="text-yellow-400 text-2xl font-bold flex items-center justify-center gap-2">
                <Image src="/D.FAITH.png" alt="" width={24} height={24} className="w-6 h-6 rounded-full" unoptimized /> {formatCredits(rewardAmount)} D.FAITH
              </p>
              {(quest?.reputationReward ?? 0) > 0 && (
                <p className="text-amber-300 font-semibold text-sm flex items-center justify-center gap-1">
                  <FaStar size={12} /> +{quest!.reputationReward} REP
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-semibold">
            Schließen
          </button>
        </div>
      )}

      {/* Expired */}
      {step === 'expired' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4 text-center">
            <p className="text-red-300 font-semibold">Zeit abgelaufen</p>
            <p className="text-zinc-400 text-sm mt-1">Die 10 Minuten sind um. Starte die Verifizierung neu.</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <FaRedo size={13} /> Neu starten
          </button>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-semibold">
            Schließen
          </button>
        </div>
      )}
    </Modal>
  );
}
