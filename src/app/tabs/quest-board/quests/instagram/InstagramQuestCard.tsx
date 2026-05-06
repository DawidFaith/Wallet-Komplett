'use client';

import React from 'react';
import { FaInstagram, FaCoins, FaClock, FaComment, FaHeart, FaBookmark, FaShareAlt } from 'react-icons/fa';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry } from '../../utils';

interface InstagramQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  onComplete: (questId: string) => void;
}

const QUEST_TYPE_CONFIG = {
  like:       { label: 'Like',             icon: <FaHeart size={8} />,    bg: 'bg-pink-600/90',                                          btn: 'Like verifizieren' },
  save:       { label: 'Speichern',        icon: <FaBookmark size={8} />, bg: 'bg-yellow-600/90',                                        btn: 'Speichern verifizieren' },
  comment:    { label: 'Kommentar',        icon: <FaComment size={8} />,  bg: 'bg-purple-600/90',                                        btn: 'Kommentar verifizieren' },
  engagement: { label: 'Like & Speichern', icon: <FaHeart size={8} />,   bg: 'bg-gradient-to-r from-red-600/90 to-yellow-600/90',       btn: 'Engagement verifizieren' },
  repost:     { label: 'Repost',           icon: <FaShareAlt size={8} />, bg: 'bg-gradient-to-r from-blue-600/90 to-cyan-600/90',        btn: 'Repost verifizieren' },
} as const;

export default function InstagramQuestCard({ quest, isCompleted, onComplete }: InstagramQuestCardProps) {
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const expiry = formatExpiry(quest.expiresAt);
  const isFull = quest.completions >= quest.maxCompletions;
  const typeConfig = QUEST_TYPE_CONFIG[quest.type as keyof typeof QUEST_TYPE_CONFIG] ?? QUEST_TYPE_CONFIG.comment;

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-pink-800/40 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      {quest.videoThumbnail && (
        <div className="relative w-full aspect-video overflow-hidden">
          <img src={quest.videoThumbnail} alt={quest.videoTitle} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
          <span className={`absolute top-2 left-2 ${typeConfig.bg} text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1`}>
            {typeConfig.icon} {typeConfig.label}
          </span>
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FaInstagram size={16} className="text-pink-400 shrink-0" />
          <span className="text-white font-semibold text-sm line-clamp-2">{quest.videoTitle}</span>
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
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-zinc-500 text-xs">{quest.completions}/{quest.maxCompletions} abgeschlossen</p>

        <button
          onClick={() => !isCompleted && !isFull && onComplete(quest.id)}
          disabled={isCompleted || isFull}
          className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {isCompleted ? '✓ Erledigt' : isFull ? 'Ausgebucht' : typeConfig.btn}
        </button>
      </div>
    </div>
  );
}
