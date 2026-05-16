'use client';

import React from 'react';
import Image from 'next/image';
import { FaCheck, FaSync, FaExternalLinkAlt, FaStar, FaInfoCircle } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry, VerifyResult } from '../types';
import { formatCredits } from '../utils';

interface VerifyModalProps {
  quest: QuestIndexEntry | null;
  loading: boolean;
  result: VerifyResult | null;
  onVerify: (questId: string) => void;
  onClose: () => void;
}

export default function VerifyModal({ quest, loading, result, onVerify, onClose }: VerifyModalProps) {
  const isOpen = !!quest;
  const title = result
    ? result.success
      ? '🎉 Quest abgeschlossen!'
      : '❌ Fehler'
    : 'Quest verifizieren';

  return (
    <Modal open={isOpen} onClose={onClose} title={title}>
      {/* Reward-Banner */}
      {quest && !result?.success && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">Belohnung</span>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
              <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3.5 h-3.5 rounded-full shrink-0" />
              +{formatCredits(quest.rewardAmount)} D.FAITH
            </span>
            {(quest.reputationReward ?? 0) > 0 && (
              <span className="text-purple-300 font-bold text-sm flex items-center gap-1">
                <FaStar size={10} /> +{quest?.reputationReward} REP
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-yellow-500/30 border-t-yellow-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm text-center">
            Durchsuche Kommentare nach deinem Kanal…
          </p>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {result.success ? (
            <>
              <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 space-y-2">
                <p className="text-green-300 font-semibold">{result.message}</p>
                {result.comment && (
                  <p className="text-zinc-400 text-sm italic">
                    Gefundener Kommentar: &bdquo;{result.comment}&ldquo;
                  </p>
                )}
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
            <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
              <p className="text-red-300">{result.message}</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            Schließen
          </button>
        </div>
      ) : quest ? (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm">{quest.videoTitle}</p>
            <div className="flex items-start gap-2 text-zinc-400 text-sm">
              <FaInfoCircle className="mt-0.5 shrink-0 text-yellow-400" />
              <div>
                <p>So läuft die Verifizierung ab:</p>
                <ol className="mt-1 space-y-1 list-decimal list-inside text-xs">
                  <li>Öffne das Short und hinterlasse einen Kommentar</li>
                  <li>Warte ca. 30 Sekunden bis YouTube gespeichert hat</li>
                  <li>Klicke unten auf &quot;Jetzt verifizieren&quot;</li>
                </ol>
              </div>
            </div>
          </div>
          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={13} /> Zum Short (kommentieren)
          </a>
          <button
            onClick={() => onVerify(quest.id)}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaCheck size={13} /> Jetzt verifizieren
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
