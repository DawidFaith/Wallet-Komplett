'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaExternalLinkAlt, FaRedo, FaStar } from 'react-icons/fa';
import { FiShare2 } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface TiktokShareVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function TiktokShareVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
}: TiktokShareVerifyModalProps) {
  const lang = useLang();
  const [step, setStep] = useState<Step>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shareVerified, setShareVerified] = useState(false);
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
      setShareVerified(false);
      callApi('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const title =
    step === 'success' ? t('verify.shareConfirmed', lang) :
    step === 'expired' ? t('verify.expiredTitle', lang) :
    step === 'error'   ? t('verify.errorTitle', lang) :
    t('verify.shareTitle', lang);

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>
      {/* Reward-Banner */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 mb-1">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">{t('verify.rewardLabel', lang)}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full shrink-0" unoptimized />
              <span className="text-yellow-400 font-bold text-base">+{formatCredits(displayReward)} D.FAITH</span>
            </div>
            {(quest.reputationReward ?? 0) > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <FaStar size={10} className="text-amber-300 shrink-0" />
                <span className="text-amber-300 font-bold text-sm">+{displayRep} REP</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-cyan-500/30 border-t-cyan-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">{t('verify.preparing', lang)}</p>
        </div>
      )}

      {/* Pending / not_yet */}
      {(step === 'pending' || step === 'not_yet') && quest && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">{t('verify.timeLeft', lang)}</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-amber-400' : 'text-cyan-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {/* Anleitung */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
            <p className="text-white font-semibold text-sm">{t('verify.shareVerifyTitle', lang)}</p>
            <ol className="text-zinc-300 text-sm space-y-2 list-decimal list-inside">
              <li>{lang === 'en' ? 'Open the video on TikTok and tap Share' : lang === 'pl' ? 'Otwórz film na TikTok i naciśnij Udostępnij' : 'Öffne das Video auf TikTok und tippe auf Teilen'}</li>
              <li>{t('verify.repostTiktok', lang)}</li>
              <li>{t('verify.comeTapCheck', lang)}</li>
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
              <span className="text-xs font-medium">{t('verify.shareDetected', lang)}</span>
            </div>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3 space-y-1">
              <p className="text-orange-300 text-sm">
                {!shareVerified
                  ? t('verify.shareNotDetected', lang)
                  : t('verify.shareDetectedStatus', lang)}
              </p>
              {!shareVerified && (
                <p className="text-zinc-400 text-xs">
                {t('verify.repostHint', lang)}
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
              <FaExternalLinkAlt size={12} /> {t('common.open', lang)}
            </a>
            <button
              onClick={() => callApi('check')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? (
                <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" />
              ) : (
                <><FaRedo size={12} /> {t('verify.checkBtn', lang)}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && quest && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
            <p className="text-green-300 font-bold text-lg mb-1">{t('verify.shareConfirmed', lang)}</p>
            <p className="text-zinc-400 text-sm flex items-center justify-center gap-1.5">
              +{formatCredits(rewardAmount)} D.FAITH {lang === 'en' ? 'credited' : lang === 'pl' ? 'dodano' : 'wurden gutgeschrieben'}
            </p>
          </div>
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 bg-green-900/30 border border-green-700/40 text-green-400">
              <FiShare2 size={16} />
              <span className="text-xs font-medium">{t('verify.shareDetected', lang)}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors">{t('btn.close', lang)}</button>
        </div>
      )}

      {/* Expired */}
      {step === 'expired' && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-300 font-semibold mb-1">{t('verify.expiredTitle', lang)}</p>
            <p className="text-zinc-500 text-sm">{t('verify.expiredRestart', lang)}</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? <div className="border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin" /> : <><FaRedo size={12} /> {t('btn.restart', lang)}</>}
          </button>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
            <p className="text-amber-300 text-sm">{error}</p>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors">{t('btn.close', lang)}</button>
        </div>
      )}
    </Modal>
  );
}
