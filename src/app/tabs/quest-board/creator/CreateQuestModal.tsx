'use client';

import React, { useState } from 'react';
import { FaPlus, FaSync, FaCheck, FaCommentAlt, FaClock, FaKey, FaTiktok, FaYoutube, FaInstagram, FaThumbsUp, FaBookmark, FaShareAlt, FaSearch } from 'react-icons/fa';
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
  const [platform, setPlatform] = useState<'youtube' | 'tiktok' | 'instagram'>('youtube');
  const [questType, setQuestType] = useState<'comment' | 'like' | 'secret' | 'engagement'>('comment');
  const [secretCode, setSecretCode] = useState('');
  const [durationHours, setDurationHours] = useState('24');
  // freie Dauer-Eingabe
  const [customDurationValue, setCustomDurationValue] = useState('30');
  const [customDurationUnit, setCustomDurationUnit] = useState<'min' | 'h' | 'd'>('min');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // Instagram Reel Auto-Resolve
  const [reelResolved, setReelResolved] = useState<{ mediaId: string; title: string; thumbnailUrl: string; ownerUsername: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const reset = () => {
    setVideoUrl(''); setDescription(''); setRewardAmount('100'); setMaxParticipants('10');
    setPlatform('youtube'); setQuestType('comment'); setDurationHours('24');
    setCustomDurationValue('30'); setCustomDurationUnit('min');
    setSecretCode('');
    setReelResolved(null); setResolving(false); setResolveError('');
    setError(''); setSuccess(false);
  };

  const handleResolveReel = async () => {
    if (!videoUrl.trim()) return;
    setResolving(true);
    setResolveError('');
    setReelResolved(null);
    try {
      const res = await fetch(`/api/instagram-quests/resolve-reel?url=${encodeURIComponent(videoUrl.trim())}`);
      const data = await res.json();
      if (!res.ok) { setResolveError(data.error); return; }
      setReelResolved(data);
    } catch {
      setResolveError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setResolving(false);
    }
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
        platform === 'tiktok'
          ? questType === 'engagement'
            ? '👍 Like, 🔄 Teile und 🔖 Speichere dieses TikTok-Video!'
            : questType === 'secret'
            ? '🔑 Finde den geheimen Code im TikTok-Video und gib ihn ein!'
            : '💬 Schreibe einen positiven Kommentar unter dieses TikTok-Video!'
          : questType === 'like'
          ? '👍 Like dieses YouTube Short!'
          : questType === 'secret'
          ? '🔑 Finde den geheimen Code im Video und gib ihn ein!'
          : '💬 Schreibe einen positiven Kommentar unter diesen YouTube Short!'
      );

      // Instagram: muss vorher resolved sein
      if (platform === 'instagram' && !reelResolved) {
        setError('Bitte erst das Reel auflösen (Lupe klicken)');
        return;
      }

      const apiEndpoint = platform === 'tiktok'
        ? '/api/tiktok-quests/quests'
        : platform === 'instagram'
        ? '/api/instagram-quests/quests'
        : '/api/youtube-quests/quests';

      const body = platform === 'instagram'
        ? {
            creatorWallet: walletAddress,
            videoUrl: `https://www.instagram.com/reel/${reelResolved!.ownerUsername}/`,
            reelUrl: videoUrl.trim(),
            mediaId: reelResolved!.mediaId,
            videoTitle: reelResolved!.title,
            thumbnailUrl: reelResolved!.thumbnailUrl,
            description: finalDescription || `💬 Kommentiere dieses Instagram Reel von @${reelResolved!.ownerUsername}!`,
            rewardAmount: Number(rewardAmount),
            maxCompletions: Number(maxParticipants),
            durationHours: finalDurationHours,
          }
        : {
            creatorWallet: walletAddress,
            videoUrl: videoUrl.trim(),
            description: finalDescription,
            rewardAmount: Number(rewardAmount),
            maxCompletions: Number(maxParticipants),
            questType,
            durationHours: finalDurationHours,
            secretCode: questType === 'secret' ? secretCode.trim() : undefined,
          };

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          {/* Plattform-Auswahl */}
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Plattform <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setPlatform('youtube'); setQuestType('comment'); setReelResolved(null); setResolveError(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  platform === 'youtube'
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-600'
                }`}
              >
                <FaYoutube size={16} /> YouTube
              </button>
              <button
                type="button"
                onClick={() => { setPlatform('tiktok'); setQuestType('comment'); setReelResolved(null); setResolveError(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  platform === 'tiktok'
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-cyan-600'
                }`}
              >
                <FaTiktok size={15} /> TikTok
              </button>
              <button
                type="button"
                onClick={() => { setPlatform('instagram'); setQuestType('comment'); setReelResolved(null); setResolveError(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  platform === 'instagram'
                    ? 'bg-pink-600 border-pink-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-pink-600'
                }`}
              >
                <FaInstagram size={15} /> Instagram
              </button>
            </div>
          </div>

          {/* Quest-Typ – nur bei YouTube */}
          {platform === 'youtube' && (
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">Quest-Typ <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestType('comment')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'comment'
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-600'
                  }`}
                >
                  💬 Kommentar
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('like')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'like'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-blue-600'
                  }`}
                >
                  👍 Like
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('secret')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'secret'
                      ? 'bg-yellow-600 border-yellow-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-yellow-600'
                  }`}
                >
                  🔑 Secret
                </button>
              </div>
              <p className="text-zinc-500 text-xs mt-1">
                {questType === 'like'
                  ? 'Verifizierung über Like-Anzahl-Delta: Fan entfernt Like → 5 Min Zeit um erneut zu liken.'
                  : questType === 'secret'
                  ? 'Der Fan gibt einen Code ein der im Video versteckt ist. Kein YouTube API-Aufruf nötig.'
                  : 'Die API prüft anhand des Kanalnamens ob der Fan kommentiert hat.'}
              </p>
            </div>
          )}

          {/* Quest-Typ – nur bei TikTok */}
          {platform === 'tiktok' && (
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">Quest-Typ <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestType('comment')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'comment'
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-cyan-600'
                  }`}
                >
                  💬 Kommentar
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('secret')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'secret'
                      ? 'bg-yellow-600 border-yellow-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-yellow-600'
                  }`}
                >
                  🔑 Secret
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('engagement')}
                  className={`flex items-center gap-1.5 justify-center py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'engagement'
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-purple-600'
                  }`}
                >
                  <FaThumbsUp size={12} /><FaShareAlt size={12} /><FaBookmark size={12} /> Engagement
                </button>
              </div>
              <p className="text-zinc-500 text-xs mt-1">
                {questType === 'engagement'
                  ? 'Fan muss liken, teilen und speichern. Jede Aktion = 1/3 des Rewards. Teilbelohnung möglich.'
                  : questType === 'secret'
                  ? 'Fan gibt einen Code ein, der im TikTok-Video versteckt ist. Kein API-Aufruf nötig.'
                  : 'API prüft via Kommentare ob der Fan kommentiert hat.'}
              </p>
            </div>
          )}

          {/* Secret Code – bei YouTube oder TikTok + secret-Typ */}
          {questType === 'secret' && (
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">
                <FaKey className="inline mr-1 text-yellow-400" size={12} />
                Geheimer Code <span className="text-red-400">*</span>
              </label>
              <input
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder="z.B. DFAITH oder W4LLET"
                maxLength={50}
                required
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-500 font-mono tracking-widest uppercase"
              />
              <p className="text-zinc-500 text-xs mt-1">
                Groß-/Kleinschreibung egal – Fans müssen die Buchstaben nacheinander im Video finden und zusammensetzen.
              </p>
            </div>
          )}

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
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">
              {platform === 'instagram' ? 'Instagram Reel URL' : platform === 'tiktok' ? 'TikTok Video URL' : 'YouTube Shorts URL'}{' '}
              <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                value={videoUrl}
                onChange={(e) => { setVideoUrl(e.target.value); setReelResolved(null); setResolveError(''); }}
                placeholder={
                  platform === 'instagram'
                    ? 'https://www.instagram.com/reel/SHORTCODE/'
                    : platform === 'tiktok'
                    ? 'https://www.tiktok.com/@user/video/VIDEO_ID'
                    : 'https://www.youtube.com/shorts/VIDEO_ID'
                }
                required
                className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-pink-500 focus:outline-none text-sm placeholder-zinc-500"
              />
              {platform === 'instagram' && (
                <button
                  type="button"
                  onClick={handleResolveReel}
                  disabled={resolving || !videoUrl.trim()}
                  className="bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white px-4 rounded-xl transition-colors flex items-center gap-2 text-sm font-semibold shrink-0"
                  title="Reel auflösen"
                >
                  {resolving ? <FaSync size={13} className="animate-spin" /> : <FaSearch size={13} />}
                </button>
              )}
            </div>
            {/* Instagram Resolve Ergebnis */}
            {platform === 'instagram' && resolveError && (
              <p className="text-red-400 text-xs mt-1">{resolveError}</p>
            )}
            {platform === 'instagram' && reelResolved && (
              <div className="mt-2 flex items-center gap-3 bg-zinc-800 rounded-xl p-2.5">
                {reelResolved.thumbnailUrl && (
                  <img src={reelResolved.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold line-clamp-1">{reelResolved.title}</p>
                  <p className="text-zinc-400 text-xs">@{reelResolved.ownerUsername} · Media ID: {reelResolved.mediaId}</p>
                </div>
                <span className="text-green-400 text-xs font-bold shrink-0">✓</span>
              </div>
            )}
            {platform !== 'instagram' && (
              <p className="text-zinc-500 text-xs mt-1">
                {platform === 'tiktok' ? 'Nur Videos deines verknüpften TikTok-Kontos sind erlaubt' : 'Nur YouTube Shorts sind erlaubt'}
              </p>
            )}
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
            <p className="text-zinc-600 text-xs mt-1">Leer lassen → Standardnachricht wird verwendet ({platform === 'tiktok' ? 'TikTok-Kommentar' : 'YouTube-Kommentar/-Like/-Code'})</p>
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
            {creating ? 'Erstelle Quest…' : `Quest veröffentlichen (${platform === 'tiktok' ? 'TikTok' : platform === 'instagram' ? 'Instagram' : 'YouTube'})`}
          </button>
        </form>
      )}
    </Modal>
  );
}
