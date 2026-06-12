'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaInstagram, FaStar, FaExternalLinkAlt, FaRedo, FaShareAlt } from 'react-icons/fa';
import { FiThumbsUp, FiBookmark } from 'react-icons/fi';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface InstagramLikeVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number, creditBonus?: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'pending' | 'not_yet' | 'success' | 'expired' | 'error';

export default function InstagramLikeVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
}: InstagramLikeVerifyModalProps) {
  const lang = useLang();
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
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayRep = quest ? Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100)) : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

  // For single-action quests (like / save / repost)
  const ActionIcon = isLike ? FiThumbsUp : isRepost ? FaShareAlt : FiBookmark;
  const accentColor = isLike ? 'text-pink-400' : isRepost ? 'text-blue-400' : 'text-yellow-400';
  const accentBg = isLike ? 'bg-pink-600 hover:bg-pink-500' : isRepost ? 'bg-blue-600 hover:bg-blue-500' : 'bg-yellow-500 hover:bg-yellow-400';

  const rewardPer = quest ? Math.round((displayReward / 2) * 100) / 100 : 0;
  const repPer = quest ? Math.round(((quest.reputationReward ?? 0) / 2) * (1 + repBonusPercent / 100)) : 0;

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
            onCompleted(data.rewardAmount, data.levelBonus, data.creditBonus);
            onClose();
          }
        }
      } catch {
      setError(lang === 'en' ? 'Network error. Please try again.' : lang === 'pl' ? 'Błąd sieci. Spróbuj ponownie.' : 'Netzwerkfehler. Bitte versuche es erneut.');
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
      ? isEngagement ? t('verify.engagementConfirmed', lang) : isRepost ? t('verify.repostConfirmed', lang) : t('verify.likeConfirmed', lang)
    : step === 'expired' ? t('verify.expiredTitle', lang)
    : step === 'error'   ? t('verify.errorTitle', lang)
    : isEngagement ? t('verify.engagementVerifyTitle', lang)
    : isRepost ? t('verify.repostVerifyTitle', lang)
    : `${isLike ? '❤️' : '🔖'} ${t(isLike ? 'verify.likeVerifyTitle' : 'verify.saveTitle', lang)}`;

  return (
    <Modal open={!!quest} onClose={onClose} title={title}>

      {/* ── Reward-Banner (überall sichtbar außer Fehler/Ablauf) ─────────────── */}
      {quest && step !== 'error' && step !== 'expired' && (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 mb-1">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">
            {t('verify.rewardLabel', lang)}{isEngagement && <span className="normal-case font-normal"> · {t('verify.perAction', lang)}</span>}
          </p>
          <div className="flex items-center justify-between gap-2">
            {isEngagement ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full shrink-0" />
                  <span className="text-amber-400 font-bold text-base">+{formatCredits(rewardPer)} D.FAITH</span>
                  <span className="text-zinc-600 text-xs">×2</span>
                </div>
                {repPer > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <FaStar size={10} className="text-purple-300 shrink-0" />
                    <span className="text-purple-300 font-bold text-sm">+{repPer} REP</span>
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-pink-500/30 border-t-pink-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm">{t('verify.baselineLoading', lang)}</p>
        </div>
      )}

      {/* ── Pending / not_yet — ENGAGEMENT ─────────────────────────────────── */}
      {(step === 'pending' || step === 'not_yet') && quest && isEngagement && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">{t('verify.timeLeft', lang)}</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-amber-400' : 'text-pink-400'}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">
                {t('verify.igNotFound', lang)}
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
                <span className="text-amber-400 text-xs flex items-center gap-0.5"><Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />+{rewardPer} D.FAITH</span>
                {repPer > 0 && <span className="text-purple-300 text-xs flex items-center gap-0.5"><FaStar size={8} /> +{repPer} REP</span>}
                {step === 'not_yet' && (
                  <span className={`text-xs ${verified ? 'text-green-400' : 'text-zinc-500'}`}>
                    {verified ? '✓' : '–'}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
            <p className="text-amber-300 text-xs font-semibold mb-1">{t('verify.hintLabel', lang)}</p>
            <p className="text-amber-200/80 text-xs">
              {t('verify.igHint', lang)}
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
              : <><FiThumbsUp size={14} /><FiBookmark size={14} /> {t('verify.checkBtn', lang)}</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors">
            {t('btn.cancel', lang)}
          </button>
        </div>
      )}

      {/* ── Pending / not_yet — SINGLE ACTION (like/save) ───────────────────── */}
      {(step === 'pending' || step === 'not_yet') && quest && !isEngagement && (
        <div className="space-y-4">
          {/* Timer */}
          <div className={`rounded-xl p-4 text-center ${secondsLeft < 60 ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-zinc-800'}`}>
            <p className="text-zinc-400 text-sm mb-1">{t('verify.timeLeft', lang)}</p>
            <p className={`text-3xl font-bold tabular-nums ${secondsLeft < 60 ? 'text-amber-400' : accentColor}`}>
              {formatTime(secondsLeft)}
            </p>
          </div>

          {step === 'not_yet' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm">
              {lang === 'en' ? 'Not detected yet. Wait a moment and try again.' : lang === 'pl' ? 'Jeszcze nie wykryte. Poczekaj chwilę i spróbuj ponownie.' : 'Noch nicht erkannt. Warte kurz und versuche es erneut.'}
            </p>
            </div>
          )}

          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <ActionIcon size={16} className={accentColor} />
              {t('verify.fbHowTitle', lang)}
            </p>
            <ol className="space-y-1 text-zinc-400 text-sm">
              <li className="flex gap-2">
                <span className={`${accentColor} font-bold shrink-0`}>1.</span>
                {t('verify.openReelBelow', lang)}
              </li>
              <li className="flex gap-2">
                <span className={`${accentColor} font-bold shrink-0`}>2.</span>
                {isLike
                  ? (lang === 'en' ? 'Tap the heart to like the reel' : lang === 'pl' ? 'Stuknij serce, aby polubieć reel' : 'Tippe auf das Herz um das Reel zu liken')
                  : isRepost
                  ? (lang === 'en' ? 'Tap the repost button (\uD83D\uDD01) below the reel' : lang === 'pl' ? 'Stuknij przycisk repostu (\uD83D\uDD01) pod reelem' : 'Tippe auf den Repost-Button (\uD83D\uDD01) unter dem Reel')
                  : (lang === 'en' ? 'Tap the bookmark icon to save the reel' : lang === 'pl' ? 'Stuknij ikonę zakładki, aby zapisać reel' : 'Tippe auf das Lesezeichen-Symbol um das Reel zu speichern')}
              </li>
              <li className="flex gap-2">
                <span className={`${accentColor} font-bold shrink-0`}>3.</span>
                {t('verify.clickVerify', lang)}
              </li>
            </ol>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
            <p className="text-amber-300 text-xs font-semibold mb-1">{t('verify.hintLabel', lang)}</p>
            <p className="text-amber-200/80 text-xs">
              {isRepost
                ? t('verify.repostHint', lang)
                : t('verify.igHint', lang)}
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
            className={`w-full ${accentBg} disabled:opacity-50 ${isLike ? 'text-white' : 'text-black'} text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2`}
          >
            {loading
              ? <div className="border-2 border-current/30 border-t-current rounded-full w-4 h-4 animate-spin" />
              : <><ActionIcon size={14} /> {isLike ? t('verify.likedSaved', lang) : isRepost ? t('verify.reposted', lang) : t('verify.saved', lang)}? – {t('verify.checkBtn', lang)}</>
            }
          </button>
          <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors">{t('btn.cancel', lang)}</button>
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
            className={`w-full ${isEngagement ? 'bg-gradient-to-r from-pink-600 to-yellow-600 hover:from-pink-500 hover:to-yellow-500 text-white' : `${accentBg} ${isLike ? 'text-white' : 'text-black'}`} disabled:opacity-50 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2`}
          >
            {loading
              ? <div className="border-2 border-current/30 border-t-current rounded-full w-4 h-4 animate-spin" />
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
                  ? <div className="flex flex-col items-center gap-0.5">
                      <span className="text-green-400 text-xs flex items-center gap-0.5">✓ <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />+{formatCredits(rewardPer)} D.FAITH</span>
                      {repPer > 0 && <span className="text-purple-300 text-xs flex items-center gap-0.5"><FaStar size={8} /> +{repPer} REP</span>}
                    </div>
                  : <span className="text-zinc-500 text-xs">–</span>
                }
              </div>
            ))}
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

      {/* ── Erfolg — EINZELNE AKTION (like/save) ────────────────────────────── */}
      {step === 'success' && !isEngagement && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
            <ActionIcon size={32} className={`${accentColor} mx-auto mb-2`} />
            <p className="text-green-300 font-semibold">
              {isLike ? t('verify.likeSuccess', lang) : isRepost ? t('verify.shareConfirmed', lang) : t('verify.saveConfirmed', lang)}
            </p>
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
    </Modal>
  );
}
