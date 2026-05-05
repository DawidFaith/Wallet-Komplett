'use client';

import React, { useState } from 'react';
import { FaInstagram, FaCheck, FaSync, FaCoins, FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry, VerifyResult } from '../types';

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
  const [copied, setCopied] = useState(false);

  const verificationCode = walletAddress
    ? `DFAITH-${walletAddress.slice(2, 10).toUpperCase()}`
    : '';

  const handleCopy = async () => {
    if (!verificationCode) return;
    await navigator.clipboard.writeText(verificationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          message: `Quest abgeschlossen! +${data.rewardAmount} DFAITH Credits`,
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
                  <p className="text-white font-bold text-lg">{result.rewardAmount} DFAITH</p>
                  <p className="text-zinc-400 text-xs">Zu deinem Dfaith Credits Guthaben hinzugefügt</p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4 space-y-2">
              <p className="text-red-300">{result.message}</p>
              {result.message?.includes('DFAITH-') && (
                <p className="text-zinc-500 text-xs">
                  Stelle sicher dass du deinen Code genau so kommentiert hast und warte einige Sekunden bevor du erneut prüfst.
                </p>
              )}
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
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
            <p className="text-white font-semibold text-sm">So funktioniert es:</p>
            <ol className="space-y-2 text-zinc-400 text-sm">
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">1.</span>
                Öffne das Reel oben
              </li>
              <li className="flex gap-2">
                <span className="text-pink-400 font-bold shrink-0">2.</span>
                Kommentiere genau diesen Code darunter:
              </li>
            </ol>

            {/* Verifizierungscode */}
            <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-4 py-3">
              <span className="text-pink-300 font-mono font-bold tracking-wider flex-1">
                {verificationCode}
              </span>
              <button
                onClick={handleCopy}
                className="text-zinc-400 hover:text-white transition-colors p-1"
                title="Code kopieren"
              >
                {copied ? <FaCheck size={14} className="text-green-400" /> : <FaCopy size={14} />}
              </button>
            </div>

            <li className="flex gap-2 text-zinc-400 text-sm">
              <span className="text-pink-400 font-bold shrink-0">3.</span>
              Klicke auf &bdquo;Jetzt verifizieren&ldquo;
            </li>
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
