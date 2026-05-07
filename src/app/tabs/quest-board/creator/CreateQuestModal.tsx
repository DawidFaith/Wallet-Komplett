'use client';

import React, { useState, useEffect } from 'react';
import { FaPlus, FaSync, FaCheck, FaCommentAlt, FaClock, FaKey, FaTiktok, FaYoutube, FaInstagram, FaThumbsUp, FaBookmark, FaShareAlt, FaTrash } from 'react-icons/fa';
import Modal from '../components/Modal';
import { shortenWallet } from '../utils';

interface AvailableMediaItem {
  shortcode: string;
  graph_media_id: string;
  ig_id?: string;
  username?: string;
  caption: string;
  media_url?: string;
  thumbnail_url: string;
  permalink: string;
  posted_at: string | null;
  media_type?: string;
  media_product_type?: string;
  like_count?: number;
  comments_count?: number;
  is_comment_enabled?: boolean;
}

interface AvailableQuestMediaItem {
  video_id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  created_at: string | null;
}

interface CreateQuestModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  creatorBalance: number;
  verified: { youtube: boolean; instagram: boolean; tiktok: boolean; facebook: boolean };
  onCreated: () => void;
  onOpenDeposit: () => void;
}

export default function CreateQuestModal({
  open,
  onClose,
  walletAddress,
  creatorBalance,
  verified,
  onCreated,
  onOpenDeposit,
}: CreateQuestModalProps) {
  const [description, setDescription] = useState('');
  const [rewardAmount, setRewardAmount] = useState('100');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [platform, setPlatform] = useState<'youtube' | 'tiktok' | 'instagram'>(
    verified.youtube ? 'youtube' : verified.tiktok ? 'tiktok' : verified.instagram ? 'instagram' : 'youtube'
  );
  const [questType, setQuestType] = useState<'comment' | 'like' | 'save' | 'secret' | 'engagement' | 'repost' | 'dm_share'>('comment');
  const [secretCode, setSecretCode] = useState('');
  const [durationHours, setDurationHours] = useState('24');
  // freie Dauer-Eingabe
  const [customDurationValue, setCustomDurationValue] = useState('30');
  const [customDurationUnit, setCustomDurationUnit] = useState<'min' | 'h' | 'd'>('min');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // Instagram – verfügbare Videos aus DB
  const [availableMedia, setAvailableMedia] = useState<AvailableMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<AvailableMediaItem | null>(null);
  const [availableQuestMedia, setAvailableQuestMedia] = useState<AvailableQuestMediaItem[]>([]);
  const [loadingQuestMedia, setLoadingQuestMedia] = useState(false);
  const [selectedQuestMediaId, setSelectedQuestMediaId] = useState<string | null>(null);
  const selectedQuestMedia = availableQuestMedia.find((item) => item.video_id === selectedQuestMediaId) ?? null;

  const buildInstagramTitle = (item: AvailableMediaItem) => {
    // Erste Zeile der Caption verwenden (mit Emojis & Hashtags)
    const firstLine = item.caption?.split(/[\n\r]/)[0].trim();
    if (firstLine && firstLine.length > 0) {
      return firstLine.slice(0, 100);
    }
    // Fallback: restliche Caption
    const fullCaption = item.caption?.trim();
    if (fullCaption && fullCaption.length > 0) {
      return fullCaption.slice(0, 100);
    }
    // Kein Caption → Datum
    const dateLabel = item.posted_at
      ? new Date(item.posted_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Unbekannt';
    return `${item.media_type === 'VIDEO' ? 'Reel' : item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Beitrag'} vom ${dateLabel}`;
  };

  const reset = () => {
    setDescription(''); setRewardAmount('100'); setMaxParticipants('10');
    setPlatform('youtube'); setQuestType('comment'); setDurationHours('24');
    setCustomDurationValue('30'); setCustomDurationUnit('min');
    setSecretCode('');
    setSelectedMedia(null); setAvailableMedia([]); setLoadingMedia(false);
    setAvailableQuestMedia([]); setLoadingQuestMedia(false); setSelectedQuestMediaId(null);
    setError(''); setSuccess(false);
  };

  const fetchAvailableMedia = async () => {
    setLoadingMedia(true);
    try {
      const res = await fetch('/api/instagram-quests/available-media');
      const data = await res.json();
      setAvailableMedia(data.media ?? []);
    } finally {
      setLoadingMedia(false);
    }
  };

  const fetchAvailableQuestMedia = async () => {
    if (!walletAddress) return;
    setLoadingQuestMedia(true);
    try {
      const endpoint = platform === 'youtube'
        ? `/api/youtube-quests/available-media?wallet=${encodeURIComponent(walletAddress)}`
        : `/api/tiktok-quests/available-media?wallet=${encodeURIComponent(walletAddress)}`;

      const res = await fetch(endpoint);
      const data = await res.json();
      setAvailableQuestMedia(data.media ?? []);
      if (selectedQuestMediaId && !(data.media ?? []).some((item: AvailableQuestMediaItem) => item.video_id === selectedQuestMediaId)) {
        setSelectedQuestMediaId(null);
      }
    } finally {
      setLoadingQuestMedia(false);
    }
  };



  const handleDeleteMedia = async (shortcode: string) => {
    await fetch(`/api/instagram-quests/available-media?shortcode=${encodeURIComponent(shortcode)}`, { method: 'DELETE' });
    setAvailableMedia((prev) => prev.filter((m) => m.shortcode !== shortcode));
    if (selectedMedia?.shortcode === shortcode) setSelectedMedia(null);
  };

  // Verfügbare Videos laden wenn Instagram-Plattform gewählt wird
  useEffect(() => {
    if (platform === 'instagram' && open) {
      fetchAvailableMedia();
    }
    if ((platform === 'youtube' || platform === 'tiktok') && open) {
      fetchAvailableQuestMedia();
    }
  }, [platform, open, walletAddress]);

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
          : platform === 'instagram'
          ? questType === 'engagement'
            ? '❤️ Like und 🔖 Speichere dieses Instagram Reel! (Teilbelohnung möglich)'
            : questType === 'dm_share'
            ? '📩 Teile dieses Reel in deiner Story und klicke den DM-Link!'
            : '💬 Kommentiere dieses Instagram Reel!'
          : questType === 'like'
          ? '👍 Like dieses YouTube Short!'
          : questType === 'secret'
          ? '🔑 Finde den geheimen Code im Video und gib ihn ein!'
          : '💬 Schreibe einen positiven Kommentar unter diesen YouTube Short!'
      );

      // Instagram: muss ein Video ausgewählt sein
      if (platform === 'instagram' && !selectedMedia) {
        setError('Bitte erst ein Instagram Video auswählen.');
        return;
      }

      if ((platform === 'youtube' || platform === 'tiktok') && !selectedQuestMedia) {
        setError(`Bitte zuerst ein ${platform === 'youtube' ? 'YouTube' : 'TikTok'}-Video aus der Liste auswählen.`);
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
            reelUrl: selectedMedia!.permalink || `https://www.instagram.com/reel/${selectedMedia!.shortcode}/`,
            mediaId: selectedMedia!.graph_media_id,   // echte Graph API ID → direkt für /comments
            videoTitle: buildInstagramTitle(selectedMedia!),
            thumbnailUrl: selectedMedia!.thumbnail_url,
            description: finalDescription || `💬 Kommentiere dieses Instagram Reel!`,
            rewardAmount: Number(rewardAmount),
            maxCompletions: Number(maxParticipants),
            durationHours: finalDurationHours,
            questType,
          }
        : {
            creatorWallet: walletAddress,
            videoUrl: selectedQuestMedia?.video_url ?? '',
          videoTitle: selectedQuestMedia?.title ?? '',
          thumbnailUrl: selectedQuestMedia?.thumbnail_url ?? '',
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
                disabled={!verified.youtube}
                title={verified.youtube ? '' : 'YouTube-Konto im Profil verknüpfen'}
                onClick={() => { setPlatform('youtube'); setQuestType('comment'); setSelectedMedia(null); setSelectedQuestMediaId(null); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  !verified.youtube
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                    : platform === 'youtube'
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-600'
                }`}
              >
                <FaYoutube size={16} /> YouTube
              </button>
              <button
                type="button"
                disabled={!verified.tiktok}
                title={verified.tiktok ? '' : 'TikTok-Konto im Profil verknüpfen'}
                onClick={() => { setPlatform('tiktok'); setQuestType('comment'); setSelectedMedia(null); setSelectedQuestMediaId(null); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  !verified.tiktok
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                    : platform === 'tiktok'
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-cyan-600'
                }`}
              >
                <FaTiktok size={15} /> TikTok
              </button>
              <button
                type="button"
                disabled={!verified.instagram}
                title={verified.instagram ? '' : 'Instagram-Konto im Profil verknüpfen'}
                onClick={() => { setPlatform('instagram'); setQuestType('comment'); setSelectedMedia(null); setSelectedQuestMediaId(null); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  !verified.instagram
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                    : platform === 'instagram'
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

          {/* Quest-Typ – nur bei Instagram */}
          {platform === 'instagram' && (
            <div>
              <label className="text-zinc-300 text-sm font-medium block mb-1.5">Quest-Typ <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestType('comment')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'comment'
                      ? 'bg-pink-600 border-pink-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-pink-600'
                  }`}
                >
                  💬 Kommentar
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('engagement')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'engagement'
                      ? 'bg-gradient-to-r from-red-600 to-yellow-600 border-red-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-600'
                  }`}
                >
                  ❤️🔖 Like &amp; Speichern
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('repost')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'repost'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 border-blue-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-blue-600'
                  }`}
                >
                  🔁 Repost
                </button>
                <button
                  type="button"
                  onClick={() => setQuestType('dm_share')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    questType === 'dm_share'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-purple-600'
                  }`}
                >
                  📩 Story Quest
                </button>
              </div>
              <p className="text-zinc-500 text-xs mt-1">
                {questType === 'engagement'
                  ? 'Fan muss liken und speichern. Jede Aktion = 1/2 des Rewards. Teilbelohnung möglich.'
                  : questType === 'repost'
                  ? 'Fan muss das Reel auf seinen Kanal reposten. Delta aus total_interactions wird gemessen.'
                  : questType === 'dm_share'
                  ? 'Fan teilt das Reel in seiner Story (Teil 1) und klickt den Link-DM-Link (Teil 2).'
                  : 'Make.com prüft via Instagram Graph API ob der Fan kommentiert hat.'}
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

          {/* YouTube/TikTok – externe Videoauswahl */}
          {platform !== 'instagram' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-zinc-300 text-sm font-medium">
                  Verfügbare {platform === 'youtube' ? 'YouTube' : 'TikTok'} Videos
                </label>
                <button
                  type="button"
                  onClick={fetchAvailableQuestMedia}
                  disabled={loadingQuestMedia}
                  className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 disabled:opacity-50"
                >
                  <FaSync size={10} className={loadingQuestMedia ? 'animate-spin' : ''} /> Aktualisieren
                </button>
              </div>

              {loadingQuestMedia ? (
                <div className="text-center text-zinc-500 py-6 text-sm bg-zinc-800/50 rounded-xl mb-3">
                  <FaSync size={16} className="animate-spin mx-auto mb-2" />
                  Lade Videos vom verknüpften Account…
                </div>
              ) : availableQuestMedia.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 mb-3">
                  {availableQuestMedia.map((item) => (
                    <button
                      key={item.video_id}
                      type="button"
                      onClick={() => {
                        setSelectedQuestMediaId(item.video_id);
                      }}
                      className={`text-left relative rounded-xl overflow-hidden border transition-all ${
                        selectedQuestMediaId === item.video_id
                          ? 'border-pink-500 ring-1 ring-pink-500/30'
                          : 'border-zinc-700 hover:border-pink-400'
                      }`}
                    >
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt="" className="w-full h-24 object-cover" />
                      ) : (
                        <div className="w-full h-24 bg-zinc-700 flex items-center justify-center">
                          {platform === 'youtube' ? <FaYoutube size={22} className="text-zinc-500" /> : <FaTiktok size={20} className="text-zinc-500" />}
                        </div>
                      )}
                      <div className="p-2 bg-zinc-900">
                        <p className="text-white text-xs font-semibold line-clamp-2 leading-tight">
                          {item.title || `${platform === 'youtube' ? 'YouTube' : 'TikTok'} Video ${item.video_id.slice(0, 8)}`}
                        </p>
                        {item.created_at && (
                          <p className="text-zinc-500 text-[11px] mt-1">
                            {new Date(item.created_at).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-zinc-500 mb-3">
                  Keine Videos gefunden. Prüfe, ob dein {platform === 'youtube' ? 'YouTube-Kanal' : 'TikTok-Account'} korrekt verknüpft ist.
                </div>
              )}

              {selectedQuestMedia ? (
                <p className="text-pink-400 text-xs mt-1.5 flex items-center gap-1">
                  <FaCheck size={10} /> Ausgewählt: {(selectedQuestMedia.title || selectedQuestMedia.video_id).slice(0, 70)}
                </p>
              ) : (
                <p className="text-zinc-500 text-xs mt-1">
                  Wähle ein Video aus der Liste, um den Quest zu veröffentlichen.
                </p>
              )}
            </div>
          )}

          {/* Instagram – verfügbare Videos aus DB */}
          {platform === 'instagram' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-zinc-300 text-sm font-medium">
                  Video auswählen <span className="text-red-400">*</span>
                </label>
                <button type="button" onClick={fetchAvailableMedia} disabled={loadingMedia}
                  className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 disabled:opacity-50">
                  <FaSync size={10} className={loadingMedia ? 'animate-spin' : ''} /> Aktualisieren
                </button>
              </div>

              {loadingMedia ? (
                <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-800/50 rounded-xl">
                  <FaSync size={16} className="animate-spin mx-auto mb-2" />
                  Lade Videos…
                </div>
              ) : availableMedia.length === 0 ? (
                <div className="text-center py-6 text-sm bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-1">
                  <FaInstagram size={24} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-zinc-400">Noch keine Videos verfügbar.</p>
                  <p className="text-zinc-600 text-xs">Videos werden automatisch synchronisiert.<br/>Hier auf &bdquo;Aktualisieren&ldquo; klicken um sie anzuzeigen.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-2">
                  {availableMedia.map((item) => {
                    const postedDate = item.posted_at 
                      ? new Date(item.posted_at).toLocaleDateString('de-DE', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Datum unbekannt';

                    const title = buildInstagramTitle(item).slice(0, 70);
                    
                    return (
                      <div
                        key={item.shortcode}
                        onClick={() => setSelectedMedia(item)}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all flex flex-col h-full ${
                          selectedMedia?.shortcode === item.shortcode
                            ? 'border-pink-500 ring-2 ring-pink-500/30 bg-pink-950/20'
                            : 'border-zinc-700 hover:border-pink-400 hover:bg-zinc-800/50'
                        }`}
                      >
                        {/* Thumbnail */}
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt="" className="w-full h-32 object-cover" />
                        ) : (
                          <div className="w-full h-32 bg-zinc-700 flex items-center justify-center">
                            <FaInstagram size={28} className="text-zinc-500" />
                          </div>
                        )}

                        {/* Media-Type Badge */}
                        {item.media_type && (
                          <div className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {item.media_type === 'VIDEO' ? '🎬 Reel' : item.media_type === 'CAROUSEL_ALBUM' ? '🖼️ Carousel' : item.media_type === 'IMAGE' ? '📷 Bild' : item.media_type}
                          </div>
                        )}

                        {/* Info */}
                        <div className="p-2 bg-zinc-900 flex-1 flex flex-col gap-1">
                          <p className="text-white text-xs font-semibold line-clamp-2 leading-tight flex-1">
                            {title}
                          </p>
                          <p className="text-zinc-500 text-xs">{postedDate}</p>

                          {/* Engagement-Statistiken */}
                          {(typeof item.like_count === 'number' || typeof item.comments_count === 'number') && (
                            <div className="flex items-center gap-3 text-xs text-zinc-400">
                              {typeof item.like_count === 'number' && (
                                <span title="Likes">❤️ {item.like_count}</span>
                              )}
                              {typeof item.comments_count === 'number' && (
                                <span title="Kommentare">💬 {item.comments_count}</span>
                              )}
                            </div>
                          )}

                          {/* Link zum Video */}
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-pink-400 text-xs hover:text-pink-300 hover:underline truncate"
                            title={item.shortcode}
                          >
                            {item.media_product_type === 'REELS' ? 'instagram.com/reel' : 'instagram.com/p'}
                          </a>
                        </div>
                        
                        {/* Checkmark overlay */}
                        {selectedMedia?.shortcode === item.shortcode && (
                          <div className="absolute inset-0 bg-pink-500/10 flex items-center justify-center pointer-events-none rounded-lg">
                            <FaCheck size={24} className="text-pink-400 drop-shadow-lg" />
                          </div>
                        )}
                        
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteMedia(item.shortcode); }}
                          className="absolute top-1.5 right-1.5 bg-red-900/90 hover:bg-red-700 text-white rounded-full w-7 h-7 flex items-center justify-center transition-colors shadow-lg"
                          title="Video entfernen"
                        >
                          <FaTrash size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedMedia && (
                <p className="text-pink-400 text-xs mt-1.5 flex items-center gap-1">
                  <FaCheck size={10} /> Ausgewählt: {buildInstagramTitle(selectedMedia).slice(0, 60)}
                </p>
              )}
            </div>
          )}

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
                  min="0.01"
                  step="0.01"
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
              <span className="text-yellow-300 font-bold">{creatorBalance.toFixed(2)} DFAITH</span>
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
