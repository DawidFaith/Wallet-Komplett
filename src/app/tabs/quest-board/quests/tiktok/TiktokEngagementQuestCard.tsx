'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaClock, FaCheck, FaStar } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import { FiThumbsUp, FiShare2, FiBookmark } from 'react-icons/fi';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry, formatCredits } from '../../utils';
import { t, type Lang } from '../../../../utils/i18n';
import Modal from '../../components/Modal';

interface TiktokEngagementQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  isVerified?: boolean;
  onComplete: (questId: string) => void;
  rewardTokenName?: string | null;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  language?: Lang;
}

export default function TiktokEngagementQuestCard({ quest, isCompleted, isVerified = true, onComplete, rewardTokenName, levelBonusPercent = 0, repBonusPercent = 0, language = 'de' }: TiktokEngagementQuestCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const tokenLabel = rewardTokenName ?? 'D.FAITH';
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const isFull = quest.completions >= quest.maxCompletions;
  const expiry = formatExpiry(quest.expiresAt);
  const levelBonusAmount = Math.round(quest.rewardAmount * levelBonusPercent) / 100;
  const displayReward = quest.rewardAmount + levelBonusAmount;
  const rewardPer = Math.round((displayReward / 3) * 100) / 100;
  const displayRep = Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100));

  return (
    <>
      {/* ── Kompakte Karte (Shop-Stil) ── */}
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className={`group relative flex flex-col bg-zinc-900 rounded-xl overflow-hidden border border-cyan-600/40 text-left transition-all hover:bg-zinc-800/70 ${isCompleted ? 'opacity-60' : ''}`}
      >
        <div className="relative w-full aspect-square">
          {quest.videoThumbnail
            ? <Image src={quest.videoThumbnail} alt={quest.videoTitle} fill unoptimized className="object-cover" />
            : <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/50 to-zinc-900" />
          }
          <div className="absolute top-1.5 left-1.5 bg-black/80 text-cyan-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <SiTiktok size={8} /> Engagement
          </div>
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Image src="/D.FAITH.png" alt={tokenLabel} width={12} height={12} className="w-3 h-3 rounded-full" unoptimized /> {formatCredits(displayReward)}
          </div>
          {isCompleted && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-green-500 rounded-full w-8 h-8 flex items-center justify-center">
                <FaCheck size={14} className="text-black" />
              </div>
            </div>
          )}
          {isFull && !isCompleted && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-[10px] font-black uppercase tracking-wide">{t('btn.full', language)}</span>
            </div>
          )}
        </div>
        <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1">
          <p className="text-white font-semibold text-xs leading-snug line-clamp-2">{quest.videoTitle}</p>
          <span className="text-zinc-500 text-[10px]">{quest.completions}/{quest.maxCompletions} {t('quest.slots', language)}</span>
        </div>
      </button>

      {/* ── Detail-Modal ── */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={quest.videoTitle}>
        <div className="relative h-40 rounded-xl overflow-hidden -mt-1 mb-3">
          {quest.videoThumbnail
            ? <Image src={quest.videoThumbnail} alt={quest.videoTitle} fill unoptimized className="object-cover" />
            : <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/50 to-zinc-900" />
          }
          <div className="absolute top-2 left-2 bg-black/80 text-cyan-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <SiTiktok size={10} /> Engagement
          </div>
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Image src="/D.FAITH.png" alt={tokenLabel} width={16} height={16} className="w-4 h-4 rounded-full" unoptimized /> {formatCredits(displayReward)} {tokenLabel}{levelBonusPercent > 0 && <span className="text-yellow-400 font-bold text-xs"> (+{levelBonusPercent}%)</span>}
            </div>
            {(quest.reputationReward ?? 0) > 0 && (
              <div className="bg-black/70 text-amber-300 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <FaStar size={9} /> +{displayRep} REP{repBonusPercent > 0 && <span className="text-yellow-400 font-bold text-xs"> (+{repBonusPercent}%)</span>}
              </div>
            )}
          </div>
          {expiry && (
            <div className="absolute bottom-2 left-2 bg-black/70 text-zinc-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <FaClock size={9} /> {expiry}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* 3 Aktionen mit Reward */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <FiThumbsUp size={16} />, label: 'Like', color: 'text-cyan-400' },
              { icon: <FiShare2 size={16} />, label: 'Share', color: 'text-purple-400' },
              { icon: <FiBookmark size={16} />, label: 'Save', color: 'text-yellow-400' },
            ].map(({ icon, label, color }) => (
              <div key={label} className="bg-zinc-800 rounded-xl p-2 flex flex-col items-center gap-1">
                <span className={color}>{icon}</span>
                <span className="text-zinc-300 text-xs font-semibold">{label}</span>
                <span className="text-yellow-400 text-xs flex items-center gap-0.5">
                  <Image src="/D.FAITH.png" alt="" width={11} height={11} className="w-2.5 h-2.5 rounded-full" unoptimized /> +{formatCredits(rewardPer)}
                </span>
              </div>
            ))}
          </div>

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>{quest.completions} / {quest.maxCompletions} {t('quest.slots', language)}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-cyan-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {isCompleted ? (
            <button disabled className="w-full bg-green-900/40 text-green-400 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-default border border-green-700/30">
              <FaCheck size={12} /> {t('btn.done', language)}
            </button>
          ) : (
            <button
              onClick={() => { if (!isFull && isVerified) { setShowDetail(false); onComplete(quest.id); } }}
              disabled={isFull || !isVerified}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isFull ? t('btn.full', language) : <><FaCheck size={12} /> {t('btn.start', language)}</>}
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
