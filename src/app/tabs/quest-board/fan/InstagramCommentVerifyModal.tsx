'use client';

import React, { useState } from 'react';
import { FaInstagram, FaCheck, FaSync, FaCoins, FaExternalLinkAlt } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry, VerifyResult } from '../types';
import { formatCredits } from '../utils';

interface InstagramCommentVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  onCompleted: (rewardAmount: number) => void;
  onClose: () => void;
}

export default function InstagramCommentVerifyModal({
  quest,
  walletAddress,
  onCompleted,
  onClose,
}: InstagramCommentVerifyModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const handleVerify = async () => {
    if (!quest) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/instagram-quests/comment-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId: quest.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `Quest abgeschlossen! +${formatCredits(data.rewardAmount)} DFAITH Credits`,
          rewardAmount: data.rewardAmount,
        });
        onCompleted(data.rewardAmount);
      } else {
        setResult({ success: false, message: data.error ?? 'Fehler bei der Verifizierung' });
      }
    } catch {
      setResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const title = result
    ? result.success
      ? '🎉 Quest abgeschlossen!'
      : '❌ Fehler'
    : 'Instagram Comment Quest';

  return (
    <Modal open={!!quest} onClose={handleClose} title={title}>
      {/* Reward-Banner */}
      {quest && !result?.success && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">Belohnung</span>
          <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
            <FaCoins size={12} /> +{formatCredits(quest.rewardAmount)} DFAITH
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="border-4 border-pink-500/30 border-t-pink-500 rounded-full w-12 h-12 animate-spin" />
          <p className="text-zinc-400 text-sm text-center">
            Kommentare werden geprüft…
          </p>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {result.success ? (
            <>
              <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4">
                <p className="text-green-300 font-semibold">{result.message}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
                <FaCoins size={24} className="text-yellow-400" />
                <div>
                  <p className="text-white font-bold text-lg">{formatCredits(result.rewardAmount)} DFAITH</p>
                  <p className="text-zinc-400 text-xs">Zu deinem Dfaith Credits Guthaben hinzugefügt</p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
              <p className="text-red-300">{result.message}</p>
            </div>
          )}
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            Schließen
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reel-Link */}
          {quest?.videoUrl && (
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
            >
              <FaInstagram size={20} className="text-pink-400 shrink-0" />
              <span className="text-white text-sm font-medium line-clamp-1 flex-1">{quest.videoTitle}</span>
              <FaExternalLinkAlt size={12} className="text-zinc-500 shrink-0" />
            </a>
          )}

          {/* Anleitung */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm">So funktioniert es:</p>
            <ol className="space-y-2 text-zinc-400 text-sm">
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">1.</span>
                Öffne das Reel oben
              </li>
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">2.</span>
                Hinterlasse einen positiven Kommentar mit deinem Instagram-Account
              </li>
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">3.</span>
                Klicke auf &bdquo;Jetzt verifizieren&ldquo;
              </li>
            </ol>
          </div>

          <button
            onClick={handleVerify}
            className="w-full bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaSync size={12} />
            Jetzt verifizieren
          </button>
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-xl transition-colors"
          >
            Abbrechen
          </button>
        </div>
      )}
    </Modal>
  );
}
