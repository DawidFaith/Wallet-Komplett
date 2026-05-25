'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FaLayerGroup, FaTimes, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaPlus, FaTrash, FaCheck, FaInfoCircle } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { Platform, QuestType } from '../types';

// ─── Typen ────────────────────────────────────────────────────────────────────
interface BundleItem {
  questType: QuestType;
  reachWeight: number;
}

const DEFAULT_WEIGHTS: Record<QuestType, number> = {
  comment:    3,
  like:       1,
  save:       2,
  repost:     3,
  dm_share:   4,
  engagement: 2,
  secret:     2,
};

const TYPE_LABELS: Record<QuestType, string>       = {
  comment: 'Kommentar', like: 'Like', save: 'Speichern',
  repost: 'Repost', dm_share: 'Story-Share', engagement: 'Engagement', secret: 'Geheimcode',
};

const TYPE_ICONS: Record<QuestType, string> = {
  comment: '💬', like: '❤️', save: '🔖', repost: '🔁', dm_share: '📤', engagement: '🎯', secret: '🔑',
};

const PLATFORM_TYPES: Record<Platform, QuestType[]> = {
  youtube:   ['comment', 'like', 'secret'],
  instagram: ['like', 'comment', 'save', 'repost', 'dm_share'],
  tiktok:    ['engagement', 'comment'],
  facebook:  ['like', 'comment'],
};

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube:   <FaYoutube   className="text-red-500"  size={14} />,
  instagram: <FaInstagram className="text-pink-500" size={14} />,
  tiktok:    <FaTiktok    className="text-white"    size={13} />,
  facebook:  <FaFacebook  className="text-blue-500" size={14} />,
};

interface CreateBundleModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  creatorBalance: number;
  verified: { youtube: boolean; instagram: boolean; tiktok: boolean; facebook: boolean };
  onCreated: () => void;
  onOpenDeposit: () => void;
}

type Step = 1 | 2 | 3;

export default function CreateBundleModal({
  open, onClose, walletAddress, creatorBalance, verified, onCreated, onOpenDeposit,
}: CreateBundleModalProps) {
  const [step, setStep]       = useState<Step>(1);
  const [platform, setPlatform] = useState<Platform>(
    verified.youtube ? 'youtube' : verified.instagram ? 'instagram' : verified.tiktok ? 'tiktok' : verified.facebook ? 'facebook' : 'youtube',
  );
  const [videoUrl, setVideoUrl]       = useState('');
  const [videoTitle, setVideoTitle]   = useState('');
  const [description, setDescription] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metaError, setMetaError]       = useState('');

  const [items, setItems]   = useState<BundleItem[]>([]);
  const [reward, setReward] = useState('10');
  const [bonus, setBonus]   = useState('2');
  const [maxP, setMaxP]     = useState('20');
  const [duration, setDuration] = useState('72');

  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  // Reset beim Öffnen
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setVideoUrl('');
    setVideoTitle('');
    setDescription('');
    setMetaError('');
    setItems([]);
    setReward('10');
    setBonus('2');
    setMaxP('20');
    setDuration('72');
    setError('');
    setSuccess(false);
  }, [open]);

  // Auto-Fetch für YouTube
  const handleFetchMeta = useCallback(async () => {
    if (platform !== 'youtube' || !videoUrl.trim()) {
      setStep(2);
      return;
    }
    setFetchingMeta(true);
    setMetaError('');
    try {
      const res  = await fetch(`/api/youtube-quests/meta?url=${encodeURIComponent(videoUrl)}`);
      const data = await res.json() as { title?: string; error?: string };
      if (!res.ok || !data.title) throw new Error(data.error ?? 'Titel konnte nicht geladen werden');
      setVideoTitle(data.title);
      setStep(2);
    } catch (e) {
      setMetaError((e as Error).message);
    } finally {
      setFetchingMeta(false);
    }
  }, [platform, videoUrl]);

  const toggleType = (qt: QuestType) => {
    setItems((prev) =>
      prev.some((i) => i.questType === qt)
        ? prev.filter((i) => i.questType !== qt)
        : [...prev, { questType: qt, reachWeight: DEFAULT_WEIGHTS[qt] }],
    );
  };

  const updateWeight = (qt: QuestType, weight: number) => {
    setItems((prev) => prev.map((i) => i.questType === qt ? { ...i, reachWeight: weight } : i));
  };

  // Reward-Berechnung
  const rewardNum  = Math.max(0.01, Number(reward)  || 0);
  const bonusNum   = Math.max(0,    Number(bonus)    || 0);
  const maxNum     = Math.max(1,    Number(maxP)     || 10);
  const totalWeight = items.reduce((s, i) => s + i.reachWeight, 0);
  const totalBudget = Math.round((rewardNum * maxNum + bonusNum * maxNum) * 100) / 100;
  const hasEnough   = creatorBalance >= totalBudget;

  const handleCreate = async () => {
    if (!items.length) { setError('Mindestens einen Quest-Typ auswählen'); return; }
    if (!videoUrl.trim()) { setError('URL/Link fehlt'); return; }
    if (platform !== 'youtube' && !videoTitle.trim()) { setError('Titel fehlt'); return; }

    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/quest-bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorWallet:       walletAddress,
          platform,
          videoUrl:            videoUrl.trim(),
          videoTitle:          videoTitle.trim() || undefined,
          description:         description.trim(),
          rewardPoolPerFan:    rewardNum,
          bundleCompletionBonus: bonusNum,
          maxParticipants:     maxNum,
          durationHours:       Number(duration) || undefined,
          items:               items.map((i) => ({ questType: i.questType, reachWeight: i.reachWeight })),
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Unbekannter Fehler');
      setSuccess(true);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  if (success) {
    return (
      <Modal onClose={onClose}>
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mx-auto">
            <FaCheck size={28} className="text-green-400" />
          </div>
          <h2 className="text-white font-bold text-xl">Bundle erstellt! 🎉</h2>
          <p className="text-zinc-400 text-sm">
            Fans sehen jetzt dein Bundle und können alle Aufgaben abschließen, um den Gesamtreward zu verdienen.
          </p>
          <button onClick={onClose} className="w-full bg-green-700 hover:bg-green-600 text-white rounded-xl py-3 font-semibold">
            Fertig
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-5 space-y-5 max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaLayerGroup className="text-purple-400" size={18} />
            <h2 className="text-white font-bold text-lg">Bundle Quest erstellen</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <FaTimes size={18} />
          </button>
        </div>

        {/* Schritt-Anzeige */}
        <div className="flex gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-purple-500' : 'bg-zinc-700'}`} />
          ))}
        </div>

        {/* ── Schritt 1: Plattform + Content ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">Wähle Plattform und gib den Content-Link ein.</p>

            {/* Plattform */}
            <div className="grid grid-cols-4 gap-2">
              {(['youtube', 'instagram', 'tiktok', 'facebook'] as Platform[]).map((p) => (
                <button
                  key={p}
                  disabled={!verified[p]}
                  onClick={() => { setPlatform(p); setItems([]); }}
                  className={`rounded-xl py-3 flex flex-col items-center gap-1 text-[11px] font-semibold border transition-all ${
                    platform === p
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : verified[p]
                        ? 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {PLATFORM_ICONS[p]}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* URL */}
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs">
                {platform === 'youtube' ? 'YouTube Shorts URL' : `${platform.charAt(0).toUpperCase() + platform.slice(1)}-Link / Post-URL`}
              </label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={platform === 'youtube' ? 'https://youtube.com/shorts/...' : 'https://...'}
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500"
              />
            </div>

            {/* Titel (für nicht-YouTube) */}
            {platform !== 'youtube' && (
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs">Titel / Bezeichnung</label>
                <input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="z.B. Mein neuer Song"
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* Beschreibung */}
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs">Beschreibung (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Worum geht es in diesem Bundle?"
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {metaError && <p className="text-red-400 text-sm">{metaError}</p>}

            <button
              onClick={handleFetchMeta}
              disabled={!videoUrl.trim() || fetchingMeta}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
            >
              {fetchingMeta ? 'Lädt...' : 'Weiter →'}
            </button>
          </div>
        )}

        {/* ── Schritt 2: Quest-Typen auswählen + Gewichte ─────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Wähle die Aktionen für dein Bundle. Das <span className="text-purple-400 font-semibold">Reichweiten-Gewicht</span> bestimmt den Anteil am Gesamt-Reward.
            </p>

            {/* Tipp */}
            <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 flex gap-2">
              <FaInfoCircle className="text-blue-400 mt-0.5 shrink-0" size={13} />
              <p className="text-blue-300 text-xs">
                Höheres Gewicht = mehr Algorythmus-Signalstärke = größerer Token-Anteil. Story-Share hat standardmäßig den höchsten Wert.
              </p>
            </div>

            <div className="space-y-2">
              {PLATFORM_TYPES[platform].map((qt) => {
                const selected = items.some((i) => i.questType === qt);
                const item     = items.find((i) => i.questType === qt);
                return (
                  <div
                    key={qt}
                    className={`rounded-xl border p-3 transition-all ${selected ? 'bg-purple-900/20 border-purple-600/50' : 'bg-zinc-800/40 border-zinc-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleType(qt)}
                        className="flex items-center gap-2 text-left"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-purple-600 border-purple-600' : 'border-zinc-600'}`}>
                          {selected && <FaCheck size={10} className="text-white" />}
                        </div>
                        <span className="text-base">{TYPE_ICONS[qt]}</span>
                        <span className="text-white text-sm font-semibold">{TYPE_LABELS[qt]}</span>
                      </button>
                      {selected && item && (
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 text-xs">Gewicht:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((w) => (
                              <button
                                key={w}
                                onClick={() => updateWeight(qt, w)}
                                className={`w-6 h-6 rounded text-xs font-bold transition-all ${item.reachWeight === w ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {selected && item && totalWeight > 0 && (
                      <p className="text-purple-300 text-xs mt-2 ml-7">
                        → {((item.reachWeight / totalWeight) * 100).toFixed(0)}% des Reward-Pools
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-3 font-semibold text-sm">
                ← Zurück
              </button>
              <button
                onClick={() => items.length >= 2 ? setStep(3) : setError('Mindestens 2 Typen auswählen für ein Bundle')}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3 font-semibold text-sm"
              >
                Weiter →
              </button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {/* ── Schritt 3: Reward + Budget ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">Lege den Reward-Pool und die Teilnehmeranzahl fest.</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs">Reward-Pool pro Fan (D.FAITH)</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs">Abschluss-Bonus (D.FAITH)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs">Max. Teilnehmer</label>
                <input
                  type="number" min="1"
                  value={maxP}
                  onChange={(e) => setMaxP(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs">Laufzeit (Stunden, 0 = unbegrenzt)</label>
                <input
                  type="number" min="0"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Aufschlüsselung pro Typ */}
            <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl p-3 space-y-2">
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Reward-Aufschlüsselung pro Fan</p>
              {items.map((item) => {
                const share = totalWeight > 0 ? (item.reachWeight / totalWeight) * rewardNum : 0;
                return (
                  <div key={item.questType} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{TYPE_ICONS[item.questType]} {TYPE_LABELS[item.questType]}</span>
                    <span className="text-purple-300 font-mono">{share.toFixed(2)} D.FAITH</span>
                  </div>
                );
              })}
              {bonusNum > 0 && (
                <div className="flex items-center justify-between text-sm border-t border-zinc-700/50 pt-2 mt-1">
                  <span className="text-yellow-300">🎁 Alles-abschließen Bonus</span>
                  <span className="text-yellow-300 font-mono">+{bonusNum.toFixed(2)} D.FAITH</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm border-t border-zinc-700/50 pt-2">
                <span className="text-white font-semibold">Gesamt pro Fan</span>
                <span className="text-green-400 font-mono font-bold">{(rewardNum + bonusNum).toFixed(2)} D.FAITH</span>
              </div>
            </div>

            {/* Gesamtkosten */}
            <div className={`rounded-xl p-3 border ${hasEnough ? 'bg-green-950/30 border-green-800/40' : 'bg-red-950/30 border-red-800/40'}`}>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 text-sm">Gesamtkosten (Budget sperren)</span>
                <span className={`font-bold font-mono ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                  {totalBudget.toFixed(2)} D.FAITH
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-zinc-500 text-xs">Dein Guthaben</span>
                <span className={`text-xs font-mono ${hasEnough ? 'text-green-500' : 'text-red-400'}`}>
                  {creatorBalance.toFixed(2)} D.FAITH
                </span>
              </div>
              {!hasEnough && (
                <button onClick={onOpenDeposit} className="text-blue-400 text-xs mt-1 hover:underline">
                  Jetzt einzahlen →
                </button>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setError(''); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-3 font-semibold text-sm">
                ← Zurück
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !hasEnough || items.length < 2}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
              >
                {creating ? 'Erstelle Bundle...' : '🎯 Bundle erstellen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
