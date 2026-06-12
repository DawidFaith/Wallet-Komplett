'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { FaFacebookF, FaStar, FaExternalLinkAlt, FaCopy, FaCheck } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry, VerifyResult } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface FacebookCommentVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

export default function FacebookCommentVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
}: FacebookCommentVerifyModalProps) {
  const lang = useLang();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [commentText, setCommentText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayRep = quest ? Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100)) : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

  // Kommentartext vom Backend holen (deterministisch pro wallet+quest)
  useEffect(() => {
    if (!quest) {
      setCommentText(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/facebook-quests/comment-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, questId: quest.id, action: 'preview' }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.commentText) setCommentText(data.commentText);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [quest, walletAddress]);

  const handleCopy = async () => {
    if (!commentText) return;
    try {
      await navigator.clipboard.writeText(commentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleVerify = async () => {
    if (!quest) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/facebook-quests/comment-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId: quest.id, action: 'verify' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `Quest abgeschlossen! +${formatCredits(data.rewardAmount)} DFAITH Credits`,
          rewardAmount: data.rewardAmount,
        });
        onCompleted(data.rewardAmount, data.levelBonus);
      } else {
        setResult({ success: false, message: data.error ?? data.message ?? 'Fehler bei der Verifizierung' });
      }
    } catch {
      setResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setCopied(false);
    onClose();
  };

  const title = result
    ? result.success
      ? t('verify.questDone', lang)
      : t('verify.errorTitle', lang)
    : t('verify.fbCommentTitle', lang);

  return (
    <Modal open={!!quest} onClose={handleClose} title={title}>
      {/* Reward-Banner */}
      {quest && !result?.success && (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 mb-1">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">{t('verify.rewardLabel', lang)}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full shrink-0" />
              <span className="text-amber-400 font-bold text-base">+{formatCredits(displayReward)} D.FAITH</span>
              {levelBonusPercent > 0 && <span className="text-yellow-400 font-bold text-xs">(+{levelBonusPercent}%)</span>}
            </div>
            {(quest.reputationReward ?? 0) > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <FaStar size={10} className="text-purple-300 shrink-0" />
                <span className="text-purple-300 font-bold text-sm">+{displayRep} REP</span>
                {repBonusPercent > 0 && <span className="text-yellow-400 font-bold text-xs">(+{repBonusPercent}%)</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-blue-500/30 border-t-blue-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm text-center">
            {t('verify.commentsChecking', lang)}
          </p>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {result.success ? (
            <>
              <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4">
                <p className="text-green-300 font-semibold">{result.message}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
                <Image src="/D.FAITH.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full shrink-0" />
                <div>
                  <p className="text-white font-bold text-lg">{formatCredits(result.rewardAmount)} D.FAITH Credits</p>
                  <p className="text-zinc-400 text-xs">{t('verify.creditsAdded', lang)}</p>
                  {(quest?.reputationReward ?? 0) > 0 && (
                    <p className="text-purple-300 text-xs font-medium flex items-center gap-1 mt-0.5">
                      <FaStar size={9} /> +{displayRep} {t('verify.reputation', lang)}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
              <p className="text-amber-300">{result.message}</p>
            </div>
          )}
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            {t('btn.close', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Post-Link */}
          {quest?.videoUrl && (
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
            >
              <FaFacebookF size={20} className="text-blue-400 shrink-0" />
              <span className="text-zinc-300 text-sm line-clamp-2 flex-1">{quest.videoTitle}</span>
              <FaExternalLinkAlt size={12} className="text-zinc-500 shrink-0" />
            </a>
          )}

          {/* Anleitung */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
            <p className="text-zinc-300 text-sm font-semibold">{t('verify.fbHowTitle', lang)}</p>
            <ol className="space-y-1.5 text-zinc-400 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">1.</span>{t('verify.fbStep1', lang)}</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">2.</span>{t('verify.fbStep2', lang)}</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">3.</span>{t('verify.fbStep3', lang)}</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">4.</span>{t('verify.fbStep4', lang)}</li>
            </ol>
          </div>

          {/* Dein Kommentar */}
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-xs font-semibold uppercase tracking-wide">{t('verify.yourComment', lang)}</span>
              <span className="text-zinc-500 text-[10px]">{t('verify.individualComment', lang)}</span>
            </div>
            {commentText ? (
              <>
                <p className="text-white text-base font-medium leading-snug select-all">
                  {commentText}
                </p>
                <button
                  onClick={handleCopy}
                  className="w-full bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <><FaCheck size={12} /> {t('btn.copied', lang)}</>
                  ) : (
                    <><FaCopy size={12} /> {lang === 'en' ? 'Copy comment' : lang === 'pl' ? 'Kopiuj komentarz' : 'Kommentar kopieren'}</>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
                <div className="border-2 border-zinc-600 border-t-blue-400 rounded-full w-4 h-4 animate-spin" />
                  {lang === 'en' ? 'Loading comment…' : lang === 'pl' ? 'Ładowanie komentarza…' : 'Kommentar wird geladen…'}
              </div>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={!commentText}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaFacebookF size={14} />
            {t('btn.verify', lang)}
          </button>
        </div>
      )}
    </Modal>
  );
}
