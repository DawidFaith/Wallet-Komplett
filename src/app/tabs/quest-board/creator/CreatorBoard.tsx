'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FaPlus, FaSync, FaTrophy, FaExternalLinkAlt, FaTimes, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaCopy, FaCheck, FaLink, FaLayerGroup } from 'react-icons/fa';
import CreditsBox from '../components/CreditsBox';
import DepositModal from './DepositModal';
import CreateBundleModal from './CreateBundleModal';
import CreateStreamingQuestModal from './CreateStreamingQuestModal';
import StreamingQuestManageCard from './StreamingQuestManageCard';
import type { StreamingQuest } from '../fan/StreamingQuestCard';
import type { QuestIndexEntry, YouTubeBinding, VerifiedPlatforms, Platform, QuestType } from '../types';
import type { QuestBundleWithItems } from '../../../lib/questDb';
import { useLang } from '../../../components/LangContext';
import { t, tFmt } from '../../../utils/i18n';
import { getProgressPercent, formatCredits } from '../utils';

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube:   <FaYoutube   className="text-red-500"  size={13} />,
  instagram: <FaInstagram className="text-pink-500" size={13} />,
  tiktok:    <FaTiktok    className="text-white"    size={12} />,
  facebook:  <FaFacebook  className="text-blue-500" size={13} />,
};

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
};

const TYPE_LABELS: Record<QuestType, string> = {
  comment:    'comment',
  like:       'like',
  save:       'save',
  secret:     'secret',
  engagement: 'engagement',
  repost:     'repost',
  dm_share:   'dm_share',
  share:      'share',
};

interface CreatorBoardProps {
  walletAddress: string;
  binding: YouTubeBinding | null;
  verified: VerifiedPlatforms;
  /** Eigener Token-Name des Artists */
  rewardToken?: string | null;
}

export default function CreatorBoard({ walletAddress, binding: _binding, verified, rewardToken }: CreatorBoardProps) {
  const lang = useLang();
  const tokenName = rewardToken ?? 'D.FAITH';
  const [quests, setQuests] = useState<QuestIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundles, setBundles] = useState<QuestBundleWithItems[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [confirmCancelBundleId, setConfirmCancelBundleId] = useState<string | null>(null);
  const [cancellingBundleId, setCancellingBundleId] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [creatorBalance, setCreatorBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Streaming Quests
  const [streamingQuests, setStreamingQuests]       = useState<StreamingQuest[]>([]);
  const [streamingLoading, setStreamingLoading]     = useState(false);
  const [showStreamingModal, setShowStreamingModal] = useState(false);

  const loadCreatorBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch(
        `/api/youtube-quests/creator-balance?wallet=${walletAddress}&t=${Date.now()}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      setCreatorBalance(data.balance ?? 0);
    } catch { /* ignorieren */ }
    finally { setBalanceLoading(false); }
  }, [walletAddress]);

  const loadCreatorQuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube-quests/quests');
      const data = await res.json();
      const mine = (data.quests ?? []).filter(
        (q: QuestIndexEntry) => q.creatorWallet === walletAddress.toLowerCase() && !q.bundleId
      );
      setQuests(mine);
    } catch { /* ignorieren */ }
    finally { setLoading(false); }
  }, [walletAddress]);

  const loadCreatorBundles = useCallback(async () => {
    setBundlesLoading(true);
    try {
      const res  = await fetch(`/api/quest-bundles?wallet=${walletAddress}&creator=${walletAddress}`);
      const data = await res.json() as { bundles?: QuestBundleWithItems[] };
      setBundles(data.bundles ?? []);
    } catch { /* ignorieren */ }
    finally { setBundlesLoading(false); }
  }, [walletAddress]);

  const loadStreamingQuests = useCallback(async () => {
    setStreamingLoading(true);
    try {
      const res  = await fetch(`/api/streaming-quests?creatorWallet=${walletAddress}`, { cache: 'no-store' });
      const data = await res.json() as { quests?: StreamingQuest[] };
      setStreamingQuests(data.quests ?? []);
    } catch { /* ignorieren */ }
    finally { setStreamingLoading(false); }
  }, [walletAddress]);

  const handleCancelBundle = useCallback(async (bundleId: string) => {
    setCancellingBundleId(bundleId);
    setConfirmCancelBundleId(null);
    try {
      const res = await fetch(`/api/quest-bundles/${bundleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorWallet: walletAddress }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? t('cb.cancelError', lang)); return; }
      await Promise.all([loadCreatorBalance(), loadCreatorBundles()]);
    } catch { alert(t('cb.networkError', lang)); }
    finally { setCancellingBundleId(null); }
  }, [walletAddress, loadCreatorBalance, loadCreatorBundles]);

  const handleCancel = useCallback(async (questId: string) => {
    setCancellingId(questId);
    setConfirmCancelId(null);
    try {
      const res = await fetch(`/api/youtube-quests/quests/${questId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorWallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? t('cb.cancelError', lang));
        return;
      }
      await loadCreatorBalance();
      await loadCreatorQuests();
    } catch {
      alert(t('cb.networkErrorCancel', lang));
    } finally {
      setCancellingId(null);
    }
  }, [walletAddress, loadCreatorBalance, loadCreatorQuests]);

  useEffect(() => {
    // Erst abgelaufene Quests erstatten, dann Balance + Quests laden
    fetch('/api/youtube-quests/refund-expired', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorWallet: walletAddress }),
    }).finally(() => {
      loadCreatorQuests();
      loadCreatorBalance();
      loadCreatorBundles();
      loadStreamingQuests();
    });
  }, [loadCreatorQuests, loadCreatorBalance, loadCreatorBundles, loadStreamingQuests, walletAddress]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
      {/* Credits Box */}
      <CreditsBox
        balance={creatorBalance}
        tokenName={tokenName}
        subtitle={creatorBalance > 0 ? t('cb.available', lang) : tFmt('cb.topUp', lang, { token: tokenName })}
        secondaryLabel={t('cb.topUpBtn', lang)}
        onSecondary={() => setShowDeposit(true)}
        onRefresh={loadCreatorBalance}
        refreshLoading={balanceLoading}
      />

      {/* Header + Buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">{t('cb.myQuests', lang)}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBundleModal(true)}
            className="bg-purple-700 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm"
          >
            <FaPlus size={12} /> {t('creator.createQuest', lang)}
          </button>
        </div>
      </div>

      {/* Quest-Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="border-4 border-amber-500/30 border-t-amber-500 rounded-full w-10 h-10 animate-spin" />
        </div>
      ) : quests.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1710] rounded-2xl border border-white/[0.08] text-zinc-500">
          <FaPlus size={32} className="mx-auto mb-3 opacity-30" />
          <p>{t('cb.noQuests', lang)}</p>
          <p className="text-sm mt-1">{t('cb.noQuestsHint', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quests.map((quest) => (
            <div key={quest.id} className="bg-[#1a1710] rounded-2xl border border-white/[0.08] p-4 flex gap-4 items-start">
              <div className="relative w-24 h-16 shrink-0 rounded-xl overflow-hidden">
                <Image src={quest.videoThumbnail} alt={quest.videoTitle} fill unoptimized className="object-cover" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1 bg-[#231e12] rounded-lg px-2 py-0.5 text-xs font-medium">
                    {PLATFORM_ICONS[quest.platform]}
                    <span className="text-zinc-300">{PLATFORM_LABELS[quest.platform]}</span>
                  </span>
                  <span className="bg-[#231e12] rounded-lg px-2 py-0.5 text-xs text-zinc-400 font-medium">
                    {TYPE_LABELS[quest.type] ?? quest.type}
                  </span>
                </div>
                <p className="text-white text-sm font-semibold line-clamp-2">{quest.videoTitle}</p>
                <a href={quest.videoUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 text-xs flex items-center gap-1 hover:underline">
                  <FaExternalLinkAlt size={10} /> {lang === 'en' ? 'Open' : lang === 'pl' ? 'Otwórz' : 'Öffnen'}
                </a>
                {/* Story-Link für dm_share Quests */}
                {(quest.type as string) === 'dm_share' && quest.storyToken && (
                  <StoryLinkRow token={quest.storyToken} />
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Image src="/D.FAITH.png" alt={tokenName} width={12} height={12} className="w-3 h-3 object-contain" />
                    {formatCredits(quest.rewardAmount)} {tokenName}
                  </span>
                  <span className="flex items-center gap-1"><FaTrophy size={10} className="text-green-400" />{quest.completions}/{quest.maxCompletions}</span>
                </div>
                <div className="h-1.5 bg-[#231e12] rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full"
                    style={{ width: `${getProgressPercent(quest.completions, quest.maxCompletions)}%` }}
                  />
                </div>
                {/* Cancel */}
                {confirmCancelId === quest.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleCancel(quest.id)}
                      disabled={cancellingId === quest.id}
                      className="text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                    >
                      {cancellingId === quest.id ? '…' : (lang === 'en' ? 'Yes, cancel' : lang === 'pl' ? 'Tak, anuluj' : 'Ja, stornieren')}
                    </button>
                    <button
                      onClick={() => setConfirmCancelId(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg transition-colors"
                    >
                      {t('btn.cancel', lang)}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCancelId(quest.id)}
                    disabled={cancellingId === quest.id}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-amber-400 disabled:opacity-50 transition-colors pt-1"
                  >
                    <FaTimes size={10} /> {lang === 'en' ? 'Cancel quest' : lang === 'pl' ? 'Anuluj quest' : 'Stornieren'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bundle-Sektion ──────────────────────────────────────────────── */}
      {(bundles.length > 0 || bundlesLoading) && (
        <div className="space-y-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <FaLayerGroup className="text-purple-400" size={15} />
            {t('cb.myBundles', lang)}
          </h3>
          {bundlesLoading ? (
            <div className="flex justify-center py-6">
              <div className="border-4 border-purple-500/30 border-t-purple-500 rounded-full w-8 h-8 animate-spin" />
            </div>
          ) : (
            bundles.map((bundle) => (
              <div key={bundle.id} className="bg-[#1a1228] rounded-2xl border border-purple-900/40 p-4 space-y-3">
                {/* Bundle Header */}
                <div className="flex gap-3 items-start">
                  {bundle.videoThumbnail && (
                    <div className="relative w-20 h-14 shrink-0 rounded-xl overflow-hidden">
                      <Image src={bundle.videoThumbnail} alt={bundle.videoTitle} fill unoptimized className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-purple-900/50 border border-purple-700/50 rounded-lg px-2 py-0.5 text-xs text-purple-300 font-semibold flex items-center gap-1">
                        <FaLayerGroup size={9} /> Bundle
                      </span>
                      <span className="flex items-center gap-1 bg-[#231e12] rounded-lg px-2 py-0.5 text-xs font-medium">
                        {PLATFORM_ICONS[bundle.platform]}
                        <span className="text-zinc-300">{PLATFORM_LABELS[bundle.platform]}</span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${bundle.isActive ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                        {bundle.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <p className="text-white text-sm font-semibold line-clamp-1">{bundle.videoTitle}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Pool: {bundle.rewardPoolPerFan.toFixed(2)} + {bundle.bundleCompletionBonus.toFixed(2)} Bonus · max {bundle.maxParticipants} Fans
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="grid grid-cols-2 gap-1.5">
                  {bundle.items.map((item) => (
                    <div key={item.questId} className="bg-purple-950/30 rounded-lg px-3 py-1.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-300 text-xs capitalize">{item.questType}</span>
                        <span className="flex items-center gap-1.5">
                          {item.reputationReward > 0 && (
                            <span className="text-amber-400 text-[10px]">+{item.reputationReward} REP</span>
                          )}
                          <span className="text-purple-300 text-xs font-mono">{item.rewardAmount.toFixed(2)}</span>
                        </span>
                      </div>
                      {item.questType === 'dm_share' && item.storyToken && (
                        <StoryLinkRow token={item.storyToken} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Stornieren */}
                {bundle.isActive && (
                  confirmCancelBundleId === bundle.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCancelBundle(bundle.id)}
                        disabled={cancellingBundleId === bundle.id}
                        className="text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                      >
                        {cancellingBundleId === bundle.id ? '…' : (lang === 'en' ? 'Yes, cancel' : lang === 'pl' ? 'Tak, anuluj' : 'Ja, stornieren')}
                      </button>
                      <button onClick={() => setConfirmCancelBundleId(null)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg">
                        {t('btn.cancel', lang)}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmCancelBundleId(bundle.id)}
                      className="flex items-center gap-1 text-xs text-zinc-600 hover:text-amber-400 transition-colors"
                    >
                      <FaTimes size={10} /> {lang === 'en' ? 'Cancel bundle' : lang === 'pl' ? 'Anuluj pakiet' : 'Bundle stornieren'}
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Streaming Quests ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            🎵 {t('sq.sectionTitle', lang)}
          </h3>
          <button
            onClick={() => setShowStreamingModal(true)}
            className="bg-purple-800/60 hover:bg-purple-700/60 border border-purple-600/40 text-white font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 text-xs"
          >
            <FaPlus size={10} /> {t('sq.createBtn', lang)}
          </button>
        </div>
        {streamingLoading ? (
          <div className="flex justify-center py-6">
            <div className="border-4 border-purple-500/30 border-t-purple-500 rounded-full w-7 h-7 animate-spin" />
          </div>
        ) : streamingQuests.length === 0 ? (
          <p className="text-sm text-gray-600 py-3 text-center">{t('sq.noQuests', lang)}</p>
        ) : (
          <div className="space-y-3">
            {streamingQuests.map(q => (
              <StreamingQuestManageCard
                key={q.id}
                quest={q as StreamingQuest & { participant_count: number; paid_count?: number }}
                creatorWallet={walletAddress}
                onRefresh={loadStreamingQuests}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateBundleModal
        open={showBundleModal}
        onClose={() => setShowBundleModal(false)}
        walletAddress={walletAddress}
        creatorBalance={creatorBalance}
        verified={verified}
        onCreated={() => { loadCreatorBundles(); loadCreatorBalance(); }}
        onOpenDeposit={() => setShowDeposit(true)}
      />
      <DepositModal
        open={showDeposit}
        onClose={() => setShowDeposit(false)}
        walletAddress={walletAddress}
        onDeposited={(amount) => setCreatorBalance((prev) => prev + amount)}
      />
      {showStreamingModal && (
        <CreateStreamingQuestModal
          creatorWallet={walletAddress}
          onClose={() => setShowStreamingModal(false)}
          onCreated={loadStreamingQuests}
        />
      )}
    </div>
  );
}

// ─── StoryLinkRow ─────────────────────────────────────────────────────────────

function StoryLinkRow({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de';
  const link = `${appUrl}/api/instagram-quests/story-click?token=${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      <FaLink size={9} className="text-pink-400 shrink-0" />
      <span className="text-[10px] text-pink-300 truncate flex-1 font-mono max-w-[160px]" title={link}>
        Story-Link
      </span>
      <button
        onClick={handleCopy}
        title={link}
        className="text-zinc-500 hover:text-white transition-colors shrink-0"
      >
        {copied ? <FaCheck size={10} className="text-green-400" /> : <FaCopy size={10} />}
      </button>
    </div>
  );
}
