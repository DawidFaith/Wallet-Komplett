'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaExternalLinkAlt, FaRedo, FaStar } from 'react-icons/fa';
import { FiShare2 } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';

interface TiktokShareVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function TiktokShareVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  onCompleted,
  onClose,
}: TiktokShareVerifyModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shareVerified, setShareVerified] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

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
        const res = await fetch('/api/tiktok-quests/share-verify', {
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
            setExpiresAt(data.expiresAt ?? expiresAt);
            setShareVerified(data.shareVerified ?? false);
            setStep('not_yet');
          } else if (data.success) {
            setShareVerified(true);
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
      setShareVerified(false);
      callApi('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const title =
    step === 'success' ? '🎉 Share bestätigt!' :
    step === 'expired' ? '⏰ Zeit abgelaufen' :
    step === 'error'   ? '❌ Fehler' :
    '🔁 Video teilen';

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>
      {/* Reward-Banner */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">Belohnung</span>
          <div className="flex items-center gap-2.5">
            <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
              <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" unoptimized />
              +{formatCredits(displayReward)} D.FAITH
            </span>
            {levelBonusPercent > 0 && (
              <span className="text-green-300 font-bold text-[10px]">inkl. +{levelBonusPercent}% Bonus</span>
            )}
            {(quest.reputationReward ?? 0) > 0 && (
              <span className="text-amber-300 font-bold text-sm flex items-center gap-1">
                <FaStar size={10} /> +{quest.reputationReward} REP
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-cyan-500/30 border-t-cyan-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">Wird vorbereitet…</p>
        </div>
      )}

      {/* Pending / not_yet */}
      {(step === 'pending' || step === 'not_yet') && quest && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">Verbleibende Zeit</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-amber-400' : 'text-cyan-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {/* Anleitung */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
            <p className="text-white font-semibold text-sm">So verifizierst du den Share:</p>
            <ol className="text-zinc-300 text-sm space-y-2 list-decimal list-inside">
              <li>Öffne das Video auf TikTok und tippe auf <strong>Teilen</strong></li>
              <li>Wähle <strong>Repost</strong> – falls du bereits repostet hast, entferne den Repost zuerst und teile erneut</li>
              <li>Komm zurück und tippe auf <strong>Prüfen</strong></li>
            </ol>
          </div>

          {/* Verifizierungsstatus */}
          <div className="flex gap-3">
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-all ${
                shareVerified
                  ? 'bg-green-900/30 border-green-700/40 text-green-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              <FiShare2 size={16} className={shareVerified ? 'text-green-400' : 'text-purple-400'} />
              <span className="text-xs font-medium">Share erkannt</span>
            </div>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3 space-y-1">
              <p className="text-orange-300 text-sm">
                {!shareVerified
                  ? 'Share noch nicht erkannt. Teile das Video und warte kurz.'
                  : 'Share erkannt! Verifizierung läuft…'}
              </p>
              {!shareVerified && (
                <p className="text-zinc-400 text-xs">
                  Falls du das Video bereits repostet hast, entferne den Repost zuerst und teile ihn dann erneut. Nur so kann die Verifizierung ein neues Delta erkennen.
                </p>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              <FaExternalLinkAlt size={12} /> Video öffnen
            </a>
            <button
              onClick={() => callApi('check')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? (
                <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" />
              ) : (
                <><FaRedo size={12} /> Prüfen</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && quest && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
            <p className="text-green-300 font-bold text-lg mb-1">🎉 Share verifiziert!</p>
            <p className="text-zinc-400 text-sm">
              +{formatCredits(rewardAmount + levelBonusAmount)} D.FAITH wurden gutgeschrieben
            </p>
          </div>
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 bg-green-900/30 border border-green-700/40 text-green-400">
              <FiShare2 size={16} />
              <span className="text-xs font-medium">Repost erkannt</span>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
            Schließen
          </button>
        </div>
      )}

      {/* Expired */}
      {step === 'expired' && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-300 font-semibold mb-1">Zeit abgelaufen</p>
            <p className="text-zinc-500 text-sm">Starte die Verifizierung neu.</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" /> : <><FaRedo size={12} /> Neu starten</>}
          </button>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
            <p className="text-amber-300 text-sm">{error}</p>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
            Schließen
          </button>
        </div>
      )}
    </Modal>
  );
}
