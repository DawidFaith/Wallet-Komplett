'use client';

import React, { useState } from 'react';
import { FaTimes, FaMusic, FaSpotify } from 'react-icons/fa';
import { t } from '../../../utils/i18n';
import { useLang } from '../../../components/LangContext';

const PLATFORMS = [
  { value: 'spotify',       label: 'Spotify' },
  { value: 'apple_music',   label: 'Apple Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'amazon_music',  label: 'Amazon Music' },
  { value: 'deezer',        label: 'Deezer' },
  { value: 'tidal',         label: 'Tidal' },
  { value: 'other',         label: 'Andere' },
] as const;

interface Props {
  creatorWallet: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateStreamingQuestModal({ creatorWallet, onClose, onCreated }: Props) {
  const lang = useLang();

  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [platform, setPlatform]           = useState<string>('spotify');
  const [targetStreams, setTargetStreams]  = useState(10000);
  const [rewardPerPart, setRewardPerPart] = useState(100);
  const [maxPart, setMaxPart]             = useState(50);
  const [repReward, setRepReward]         = useState(0);
  const [enrollHours, setEnrollHours]     = useState(48);
  const [deadlineHours, setDeadlineHours] = useState(240);

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const totalBudget = rewardPerPart * maxPart;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError(t('sq.errorTitle', lang)); return; }
    if (deadlineHours <= enrollHours) {
      setError(t('sq.errorDeadline', lang));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/streaming-quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorWallet,
          title: title.trim(),
          description: description.trim() || undefined,
          platform,
          targetStreams,
          rewardPerParticipant: rewardPerPart,
          maxParticipants: maxPart,
          reputationReward: repReward,
          enrollmentHours: enrollHours,
          deadlineHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">
            {t('sq.createTitle', lang)}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Titel */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.labelTitle', lang)}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('sq.placeholderTitle', lang)}
              maxLength={100}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.labelDesc', lang)}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={t('sq.placeholderDesc', lang)}
              maxLength={300}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Plattform */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.labelPlatform', lang)}</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Stream-Ziel */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.labelTarget', lang)}</label>
            <input
              type="number"
              value={targetStreams}
              onChange={e => setTargetStreams(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Belohnungen */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelRewardPer', lang)}</label>
              <input
                type="number"
                value={rewardPerPart}
                onChange={e => setRewardPerPart(Math.max(0, parseFloat(e.target.value) || 0))}
                min={0}
                step={10}
                className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelMaxPart', lang)}</label>
              <input
                type="number"
                value={maxPart}
                onChange={e => setMaxPart(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* REP-Bonus */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('sq.labelRepReward', lang)}</label>
            <input
              type="number"
              value={repReward}
              onChange={e => setRepReward(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              step={5}
              className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Zeitfenster */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelEnrollHours', lang)}</label>
              <input
                type="number"
                value={enrollHours}
                onChange={e => setEnrollHours(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={168}
                className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('sq.hintEnrollHours', lang)}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelDeadlineHours', lang)}</label>
              <input
                type="number"
                value={deadlineHours}
                onChange={e => setDeadlineHours(Math.max(enrollHours + 1, parseInt(e.target.value) || enrollHours + 1))}
                min={enrollHours + 1}
                max={720}
                className="w-full rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('sq.hintDeadlineHours', lang)}</p>
            </div>
          </div>

          {/* Budget-Info */}
          <div className="rounded-lg bg-purple-900/30 border border-purple-500/30 p-3 text-sm">
            <p className="text-purple-300">
              {t('sq.budgetInfo', lang)}:{' '}
              <span className="font-bold text-white">{totalBudget.toLocaleString()} D.FAITH</span>
            </p>
            <p className="text-gray-400 text-xs mt-1">{t('sq.budgetHint', lang)}</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Aktionen */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-colors"
            >
              {t('sq.cancel', lang)}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? t('sq.creating', lang) : t('sq.createBtn', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
