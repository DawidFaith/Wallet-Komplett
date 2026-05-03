'use client';

import React, { useState } from 'react';
import { FaPlus, FaSync, FaCheck, FaCommentAlt, FaClock } from 'react-icons/fa';
import Modal from '../components/Modal';
import { shortenWallet } from '../utils';

interface CreateQuestModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  creatorBalance: number;
  onCreated: () => void;
  onOpenDeposit: () => void;
}

export default function CreateQuestModal({
  open,
  onClose,
  walletAddress,
  creatorBalance,
  onCreated,
  onOpenDeposit,
}: CreateQuestModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [rewardAmount, setRewardAmount] = useState('100');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [questType, setQuestType] = useState<'comment' | 'like'>('comment');
  const [durationHours, setDurationHours] = useState('24');
  // freie Dauer-Eingabe
  const [customDurationValue, setCustomDurationValue] = useState('30');
  const [customDurationUnit, setCustomDurationUnit] = useState<'min' | 'h' | 'd'>('min');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setVideoUrl(''); setDescription(''); setRewardAmount('100'); setMaxParticipants('10');
    setQuestType('comment'); setDurationHours('24');
    setCustomDurationValue('30'); setCustomDurationUnit('min');
    setError(''); setSuccess(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      // Dauer in Stunden umrechnen
      let finalDurationHours: number | undefined;
      if (durationHours === 'custom') {
        const val = Math.max(1, Number(customDurationValue) || 30);
        if (customDurationUnit === 'min') finalDurationHours = val / 60;
        else if (customDurationUnit === 'h') finalDurationHours = val;
        else finalDurationHours = val * 24;
      } else {
        finalDurationHours = durationHours === '0' ? undefined : Number(durationHours);
      }

      // Auto-Beschreibung wenn leer
      const finalDescription = description.trim() || (
        questType === 'like'
          ? '👍 Like dieses YouTube Short!'
          : '💬 Schreibe einen positiven Kommentar unter diesen YouTube Short!'
      );

      const res = await fetch('/api/youtube-quests/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorWallet: walletAddress,
          videoUrl: videoUrl.trim(),
          description: finalDescription,
          rewardAmount: Number(rewardAmount),
          maxCompletions: Number(maxParticipants),
          questType,
          durationHours: finalDurationHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      onCreated();
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Neuen Quest erstellen">
      {success ? (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
            <FaCheck size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-semibold">Quest erfolgreich erstellt!</p>
            <p className="text-zinc-400 text-sm mt-1">Fans können jetzt deinen Quest sehen und abschließen.</p>
          </div>
          <button onClick={handleClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">Schließen</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quest-Typ */}
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Quest-Typ <span className="text-red-400">*</span></label>
            <div className="relative">
              <select
                value={questType}
                onChange={(e) => setQuestType(e.target.value as 'comment' | 'like')}
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="comment">💬 Kommentar – Wertsteigernder Kommentar unter dem Video</option>
                <option value="like">👍 Like – Klick auf Like unter dem Video</option>
              </select>
              <FaCommentAlt className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={13} />
            </div>
            <p className="text-zinc-500 text-xs mt-1">
              {questType === 'like'
                ? 'Verifizierung über Like-Anzahl-Delta: Fan entfernt Like → 5 Min Zeit um erneut zu liken.'
                : 'Die API prüft anhand des Kanalnamens ob der Fan kommentiert hat.'}
            </p>
          </div>

          {/* Dauer */}
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Dauer <span className="text-red-400">*</span></label>
            <div className="relative">
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="1">1 Stunde</option>
                <option value="12">12 Stunden</option>
                <option value="24">1 Tag</option>
                <option value="168">7 Tage</option>
                <option value="0">∞ Kein Ablauf</option>
                <option value="custom">⚙️ Eigene Dauer…</option>
              </select>
              <FaClock className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={13} />
            </div>
            {durationHours === 'custom' && (
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  value={customDurationValue}
                  onChange={(e) => setCustomDurationValue(e.target.value)}
                  min="1"
                  className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm"
                  placeholder="z.B. 30"
                />
                <select
                  value={customDurationUnit}
                  onChange={(e) => setCustomDurationUnit(e.target.value as 'min' | 'h' | 'd')}
                  className="bg-zinc-800 text-white rounded-xl px-3 py-2.5 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm cursor-pointer"
                >
                  <option value="min">Minuten</option>
                  <option value="h">Stunden</option>
                  <option value="d">Tage</option>
                </select>
              </div>
            )}
          </div>

          {/* Video URL */}
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">YouTube Shorts URL <span className="text-red-400">*</span></label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/shorts/VIDEO_ID"
              required
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-500"
            />
            <p className="text-zinc-500 text-xs mt-1">Nur YouTube Shorts sind erlaubt</p>
          </div>

          {/* Beschreibung */}
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">
              Aufgabenbeschreibung für den Fan
              <span className="text-zinc-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="💬 Schreibe einen positiven Kommentar unter diesen YouTube Short!"
              rows={2}
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-500 resize-none"
            />
            <p className="text-zinc-600 text-xs mt-1">Leer lassen → Standardnachricht wird verwendet</p>
          </div>

          {/* Reward + Max */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">Belohnung pro Fan</label>
              <div className="relative">
                <input
                  type="number"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  min="1"
                  required
                  className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">DFAITH</span>
              </div>
            </div>
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">Maximale Teilnehmer</label>
              <input
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                min="1"
                max="1000"
                required
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm"
              />
              <p className="text-zinc-600 text-xs mt-1">Wie viele Fans mitmachen dürfen</p>
            </div>
          </div>

          {/* Hinweis */}
          <div className="bg-zinc-800 rounded-xl p-3 text-xs text-zinc-400 space-y-1">
            <p className="text-yellow-400 font-semibold">Hinweis:</p>
            <p>
              Quest-Pool:{' '}
              <span className="text-yellow-300 font-bold">{creatorBalance} DFAITH</span>
              {creatorBalance === 0 && (
                <button
                  type="button"
                  onClick={() => { handleClose(); onOpenDeposit(); }}
                  className="ml-2 text-yellow-400 underline"
                >
                  Jetzt aufladen
                </button>
              )}
            </p>
            <p>Wallet: <span className="text-zinc-300 font-mono">{shortenWallet(walletAddress)}</span></p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

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
  );
}
