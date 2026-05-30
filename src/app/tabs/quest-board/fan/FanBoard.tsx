'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaTrophy, FaSync, FaLock, FaChevronLeft, FaChevronRight, FaStar } from 'react-icons/fa';
import CreditsBox from '../components/CreditsBox';
import VerifyModal from './VerifyModal';
import LikeVerifyModal from './LikeVerifyModal';
import SecretVerifyModal from './SecretVerifyModal';
import TiktokEngagementVerifyModal from './TiktokEngagementVerifyModal';
import TiktokShareVerifyModal from './TiktokShareVerifyModal';
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
import BundleCard from './BundleCard';
import type { QuestIndexEntry, VerifiedPlatforms, VerifyResult, ClaimResult } from '../types';
import type { QuestBundleWithItems } from '../../../lib/questDb';
import { formatCredits } from '../utils';

interface FanBoardProps {
  walletAddress: string;
  verified: VerifiedPlatforms;
  /** Optionaler Filter: nur Quests dieses Artists (creatorWallet, lowercase) anzeigen */
  filterCreator?: string;
  /** Token-Name des gefilterten Artists (z.B. "MYTOKEN") */
  rewardToken?: string | null;
  /** Wird aufgerufen wenn ein Quest erfolgreich abgeschlossen wurde */
  onQuestCompleted?: () => void;
}

export default function FanBoard({ walletAddress, verified, filterCreator, rewardToken, onQuestCompleted }: FanBoardProps) {
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
  const [tiktokLikeQuest, setTiktokLikeQuest] = useState<QuestIndexEntry | null>(null);
  const [tiktokSaveQuest, setTiktokSaveQuest] = useState<QuestIndexEntry | null>(null);
  const [tiktokShareQuest, setTiktokShareQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramCommentQuest, setInstagramCommentQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramLikeQuest, setInstagramLikeQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramDmShareQuest, setInstagramDmShareQuest] = useState<QuestIndexEntry | null>(null);
  const [instagramDmShareToken, setInstagramDmShareToken] = useState<string | null>(null);
  const [facebookCommentQuest, setFacebookCommentQuest] = useState<QuestIndexEntry | null>(null);
  const [facebookLikeQuest, setFacebookLikeQuest] = useState<QuestIndexEntry | null>(null);
  const [bundles, setBundles] = useState<QuestBundleWithItems[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [bonusPercentByCreator, setBonusPercentByCreator] = useState<Record<string, number>>({});

  // Celebration nach Quest-Abschluss
  const [celebration, setCelebration] = useState<{ amount: number; questTitle: string; reputationReward?: number; levelBonus?: number } | null>(null);
  const pendingCelebration = useRef<{ amount: number; questTitle: string; reputationReward?: number; levelBonus?: number } | null>(null);

  // Eltern-Komponente über jeden neuen Quest-Abschluss informieren (für questCount-Badge)
  const prevCompletedCount = useRef(0);
  useEffect(() => {
    if (completedIds.length > prevCompletedCount.current) {
      onQuestCompleted?.();
    }
    prevCompletedCount.current = completedIds.length;
  }, [completedIds, onQuestCompleted]);

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

  const loadBundles = useCallback(async () => {
    setBundlesLoading(true);
    try {
      const url = filterCreator
        ? `/api/quest-bundles?wallet=${walletAddress}&creator=${filterCreator}`
        : `/api/quest-bundles?wallet=${walletAddress}`;
      const res  = await fetch(url);
      const data = await res.json() as { bundles?: QuestBundleWithItems[] };
      setBundles(data.bundles ?? []);
    } catch { /* ignorieren */ }
    finally { setBundlesLoading(false); }
  }, [walletAddress, filterCreator]);

  useEffect(() => { loadQuests(); loadBundles(); }, [loadQuests, loadBundles]);

  useEffect(() => {
    let cancelled = false;

    const loadBonusPercents = async () => {
      const creatorWallets = Array.from(new Set([
        ...quests.map((q) => q.creatorWallet.toLowerCase()),
        ...bundles.map((b) => b.creatorWallet.toLowerCase()),
      ]));

      if (creatorWallets.length === 0) {
        if (!cancelled) setBonusPercentByCreator({});
        return;
      }

      const entries = await Promise.all(
        creatorWallets.map(async (artistWallet) => {
          try {
            const res = await fetch(`/api/reputation?wallet=${walletAddress}&artistWallet=${artistWallet}`);
            if (!res.ok) return [artistWallet, 0] as const;
            const data = await res.json() as { questRewardBonusPercent?: number };
            return [artistWallet, Math.max(0, Number(data.questRewardBonusPercent) || 0)] as const;
          } catch {
            return [artistWallet, 0] as const;
          }
        })
      );

      if (!cancelled) {
        setBonusPercentByCreator(Object.fromEntries(entries));
      }
    };

    loadBonusPercents();
    return () => { cancelled = true; };
  }, [walletAddress, quests, bundles]);

  const getBonusPercent = (creatorWallet: string) => bonusPercentByCreator[creatorWallet.toLowerCase()] ?? 0;

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
    // Kommentar-Quest → Anleitung zeigen
    setVerifyingQuest(quest);
    setVerifyResult(null);
    setVerifyLoading(false);
  };

  const handleVerifyYoutubeComment = async (questId: string) => {
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
          message: `Quest abgeschlossen! +${formatCredits(data.rewardAmount)} ${tokenName} Credits${data.levelBonus && data.levelBonus > 0 ? ` (⚡ inkl. Level-Bonus)` : ''}`,
          comment: data.comment?.text,
          rewardAmount: data.rewardAmount,
          levelBonus: data.levelBonus,
        });
        setCompletedIds((prev) => [...prev, questId]);
        setCredits((prev) => prev + (data.rewardAmount ?? 0));
        setQuests((prev) =>
          prev.map((q) => q.id === questId ? { ...q, completions: q.completions + 1 } : q)
        );
        loadBundles();
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
    // Like-Quest → Like-Verify-Modal
    if (quest?.type === 'like') {
      setTiktokLikeQuest(quest);
      return;
    }
    // Save-Quest → Save-Verify-Modal
    if (quest?.type === 'save') {
      setTiktokSaveQuest(quest);
      return;
    }
    // Share-Quest → Share-Verify-Modal
    if (quest?.type === 'share') {
      setTiktokShareQuest(quest);
      return;
    }
    // Secret-Quest → Code-Eingabe-Modal
    if (quest?.type === 'secret') {
      setSecretVerifyQuest(quest);
      return;
    }
    // Kommentar-Quest → Anleitung zeigen
    setVerifyingQuest(quest);
    setVerifyResult(null);
    setVerifyLoading(false);
  };

  const handleVerifyTikTokComment = async (questId: string) => {
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
          message: `Quest abgeschlossen! +${formatCredits(data.rewardAmount)} ${tokenName} Credits${data.levelBonus && data.levelBonus > 0 ? ` (⚡ inkl. Level-Bonus)` : ''}`,
          comment: data.comment,
          rewardAmount: data.rewardAmount,
          levelBonus: data.levelBonus,
        });
        setCompletedIds((prev) => [...prev, questId]);
        setCredits((prev) => prev + (data.rewardAmount ?? 0));
        setQuests((prev) =>
          prev.map((q) => q.id === questId ? { ...q, completions: q.completions + 1 } : q)
        );
        loadBundles();
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
      } else if (res.status === 403) {
        setClaimResult({ success: false, message: data.error, fraud: true });
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
    } else if (quest.type === 'secret') {
      setSecretVerifyQuest(quest);
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
  // Bundle-Quests werden hier ausgeschlossen, weil sie innerhalb der BundleCard
  // (Sektion "Quest-Reihen" weiter oben) erscheinen und sonst doppelt auftauchen würden.
  const filteredQuests = (filterCreator
    ? quests.filter((q) => q.creatorWallet.toLowerCase() === filterCreator.toLowerCase())
    : quests
  ).filter((q) => !q.bundleId);
  const youtubeQuests = filteredQuests.filter((q) => q.platform === 'youtube' && !completedIds.includes(q.id));
  const tiktokCommentQuests = filteredQuests.filter((q) => q.platform === 'tiktok' && q.type !== 'engagement' && !completedIds.includes(q.id));
  const tiktokEngagementQuests = filteredQuests.filter((q) => q.platform === 'tiktok' && q.type === 'engagement' && !completedIds.includes(q.id));
  const instagramQuests = filteredQuests.filter((q) => q.platform === 'instagram' && !completedIds.includes(q.id));
  const facebookQuests = filteredQuests.filter((q) => q.platform === 'facebook' && !completedIds.includes(q.id));
  // Bundles ausblenden, wenn alle Quests abgeschlossen UND Bonus bereits eingelöst
  const activeBundles = bundles.filter((b) => !(b.fanAllCompleted && b.fanBonusClaimed));

  return (
    <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
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
        <div className={`rounded-2xl p-4 border ${claimResult.success ? 'bg-green-900/30 border-green-700/40' : claimResult.fraud ? 'bg-red-950/60 border-red-600/60' : 'bg-red-900/30 border-red-700/40'}`}>
          {claimResult.fraud && (
            <p className="text-red-400 font-black text-xs uppercase tracking-widest mb-1">⛔ Einlösen gesperrt</p>
          )}
          <p className={`font-semibold text-sm ${claimResult.success ? 'text-green-300' : 'text-red-300'}`}>
            {claimResult.message}
          </p>
          {claimResult.txHash && (
            <a href={`https://basescan.org/tx/${claimResult.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline mt-1 block">
              Transaktion auf BaseScan ansehen →
            </a>
          )}
          {!claimResult.fraud && (
            <button onClick={() => setClaimResult(null)} className="text-zinc-500 text-xs mt-2 hover:text-zinc-300">Schließen</button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Verfügbare Quests</h2>
        <button onClick={() => { loadQuests(); loadBundles(); }} className="text-zinc-400 hover:text-white p-2 transition-colors">
          <FaSync size={14} className={(loading || bundlesLoading) ? 'animate-spin' : ''} />
        </button>
      </div>

      {(loading || bundlesLoading) ? (
        <div className="flex justify-center py-12">
          <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-10 h-10 animate-spin" />
        </div>
      ) : activeBundles.length === 0 && youtubeQuests.length === 0 && tiktokCommentQuests.length === 0 && tiktokEngagementQuests.length === 0 && instagramQuests.length === 0 && facebookQuests.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FaTrophy size={32} className="mx-auto mb-3 opacity-30" />
          <p>Alle Quests erledigt oder noch keine verfügbar.</p>
          <p className="text-sm mt-1">Schau später wieder rein!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quest-Reihen (Bundles) zuerst */}
          {activeBundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              fanWallet={walletAddress}
              verified={verified}
              levelBonusPercent={getBonusPercent(bundle.creatorWallet)}
              onBonusClaimed={(bonusAmount, bundleTitle) => { 
                // Sofort aus der Liste entfernen (kein Flackern bis loadBundles fertig ist)
                setBundles((prev) => prev.filter((b) => b.id !== bundle.id));
                loadBundles(); 
                loadQuests(); 
                setCelebration({ amount: bonusAmount, questTitle: `🎁 ${bundleTitle} - Bonus`, reputationReward: 0, levelBonus: 0 });
              }}
              renderQuestCard={(quest) => {
                const isCompleted = completedIds.includes(quest.id);
                if (quest.platform === 'youtube') {
                  return <YoutubeQuestCard quest={quest} isCompleted={isCompleted} isVerified={verified.youtube} onComplete={handleVerify} rewardTokenName={tokenName} levelBonusPercent={getBonusPercent(quest.creatorWallet)} />;
                }
                if (quest.platform === 'tiktok') {
                  return quest.type === 'engagement'
                    ? <TiktokEngagementQuestCard quest={quest} isCompleted={isCompleted} isVerified={verified.tiktok} onComplete={handleTikTokVerify} rewardTokenName={tokenName} levelBonusPercent={getBonusPercent(quest.creatorWallet)} />
                    : <TiktokQuestCard quest={quest} isCompleted={isCompleted} isVerified={verified.tiktok} onComplete={handleTikTokVerify} rewardTokenName={tokenName} levelBonusPercent={getBonusPercent(quest.creatorWallet)} />;
                }
                if (quest.platform === 'instagram') {
                  return <InstagramQuestCard quest={quest} isCompleted={isCompleted} isVerified={verified.instagram} onComplete={handleInstagramVerify} rewardTokenName={tokenName} levelBonusPercent={getBonusPercent(quest.creatorWallet)} />;
                }
                if (quest.platform === 'facebook') {
                  return <FacebookQuestCard quest={quest} isCompleted={isCompleted} isVerified={verified.facebook} onComplete={handleFacebookVerify} rewardTokenName={tokenName} levelBonusPercent={getBonusPercent(quest.creatorWallet)} />;
                }
                return null;
              }}
              onOpenQuest={(quest) => {
                if (quest.platform === 'instagram' && (quest.type as string) === 'dm_share') {
                  setInstagramDmShareQuest(quest);
                } else if (quest.platform === 'instagram') {
                  if (quest.type === 'secret') {
                    setSecretVerifyQuest(quest);
                  } else if (quest.type === 'like' || quest.type === 'save' || (quest.type as string) === 'engagement' || (quest.type as string) === 'repost') {
                    setInstagramLikeQuest(quest);
                  } else {
                    setInstagramCommentQuest(quest);
                  }
                } else if (quest.platform === 'youtube') {
                  if (quest.type === 'like') setLikeVerifyQuest(quest);
                  else if (quest.type === 'secret') setSecretVerifyQuest(quest);
                  else setVerifyingQuest(quest);
                } else if (quest.platform === 'tiktok') {
                  if (quest.type === 'engagement') setTiktokEngagementQuest(quest);
                  else if (quest.type === 'like') setTiktokLikeQuest(quest);
                  else if (quest.type === 'save') setTiktokSaveQuest(quest);
                  else if (quest.type === 'share') setTiktokShareQuest(quest);
                  else if (quest.type === 'secret') setSecretVerifyQuest(quest);
                  else setVerifyingQuest(quest);
                } else if (quest.platform === 'facebook') {
                  if (quest.type === 'like') setFacebookLikeQuest(quest);
                  else if (quest.type === 'secret') setSecretVerifyQuest(quest);
                  else setFacebookCommentQuest(quest);
                }
              }}
            />
          ))}

          {/* Einzelne Quest-Karten nach den Bundles */}
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
                      isVerified={verified.youtube}
                      onComplete={handleVerify}
                      rewardTokenName={tokenName}
                      levelBonusPercent={getBonusPercent(quest.creatorWallet)}
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
                      isVerified={verified.tiktok}
                      onComplete={handleTikTokVerify}
                      rewardTokenName={tokenName}
                      levelBonusPercent={getBonusPercent(quest.creatorWallet)}
                    />
                  ))}
                  {tiktokEngagementQuests.map((quest) => (
                    <TiktokEngagementQuestCard
                      key={quest.id}
                      quest={quest}
                      isCompleted={completedIds.includes(quest.id)}
                      isVerified={verified.tiktok}
                      onComplete={handleTikTokVerify}
                      rewardTokenName={tokenName}
                      levelBonusPercent={getBonusPercent(quest.creatorWallet)}
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
                      isVerified={verified.instagram}
                      onComplete={handleInstagramVerify}
                      rewardTokenName={tokenName}
                      levelBonusPercent={getBonusPercent(quest.creatorWallet)}
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
                      isVerified={verified.facebook}
                      onComplete={handleFacebookVerify}
                      rewardTokenName={tokenName}
                      levelBonusPercent={getBonusPercent(quest.creatorWallet)}
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
        levelBonusPercent={verifyingQuest ? getBonusPercent(verifyingQuest.creatorWallet) : 0}
        onVerify={verifyingQuest?.platform === 'tiktok' ? handleVerifyTikTokComment : handleVerifyYoutubeComment}
        onClose={() => {
          if (verifyResult?.success && verifyingQuest) {
            pendingCelebration.current = { amount: verifyResult.rewardAmount ?? 0, questTitle: verifyingQuest.videoTitle, reputationReward: verifyingQuest.reputationReward, levelBonus: verifyResult.levelBonus };
            loadBundles();
          }
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setVerifyingQuest(null); setVerifyResult(null);
        }}
      />

      {/* Verifizierungs-Modal (Like) */}
      <LikeVerifyModal
        quest={likeVerifyQuest}
        walletAddress={walletAddress}
        levelBonusPercent={likeVerifyQuest ? getBonusPercent(likeVerifyQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (likeVerifyQuest) {
            setCompletedIds((prev) => [...prev, likeVerifyQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === likeVerifyQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: likeVerifyQuest.videoTitle, reputationReward: likeVerifyQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setLikeVerifyQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (Secret) */}
      <SecretVerifyModal
        quest={secretVerifyQuest}
        walletAddress={walletAddress}
        levelBonusPercent={secretVerifyQuest ? getBonusPercent(secretVerifyQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (secretVerifyQuest) {
            setCompletedIds((prev) => [...prev, secretVerifyQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === secretVerifyQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: secretVerifyQuest.videoTitle, reputationReward: secretVerifyQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setSecretVerifyQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (TikTok Engagement) */}
      <TiktokEngagementVerifyModal
        quest={tiktokEngagementQuest}
        walletAddress={walletAddress}
        levelBonusPercent={tiktokEngagementQuest ? getBonusPercent(tiktokEngagementQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (tiktokEngagementQuest) {
            setCompletedIds((prev) => [...prev, tiktokEngagementQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === tiktokEngagementQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: tiktokEngagementQuest.videoTitle, reputationReward: tiktokEngagementQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setTiktokEngagementQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (TikTok Like) */}
      <TiktokEngagementVerifyModal
        quest={tiktokLikeQuest}
        walletAddress={walletAddress}
        singleAction="like"
        levelBonusPercent={tiktokLikeQuest ? getBonusPercent(tiktokLikeQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (tiktokLikeQuest) {
            setCompletedIds((prev) => [...prev, tiktokLikeQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === tiktokLikeQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: tiktokLikeQuest.videoTitle, reputationReward: tiktokLikeQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setTiktokLikeQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (TikTok Save) */}
      <TiktokEngagementVerifyModal
        quest={tiktokSaveQuest}
        walletAddress={walletAddress}
        singleAction="save"
        levelBonusPercent={tiktokSaveQuest ? getBonusPercent(tiktokSaveQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (tiktokSaveQuest) {
            setCompletedIds((prev) => [...prev, tiktokSaveQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === tiktokSaveQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: tiktokSaveQuest.videoTitle, reputationReward: tiktokSaveQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setTiktokSaveQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (TikTok Share) */}
      <TiktokShareVerifyModal
        quest={tiktokShareQuest}
        walletAddress={walletAddress}
        levelBonusPercent={tiktokShareQuest ? getBonusPercent(tiktokShareQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (tiktokShareQuest) {
            setCompletedIds((prev) => [...prev, tiktokShareQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === tiktokShareQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: tiktokShareQuest.videoTitle, reputationReward: tiktokShareQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setTiktokShareQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (Instagram Like / Save) */}
      <InstagramLikeVerifyModal
        quest={instagramLikeQuest}
        walletAddress={walletAddress}
        levelBonusPercent={instagramLikeQuest ? getBonusPercent(instagramLikeQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (instagramLikeQuest) {
            setCompletedIds((prev) => [...prev, instagramLikeQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === instagramLikeQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: instagramLikeQuest.videoTitle, reputationReward: instagramLikeQuest.reputationReward, levelBonus };
            loadBundles();
          }
          // Modal NICHT schließen – onClose schließt nach dem Erfolgs-Screen
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setInstagramLikeQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (Instagram Kommentar) */}
      <InstagramCommentVerifyModal
        quest={instagramCommentQuest}
        walletAddress={walletAddress}
        levelBonusPercent={instagramCommentQuest ? getBonusPercent(instagramCommentQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (instagramCommentQuest) {
            setCompletedIds((prev) => [...prev, instagramCommentQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === instagramCommentQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: instagramCommentQuest.videoTitle, reputationReward: instagramCommentQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setInstagramCommentQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (Facebook Kommentar) */}
      <FacebookCommentVerifyModal
        quest={facebookCommentQuest}
        walletAddress={walletAddress}
        levelBonusPercent={facebookCommentQuest ? getBonusPercent(facebookCommentQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (facebookCommentQuest) {
            setCompletedIds((prev) => [...prev, facebookCommentQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === facebookCommentQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: facebookCommentQuest.videoTitle, reputationReward: facebookCommentQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setFacebookCommentQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (Facebook Like) */}
      <FacebookLikeVerifyModal
        quest={facebookLikeQuest}
        walletAddress={walletAddress}
        levelBonusPercent={facebookLikeQuest ? getBonusPercent(facebookLikeQuest.creatorWallet) : 0}
        onCompleted={(amount, levelBonus) => {
          if (facebookLikeQuest) {
            setCompletedIds((prev) => [...prev, facebookLikeQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === facebookLikeQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: facebookLikeQuest.videoTitle, reputationReward: facebookLikeQuest.reputationReward, levelBonus };
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setFacebookLikeQuest(null);
        }}
      />

      {/* Verifizierungs-Modal (Instagram DM-Share) */}
      <InstagramDmShareModal
        quest={instagramDmShareQuest}
        walletAddress={walletAddress}
        levelBonusPercent={instagramDmShareQuest ? getBonusPercent(instagramDmShareQuest.creatorWallet) : 0}
        storyClaimToken={instagramDmShareToken ?? undefined}
        onCompleted={(amount, levelBonus) => {
          if (instagramDmShareQuest) {
            setCompletedIds((prev) => [...prev, instagramDmShareQuest.id]);
            setCredits((prev) => prev + amount);
            setQuests((prev) =>
              prev.map((q) => q.id === instagramDmShareQuest.id ? { ...q, completions: q.completions + 1 } : q)
            );
            pendingCelebration.current = { amount, questTitle: instagramDmShareQuest.videoTitle, reputationReward: instagramDmShareQuest.reputationReward, levelBonus };
            // Falls Bundle-Quest → Bundle-Liste aktualisieren
            loadBundles();
          }
        }}
        onClose={() => {
          if (pendingCelebration.current) { setCelebration(pendingCelebration.current); pendingCelebration.current = null; }
          setInstagramDmShareQuest(null); setInstagramDmShareToken(null);
        }}
      />

      {/* ── Quest-Abschluss-Celebration ───────────────────────────────────── */}
      {celebration && (
        <div
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setCelebration(null)}
        >
          <style>{`
            @keyframes questCelebFlyUp {
              0%   { transform: translateY(0) scale(1); opacity: 1; }
              100% { transform: translateY(-180px) scale(0.3); opacity: 0; }
            }
            @keyframes questCelebPop {
              0%   { transform: scale(0.3); opacity: 0; }
              60%  { transform: scale(1.15); opacity: 1; }
              100% { transform: scale(1); }
            }
            @keyframes questCelebGlow {
              0%, 100% { text-shadow: 0 0 20px #f59e0b, 0 0 40px #f59e0b; }
              50%       { text-shadow: 0 0 40px #fbbf24, 0 0 80px #fbbf24, 0 0 120px #fde68a; }
            }
            .quest-celeb-particle {
              position: absolute;
              animation: questCelebFlyUp 1.4s ease-out forwards;
              font-size: 1.3rem;
            }
          `}</style>
          {['⭐','✨','🎵','💫','🌟','✨','⭐','🎶','💫','✨'].map((s, i) => (
            <span
              key={i}
              className="quest-celeb-particle"
              style={{
                left: `${10 + i * 9}%`,
                bottom: `${20 + (i % 3) * 15}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${1.2 + (i % 4) * 0.2}s`,
              }}
            >{s}</span>
          ))}
          <div
            className="relative bg-zinc-900 border border-amber-500/40 rounded-3xl p-8 mx-6 text-center shadow-2xl max-w-sm w-full"
            style={{ animation: 'questCelebPop 0.5s ease-out forwards' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-5xl mb-3">🎉</p>
            <p
              className="text-amber-300 font-black text-5xl mb-1"
              style={{ animation: 'questCelebPop 0.6s ease-out forwards, questCelebGlow 2s ease-in-out infinite' }}
            >
              +{formatCredits(celebration.amount)}
            </p>
            <p className="text-amber-400 font-bold text-lg mb-3">D.FAITH Credits</p>
            {(celebration.reputationReward ?? 0) > 0 && (
              <p className="text-purple-300 font-semibold text-sm mb-2 flex items-center justify-center gap-1">
                <FaStar size={12} /> +{celebration.reputationReward} Reputation
              </p>
            )}
            {(celebration.levelBonus ?? 0) > 0 && (
              <p className="text-green-400 font-semibold text-sm mb-3 flex items-center justify-center gap-1">
                ⚡ +{celebration.levelBonus} Level-Bonus enthalten!
              </p>
            )}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-6">
              <p className="text-zinc-400 text-xs mb-0.5">Quest abgeschlossen</p>
              <p className="text-white text-sm font-semibold line-clamp-2">{celebration.questTitle}</p>
            </div>
            <button
              onClick={() => setCelebration(null)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-2xl transition-colors text-sm"
            >
              Awesome! 🎊
            </button>
          </div>
        </div>
      )}
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
