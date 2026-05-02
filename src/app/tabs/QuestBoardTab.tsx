'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import {
  FaYoutube,
  FaTrophy,
  FaPlus,
  FaCheck,
  FaExternalLinkAlt,
  FaCoins,
  FaUserCheck,
  FaTimes,
  FaSync,
  FaChevronRight,
  FaInfoCircle,
} from 'react-icons/fa';
import Image from 'next/image';
import type { SupportedLanguage } from '../utils/deepLTranslation';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface QuestIndexEntry {
  id: string;
  platform: 'youtube';
  type: 'comment';
  creatorWallet: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  videoUrl: string;
  rewardAmount: number;
  maxCompletions: number;
  completions: number;
  isActive: boolean;
  createdAt: string;
}

interface YouTubeBinding {
  walletAddress: string;
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  verifiedAt: string;
}

type View = 'fan' | 'creator';
type Step = 'loading' | 'not-connected' | 'link-channel' | 'quests' | 'create-quest';

interface QuestBoardTabProps {
  language: SupportedLanguage;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function shortenWallet(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function getProgressPercent(completions: number, max: number) {
  return Math.min(100, Math.round((completions / max) * 100));
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg mx-4 max-h-[88vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-700 sticky top-0 bg-zinc-900 z-10">
          <h3 className="font-bold text-lg text-red-400 truncate pr-4">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 transition-colors">
            <FaTimes size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── YouTube Kanal verknüpfen ─────────────────────────────────────────────────

function LinkChannelView({
  walletAddress,
  onLinked,
}: {
  walletAddress: string;
  onLinked: (binding: YouTubeBinding) => void;
}) {
  const [channelInput, setChannelInput] = useState('');
  const [preview, setPreview] = useState<{
    channelId: string;
    channelName: string;
    channelThumbnail: string;
    verificationCode: string;
  } | null>(null);
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const handlePreview = async () => {
    if (!channelInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/youtube-quests/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, channelInput: channelInput.trim(), action: 'preview' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPreview(data);
      setStep('verify');
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/youtube-quests/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, channelInput: channelInput.trim(), action: 'verify' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onLinked(data.binding);
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.verificationCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FaYoutube size={28} className="text-red-500" />
          <div>
            <h2 className="font-bold text-white text-lg">YouTube Kanal verknüpfen</h2>
            <p className="text-zinc-400 text-sm">Einmalig – keine OAuth erforderlich</p>
          </div>
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 space-y-1">
              <p className="font-semibold text-yellow-400">So funktioniert es:</p>
              <p>1. Gib deinen YouTube-Kanal-Handle ein</p>
              <p>2. Du bekommst einen einzigartigen Code</p>
              <p>3. Füge den Code in deine Kanal-Beschreibung ein</p>
              <p>4. Wir verifizieren – fertig!</p>
            </div>
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="@DeinHandle oder youtube.com/@Handle"
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none placeholder-zinc-500"
              onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handlePreview}
              disabled={loading || !channelInput.trim()}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <FaSync className="animate-spin" /> : <FaChevronRight />}
              {loading ? 'Suche Kanal…' : 'Kanal laden'}
            </button>
          </div>
        )}

        {step === 'verify' && preview && (
          <div className="space-y-4">
            {/* Kanal-Vorschau */}
            <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
              {preview.channelThumbnail && (
                <Image
                  src={preview.channelThumbnail}
                  alt={preview.channelName}
                  width={48}
                  height={48}
                  unoptimized
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-semibold">{preview.channelName}</p>
                <p className="text-zinc-400 text-xs">{preview.channelId}</p>
              </div>
            </div>

            {/* Verifikationscode */}
            <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
              <p className="text-yellow-400 font-semibold text-sm">Dein Verifikationscode:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-900 text-yellow-300 font-mono text-sm px-3 py-2 rounded-lg border border-zinc-700 select-all">
                  {preview.verificationCode}
                </code>
                <button
                  onClick={copyCode}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg transition-colors text-sm shrink-0"
                >
                  {codeCopied ? <FaCheck className="text-green-400" /> : 'Kopieren'}
                </button>
              </div>
              <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                <li>Öffne <a href={`https://studio.youtube.com/channel/${preview.channelId}/editing/details`} target="_blank" rel="noopener noreferrer" className="text-red-400 underline">YouTube Studio → Kanal-Beschreibung</a></li>
                <li>Füge den Code an beliebiger Stelle ein</li>
                <li>Klicke &quot;Speichern&quot; in YouTube Studio</li>
                <li>Komm zurück und klicke &quot;Verifizieren&quot;</li>
              </ol>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('input'); setError(''); setPreview(null); }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 rounded-xl transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <FaSync className="animate-spin" /> : <FaUserCheck />}
                {loading ? 'Verifiziere…' : 'Verifizieren'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quest Karte (Fan-View) ───────────────────────────────────────────────────

function QuestCard({
  quest,
  isCompleted,
  onComplete,
}: {
  quest: QuestIndexEntry;
  isCompleted: boolean;
  onComplete: (questId: string) => void;
}) {
  const progress = getProgressPercent(quest.completions, quest.maxCompletions);
  const isFull = quest.completions >= quest.maxCompletions;

  return (
    <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden transition-all ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      <div className="relative h-40">
        <Image
          src={quest.videoThumbnail}
          alt={quest.videoTitle}
          fill
          unoptimized
          className="object-cover"
        />
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <FaYoutube size={10} /> Shorts
        </div>
        <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <FaCoins size={10} /> {quest.rewardAmount} DFAITH
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{quest.videoTitle}</h3>

        {/* Fortschrittsbalken */}
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>{quest.completions} / {quest.maxCompletions} abgeschlossen</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-zinc-400 text-xs">
          Aufgabe: <span className="text-zinc-300">Kommentiere unter dem Short</span>
        </p>

        <div className="flex gap-2">
          {/* Zum Short */}
          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FaExternalLinkAlt size={12} /> Zum Short
          </a>

          {/* Quest abschließen */}
          {isCompleted ? (
            <button
              disabled
              className="flex-1 bg-green-900/40 text-green-400 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-default border border-green-700/30"
            >
              <FaCheck size={12} /> Erledigt
            </button>
          ) : isFull ? (
            <button
              disabled
              className="flex-1 bg-zinc-800 text-zinc-500 text-sm font-semibold py-2.5 rounded-xl cursor-default"
            >
              Voll
            </button>
          ) : (
            <button
              onClick={() => onComplete(quest.id)}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FaTrophy size={12} /> Verifizieren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fan Board ────────────────────────────────────────────────────────────────

function FanBoard({
  walletAddress,
  binding,
}: {
  walletAddress: string;
  binding: YouTubeBinding;
}) {
  const [quests, setQuests] = useState<QuestIndexEntry[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Verifizierungs-Modal
  const [verifyingQuestId, setVerifyingQuestId] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    message: string;
    comment?: string;
    rewardAmount?: number;
  } | null>(null);

  const loadQuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube-quests/quests?wallet=${walletAddress}`);
      const data = await res.json();
      setQuests(data.quests ?? []);
      setCompletedIds(data.completedIds ?? []);
    } catch {
      // Fehler beim Laden
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  const handleVerify = async (questId: string) => {
    setVerifyingQuestId(questId);
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
          message: `Quest abgeschlossen! ${data.rewardAmount} DFAITH werden dir gutgeschrieben.`,
          comment: data.comment?.text,
          rewardAmount: data.rewardAmount,
        });
        setCompletedIds((prev) => [...prev, questId]);
        // Zähler im State aktualisieren
        setQuests((prev) =>
          prev.map((q) =>
            q.id === questId ? { ...q, completions: q.completions + 1 } : q
          )
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

  const selectedQuest = quests.find((q) => q.id === verifyingQuestId);

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

      {/* Quest Liste */}
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
      ) : quests.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FaTrophy size={32} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine Quests verfügbar.</p>
          <p className="text-sm mt-1">Schau später wieder rein!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              isCompleted={completedIds.includes(quest.id)}
              onComplete={handleVerify}
            />
          ))}
        </div>
      )}

      {/* Verifizierungs-Modal */}
      <Modal
        open={!!verifyingQuestId}
        onClose={() => { setVerifyingQuestId(null); setVerifyResult(null); }}
        title={verifyResult ? (verifyResult.success ? '🎉 Quest abgeschlossen!' : '❌ Fehler') : `Quest verifizieren`}
      >
        {verifyLoading ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="border-4 border-yellow-500/30 border-t-yellow-500 rounded-full w-12 h-12 animate-spin" />
            <p className="text-zinc-400 text-sm text-center">
              Durchsuche YouTube-Kommentare nach deinem Kanal…
            </p>
          </div>
        ) : verifyResult ? (
          <div className="space-y-4">
            {verifyResult.success ? (
              <>
                <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 space-y-2">
                  <p className="text-green-300 font-semibold">{verifyResult.message}</p>
                  {verifyResult.comment && (
                    <p className="text-zinc-400 text-sm italic">
                      Gefundener Kommentar: &bdquo;{verifyResult.comment}&ldquo;
                    </p>
                  )}
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
                  <FaCoins size={24} className="text-yellow-400" />
                  <div>
                    <p className="text-white font-bold text-lg">{verifyResult.rewardAmount} DFAITH</p>
                    <p className="text-zinc-400 text-xs">Reward vorgemerkt – wird bald ausgezahlt</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
                <p className="text-red-300">{verifyResult.message}</p>
              </div>
            )}
            <button
              onClick={() => { setVerifyingQuestId(null); setVerifyResult(null); }}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
            >
              Schließen
            </button>
          </div>
        ) : selectedQuest ? (
          <div className="space-y-4">
            <div className="bg-zinc-800 rounded-xl p-4 space-y-2">
              <p className="text-white font-semibold text-sm">{selectedQuest.videoTitle}</p>
              <div className="flex items-start gap-2 text-zinc-400 text-sm">
                <FaInfoCircle className="mt-0.5 shrink-0 text-yellow-400" />
                <div>
                  <p>So läuft die Verifizierung ab:</p>
                  <ol className="mt-1 space-y-1 list-decimal list-inside text-xs">
                    <li>Öffne das Short und hinterlasse einen Kommentar</li>
                    <li>Warte ca. 30 Sekunden bis YouTube den Kommentar gespeichert hat</li>
                    <li>Klicke unten auf &quot;Jetzt verifizieren&quot;</li>
                  </ol>
                </div>
              </div>
            </div>
            <a
              href={selectedQuest.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FaExternalLinkAlt size={13} /> Zum Short (kommentieren)
            </a>
            <button
              onClick={() => selectedQuest && handleVerify(selectedQuest.id)}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FaCheck size={13} /> Jetzt verifizieren
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

// ─── Creator Board ────────────────────────────────────────────────────────────

function CreatorBoard({ walletAddress }: { walletAddress: string }) {
  const [quests, setQuests] = useState<QuestIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formular-State
  const [videoUrl, setVideoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [rewardAmount, setRewardAmount] = useState('100');
  const [maxCompletions, setMaxCompletions] = useState('10');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  const loadCreatorQuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube-quests/quests');
      const data = await res.json();
      const mine = (data.quests ?? []).filter(
        (q: QuestIndexEntry) => q.creatorWallet === walletAddress.toLowerCase()
      );
      setQuests(mine);
    } catch {
      // Fehler
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadCreatorQuests(); }, [loadCreatorQuests]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess(false);
    try {
      const res = await fetch('/api/youtube-quests/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorWallet: walletAddress,
          videoUrl: videoUrl.trim(),
          description: description.trim(),
          rewardAmount: Number(rewardAmount),
          maxCompletions: Number(maxCompletions),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error); return; }
      setCreateSuccess(true);
      setVideoUrl(''); setDescription(''); setRewardAmount('100'); setMaxCompletions('10');
      await loadCreatorQuests();
    } catch {
      setCreateError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Meine Quests</h2>
        <button
          onClick={() => { setShowCreateModal(true); setCreateSuccess(false); setCreateError(''); }}
          className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm"
        >
          <FaPlus size={12} /> Quest erstellen
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-10 h-10 animate-spin" />
        </div>
      ) : quests.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-500">
          <FaPlus size={32} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine Quests erstellt.</p>
          <p className="text-sm mt-1">Erstelle deinen ersten Quest!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quests.map((quest) => (
            <div key={quest.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex gap-4 items-start">
              <img
                src={quest.videoThumbnail}
                alt={quest.videoTitle}
                className="w-24 h-16 object-cover rounded-xl shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-white text-sm font-semibold line-clamp-2">{quest.videoTitle}</p>
                <a
                  href={quest.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 text-xs flex items-center gap-1 hover:underline"
                >
                  <FaExternalLinkAlt size={10} /> Shorts öffnen
                </a>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <FaCoins size={10} className="text-yellow-400" />
                    {quest.rewardAmount} DFAITH
                  </span>
                  <span className="flex items-center gap-1">
                    <FaTrophy size={10} className="text-green-400" />
                    {quest.completions}/{quest.maxCompletions}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full"
                    style={{ width: `${getProgressPercent(quest.completions, quest.maxCompletions)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quest-Erstellen-Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Neuen Quest erstellen"
      >
        {createSuccess ? (
          <div className="space-y-4">
            <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
              <FaCheck size={28} className="text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-semibold">Quest erfolgreich erstellt!</p>
              <p className="text-zinc-400 text-sm mt-1">Fans können jetzt deinen Quest sehen und abschließen.</p>
            </div>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
            >
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">
                YouTube Shorts URL <span className="text-red-400">*</span>
              </label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/shorts/VIDEO_ID"
                required
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-500"
              />
              <p className="text-zinc-500 text-xs mt-1">Nur YouTube Shorts sind erlaubt</p>
            </div>

            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">
                Aufgabenbeschreibung für den Fan
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="z.B. Schreibe einen netten Kommentar unter meinen Short!"
                rows={2}
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-300 text-sm font-medium block mb-1.5">
                  Reward (DFAITH)
                </label>
                <input
                  type="number"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  min="1"
                  required
                  className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-zinc-300 text-sm font-medium block mb-1.5">
                  Max. Completions
                </label>
                <input
                  type="number"
                  value={maxCompletions}
                  onChange={(e) => setMaxCompletions(e.target.value)}
                  min="1"
                  max="1000"
                  required
                  className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-3 text-xs text-zinc-400 space-y-1">
              <p className="text-yellow-400 font-semibold">Hinweis:</p>
              <p>Der Reward wird aktuell manuell ausgezahlt. Automatische On-Chain-Auszahlung folgt im nächsten Update.</p>
              <p>Wallet: <span className="text-zinc-300 font-mono">{shortenWallet(walletAddress)}</span></p>
            </div>

            {createError && <p className="text-red-400 text-sm">{createError}</p>}

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {creating ? <FaSync className="animate-spin" /> : <FaPlus />}
              {creating ? 'Erstelle Quest…' : 'Quest veröffentlichen'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ─── Haupt-Tab ────────────────────────────────────────────────────────────────

export default function QuestBoardTab({ language }: QuestBoardTabProps) {
  const account = useActiveAccount();
  const [view, setView] = useState<View>('fan');
  const [binding, setBinding] = useState<YouTubeBinding | null>(null);
  const [bindingLoaded, setBindingLoaded] = useState(false);

  // Binding beim Login laden
  useEffect(() => {
    if (!account?.address) { setBindingLoaded(false); return; }
    fetch(`/api/youtube-quests/verify-channel?wallet=${account.address}`)
      .then((r) => r.json())
      .then((data) => {
        setBinding(data.binding ?? null);
        setBindingLoaded(true);
      })
      .catch(() => setBindingLoaded(true));
  }, [account?.address]);

  if (!account?.address) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-20 text-center px-4">
        <FaTrophy size={48} className="text-yellow-400 mb-4 opacity-80" />
        <h2 className="text-white text-xl font-bold mb-2">Quest Board</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verbinde deine Wallet, um Quests abzuschließen und DFAITH Tokens zu verdienen.
        </p>
      </div>
    );
  }

  if (!bindingLoaded) {
    return (
      <div className="flex justify-center py-20">
        <div className="border-4 border-red-500/30 border-t-red-500 rounded-full w-12 h-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-12">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FaTrophy size={24} className="text-yellow-400" />
            <h1 className="text-white font-bold text-xl">Quest Board</h1>
          </div>
          {/* Fan / Creator Switch */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setView('fan')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                view === 'fan' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Fan
            </button>
            <button
              onClick={() => setView('creator')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                view === 'creator' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Creator
            </button>
          </div>
        </div>
      </div>

      {/* Inhalt */}
      {view === 'fan' ? (
        binding ? (
          <FanBoard walletAddress={account.address} binding={binding} />
        ) : (
          <LinkChannelView
            walletAddress={account.address}
            onLinked={(b) => setBinding(b)}
          />
        )
      ) : (
        <CreatorBoard walletAddress={account.address} />
      )}
    </div>
  );
}
