'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaFacebookF, FaStar, FaExternalLinkAlt, FaRedo } from 'react-icons/fa';
import { FiThumbsUp } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface FacebookLikeVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function FacebookLikeVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
}: FacebookLikeVerifyModalProps) {
  const lang = useLang();
  const [step, setStep] = useState<Step>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayRep = quest ? Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100)) : 0;
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
        const res = await fetch('/api/facebook-quests/like-verify', {
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
            setStep('not_yet');
          } else if (data.success) {
            onCompleted(data.rewardAmount, data.levelBonus);
            onClose();
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
      callApi('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const title =
    step === 'success' ? t('verify.likeConfirmed', lang)
    : step === 'expired' ? t('verify.expiredTitle', lang)
    : step === 'error'   ? t('verify.errorTitle', lang)
    : t('verify.fbLikeTitle', lang);

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>

      {/* Reward-Banner */}
      {quest && step !== 'error' && step !== 'expired' && step !== 'success' && (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 mb-1">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">{t('verify.rewardLabel', lang)}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full shrink-0" />
              <span className="text-amber-400 font-bold text-base">+{formatCredits(displayReward)} D.FAITH</span>
            </div>
            {(quest.reputationReward ?? 0) > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <FaStar size={10} className="text-purple-300 shrink-0" />
                <span className="text-purple-300 font-bold text-sm">+{displayRep} REP</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-blue-500/30 border-t-blue-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">{t('verify.baselineLoading', lang)}</p>
        </div>
      )}

      {/* Pending / not_yet */}
      {(step === 'pending' || step === 'not_yet') && quest && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">{t('verify.timeLeft', lang)}</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-amber-400' : 'text-blue-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">{lang === 'en' ? 'Not detected yet. Wait a moment and try again.' : lang === 'pl' ? 'Jeszcze nie wykryte. Poczekaj chwilę i spróbuj ponownie.' : 'Noch nicht erkannt. Warte kurz und versuche es erneut.'}</p>
            </div>
          )}

          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <FiThumbsUp size={16} className="text-blue-400" />
              {t('verify.fbHowTitle', lang)}
            </p>
            <ol className="space-y-1 text-zinc-400 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">1.</span>{t('verify.fbLikeStep1', lang)}</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">2.</span>{t('verify.fbLikeStep2', lang)}</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">3.</span>{t('verify.fbLikeStep3', lang)}</li>
            </ol>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
            <p className="text-amber-300 text-xs font-semibold mb-1">{t('verify.hintLabel', lang)}</p>
            <p className="text-amber-200/80 text-xs">
              {t('verify.likeHint', lang)}
            </p>
          </div>

          {quest.videoUrl && (
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
            >
              <FaFacebookF size={20} className="text-blue-400 shrink-0" />
              <span className="text-white text-sm font-medium line-clamp-1 flex-1">{quest.videoTitle}</span>
              <FaExternalLinkAlt size={12} className="text-zinc-500 shrink-0" />
            </a>
          )}

          <button
            onClick={() => callApi('check')}
            disabled={loading || secondsLeft === 0}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" />
              : <><FiThumbsUp size={14} /> {t('verify.likedSaved', lang)}? – {t('verify.checkBtn', lang)}</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors">{t('btn.cancel', lang)}</button>
        </div>
      )}

      {/* Erfolg */}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4">
            <p className="text-green-300 font-semibold">{t('verify.likeSuccess', lang)}</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <Image src="/D.FAITH.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full shrink-0" />
            <div>
              <p className="text-white font-bold text-lg flex items-center gap-1.5">
                {formatCredits(rewardAmount)} D.FAITH Credits
              </p>
              <p className="text-zinc-400 text-xs">{t('verify.creditsAdded', lang)}</p>
              {(quest?.reputationReward ?? 0) > 0 && (
                <p className="text-purple-300 text-xs font-medium flex items-center gap-1 mt-0.5">
                  <FaStar size={9} /> +{displayRep} {t('verify.reputation', lang)}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">{t('btn.close', lang)}</button>
        </div>
      )}

      {/* Abgelaufen */}
      {step === 'expired' && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-300 text-sm">{t('verify.expiredWindow', lang).replace('5-Minuten', '10-Minuten')}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('verify.expiredRestart', lang)}</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" />
              : <><FaRedo size={13} /> {t('btn.restart', lang)}</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">{t('btn.close', lang)}</button>
        </div>
      )}

      {/* Fehler */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
            <p className="text-amber-300 text-sm">{error}</p>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">{t('btn.close', lang)}</button>
        </div>
      )}
    </Modal>
  );
}
