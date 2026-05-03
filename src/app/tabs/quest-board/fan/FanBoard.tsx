'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FaTrophy, FaSync, FaUserCheck } from 'react-icons/fa';
import CreditsBox from '../components/CreditsBox';
import VerifyModal from './VerifyModal';
import YoutubeQuestCard from '../quests/youtube/YoutubeQuestCard';
import type { QuestIndexEntry, YouTubeBinding, VerifyResult, ClaimResult } from '../types';

interface FanBoardProps {
  walletAddress: string;
  binding: YouTubeBinding;
}

export default function FanBoard({ walletAddress, binding }: FanBoardProps) {
  const [quests, setQuests] = useState<QuestIndexEntry[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [credits, setCredits] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  const [verifyingQuest, setVerifyingQuest] = useState<QuestIndexEntry | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const loadQuests = useCallback(async () => {
    setLoading(true);
    try {
      const [questsRes, balRes] = await Promise.all([
        fetch(`/api/youtube-quests/quests?wallet=${walletAddress}`),
        fetch(`/api/youtube-quests/creator-balance?wallet=${walletAddress}`),
      ]);
      const questsData = await questsRes.json();
      setQuests(questsData.quests ?? []);
      setCompletedIds(questsData.completedIds ?? []);
      if (balRes.ok) {
        const balData = await balRes.json();
        setCredits(balData.balance ?? 0);
      }
    } catch {
      // Fehler beim Laden
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  const handleVerify = async (questId: string) => {
    const quest = quests.find((q) => q.id === questId) ?? null;
    setVerifyingQuest(quest);
    setVerifyResult(null);
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/youtube-quests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerifyResult({
          success: true,
          message: `Quest abgeschlossen! +${data.rewardAmount} Dfaith Credits`,
          comment: data.comment?.text,
          rewardAmount: data.rewardAmount,
        });
        setCompletedIds((prev) => [...prev, questId]);
        setCredits((prev) => prev + (data.rewardAmount ?? 0));
        setQuests((prev) =>
          prev.map((q) => q.id === questId ? { ...q, completions: q.completions + 1 } : q)
        );
      } else {
        setVerifyResult({ success: false, message: data.error });
      }
    } catch {
      setVerifyResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await fetch('/api/youtube-quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: credits }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaimResult({ success: true, message: `${data.sentAmount} DFAITH wurden an deine Wallet gesendet!`, txHash: data.txHash });
        setCredits(0);
      } else {
        setClaimResult({ success: false, message: data.error });
      }
    } catch {
      setClaimResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setClaiming(false);
    }
  };

  // Quests nach Plattform gruppieren (für spätere Erweiterung)
  const youtubeQuests = quests.filter((q) => q.platform === 'youtube');

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Kanal-Badge */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center gap-3">
        {binding.channelThumbnail && (
          <Image src={binding.channelThumbnail} alt={binding.channelName} width={40} height={40} unoptimized className="w-10 h-10 rounded-full" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{binding.channelName}</p>
          <p className="text-zinc-500 text-xs">YouTube verknüpft</p>
        </div>
        <div className="flex items-center gap-1 text-green-400 text-xs font-semibold">
          <FaUserCheck /> Verifiziert
        </div>
      </div>

      {/* Credits Box */}
      <CreditsBox
        balance={credits}
        subtitle={credits > 0 ? 'Bereit zum Einlösen als echte DFAITH Tokens' : 'Schließe Quests ab um Credits zu verdienen'}
        actionLabel="Einlösen"
        actionLoading={claiming}
        onAction={handleClaim}
      />

      {/* Claim-Ergebnis */}
      {claimResult && (
        <div className={`rounded-2xl p-4 border ${claimResult.success ? 'bg-green-900/30 border-green-700/40' : 'bg-red-900/30 border-red-700/40'}`}>
          <p className={`font-semibold text-sm ${claimResult.success ? 'text-green-300' : 'text-red-300'}`}>
            {claimResult.message}
          </p>
          {claimResult.txHash && (
            <a href={`https://basescan.org/tx/${claimResult.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline mt-1 block">
              Transaktion auf BaseScan ansehen →
            </a>
          )}
          <button onClick={() => setClaimResult(null)} className="text-zinc-500 text-xs mt-2 hover:text-zinc-300">Schließen</button>
        </div>
      )}

      {/* Quest-Liste */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Verfügbare Quests</h2>
        <button onClick={loadQuests} className="text-zinc-400 hover:text-white p-2 transition-colors">
          <FaSync size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-10 h-10 animate-spin" />
        </div>
      ) : youtubeQuests.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FaTrophy size={32} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine Quests verfügbar.</p>
          <p className="text-sm mt-1">Schau später wieder rein!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {youtubeQuests.map((quest) => (
            <YoutubeQuestCard
              key={quest.id}
              quest={quest}
              isCompleted={completedIds.includes(quest.id)}
              onComplete={handleVerify}
            />
          ))}
        </div>
      )}

      {/* Verifizierungs-Modal */}
      <VerifyModal
        quest={verifyingQuest}
        loading={verifyLoading}
        result={verifyResult}
        onVerify={handleVerify}
        onClose={() => { setVerifyingQuest(null); setVerifyResult(null); }}
      />
    </div>
  );
}
