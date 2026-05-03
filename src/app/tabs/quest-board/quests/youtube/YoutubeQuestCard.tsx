'use client';

import React from 'react';
import Image from 'next/image';
import { FaYoutube, FaCoins, FaTrophy, FaCheck, FaExternalLinkAlt, FaClock } from 'react-icons/fa';
import type { QuestIndexEntry } from '../../types';
import { getProgressPercent, formatExpiry } from '../../utils';

interface YoutubeQuestCardProps {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  onComplete: (questId: string) => void;
}

export default function YoutubeQuestCard({ quest, isCompleted, onComplete }: YoutubeQuestCardProps) {
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const isFull = quest.completions >= quest.maxCompletions;
  const expiry = formatExpiry(quest.expiresAt);

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      <div className="relative h-40">
        <Image
          src={quest.videoThumbnail}
          alt={quest.videoTitle}
          fill
          unoptimized
          className="object-cover"
        />
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <FaYoutube size={10} /> Shorts
        </div>
        <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <FaCoins size={10} /> {quest.rewardAmount} DFAITH
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
            <span>{quest.completions} / {quest.maxCompletions} abgeschlossen</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-zinc-400 text-xs">
          Aufgabe: <span className="text-zinc-300">Wertsteigernder Kommentar unter dem Short</span>
        </p>

        <div className="flex gap-2">
          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={12} /> Zum Short
          </a>

          {isCompleted ? (
            <button
              disabled
              className="flex-1 bg-green-900/40 text-green-400 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-default border border-green-700/30"
            >
              <FaCheck size={12} /> Erledigt
            </button>
          ) : isFull ? (
            <button
              disabled
              className="flex-1 bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default"
            >
              Voll
            </button>
          ) : (
            <button
              onClick={() => onComplete(quest.id)}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FaTrophy size={12} /> Verifizieren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
