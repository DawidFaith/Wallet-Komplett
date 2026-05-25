'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { FaFacebookF, FaStar, FaExternalLinkAlt, FaCopy, FaCheck } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry, VerifyResult } from '../types';
import { formatCredits } from '../utils';

interface FacebookCommentVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  onCompleted: (rewardAmount: number) => void;
  onClose: () => void;
}

export default function FacebookCommentVerifyModal({
  quest,
  walletAddress,
  onCompleted,
  onClose,
}: FacebookCommentVerifyModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [commentText, setCommentText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Kommentartext vom Backend holen (deterministisch pro wallet+quest)
  useEffect(() => {
    if (!quest) {
      setCommentText(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/facebook-quests/comment-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, questId: quest.id, action: 'preview' }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.commentText) setCommentText(data.commentText);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [quest, walletAddress]);

  const handleCopy = async () => {
    if (!commentText) return;
    try {
      await navigator.clipboard.writeText(commentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleVerify = async () => {
    if (!quest) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/facebook-quests/comment-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId: quest.id, action: 'verify' }),
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
        setResult({ success: false, message: data.error ?? data.message ?? 'Fehler bei der Verifizierung' });
      }
    } catch {
      setResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setCopied(false);
    onClose();
  };

  const title = result
    ? result.success
      ? '🎉 Quest abgeschlossen!'
      : '❌ Fehler'
    : 'Facebook Comment Quest';

  return (
    <Modal open={!!quest} onClose={handleClose} title={title}>
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
          <div className="border-4 border-blue-500/30 border-t-blue-500 rounded-full w-12 h-12 animate-spin" />
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
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            Schließen
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Post-Link */}
          {quest?.videoUrl && (
            <a
              href={quest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
            >
              <FaFacebookF size={20} className="text-blue-400 shrink-0" />
              <span className="text-zinc-300 text-sm line-clamp-2 flex-1">{quest.videoTitle}</span>
              <FaExternalLinkAlt size={12} className="text-zinc-500 shrink-0" />
            </a>
          )}

          {/* Anleitung */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
            <p className="text-zinc-300 text-sm font-semibold">So funktioniert&apos;s:</p>
            <ol className="space-y-1.5 text-zinc-400 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">1.</span>Kopiere den unten stehenden Kommentar</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">2.</span>Öffne den Post über den Link oben</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">3.</span>Füge den Kommentar dort exakt so ein und poste ihn</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold shrink-0">4.</span>Komm zurück und klicke &bdquo;Verifizieren&ldquo;</li>
            </ol>
          </div>

          {/* Dein Kommentar */}
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-xs font-semibold uppercase tracking-wide">Dein Kommentar</span>
              <span className="text-zinc-500 text-[10px]">individuell für dich generiert</span>
            </div>
            {commentText ? (
              <>
                <p className="text-white text-base font-medium leading-snug select-all">
                  {commentText}
                </p>
                <button
                  onClick={handleCopy}
                  className="w-full bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <><FaCheck size={12} /> Kopiert!</>
                  ) : (
                    <><FaCopy size={12} /> Kommentar kopieren</>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
                <div className="border-2 border-zinc-600 border-t-blue-400 rounded-full w-4 h-4 animate-spin" />
                Kommentar wird geladen…
              </div>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={!commentText}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaFacebookF size={14} />
            Kommentar verifizieren
          </button>
        </div>
      )}
    </Modal>
  );
}
