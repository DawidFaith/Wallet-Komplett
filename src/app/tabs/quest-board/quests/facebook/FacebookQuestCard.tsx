'use client';

// Facebook Quest-Karte – unterstützt Comment / Like / Secret

import React from 'react';
import Image from 'next/image';
import { FaFacebook, FaClock, FaComment, FaThumbsUp, FaKey, FaStar } from 'react-icons/fa';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry, formatCredits } from '../../utils';
import { t, type Lang } from '../../../../utils/i18n';

interface FacebookQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  isVerified?: boolean;
  onComplete: (questId: string) => void;
  rewardTokenName?: string | null;
  levelBonusPercent?: number;
  language?: Lang;
}

export default function FacebookQuestCard({ quest, isCompleted, isVerified = true, onComplete, rewardTokenName, levelBonusPercent = 0, language = 'de' }: FacebookQuestCardProps) {
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
  const badgeBg = 'bg-blue-600/90';
  const buttonLabel = isCompleted
    ? '✓ Erledigt'
    : isFull
    ? 'Ausgebucht'
    : 'Starten';

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-blue-600/40 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
      {/* Thumbnail */}
      <div className="relative h-40">
        {quest.videoThumbnail
          ? <Image src={quest.videoThumbnail} alt={quest.videoTitle} fill unoptimized className="object-cover" />
          : <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 to-zinc-900" />
        }
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
        <div className={`absolute top-2 left-2 ${badgeBg} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
          <FaFacebook size={10} /> {badgeLabel}
        </div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Image src="/D.FAITH.png" alt={tokenLabel} width={14} height={14} className="rounded-full" unoptimized />
            +{formatCredits(displayReward)} {tokenLabel}
          </div>
          {levelBonusPercent > 0 && (
            <div className="bg-black/70 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              inkl. +{levelBonusPercent}% Level-Bonus
            </div>
          )}
          {(quest.reputationReward ?? 0) > 0 && (
            <div className="bg-black/70 text-amber-300 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <FaStar size={9} /> +{quest.reputationReward} REP
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
          <div className="h-1.5 bg-blue-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-zinc-400 text-xs">
          Aufgabe: <span className="text-zinc-300">{quest.description || (isSecret ? '🔑 Finde den geheimen Code und gib ihn ein!' : isLike ? '👍 Like dieses Video!' : '💬 Schreibe einen positiven Kommentar!')}</span>
        </p>

        {isCompleted ? (
          <button disabled className="w-full bg-green-900/40 text-green-400 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-default border border-green-700/30">
            <FaFacebook size={12} /> {t('btn.done', language)}
          </button>
        ) : isFull ? (
          <button disabled className="w-full bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default">
            {t('btn.full', language)}
          </button>
        ) : (
          <button
            onClick={() => onComplete(quest.id)}
            disabled={!isVerified}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaFacebook size={12} /> {t('btn.start', language)}
          </button>
        )}
      </div>
    </div>
  );
}
