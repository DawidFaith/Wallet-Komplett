'use client';

import React, { useState, useEffect } from 'react';
import { FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaCheck, FaInfoCircle, FaSync, FaHeart, FaComment, FaBookmark, FaShareAlt, FaPaperPlane, FaThumbsUp, FaKey, FaLink, FaCopy } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { Platform, QuestType } from '../types';
// ─── Media-Typen (für Video-Picker) ─────────────────────────────────────────
interface AvailableQuestMediaItem {
  video_id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  created_at: string | null;
}
interface AvailableIgMediaItem {
  shortcode: string;
  graph_media_id: string;
  caption: string;
  thumbnail_url: string;
  permalink: string;
  posted_at: string | null;
  media_type?: string;
}
interface AvailableFbMediaItem {
  post_id: string;
  permalink: string;
  caption: string;
  thumbnail_url: string;
  posted_at: string | null;
}
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

const TYPE_ICONS: Record<QuestType, React.ReactNode> = {
  comment:    <FaComment    size={12} />,
  like:       <FaHeart      size={12} />,
  save:       <FaBookmark   size={12} />,
  repost:     <FaShareAlt   size={12} />,
  dm_share:   <FaPaperPlane size={12} />,
  engagement: <FaThumbsUp   size={12} />,
  secret:     <FaKey        size={12} />,
};

const PLATFORM_TYPES: Record<Platform, QuestType[]> = {
  youtube:   ['comment', 'like', 'secret'],
  instagram: ['like', 'comment', 'save', 'repost', 'dm_share', 'secret'],
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

type Step = 1 | 2 | 3 | 4;

export default function CreateBundleModal({
  open, onClose, walletAddress, creatorBalance, verified, onCreated, onOpenDeposit,
}: CreateBundleModalProps) {
  const [step, setStep]       = useState<Step>(1);
  const [platform, setPlatform] = useState<Platform>(
    verified.youtube ? 'youtube' : verified.instagram ? 'instagram' : verified.tiktok ? 'tiktok' : verified.facebook ? 'facebook' : 'youtube',
  );
  const [videoUrl, setVideoUrl]       = useState('');
  const [videoMediaId, setVideoMediaId] = useState(''); // Graph Media ID (Instagram/Facebook)
  const [videoTitle, setVideoTitle]   = useState('');
  const [description, setDescription] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metaError, setMetaError]       = useState('');

  const [items, setItems]   = useState<BundleItem[]>([]);
  const [reward, setReward] = useState('10');
  const [bonus, setBonus]   = useState('2');
  const [maxP, setMaxP]     = useState('20');
  const [duration, setDuration] = useState('72');
  const [secretCodes, setSecretCodes] = useState<Record<string, string>>({});

  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');
  const [storyToken, setStoryToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Video-Thumbnail (aus Picker)
  const [videoThumbnail, setVideoThumbnail] = useState('');

  // Media-Picker
  const [availableQuestMedia, setAvailableQuestMedia] = useState<AvailableQuestMediaItem[]>([]);
  const [loadingQuestMedia, setLoadingQuestMedia]     = useState(false);
  const [questMediaError, setQuestMediaError]         = useState('');
  const [selectedQuestMediaId, setSelectedQuestMediaId] = useState<string | null>(null);
  const [availableIgMedia, setAvailableIgMedia]       = useState<AvailableIgMediaItem[]>([]);
  const [loadingIgMedia, setLoadingIgMedia]           = useState(false);
  const [selectedIgShortcode, setSelectedIgShortcode] = useState<string | null>(null);
  const [availableFbMedia, setAvailableFbMedia]       = useState<AvailableFbMediaItem[]>([]);
  const [loadingFbMedia, setLoadingFbMedia]           = useState(false);
  const [selectedFbPostId, setSelectedFbPostId]       = useState<string | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de';
  const storyLink = storyToken ? `${appUrl}/api/instagram-quests/story-click?token=${storyToken}` : '';

  // Reset beim Öffnen
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setVideoUrl('');
    setVideoMediaId('');
    setVideoTitle('');
    setVideoThumbnail('');
    setDescription('');
    setMetaError('');
    setItems([]);
    setReward('10');
    setBonus('2');
    setMaxP('20');
    setDuration('72');
    setSecretCodes({});
    setError('');
    setStoryToken(null);
    setLinkCopied(false);
    setSelectedQuestMediaId(null);
    setSelectedIgShortcode(null);
    setSelectedFbPostId(null);
    setAvailableQuestMedia([]);
    setAvailableIgMedia([]);
    setAvailableFbMedia([]);
    setQuestMediaError('');
  }, [open]);

  // Media laden wenn Plattform wechselt
  useEffect(() => {
    if (!open) return;
    setSelectedQuestMediaId(null);
    setSelectedIgShortcode(null);
    setSelectedFbPostId(null);
    setVideoUrl('');
    setVideoTitle('');
    setVideoThumbnail('');
    if (platform === 'youtube' || platform === 'tiktok') fetchQuestMedia();
    else if (platform === 'instagram') fetchIgMedia();
    else if (platform === 'facebook') fetchFbMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, open]);

  // Media-Fetch Funktionen
  const fetchQuestMedia = async () => {
    setLoadingQuestMedia(true);
    setQuestMediaError('');
    try {
      const endpoint = platform === 'youtube'
        ? `/api/youtube-quests/available-media?wallet=${encodeURIComponent(walletAddress)}`
        : `/api/tiktok-quests/available-media?wallet=${encodeURIComponent(walletAddress)}`;
      const res  = await fetch(endpoint);
      const data = await res.json().catch(() => ({})) as { media?: AvailableQuestMediaItem[]; error?: string };
      if (!res.ok) { setQuestMediaError(data.error ?? 'Fehler beim Laden'); setAvailableQuestMedia([]); return; }
      setAvailableQuestMedia(data.media ?? []);
    } catch { setQuestMediaError('Netzwerkfehler'); setAvailableQuestMedia([]); }
    finally { setLoadingQuestMedia(false); }
  };

  const fetchIgMedia = async () => {
    setLoadingIgMedia(true);
    try {
      const res  = await fetch(`/api/instagram-quests/available-media?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await res.json() as { media?: AvailableIgMediaItem[] };
      setAvailableIgMedia(data.media ?? []);
    } finally { setLoadingIgMedia(false); }
  };

  const fetchFbMedia = async () => {
    setLoadingFbMedia(true);
    try {
      const res  = await fetch(`/api/facebook-quests/available-media?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await res.json() as { media?: AvailableFbMediaItem[] };
      setAvailableFbMedia(data.media ?? []);
    } finally { setLoadingFbMedia(false); }
  };

  const toggleType = (qt: QuestType) => {
    setItems((prev) =>
      prev.some((i) => i.questType === qt)
        ? prev.filter((i) => i.questType !== qt)
        : [...prev, { questType: qt, reachWeight: DEFAULT_WEIGHTS[qt] }],
    );
  };

  // Reward-Berechnung
  const rewardNum  = Math.max(0.01, Number(reward)  || 0);
  const bonusNum   = Math.max(0,    Number(bonus)    || 0);
  const maxNum     = Math.max(1,    Number(maxP)     || 10);
  const totalWeight = items.reduce((s, i) => s + i.reachWeight, 0);
  // Level-Bonus-Reserve: 100 % des Reward-Pools (maximale Default-Stufe)
  const levelBonusReserve = Math.round(rewardNum * maxNum * 100) / 100;
  const totalBudget = Math.round((rewardNum * maxNum + bonusNum * maxNum + levelBonusReserve) * 100) / 100;
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
          videoId:             videoMediaId.trim() || undefined,
          videoTitle:          videoTitle.trim() || undefined,
          description:         description.trim(),
          videoThumbnail:      videoThumbnail.trim() || undefined,
          rewardPoolPerFan:    rewardNum,
          bundleCompletionBonus: bonusNum,
          maxParticipants:     maxNum,
          durationHours:       Number(duration) || undefined,
          items:               items.map((i) => ({ questType: i.questType, reachWeight: i.reachWeight })),
          levelBonusBudget:    levelBonusReserve,
          secretCodes,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string; storyToken?: string | null };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Unbekannter Fehler');
      onCreated();
      if (data.storyToken) {
        setStoryToken(data.storyToken);
        setStep(4);
      } else {
        setStep(4); // Erfolg-Screen auch ohne Story-Token
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  // ── Schritt 4: Erfolg + optionaler Story-Link ────────────────────────────────
  if (step === 4) {
    return (
      <Modal open={open} onClose={onClose} title="Bundle erstellt! 🎉">
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mx-auto">
            <FaCheck size={24} className="text-green-400" />
          </div>
          <p className="text-zinc-400 text-sm text-center">
            Fans sehen jetzt dein Bundle und können alle Aufgaben abschließen.
          </p>

          {storyLink && (
            <div className="bg-pink-950/40 border border-pink-700/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <FaPaperPlane className="text-pink-400" size={13} />
                <p className="text-pink-200 text-sm font-semibold">Story-Quest Link</p>
              </div>
              <p className="text-zinc-400 text-xs">
                Teile diesen Link mit deinen Fans für den Story-Share Quest. Fans die ihn öffnen werden automatisch dem Quest zugewiesen.
              </p>
              <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-2">
                <FaLink size={10} className="text-pink-400 shrink-0" />
                <span className="text-pink-300 text-xs font-mono truncate flex-1" title={storyLink}>
                  {storyLink.replace(/^https?:\/\//, '')}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(storyLink);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="shrink-0 bg-pink-700 hover:bg-pink-600 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {linkCopied ? <FaCheck size={10} /> : <FaCopy size={10} />}
                  {linkCopied ? 'Kopiert!' : 'Kopieren'}
                </button>
              </div>
            </div>
          )}

          <button onClick={onClose} className="w-full bg-green-700 hover:bg-green-600 text-white rounded-xl py-3 font-semibold">
            Fertig
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Bundle Quest erstellen">
      <div className="space-y-5">

        {/* Schritt-Anzeige */}
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-purple-500' : 'bg-zinc-700'}`} />
          ))}
        </div>

        {/* ── Schritt 1: Plattform + Content ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">Wähle Plattform und dein Video für das Bundle.</p>

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

            {/* ── Video-Picker YouTube / TikTok ── */}
            {(platform === 'youtube' || platform === 'tiktok') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    {platform === 'youtube' ? 'YouTube' : 'TikTok'}-Video auswählen
                  </label>
                  <button type="button" onClick={fetchQuestMedia} disabled={loadingQuestMedia}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                    <FaSync size={10} className={loadingQuestMedia ? 'animate-spin' : ''} /> Aktualisieren
                  </button>
                </div>
                {loadingQuestMedia ? (
                  <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-900/40 rounded-xl">
                    <FaSync size={16} className="animate-spin mx-auto mb-2" />
                    Lade Videos…
                  </div>
                ) : availableQuestMedia.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {availableQuestMedia.map((item) => (
                      <button
                        key={item.video_id}
                        type="button"
                        onClick={() => {
                          setSelectedQuestMediaId(item.video_id);
                          setVideoUrl(item.video_url);
                          setVideoTitle(item.title);
                          setVideoThumbnail(item.thumbnail_url);
                        }}
                        className={`text-left relative rounded-xl overflow-hidden border transition-all ${
                          selectedQuestMediaId === item.video_id
                            ? 'border-purple-500 ring-1 ring-purple-500/30'
                            : 'border-zinc-700 hover:border-purple-400'
                        }`}
                      >
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt="" className="w-full h-24 object-cover" />
                        ) : (
                          <div className="w-full h-24 bg-zinc-900 flex items-center justify-center">
                            {PLATFORM_ICONS[platform]}
                          </div>
                        )}
                        <div className="p-2 bg-zinc-900/80">
                          <p className="text-white text-xs font-semibold line-clamp-2 leading-tight">
                            {item.title || `Video ${item.video_id.slice(0, 8)}`}
                          </p>
                          {item.created_at && (
                            <p className="text-zinc-500 text-[11px] mt-0.5">
                              {new Date(item.created_at).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        {selectedQuestMediaId === item.video_id && (
                          <div className="absolute inset-0 bg-purple-500/10 pointer-events-none flex items-end justify-end p-1">
                            <span className="bg-purple-600 rounded-full p-0.5"><FaCheck size={8} className="text-white" /></span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5 text-xs bg-zinc-900/40 rounded-xl border border-zinc-700/50 text-zinc-500">
                    {questMediaError
                      ? <span className="text-red-400">{questMediaError}</span>
                      : <>Keine Videos gefunden. Prüfe ob dein {platform === 'youtube' ? 'YouTube-Kanal' : 'TikTok-Account'} verknüpft ist.</>
                    }
                  </div>
                )}
              </div>
            )}

            {/* ── Video-Picker Instagram ── */}
            {platform === 'instagram' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Instagram-Reel auswählen</label>
                  <button type="button" onClick={fetchIgMedia} disabled={loadingIgMedia}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                    <FaSync size={10} className={loadingIgMedia ? 'animate-spin' : ''} /> Aktualisieren
                  </button>
                </div>
                {loadingIgMedia ? (
                  <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-900/40 rounded-xl">
                    <FaSync size={16} className="animate-spin mx-auto mb-2" />Lade Reels…
                  </div>
                ) : availableIgMedia.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                    {availableIgMedia.map((item) => (
                      <button
                        key={item.shortcode}
                        type="button"
                        onClick={() => {
                          setSelectedIgShortcode(item.shortcode);
                          const url   = item.permalink || `https://www.instagram.com/reel/${item.shortcode}/`;
                          const title = (item.caption?.split(/[\n\r]/)[0].trim() || `Reel ${item.shortcode}`).slice(0, 100);
                          setVideoUrl(url);
                          setVideoMediaId(item.graph_media_id);
                          setVideoTitle(title);
                          setVideoThumbnail(item.thumbnail_url);
                        }}
                        className={`relative rounded-xl overflow-hidden border transition-all ${
                          selectedIgShortcode === item.shortcode
                            ? 'border-purple-500 ring-1 ring-purple-500/30'
                            : 'border-zinc-700 hover:border-purple-400'
                        }`}
                      >
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt="" className="w-full h-20 object-cover" />
                        ) : (
                          <div className="w-full h-20 bg-zinc-900 flex items-center justify-center">
                            {PLATFORM_ICONS.instagram}
                          </div>
                        )}
                        {selectedIgShortcode === item.shortcode && (
                          <div className="absolute inset-0 bg-purple-500/10 pointer-events-none flex items-end justify-end p-1">
                            <span className="bg-purple-600 rounded-full p-0.5"><FaCheck size={8} className="text-white" /></span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5 text-xs bg-zinc-900/40 rounded-xl border border-zinc-700/50 text-zinc-500">
                    Keine Reels verfügbar. Auf &ldquo;Aktualisieren&rdquo; klicken.
                  </div>
                )}
              </div>
            )}

            {/* ── Video-Picker Facebook ── */}
            {platform === 'facebook' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Facebook-Post auswählen</label>
                  <button type="button" onClick={fetchFbMedia} disabled={loadingFbMedia}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                    <FaSync size={10} className={loadingFbMedia ? 'animate-spin' : ''} /> Aktualisieren
                  </button>
                </div>
                {loadingFbMedia ? (
                  <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-900/40 rounded-xl">
                    <FaSync size={16} className="animate-spin mx-auto mb-2" />Lade Posts…
                  </div>
                ) : availableFbMedia.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {availableFbMedia.map((item) => {
                      const title = (item.caption?.split(/[\n\r]/)[0].trim() || item.post_id).slice(0, 80);
                      return (
                        <button
                          key={item.post_id}
                          type="button"
                          onClick={() => {
                            setSelectedFbPostId(item.post_id);
                            setVideoUrl(item.permalink);
                            setVideoTitle(title);
                            setVideoThumbnail(item.thumbnail_url);
                          }}
                          className={`relative rounded-xl overflow-hidden border transition-all text-left ${
                            selectedFbPostId === item.post_id
                              ? 'border-purple-500 ring-1 ring-purple-500/30'
                              : 'border-zinc-700 hover:border-purple-400'
                          }`}
                        >
                          {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt="" className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 bg-zinc-900 flex items-center justify-center">
                              {PLATFORM_ICONS.facebook}
                            </div>
                          )}
                          <div className="p-2 bg-zinc-900/80">
                            <p className="text-white text-xs font-semibold line-clamp-2 leading-tight">{title}</p>
                          </div>
                          {selectedFbPostId === item.post_id && (
                            <div className="absolute inset-0 bg-purple-500/10 pointer-events-none flex items-end justify-end p-1">
                              <span className="bg-purple-600 rounded-full p-0.5"><FaCheck size={8} className="text-white" /></span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-5 text-xs bg-zinc-900/40 rounded-xl border border-zinc-700/50 text-zinc-500">
                    Keine Posts verfügbar. Auf &ldquo;Aktualisieren&rdquo; klicken.
                  </div>
                )}
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

            {/* Ausgewähltes Video als Vorschau */}
            {videoUrl && videoTitle && (
              <div className="flex items-center gap-3 bg-purple-900/20 border border-purple-700/40 rounded-xl px-3 py-2">
                {videoThumbnail && (
                  <img src={videoThumbnail} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                <p className="text-purple-200 text-xs font-semibold line-clamp-2 flex-1">{videoTitle}</p>
                <FaCheck size={12} className="text-purple-400 shrink-0" />
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!videoUrl.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
            >
              Weiter →
            </button>
          </div>
        )}

        {/* ── Schritt 2: Quest-Typen auswählen + Gewichte ─────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Wähle die Aktionen für dein Bundle. Die <span className="text-purple-400 font-semibold">Algorythmus-Signalstärke</span> ist fest und bestimmt den Anteil am Gesamt-Reward.
            </p>

            {/* Tipp */}
            <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 flex gap-2">
              <FaInfoCircle className="text-blue-400 mt-0.5 shrink-0" size={13} />
              <p className="text-blue-300 text-xs">
                Höhere Signalstärke = mehr Algorythmus-Signalwirkung = größerer Token-Anteil. Story-Share hat die höchste Wirkung.
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
                        <span className="flex items-center text-zinc-300">{TYPE_ICONS[qt]}</span>
                        <span className="text-white text-sm font-semibold">{TYPE_LABELS[qt]}</span>
                      </button>
                      {selected && item && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 text-xs">Signalstärke:</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`w-1.5 rounded-sm transition-all ${i <= item.reachWeight ? 'bg-purple-400 h-3.5' : 'bg-zinc-700 h-2.5 self-end'}`}
                              />
                            ))}
                          </div>
                          <span className="text-purple-300 text-xs font-bold">{item.reachWeight}</span>
                        </div>
                      )}
                    </div>
                    {selected && item && totalWeight > 0 && (
                      <div className="flex items-center justify-between mt-2 ml-7">
                        <p className="text-purple-300 text-xs">
                          → {((item.reachWeight / totalWeight) * 100).toFixed(0)}% des Reward-Pools
                        </p>
                        <span className="text-amber-400 text-xs font-semibold">+{item.reachWeight * 20} REP</span>
                      </div>
                    )}
                    {selected && qt === 'dm_share' && (
                      <p className="text-blue-400/70 text-[11px] mt-1 ml-7">🔗 Story-Link wird nach Erstellung generiert</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Geheimcode festlegen (nur wenn 'secret'-Typ ausgewählt) */}
            {items.some((i) => i.questType === 'secret') && (
              <div className="bg-zinc-900/60 border border-yellow-800/40 rounded-xl p-3 space-y-2">
                <p className="text-yellow-300 text-xs font-semibold">🔑 Geheimcode festlegen</p>
                <p className="text-zinc-400 text-xs">Fans müssen diesen Code eingeben, um den Geheimcode-Task abzuschließen.</p>
                <input
                  type="text"
                  placeholder="z.B. DAWIDFAITH2025"
                  value={secretCodes['secret'] ?? ''}
                  onChange={(e) => setSecretCodes((prev) => ({ ...prev, secret: e.target.value.toUpperCase() }))}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-yellow-500 uppercase"
                  maxLength={50}
                />
              </div>
            )}

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
          <div className="space-y-3">
            {/* 4 Felder kompakt */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Reward/Fan (D.FAITH)', val: reward, set: setReward, min: '0.01', stp: '0.01' },
                { label: 'Abschluss-Bonus', val: bonus, set: setBonus, min: '0', stp: '0.01' },
                { label: 'Max. Teilnehmer', val: maxP, set: setMaxP, min: '1', stp: '1' },
                { label: 'Laufzeit (h, 0=∞)', val: duration, set: setDuration, min: '0', stp: '1' },
              ].map(({ label, val, set, min, stp }) => (
                <div key={label} className="space-y-0.5">
                  <label className="text-zinc-500 text-[11px]">{label}</label>
                  <input
                    type="number" min={min} step={stp}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-purple-500"
                  />
                </div>
              ))}
            </div>

            {/* Reward-Aufschlüsselung kompakt */}
            <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl px-3 py-2 space-y-1">
              <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-1.5">Reward pro Fan</p>
              {items.map((item) => {
                const share = totalWeight > 0 ? (item.reachWeight / totalWeight) * rewardNum : 0;
                return (
                  <div key={item.questType} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="text-zinc-400">{TYPE_ICONS[item.questType]}</span>
                      {TYPE_LABELS[item.questType]}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-amber-400">+{item.reachWeight * 20} REP</span>
                      <span className="text-purple-300 font-mono">{share.toFixed(2)}</span>
                    </span>
                  </div>
                );
              })}
              {bonusNum > 0 && (
                <div className="flex items-center justify-between text-xs border-t border-zinc-700/50 pt-1 mt-0.5">
                  <span className="text-yellow-300 flex items-center gap-1"><FaKey size={9} /> Alles-Bonus</span>
                  <span className="text-yellow-300 font-mono">+{bonusNum.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs border-t border-zinc-700/50 pt-1 mt-0.5">
                <span className="text-white font-semibold">Gesamt/Fan</span>
                <span className="text-green-400 font-mono font-bold">{(rewardNum + bonusNum).toFixed(2)} D.FAITH</span>
              </div>
            </div>

            {/* Gesamtkosten */}
            <div className={`rounded-xl px-3 py-2.5 border flex items-center justify-between ${
              hasEnough ? 'bg-green-950/30 border-green-800/40' : 'bg-red-950/30 border-red-800/40'
            }`}>
              <div>
                <p className="text-zinc-400 text-xs">Budget sperren</p>
                {!hasEnough && (
                  <button onClick={onOpenDeposit} className="text-blue-400 text-xs hover:underline">Jetzt einzahlen →</button>
                )}
              </div>
              <div className="text-right">
                <p className={`font-bold font-mono text-sm ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                  {totalBudget.toFixed(2)} D.FAITH
                </p>
                <p className={`text-xs font-mono ${hasEnough ? 'text-green-600' : 'text-red-400'}`}>
                  Guthaben: {creatorBalance.toFixed(2)}
                </p>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setError(''); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2.5 font-semibold text-sm">
                ← Zurück
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !hasEnough || items.length < 2}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors"
              >
                {creating ? 'Erstelle...' : '🎯 Bundle erstellen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
