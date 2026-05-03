'use client';

// TikTok Quest-Karte – coming soon
// Struktur analog zu YoutubeQuestCard, wird erweitert wenn TikTok-API integriert ist.

import React from 'react';
import { FaCoins, FaClock } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry } from '../../utils';

interface TiktokQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  onComplete: (questId: string) => void;
}

export default function TiktokQuestCard({ quest, isCompleted, onComplete }: TiktokQuestCardProps) {
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const expiry = formatExpiry(quest.expiresAt);

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-cyan-800/40 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <SiTiktok size={16} className="text-cyan-400" />
          <span className="text-white font-semibold text-sm line-clamp-1">{quest.videoTitle}</span>
        </div>

        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <FaCoins size={10} className="text-yellow-400" /> {quest.rewardAmount} DFAITH
          </span>
          {expiry && (
            <span className="flex items-center gap-1 text-zinc-500">
              <FaClock size={9} /> {expiry}
            </span>
          )}
        </div>

        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-zinc-500 text-xs">{quest.completions}/{quest.maxCompletions} abgeschlossen</p>

        <button
          onClick={() => !isCompleted && onComplete(quest.id)}
          disabled={isCompleted || quest.completions >= quest.maxCompletions}
          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {isCompleted ? 'Erledigt' : 'Verifizieren'}
        </button>
      </div>
    </div>
  );
}
