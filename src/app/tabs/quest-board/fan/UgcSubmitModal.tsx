'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaPenNib, FaStar, FaCheck, FaClock, FaPaperPlane } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t, tFmt } from '../../../utils/i18n';

interface UgcSubmitModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number, creditBonus?: number) => void;
  onClose: () => void;
}

type Result =
  | { kind: 'success'; message: string }
  | { kind: 'pending'; message: string }
  | { kind: 'error'; message: string };

/**
 * Plattformübergreifendes Modal für UGC-Quests: Fan erstellt einen eigenen
 * Beitrag zum Thema des Künstlers (statt mit dessen Post zu interagieren),
 * reicht den Link ein — Verifizierung läuft serverseitig per oEmbed-Check
 * (siehe api/quests/ugc-submit).
 */
export default function UgcSubmitModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  onCompleted,
  onClose,
}: UgcSubmitModalProps) {
  const lang = useLang();
  const [postUrl, setPostUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (!quest) return null;

  const levelBonusAmount = Math.round(quest.rewardAmount * levelBonusPercent) / 100;
  const displayReward = quest.rewardAmount + levelBonusAmount;
  const displayRep = Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100));
  const requiredTag = quest.requiredTag ?? '';

  const handleClose = () => {
    setPostUrl('');
    setResult(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!postUrl.trim()) {
      setResult({ kind: 'error', message: t('ugc.missingUrl', lang) });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/quests/ugc-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId: quest.id, postUrl: postUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ kind: 'success', message: data.message ?? '' });
        onCompleted(data.rewardAmount ?? displayReward, data.levelBonus, data.creditBonus);
      } else if (data.pending) {
        setResult({ kind: 'pending', message: data.message ?? t('ugc.pendingBody', lang) });
      } else {
        setResult({ kind: 'error', message: data.error ?? t('profile.networkError', lang) });
      }
    } catch {
      setResult({ kind: 'error', message: t('profile.networkError', lang) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!quest} onClose={handleClose} title={t('ugc.title', lang)}>
      <div className="space-y-4">
        {result?.kind !== 'success' && (
          <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3">
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

        {result?.kind === 'success' ? (
          <div className="space-y-4">
            <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 flex items-start gap-2">
              <FaCheck className="text-green-400 shrink-0 mt-0.5" size={14} />
              <p className="text-green-300 font-semibold text-sm">{result.message}</p>
            </div>
            <button onClick={handleClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
              {t('btn.close', lang)}
            </button>
          </div>
        ) : result?.kind === 'pending' ? (
          <div className="space-y-4">
            <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4 flex items-start gap-2">
              <FaClock className="text-amber-400 shrink-0 mt-0.5" size={14} />
              <div>
                <p className="text-amber-300 font-semibold text-sm">{t('ugc.pendingTitle', lang)}</p>
                <p className="text-amber-300/80 text-xs mt-1">{result.message}</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
              {t('btn.close', lang)}
            </button>
          </div>
        ) : (
          <>
            {/* Anleitung */}
            <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
              <p className="text-zinc-300 text-sm font-semibold flex items-center gap-2">
                <FaPenNib size={12} className="text-amber-400" /> {t('ugc.howTitle', lang)}
              </p>
              <ol className="space-y-1.5 text-zinc-400 text-sm">
                <li className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">1.</span>{t('ugc.step1', lang)}</li>
                <li className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">2.</span>{tFmt('ugc.step2', lang, { tag: requiredTag })}</li>
                <li className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">3.</span>{t('ugc.step3', lang)}</li>
              </ol>
            </div>

            {requiredTag && (
              <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/40 rounded-xl p-4 space-y-1.5">
                <span className="text-amber-300 text-xs font-semibold uppercase tracking-wide">{t('ugc.requiredTagLabel', lang)}</span>
                <p className="text-white text-base font-bold select-all">{requiredTag}</p>
              </div>
            )}

            <div>
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wide">{t('ugc.urlLabel', lang)}</label>
              <input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder={t('ugc.urlPlaceholder', lang)}
                className="w-full mt-1.5 bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-amber-500 focus:outline-none text-sm placeholder-zinc-500"
              />
            </div>

            {result?.kind === 'error' && (
              <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
                <p className="text-amber-300 text-sm">{result.message}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <><FaPaperPlane size={12} /> {t('ugc.submit', lang)}</>
              )}
              {loading && t('ugc.submitting', lang)}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
