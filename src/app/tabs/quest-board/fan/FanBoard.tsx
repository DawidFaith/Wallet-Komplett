'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FaTrophy, FaSync } from 'react-icons/fa';
import CreditsBox from '../components/CreditsBox';
import VerifyModal from './VerifyModal';
import LikeVerifyModal from './LikeVerifyModal';
import SecretVerifyModal from './SecretVerifyModal';
import TiktokEngagementVerifyModal from './TiktokEngagementVerifyModal';
import YoutubeQuestCard from '../quests/youtube/YoutubeQuestCard';
import TiktokQuestCard from '../quests/tiktok/TiktokQuestCard';
import TiktokEngagementQuestCard from '../quests/tiktok/TiktokEngagementQuestCard';
import InstagramQuestCard from '../quests/instagram/InstagramQuestCard';
import InstagramCommentVerifyModal from './InstagramCommentVerifyModal';
import InstagramLikeVerifyModal from './InstagramLikeVerifyModal';
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
  const [likeVerifyQuest, setLikeVerifyQuest] = useState<QuestIndexEntry | null>(null);
  const [secretVerifyQuest, setSecretVerifyQuest] = useState<QuestIndexEntry | null>(null);
  const [tiktokEngagementQuest, setTiktokEngagementQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramCommentQuest, setInstagramCommentQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramLikeQuest, setInstagramLikeQuest] = useState<QuestIndexEntry | null>(null);

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
    // Like-Quest → eigener 3-Schritt-Flow
    if (quest?.type === 'like') {
      setLikeVerifyQuest(quest);
      return;
    }
    // Secret-Quest → Code-Eingabe-Modal
    if (quest?.type === 'secret') {
      setSecretVerifyQuest(quest);
      return;
    }
    // Kommentar-Quest → bestehender Flow
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

  const handleTikTokVerify = async (questId: string) => {
    const quest = quests.find((q) => q.id === questId) ?? null;
    // Engagement-Quest → eigener Verify-Modal
    if (quest?.type === 'engagement') {
      setTiktokEngagementQuest(quest);
      return;
    }
    // Secret-Quest → Code-Eingabe-Modal
    if (quest?.type === 'secret') {
      setSecretVerifyQuest(quest);
      return;
    }
    // Kommentar-Quest
    setVerifyingQuest(quest);
    setVerifyResult(null);
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/tiktok-quests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, questId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyResult({
          success: true,
          message: `Quest abgeschlossen! +${data.rewardAmount} Dfaith Credits`,
          comment: data.comment,
          rewardAmount: data.rewardAmount,
        });
        setCompletedIds((prev) => [...prev, questId]);
        setCredits((prev) => prev + (data.rewardAmount ?? 0));
        setQuests((prev) =>
          prev.map((q) => q.id === questId ? { ...q, completions: q.completions + 1 } : q)
        );
      } else {
        setVerifyResult({ success: false, message: data.error ?? data.message });
      }
    } catch {
      setVerifyResult({ success: false, message: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleClaim = async () => {
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

  const handleInstagramVerify = (questId: string) => {
    const quest = quests.find((q) => q.id === questId) ?? null;
    if (!quest) return;
    if (quest.type === 'like' || quest.type === 'save' || (quest.type as string) === 'engagement' || (quest.type as string) === 'repost') {
      setInstagramLikeQuest(quest);
    } else {
      setInstagramCommentQuest(quest);
    }
  };

  // Quests nach Plattform und Typ gruppieren
  const youtubeQuests = quests.filter((q) => q.platform === 'youtube');
  const tiktokCommentQuests = quests.filter((q) => q.platform === 'tiktok' && q.type !== 'engagement');
  const tiktokEngagementQuests = quests.filter((q) => q.platform === 'tiktok' && q.type === 'engagement');
  const instagramQuests = quests.filter((q) => q.platform === 'instagram');

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
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
      ) : youtubeQuests.length === 0 && tiktokCommentQuests.length === 0 && tiktokEngagementQuests.length === 0 && instagramQuests.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FaTrophy size={32} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine Quests verfügbar.</p>
          <p className="text-sm mt-1">Schau später wieder rein!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {youtubeQuests.length > 0 && (
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
          {tiktokCommentQuests.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tiktokCommentQuests.map((quest) => (
                <TiktokQuestCard
                  key={quest.id}
                  quest={quest}
                  isCompleted={completedIds.includes(quest.id)}
                  onComplete={handleTikTokVerify}
                />
              ))}
            </div>
          )}
          {tiktokEngagementQuests.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tiktokEngagementQuests.map((quest) => (
                <TiktokEngagementQuestCard
                  key={quest.id}
                  quest={quest}
                  isCompleted={completedIds.includes(quest.id)}
                  onComplete={handleTikTokVerify}
                />
              ))}
            </div>
          )}
          {instagramQuests.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {instagramQuests.map((quest) => (
                <InstagramQuestCard
                  key={quest.id}
                  quest={quest}
                  isCompleted={completedIds.includes(quest.id)}
                  onComplete={handleInstagramVerify}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verifizierungs-Modal (Kommentar) */}
      <VerifyModal
        quest={verifyingQuest}
        loading={verifyLoading}
        result={verifyResult}
        onVerify={handleVerify}
        onClose={() => { setVerifyingQuest(null); setVerifyResult(null); }}
      />

      {/* Verifizierungs-Modal (Like) */}
      <LikeVerifyModal
        quest={likeVerifyQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (likeVerifyQuest) {
            setCompletedIds((prev) => [...prev, likeVerifyQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === likeVerifyQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
        }}
        onClose={() => setLikeVerifyQuest(null)}
      />

      {/* Verifizierungs-Modal (Secret) */}
      <SecretVerifyModal
        quest={secretVerifyQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (secretVerifyQuest) {
            setCompletedIds((prev) => [...prev, secretVerifyQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === secretVerifyQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
        }}
        onClose={() => setSecretVerifyQuest(null)}
      />

      {/* Verifizierungs-Modal (TikTok Engagement) */}
      <TiktokEngagementVerifyModal
        quest={tiktokEngagementQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (tiktokEngagementQuest) {
            setCompletedIds((prev) => [...prev, tiktokEngagementQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === tiktokEngagementQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
        }}
        onClose={() => setTiktokEngagementQuest(null)}
      />

      {/* Verifizierungs-Modal (Instagram Like / Save) */}
      <InstagramLikeVerifyModal
        quest={instagramLikeQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (instagramLikeQuest) {
            setCompletedIds((prev) => [...prev, instagramLikeQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === instagramLikeQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
          setInstagramLikeQuest(null);
        }}
        onClose={() => setInstagramLikeQuest(null)}
      />

      {/* Verifizierungs-Modal (Instagram Kommentar) */}
      <InstagramCommentVerifyModal
        quest={instagramCommentQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (instagramCommentQuest) {
            setCompletedIds((prev) => [...prev, instagramCommentQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === instagramCommentQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
          setInstagramCommentQuest(null);
        }}
        onClose={() => setInstagramCommentQuest(null)}
      />
    </div>
  );
}
