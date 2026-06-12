'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaInstagram, FaCheck, FaSync, FaStar, FaExternalLinkAlt } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry, VerifyResult } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface InstagramCommentVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

export default function InstagramCommentVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
}: InstagramCommentVerifyModalProps) {
  const lang = useLang();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayRep = quest ? Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100)) : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

  const handleVerify = async () => {
    if (!quest) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/instagram-quests/comment-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId: quest.id }),
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
        setResult({ success: false, message: data.error ?? 'Fehler bei der Verifizierung' });
      }
    } catch {
      setResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const title = result
    ? result.success
      ? '🎉 Quest abgeschlossen!'
      : '❌ Fehler'
    : 'Instagram Comment Quest';

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
          <div className="border-4 border-pink-500/30 border-t-pink-500 rounded-full w-12 h-12 animate-spin" />
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
                  <p className="text-zinc-400 text-xs">Zu deinem D.FAITH Credits Guthaben hinzugefügt</p>
                  {(quest?.reputationReward ?? 0) > 0 && (
                    <p className="text-purple-300 text-xs font-medium flex items-center gap-1 mt-0.5">
                      <FaStar size={9} /> +{quest?.reputationReward} Reputation
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
            {t('common.close', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reel-Link */}
          {quest?.videoUrl && (
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

          {/* Anleitung */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm">{t('verify.fbHowTitle', lang)}</p>
            <ol className="space-y-2 text-zinc-400 text-sm">
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">1.</span>
                {t('verify.openReel', lang)}
              </li>
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">2.</span>
                {t('verify.leaveCommentIG', lang)}
              </li>
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">3.</span>
                {t('verify.clickVerify', lang)}
              </li>
            </ol>
          </div>

          <button
            onClick={handleVerify}
            className="w-full bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaSync size={12} />
            {t('btn.verify', lang)}
          </button>
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors"
          >
            {t('common.cancel', lang)}
          </button>
        </div>
      )}
    </Modal>
  );
}
