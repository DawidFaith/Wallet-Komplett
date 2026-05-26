'use client';

// Facebook Quest-Karte – unterstützt Comment / Like / Secret

import React from 'react';
import Image from 'next/image';
import { FaFacebook, FaClock, FaComment, FaThumbsUp, FaKey, FaStar } from 'react-icons/fa';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry, formatCredits } from '../../utils';

interface FacebookQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  onComplete: (questId: string) => void;
  rewardTokenName?: string | null;
  levelBonusPercent?: number;
}

export default function FacebookQuestCard({ quest, isCompleted, onComplete, rewardTokenName, levelBonusPercent = 0 }: FacebookQuestCardProps) {
  const tokenLabel = rewardTokenName ?? 'D.FAITH';
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const expiry = formatExpiry(quest.expiresAt);
  const isFull = quest.completions >= quest.maxCompletions;
  const levelBonusAmount = Math.round(quest.rewardAmount * levelBonusPercent) / 100;
  const displayReward = quest.rewardAmount + levelBonusAmount;

  const isLike = quest.type === 'like';
  const isSecret = quest.type === 'secret';

  const badgeIcon = isLike ? <FaThumbsUp size={8} /> : isSecret ? <FaKey size={8} /> : <FaComment size={8} />;
  const badgeLabel = isLike ? 'Like' : isSecret ? 'Secret' : 'Kommentar';
  const badgeBg = isSecret ? 'bg-yellow-600/90' : 'bg-blue-600/90';
  const buttonLabel = isCompleted
    ? '✓ Erledigt'
    : isFull
    ? 'Ausgebucht'
    : 'Starten';

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-blue-800/40 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      <div className="relative h-40 overflow-hidden">
        {quest.videoThumbnail
          ? <img src={quest.videoThumbnail} alt={quest.videoTitle} className="w-full h-full object-cover" />
          : <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 to-zinc-900" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
        <span className={`absolute top-2 left-2 ${badgeBg} text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1`}>
          {badgeIcon} {badgeLabel}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FaFacebook size={16} className="text-blue-400" />
          <span className="text-white font-semibold text-sm line-clamp-1">{quest.videoTitle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1 text-yellow-400 font-semibold">
            <Image src="/D.FAITH.png" alt={tokenLabel} width={16} height={16} className="w-4 h-4 rounded-full" unoptimized /> {formatCredits(displayReward)} {tokenLabel}
          </span>
          {levelBonusPercent > 0 && (
            <span className="text-green-300 font-semibold">inkl. +{levelBonusPercent}% Level-Bonus</span>
          )}
          {(quest.reputationReward ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-amber-300 font-semibold">
              <FaStar size={9} /> +{quest.reputationReward} REP
            </span>
          )}
          {expiry && (
            <span className="flex items-center gap-1 text-zinc-500 ml-auto">
              <FaClock size={9} /> {expiry}
            </span>
          )}
        </div>

        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-zinc-500 text-xs">{quest.completions}/{quest.maxCompletions} abgeschlossen</p>

        <button
          onClick={() => !isCompleted && !isFull && onComplete(quest.id)}
          disabled={isCompleted || isFull}
          className={`w-full ${isSecret ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-blue-600 hover:bg-blue-500 text-white'} disabled:opacity-40 text-sm font-semibold py-2.5 rounded-xl transition-colors`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
