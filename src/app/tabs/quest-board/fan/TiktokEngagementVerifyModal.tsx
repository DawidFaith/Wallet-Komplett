'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaExternalLinkAlt, FaRedo, FaCheck, FaStar } from 'react-icons/fa';
import { FiThumbsUp, FiShare2, FiBookmark } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface TiktokEngagementVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
  /** Wenn gesetzt, wird nur eine einzelne Aktion verifiziert (für like / save Quests) */
  singleAction?: 'like' | 'save';
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function TiktokEngagementVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
  singleAction,
}: TiktokEngagementVerifyModalProps) {
  const lang = useLang();
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
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayRep = quest ? Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100)) : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

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
      const endpoint = singleAction === 'like'
        ? '/api/tiktok-quests/like-verify'
        : singleAction === 'save'
        ? '/api/tiktok-quests/save-verify'
        : '/api/tiktok-quests/engagement-verify';
      try {
        const res = await fetch(endpoint, {
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
    [quest, walletAddress, expiresAt, onCompleted, singleAction]
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

  const title = singleAction === 'like'
    ? (step === 'success' ? t('verify.likeConfirmed', lang) : step === 'expired' ? '⏰ Zeit abgelaufen' : step === 'error' ? '❌ Fehler' : '👍 Like verifizieren')
    : singleAction === 'save'
    ? (step === 'success' ? t('verify.saveConfirmed', lang) : step === 'expired' ? t('verify.expiredTitle', lang) : step === 'error' ? t('verify.errorTitle', lang) : t('verify.saveTitle', lang))
    : (step === 'success' ? t('verify.engagementConfirmed', lang) : step === 'expired' ? t('verify.expiredTitle', lang) : step === 'error' ? t('verify.errorTitle', lang) : t('verify.ttEngagementTitle', lang));

  const rewardPer = quest ? Math.round((displayReward / (singleAction ? 1 : 3)) * 100) / 100 : 0;

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>
      {/* Reward-Banner */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">{t('verify.rewardLabel', lang)}</span>
          <div className="flex items-center gap-2.5">
            {!singleAction && <span className="text-zinc-500 text-xs">{t('verify.perAction', lang)}</span>}
            <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
              <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" unoptimized /> +{formatCredits(rewardPer)} D.FAITH
            </span>
            {levelBonusPercent > 0 && (
              <span className="text-green-300 font-bold text-[10px]">(+{levelBonusPercent}%)</span>
            )}
            {(quest.reputationReward ?? 0) > 0 && (
              <span className="text-amber-300 font-bold text-sm flex items-center gap-1">
                <FaStar size={10} /> +{Math.floor((quest.reputationReward ?? 0) / (singleAction ? 1 : 3))} REP
              </span>
            )}
            {!singleAction && <span className="text-zinc-600 text-xs">×3 max</span>}
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-cyan-500/30 border-t-cyan-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">{t('verify.baselineLoading', lang)}</p>
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

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">
                {t('verify.igNotFound', lang).replace('Instagram', 'TikTok')}
              </p>
            </div>
          )}

          {/* Aktionen */}
          {singleAction ? (
            // Einzelaktion-Anzeige
            <div className="flex justify-center">
              {actions
                .filter(({ key }) => key === singleAction)
                .map(({ key, icon, label, color, verified }) => (
                  <div
                    key={key}
                    className={`rounded-xl p-5 flex flex-col items-center gap-3 border w-40 ${
                      step === 'not_yet' && verified
                        ? 'bg-green-900/30 border-green-700/40'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <span className={`text-3xl ${verified ? 'text-green-400' : color}`}>{icon}</span>
                    <span className="text-white text-sm font-semibold">{label}</span>
                    <span className="text-yellow-400 text-sm flex items-center gap-1">
                      <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" unoptimized /> +{formatCredits(rewardPer)}
                    </span>
                    {step === 'not_yet' && (
                      <span className={`text-sm ${verified ? 'text-green-400' : 'text-zinc-500'}`}>
                        {verified ? t('bc.detected', lang) : t('bc.notDetected', lang)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            // Alle 3 Aktionen
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
                    <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full" unoptimized /> +{formatCredits(rewardPer)}
                  </span>
                  {step === 'not_yet' && (
                    <span className={`text-xs ${verified ? 'text-green-400' : 'text-zinc-500'}`}>
                      {verified ? '✓' : '–'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-zinc-800 rounded-xl p-3 space-y-1">
            <p className="text-white text-sm font-semibold">{quest.videoTitle}</p>
            <p className="text-zinc-400 text-xs">
              {singleAction === 'like'
                ? lang === 'en' ? 'Like the video and click "Verify".' : lang === 'pl' ? 'Polub film i kliknij „Sprawdź“.' : 'Like das Video und klicke auf „Prüfen“.'
                : singleAction === 'save'
                ? lang === 'en' ? 'Save the video and click "Verify".' : lang === 'pl' ? 'Zapisz film i kliknij „Sprawdź“.' : 'Speichere das Video und klicke auf „Prüfen“.'
                : lang === 'en' ? 'Perform all 3 actions and click "Verify".' : lang === 'pl' ? 'Wykonaj wszystkie 3 akcje i kliknij „Sprawdź“.' : 'Führe alle 3 Aktionen durch und klicke auf „Prüfen“.'}
            </p>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
            <p className="text-amber-300 text-xs font-semibold mb-1">{t('verify.hintLabel', lang)}</p>
            <p className="text-amber-200/80 text-xs">
              {lang === 'en' ? 'If you already liked, shared or saved this video: undo these actions first, return here, restart the quest and redo them.' : lang === 'pl' ? 'Jeśli wcześniej polubyłeś, udostępniłeś lub zapisałeś ten film: najpierw cofnij te akcje, wróć tutaj, uruchom quest od nowa i powtórz je.' : 'Falls du das Video bereits vorher geliked, geteilt oder gespeichert hast: mache diese Aktionen zuerst rükgängig, kehre hierher zurück, starte den Quest neu und führe die Aktionen dann erneut durch.'}
            </p>
          </div>

          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={12} /> TikTok-Video {t('common.open', lang)}
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
            {loading ? t('common.pleaseWait', lang) : lang === 'en' ? 'Verify actions' : lang === 'pl' ? 'Sprawdź akcje' : 'Aktionen prüfen'}
          </button>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 space-y-3">
            <p className="text-green-300 font-semibold text-center">{t('verify.engagementConfirmed', lang)}</p>
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
              <p className="text-zinc-400 text-sm">{lang === 'en' ? 'Earned:' : lang === 'pl' ? 'Zarobiono:' : 'Verdient:'}</p>
              <p className="text-yellow-400 text-2xl font-bold flex items-center justify-center gap-2">
                <Image src="/D.FAITH.png" alt="" width={24} height={24} className="w-6 h-6 rounded-full" unoptimized /> {formatCredits(rewardAmount)} D.FAITH
              </p>
              {(quest?.reputationReward ?? 0) > 0 && (
                <p className="text-amber-300 font-semibold text-sm flex items-center justify-center gap-1">
                  <FaStar size={12} /> +{displayRep} REP{repBonusPercent > 0 && <span className="text-green-300"> (+{repBonusPercent}%)</span>}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-semibold">{t('btn.close', lang)}</button>
        </div>
      )}

      {/* Expired */}
      {step === 'expired' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4 text-center">
            <p className="text-amber-300 font-semibold">{t('verify.expiredTitle', lang)}</p>
            <p className="text-zinc-400 text-sm mt-1">{t('verify.expiredWindow', lang).replace('5-Minuten', '10 Minuten').replace('Das ', '')} {t('verify.expiredRestart', lang)}</p>
          </div>
          <button
            onClick={() => callApi('start')}
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <FaRedo size={13} /> {t('btn.restart', lang)}
          </button>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
            <p className="text-amber-300 text-sm">{error}</p>
          </div>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-semibold">{t('btn.close', lang)}</button>
        </div>
      )}
    </Modal>
  );
}
