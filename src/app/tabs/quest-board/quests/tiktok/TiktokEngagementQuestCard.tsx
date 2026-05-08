'use client';

import React from 'react';
import Image from 'next/image';
import { FaClock, FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import { FiThumbsUp, FiShare2, FiBookmark } from 'react-icons/fi';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry, formatCredits } from '../../utils';

interface TiktokEngagementQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  onComplete: (questId: string) => void;
}

export default function TiktokEngagementQuestCard({ quest, isCompleted, onComplete }: TiktokEngagementQuestCardProps) {
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const isFull = quest.completions >= quest.maxCompletions;
  const expiry = formatExpiry(quest.expiresAt);
  const rewardPer = Math.round((quest.rewardAmount / 3) * 100) / 100;

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-cyan-800/40 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      {quest.videoThumbnail && (
        <div className="relative h-36">
          <Image
            src={quest.videoThumbnail}
            alt={quest.videoTitle}
            fill
            unoptimized
            className="object-cover"
          />
          <div className="absolute top-2 left-2 bg-black/80 text-cyan-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <SiTiktok size={10} /> Engagement
          </div>
          <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={16} height={16} className="w-4 h-4 rounded-full" unoptimized /> {formatCredits(quest.rewardAmount)} D.FAITH
          </div>
          {expiry && (
            <div className="absolute bottom-2 left-2 bg-black/70 text-zinc-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <FaClock size={9} /> {expiry}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{quest.videoTitle}</h3>

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
              <span className="text-yellow-400 text-xs">+{formatCredits(rewardPer)}</span>
            </div>
          ))}
        </div>

        {/* Fortschrittsbalken */}
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>{quest.completions} / {quest.maxCompletions} Plätze</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-400 text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={11} /> TikTok öffnen
          </a>
          {isCompleted ? (
            <button
              disabled
              className="flex-1 bg-green-900/40 text-green-400 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-default border border-green-700/30"
            >
              <FaCheck size={12} /> Erledigt
            </button>
          ) : (
            <button
              onClick={() => !isFull && onComplete(quest.id)}
              disabled={isFull}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {isFull ? 'Voll' : 'Verifizieren'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
