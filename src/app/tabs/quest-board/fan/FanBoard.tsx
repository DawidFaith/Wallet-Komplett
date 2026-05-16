'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FaTrophy, FaSync, FaLock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
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
import InstagramDmShareModal from './InstagramDmShareModal';
import FacebookCommentVerifyModal from './FacebookCommentVerifyModal';
import FacebookQuestCard from '../quests/facebook/FacebookQuestCard';
import FacebookLikeVerifyModal from './FacebookLikeVerifyModal';
import type { QuestIndexEntry, VerifiedPlatforms, VerifyResult, ClaimResult } from '../types';
import { formatCredits } from '../utils';

interface FanBoardProps {
  walletAddress: string;
  verified: VerifiedPlatforms;
  /** Optionaler Filter: nur Quests dieses Artists (creatorWallet, lowercase) anzeigen */
  filterCreator?: string;
  /** Token-Name des gefilterten Artists (z.B. "MYTOKEN") */
  rewardToken?: string | null;
}

export default function FanBoard({ walletAddress, verified, filterCreator, rewardToken }: FanBoardProps) {
  const tokenName = rewardToken ?? 'D.FAITH';
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
  const [instagramDmShareQuest, setInstagramDmShareQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramDmShareToken, setInstagramDmShareToken] = useState<string | null>(null);
  const [facebookCommentQuest, setFacebookCommentQuest] = useState<QuestIndexEntry | null>(null);
  const [facebookLikeQuest, setFacebookLikeQuest] = useState<QuestIndexEntry | null>(null);

  const loadQuests = useCallback(async () => {
    setLoading(true);
    try {
      const [questsRes, balRes] = await Promise.all([
        fetch(`/api/youtube-quests/quests?wallet=${walletAddress}`),
        fetch(`/api/youtube-quests/creator-balance?wallet=${walletAddress}`),
      ]);
      const questsData = await questsRes.json();
      const loadedQuests: QuestIndexEntry[] = questsData.quests ?? [];
      setQuests(loadedQuests);
      setCompletedIds(questsData.completedIds ?? []);
      if (balRes.ok) {
        const balData = await balRes.json();
        setCredits(balData.balance ?? 0);
      }

      // Auto-open story-claim modal wenn storyToken in URL vorhanden
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('storyToken');
        if (token) {
          const match = loadedQuests.find(
            (q) => q.platform === 'instagram' && (q.type as string) === 'dm_share' && q.storyToken === token
          );
          if (match) {
            setInstagramDmShareQuest(match);
            setInstagramDmShareToken(token);
            // Token aus URL entfernen (kein Neuladen)
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('storyToken');
            window.history.replaceState(null, '', newUrl.toString());
          }
        }
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
          message: `Quest abgeschlossen! +${formatCredits(data.rewardAmount)} ${tokenName} Credits`,
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
          message: `Quest abgeschlossen! +${formatCredits(data.rewardAmount)} ${tokenName} Credits`,
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
        body: JSON.stringify({ walletAddress, amount: credits, ...(filterCreator ? { creatorWallet: filterCreator } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaimResult({ success: true, message: `${formatCredits(data.sentAmount)} ${tokenName} wurden an deine Wallet gesendet!`, txHash: data.txHash });
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
    if ((quest.type as string) === 'dm_share') {
      setInstagramDmShareQuest(quest);
    } else if (quest.type === 'like' || quest.type === 'save' || (quest.type as string) === 'engagement' || (quest.type as string) === 'repost') {
      setInstagramLikeQuest(quest);
    } else {
      setInstagramCommentQuest(quest);
    }
  };

  const handleFacebookVerify = (questId: string) => {
    const quest = quests.find((q) => q.id === questId) ?? null;
    if (!quest) return;
    if (quest.type === 'like') {
      setFacebookLikeQuest(quest);
    } else if (quest.type === 'secret') {
      setSecretVerifyQuest(quest);
    } else {
      setFacebookCommentQuest(quest);
    }
  };

  // Quests nach Plattform und Typ gruppieren – ALLE anzeigen, gesperrte mit Lock
  // Optionaler filterCreator (lowercase wallet) für Artist-Selektion
  const filteredQuests = filterCreator
    ? quests.filter((q) => q.creatorWallet.toLowerCase() === filterCreator.toLowerCase())
    : quests;
  const youtubeQuests = filteredQuests.filter((q) => q.platform === 'youtube' && !completedIds.includes(q.id));
  const tiktokCommentQuests = filteredQuests.filter((q) => q.platform === 'tiktok' && q.type !== 'engagement' && !completedIds.includes(q.id));
  const tiktokEngagementQuests = filteredQuests.filter((q) => q.platform === 'tiktok' && q.type === 'engagement' && !completedIds.includes(q.id));
  const instagramQuests = filteredQuests.filter((q) => q.platform === 'instagram' && !completedIds.includes(q.id));
  const facebookQuests = filteredQuests.filter((q) => q.platform === 'facebook' && !completedIds.includes(q.id));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Credits Box mit Einlösen-Button */}
      <CreditsBox
        balance={credits}
        tokenName={tokenName}
        subtitle={credits > 0 ? `Bereit zum Einlösen als echte ${tokenName}-Token` : 'Schließe Quests ab, um Credits zu verdienen'}
        actionLabel="Einlösen"
        actionLoading={claiming}
        onAction={() => { setClaiming(true); handleClaim(); }}
        onRefresh={loadQuests}
        refreshLoading={loading}
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
      ) : youtubeQuests.length === 0 && tiktokCommentQuests.length === 0 && tiktokEngagementQuests.length === 0 && instagramQuests.length === 0 && facebookQuests.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FaTrophy size={32} className="mx-auto mb-3 opacity-30" />
          <p>Alle Quests erledigt oder noch keine verfügbar.</p>
          <p className="text-sm mt-1">Schau später wieder rein!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {youtubeQuests.length > 0 && (
            <div className="relative">
              {!verified.youtube && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-zinc-700/50">
                  <FaLock size={18} className="text-zinc-400" />
                  <p className="text-zinc-300 text-sm font-semibold">YouTube verknüpfen</p>
                  <p className="text-zinc-500 text-xs">Verifiziere deinen YouTube-Kanal im Profil</p>
                </div>
              )}
              <div className={!verified.youtube ? 'pointer-events-none select-none' : ''}>
                <QuestCarousel>
                  {youtubeQuests.map((quest) => (
                    <YoutubeQuestCard
                      key={quest.id}
                      quest={quest}
                      isCompleted={completedIds.includes(quest.id)}
                      onComplete={handleVerify}
                      rewardTokenName={tokenName}
                    />
                  ))}
                </QuestCarousel>
              </div>
            </div>
          )}
          {(tiktokCommentQuests.length > 0 || tiktokEngagementQuests.length > 0) && (
            <div className="relative">
              {!verified.tiktok && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-zinc-700/50">
                  <FaLock size={18} className="text-zinc-400" />
                  <p className="text-zinc-300 text-sm font-semibold">TikTok verknüpfen</p>
                  <p className="text-zinc-500 text-xs">Verifiziere dein TikTok-Konto im Profil</p>
                </div>
              )}
              <div className={!verified.tiktok ? 'pointer-events-none select-none' : ''}>
                <QuestCarousel>
                  {tiktokCommentQuests.map((quest) => (
                    <TiktokQuestCard
                      key={quest.id}
                      quest={quest}
                      isCompleted={completedIds.includes(quest.id)}
                      onComplete={handleTikTokVerify}
                      rewardTokenName={tokenName}
                    />
                  ))}
                  {tiktokEngagementQuests.map((quest) => (
                    <TiktokEngagementQuestCard
                      key={quest.id}
                      quest={quest}
                      isCompleted={completedIds.includes(quest.id)}
                      onComplete={handleTikTokVerify}
                      rewardTokenName={tokenName}
                    />
                  ))}
                </QuestCarousel>
              </div>
            </div>
          )}
          {instagramQuests.length > 0 && (
            <div className="relative">
              {!verified.instagram && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-zinc-700/50">
                  <FaLock size={18} className="text-zinc-400" />
                  <p className="text-zinc-300 text-sm font-semibold">Instagram verknüpfen</p>
                  <p className="text-zinc-500 text-xs">Verifiziere dein Instagram-Konto im Profil</p>
                </div>
              )}
              <div className={!verified.instagram ? 'pointer-events-none select-none' : ''}>
                <QuestCarousel>
                  {instagramQuests.map((quest) => (
                    <InstagramQuestCard
                      key={quest.id}
                      quest={quest}
                      isCompleted={completedIds.includes(quest.id)}
                      onComplete={handleInstagramVerify}
                      rewardTokenName={tokenName}
                    />
                  ))}
                </QuestCarousel>
              </div>
            </div>
          )}
          {facebookQuests.length > 0 && (
            <div className="relative">
              {!verified.facebook && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-zinc-700/50">
                  <FaLock size={18} className="text-zinc-400" />
                  <p className="text-zinc-300 text-sm font-semibold">Facebook verknüpfen</p>
                  <p className="text-zinc-500 text-xs">Verifiziere dein Facebook-Konto im Profil</p>
                </div>
              )}
              <div className={!verified.facebook ? 'pointer-events-none select-none' : ''}>
                <QuestCarousel>
                  {facebookQuests.map((quest) => (
                    <FacebookQuestCard
                      key={quest.id}
                      quest={quest}
                      isCompleted={completedIds.includes(quest.id)}
                      onComplete={handleFacebookVerify}
                      rewardTokenName={tokenName}
                    />
                  ))}
                </QuestCarousel>
              </div>
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
          // Modal NICHT schließen – onClose schließt nach dem Erfolgs-Screen
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
        }}
        onClose={() => setInstagramCommentQuest(null)}
      />

      {/* Verifizierungs-Modal (Facebook Kommentar) */}
      <FacebookCommentVerifyModal
        quest={facebookCommentQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (facebookCommentQuest) {
            setCompletedIds((prev) => [...prev, facebookCommentQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === facebookCommentQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
        }}
        onClose={() => setFacebookCommentQuest(null)}
      />

      {/* Verifizierungs-Modal (Facebook Like) */}
      <FacebookLikeVerifyModal
        quest={facebookLikeQuest}
        walletAddress={walletAddress}
        onCompleted={(amount) => {
          if (facebookLikeQuest) {
            setCompletedIds((prev) => [...prev, facebookLikeQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === facebookLikeQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
        }}
        onClose={() => setFacebookLikeQuest(null)}
      />

      {/* Verifizierungs-Modal (Instagram DM-Share) */}
      <InstagramDmShareModal
        quest={instagramDmShareQuest}
        walletAddress={walletAddress}
        storyClaimToken={instagramDmShareToken ?? undefined}
        onCompleted={(amount) => {
          if (instagramDmShareQuest) {
            setCompletedIds((prev) => [...prev, instagramDmShareQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === instagramDmShareQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
          }
        }}
        onClose={() => { setInstagramDmShareQuest(null); setInstagramDmShareToken(null); }}
      />
    </div>
  );
}

// ─── QuestCarousel ──────────────────────────────────────────────────────────────────────────────
function QuestCarousel({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Index klemmen falls Liste nach Quest-Abschluss schrumpft
  const safeIdx = Math.min(idx, Math.max(0, items.length - 1));
  useEffect(() => {
    if (idx >= items.length && items.length > 0) setIdx(items.length - 1);
  }, [items.length, idx]);

  if (items.length === 0) return null;
  if (items.length === 1) return <>{items[0]}</>;

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(items.length - 1, i + 1));

  return (
    <div
      className="relative"
      onTouchStart={e => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
        setTouchStart(null);
      }}
    >
      {items[safeIdx]}
      <div className="flex items-center justify-between mt-3 px-1">
        <button
          onClick={prev}
          disabled={safeIdx === 0}
          className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white transition-colors"
        >
          <FaChevronLeft size={12} />
        </button>
        <div className="flex gap-1.5 items-center">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${
                i === safeIdx ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-zinc-600 hover:bg-zinc-400'
              }`}
            />
          ))}
          <span className="text-zinc-500 text-xs ml-1">{safeIdx + 1} / {items.length}</span>
        </div>
        <button
          onClick={next}
          disabled={safeIdx === items.length - 1}
          className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white transition-colors"
        >
          <FaChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
