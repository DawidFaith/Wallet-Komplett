'use client';

import React from 'react';
import Image from 'next/image';
import { FaTrophy, FaCheck, FaClock, FaStar } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry, formatCredits } from '../../utils';
import { t, type Lang } from '../../../../utils/i18n';

interface TiktokQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  isVerified?: boolean;
  onComplete: (questId: string) => void;
  rewardTokenName?: string | null;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  language?: Lang;
}

export default function TiktokQuestCard({ quest, isCompleted, isVerified = true, onComplete, rewardTokenName, levelBonusPercent = 0, repBonusPercent = 0, language = 'de' }: TiktokQuestCardProps) {
  const tokenLabel = rewardTokenName ?? 'D.FAITH';
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const isFull = quest.completions >= quest.maxCompletions;
  const expiry = formatExpiry(quest.expiresAt);
  const levelBonusAmount = Math.round(quest.rewardAmount * levelBonusPercent) / 100;
  const displayReward = quest.rewardAmount + levelBonusAmount;
  const displayRep = Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100));

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-cyan-600/40 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
      {/* Thumbnail */}
      <div className="relative h-40">
        <Image
          src={quest.videoThumbnail}
          alt={quest.videoTitle}
          fill
          unoptimized
          className="object-cover"
        />
        <div className="absolute top-2 left-2 bg-cyan-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <SiTiktok size={10} /> {quest.type === 'secret' ? 'Secret' : quest.type === 'engagement' ? 'Engagement' : quest.type === 'like' ? 'Like' : quest.type === 'save' ? 'Speichern' : quest.type === 'share' ? 'Teilen' : 'Kommentar'}
        </div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Image src="/D.FAITH.png" alt={tokenLabel} width={16} height={16} className="w-4 h-4 rounded-full" unoptimized /> {formatCredits(displayReward)} {tokenLabel}{levelBonusPercent > 0 && <span className="text-green-300"> (+{levelBonusPercent}%)</span>}
          </div>
          {(quest.reputationReward ?? 0) > 0 && (
            <div className="bg-black/70 text-amber-300 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <FaStar size={9} /> +{displayRep} REP{repBonusPercent > 0 && <span className="text-green-300"> (+{repBonusPercent}%)</span>}
            </div>
          )}
        </div>
        {expiry && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-zinc-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <FaClock size={9} /> {expiry}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{quest.videoTitle}</h3>

        {/* Fortschrittsbalken */}
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>{quest.completions} {t('quest.slotsOf', language)} {quest.maxCompletions} {t('quest.slots', language)}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-cyan-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-zinc-400 text-xs">
          Aufgabe: <span className="text-zinc-300">{quest.description || (quest.type === 'secret' ? '🔑 Finde den geheimen Code im Video und gib ihn ein!' : quest.type === 'share' ? '🔁 Teile dieses TikTok-Video und beweise es mit deinem Originalsound!' : '💬 Schreibe einen positiven Kommentar unter dieses TikTok-Video!')}</span>
        </p>

        {isCompleted ? (
          <button disabled className="w-full bg-green-900/40 text-green-400 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-default border border-green-700/30">
          <FaCheck size={12} /> {t('btn.done', language)}
          </button>
        ) : isFull ? (
          <button disabled className="w-full bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default">
            {t('btn.full', language)}
          </button>
        ) : (
          <button
            onClick={() => onComplete(quest.id)}
            disabled={!isVerified}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaTrophy size={12} /> {t('btn.start', language)}
          </button>
        )}
      </div>
    </div>
  );
}
