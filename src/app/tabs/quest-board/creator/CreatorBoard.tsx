'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FaPlus, FaSync, FaTrophy, FaExternalLinkAlt, FaTimes, FaYoutube, FaInstagram, FaTiktok, FaFacebook } from 'react-icons/fa';
import CreditsBox from '../components/CreditsBox';
import DepositModal from './DepositModal';
import CreateQuestModal from './CreateQuestModal';
import type { QuestIndexEntry, YouTubeBinding, VerifiedPlatforms, Platform, QuestType } from '../types';
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
  comment:    'Kommentar',
  like:       'Like',
  save:       'Speichern',
  secret:     'Geheimcode',
  engagement: 'Engagement',
  repost:     'Repost',
  dm_share:   'Story Quest',
};

interface CreatorBoardProps {
  walletAddress: string;
  binding: YouTubeBinding | null;
  verified: VerifiedPlatforms;
  /** Eigener Token-Name des Artists */
  rewardToken?: string | null;
}

export default function CreatorBoard({ walletAddress, binding: _binding, verified, rewardToken }: CreatorBoardProps) {
  const tokenName = rewardToken ?? 'D.FAITH';
  const [quests, setQuests] = useState<QuestIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [creatorBalance, setCreatorBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
        (q: QuestIndexEntry) => q.creatorWallet === walletAddress.toLowerCase()
      );
      setQuests(mine);
    } catch { /* ignorieren */ }
    finally { setLoading(false); }
  }, [walletAddress]);

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
        alert(data.error ?? 'Fehler beim Stornieren');
        return;
      }
      await loadCreatorBalance();
      await loadCreatorQuests();
    } catch {
      alert('Netzwerkfehler beim Stornieren');
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
    });
  }, [loadCreatorQuests, loadCreatorBalance, walletAddress]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Credits Box */}
      <CreditsBox
        balance={creatorBalance}
        tokenName={tokenName}
        subtitle={creatorBalance > 0 ? `Verfügbar für Quest-Auszahlungen an Fans` : `Lade ${tokenName} auf um Quests zu finanzieren`}
        secondaryLabel="Aufladen"
        onSecondary={() => setShowDeposit(true)}
        onRefresh={loadCreatorBalance}
        refreshLoading={balanceLoading}
      />

      {/* Header + Quest erstellen */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Meine Quests</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm"
        >
          <FaPlus size={12} /> Quest erstellen
        </button>
      </div>

      {/* Quest-Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-10 h-10 animate-spin" />
        </div>
      ) : quests.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1710] rounded-2xl border border-white/[0.08] text-zinc-500">
          <FaPlus size={32} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine Quests erstellt.</p>
          <p className="text-sm mt-1">Erstelle deinen ersten Quest!</p>
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
                <a href={quest.videoUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 text-xs flex items-center gap-1 hover:underline">
                  <FaExternalLinkAlt size={10} /> Öffnen
                </a>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Image src="/D.FAITH.png" alt={tokenName} width={12} height={12} className="w-3 h-3 object-contain" />
                    {formatCredits(quest.rewardAmount)} {tokenName}
                  </span>
                  <span className="flex items-center gap-1"><FaTrophy size={10} className="text-green-400" />{quest.completions}/{quest.maxCompletions}</span>
                </div>
                <div className="h-1.5 bg-[#231e12] rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full"
                    style={{ width: `${getProgressPercent(quest.completions, quest.maxCompletions)}%` }}
                  />
                </div>
                {/* Cancel */}
                {confirmCancelId === quest.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleCancel(quest.id)}
                      disabled={cancellingId === quest.id}
                      className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                    >
                      {cancellingId === quest.id ? '…' : 'Ja, stornieren'}
                    </button>
                    <button
                      onClick={() => setConfirmCancelId(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCancelId(quest.id)}
                    disabled={cancellingId === quest.id}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50 transition-colors pt-1"
                  >
                    <FaTimes size={10} /> Stornieren
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateQuestModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        walletAddress={walletAddress}
        creatorBalance={creatorBalance}
        verified={verified}
        onCreated={() => { loadCreatorQuests(); loadCreatorBalance(); }}
        onOpenDeposit={() => setShowDeposit(true)}
      />
      <DepositModal
        open={showDeposit}
        onClose={() => setShowDeposit(false)}
        walletAddress={walletAddress}
        onDeposited={(amount) => setCreatorBalance((prev) => prev + amount)}
      />
    </div>
  );
}
