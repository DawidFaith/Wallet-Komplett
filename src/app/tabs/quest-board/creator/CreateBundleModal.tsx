'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaCheck, FaInfoCircle, FaSync, FaHeart, FaComment, FaBookmark, FaShareAlt, FaPaperPlane, FaThumbsUp, FaKey, FaLink, FaCopy } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { Platform, QuestType } from '../types';
import { useLang } from '../../../components/LangContext';
import { t, tFmt } from '../../../utils/i18n';
import type { Lang } from '../../../utils/i18n';
import { upload } from '@vercel/blob/client';
import { FaMusic, FaCamera } from 'react-icons/fa';
import { SiSpotify, SiApplemusic, SiYoutubemusic, SiAmazonmusic, SiTidal } from 'react-icons/si';

const STREAMING_PLATFORMS = [
  { value: 'spotify',       label: 'Spotify',       icon: SiSpotify,      color: '#1DB954', bg: 'bg-[#1DB954]/10', border: 'border-[#1DB954]/40', text: 'text-[#1DB954]' },
  { value: 'apple_music',   label: 'Apple Music',   icon: SiApplemusic,   color: '#FC3C44', bg: 'bg-[#FC3C44]/10', border: 'border-[#FC3C44]/40', text: 'text-[#FC3C44]' },
  { value: 'youtube_music', label: 'YouTube Music', icon: SiYoutubemusic, color: '#FF0000', bg: 'bg-[#FF0000]/10', border: 'border-[#FF0000]/40', text: 'text-[#FF0000]' },
  { value: 'amazon_music',  label: 'Amazon Music',  icon: SiAmazonmusic,  color: '#00A8E1', bg: 'bg-[#00A8E1]/10', border: 'border-[#00A8E1]/40', text: 'text-[#00A8E1]' },
  { value: 'deezer',        label: 'Deezer',        icon: FaMusic,        color: '#A238FF', bg: 'bg-[#A238FF]/10', border: 'border-[#A238FF]/40', text: 'text-[#A238FF]' },
  { value: 'tidal',         label: 'Tidal',         icon: SiTidal,        color: '#00FFFF', bg: 'bg-[#00FFFF]/10', border: 'border-[#00FFFF]/40', text: 'text-[#00FFFF]' },
  { value: 'other',         label: 'Andere',        icon: FaMusic,        color: '#888888', bg: 'bg-zinc-700/20',  border: 'border-zinc-600/40',  text: 'text-zinc-400' },
] as const;
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
  share:      4,
  engagement: 2,
  secret:     2,
};

const TYPE_LABEL_KEYS: Record<QuestType, string> = {
  comment: 'qt.comment', like: 'qt.like', save: 'qt.save',
  repost: 'qt.repost', dm_share: 'qt.dmShare', share: 'qt.share', engagement: 'qt.engagement', secret: 'qt.secret',
};
function getTypeLabel(qt: QuestType, lang: Lang) { return t(TYPE_LABEL_KEYS[qt], lang); }

const TYPE_ICONS: Record<QuestType, React.ReactNode> = {
  comment:    <FaComment    size={12} />,
  like:       <FaHeart      size={12} />,
  save:       <FaBookmark   size={12} />,
  repost:     <FaShareAlt   size={12} />,
  dm_share:   <FaPaperPlane size={12} />,
  share:      <FaShareAlt   size={12} />,
  engagement: <FaThumbsUp   size={12} />,
  secret:     <FaKey        size={12} />,
};

const PLATFORM_TYPES: Record<Platform, QuestType[]> = {
  youtube:   ['comment', 'like', 'secret'],
  instagram: ['like', 'comment', 'save', 'repost', 'dm_share', 'secret'],
  tiktok:    ['like', 'save', 'comment', 'share', 'secret'],
  facebook:  ['like', 'comment', 'secret'],
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
  const lang = useLang();

  // ── Quest-Typ-Wähler ────────────────────────────────────────────────────────
  const [questMode, setQuestMode] = useState<'social' | 'streaming' | null>(null);

  // ── Streaming-Quest-Formular-State ───────────────────────────────────────────
  const [sqTitle, setSqTitle]               = useState('');
  const [sqDesc, setSqDesc]                 = useState('');
  const [sqPlatform, setSqPlatform]         = useState('spotify');
  const [sqTargetStreams, setSqTargetStreams] = useState('10000');
  const [sqRewardPer, setSqRewardPer]       = useState('100');
  const [sqMaxPart, setSqMaxPart]           = useState('50');
  const [sqRepReward, setSqRepReward]       = useState('0');
  const [sqEnrollHours, setSqEnrollHours]   = useState('48');
  const [sqDeadlineHours, setSqDeadlineHours] = useState('240');
  const [sqShardChance, setSqShardChance]   = useState('20');
  const [sqMinLevel, setSqMinLevel]         = useState('3');
  const [sqTrackUrl, setSqTrackUrl]         = useState('');
  const [sqCreating, setSqCreating]         = useState(false);
  const [sqError, setSqError]               = useState<string | null>(null);

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
  const [shardChance, setShardChance] = useState('20');
  const [maxP, setMaxP]     = useState('20');
  const [duration, setDuration] = useState('72');
  const [secretCodes, setSecretCodes] = useState<Record<string, string>>({});

  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');
  const [storyToken, setStoryToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Video-Thumbnail (aus Picker)
  const [videoThumbnail, setVideoThumbnail] = useState('');

  // Platform-Nutzerzahl & Bonus-Prozentsätze der Top-Fans für Level-Bonus-Reserve
  const [platformUserCount, setPlatformUserCount] = useState<number>(0);
  const [loadingPlatformUsers, setLoadingPlatformUsers] = useState(false);
  const [topFanBonusPcts, setTopFanBonusPcts] = useState<number[]>([]);
  const [maxCollectibleCreditPct, setMaxCollectibleCreditPct] = useState<number>(0);

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
    setQuestMode(null);
    setSqTitle(''); setSqDesc(''); setSqPlatform('spotify');
    setSqTargetStreams('10000'); setSqRewardPer('100'); setSqMaxPart('50');
    setSqRepReward('0'); setSqEnrollHours('48'); setSqDeadlineHours('240');
    setSqShardChance('20'); setSqMinLevel('3'); setSqCreating(false); setSqError(null);
    setStep(1);
    setVideoUrl('');
    setVideoMediaId('');
    setVideoTitle('');
    setVideoThumbnail('');
    setDescription('');
    setMetaError('');
    setItems([]);
    setReward('10');
    setShardChance('20');
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
    setPlatformUserCount(0);
    setTopFanBonusPcts([]);
    setMaxCollectibleCreditPct(0);
    setSqTrackUrl('');
  }, [open]);

  // ── Streaming Quest erstellen ─────────────────────────────────────────────
  const handleCreateStreamingQuest = async () => {
    const _target   = Math.max(1, parseInt(sqTargetStreams) || 1);
    const _reward   = Math.max(0, parseFloat(sqRewardPer) || 0);
    const _maxPart  = Math.max(1, parseInt(sqMaxPart) || 1);
    const _rep      = Math.max(0, parseInt(sqRepReward) || 0);
    const _enroll   = Math.max(1, Math.min(168, parseInt(sqEnrollHours) || 1));
    const _deadline = Math.max(_enroll + 1, Math.min(720, parseInt(sqDeadlineHours) || _enroll + 1));
    const _shard    = Math.max(0, Math.min(100, parseInt(sqShardChance) || 0));
    const _minLevel = Math.max(1, Math.min(100, parseInt(sqMinLevel) || 1));
    // Titel automatisch aus Plattform + Stream-Ziel generieren
    const platformLabel = STREAMING_PLATFORMS.find(p => p.value === sqPlatform)?.label ?? sqPlatform;
    const autoTitle = `${_target.toLocaleString()} ${platformLabel} Streams`;
    if (_deadline <= _enroll) { setSqError(t('sq.errorDeadline', lang)); return; }
    setSqCreating(true); setSqError(null);
    try {
      const res = await fetch('/api/streaming-quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorWallet: walletAddress,
          title: autoTitle,
          description: sqDesc.trim() || undefined,
          trackUrl: sqTrackUrl.trim() || undefined,
          platform: sqPlatform,
          targetStreams: _target,
          rewardPerParticipant: _reward,
          maxParticipants: _maxPart,
          reputationReward: _rep,
          enrollmentHours: _enroll,
          deadlineHours: _deadline,
          shardDropChance: _shard,
          minLevel: _minLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      onCreated();
      onClose();
    } catch (err) {
      setSqError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSqCreating(false);
    }
  };

  // Platform-Nutzerzahl laden
  const fetchPlatformUserCount = async (p: Platform) => {
    setLoadingPlatformUsers(true);
    try {
      const res = await fetch(`/api/quest-bundles/platform-stats?platform=${p}&creatorWallet=${encodeURIComponent(walletAddress)}&limit=500`);
      const data = await res.json() as { userCount?: number; topFanBonusPcts?: number[]; maxCollectibleCreditPct?: number };
      setPlatformUserCount(data.userCount ?? 0);
      setTopFanBonusPcts(data.topFanBonusPcts ?? []);
      setMaxCollectibleCreditPct(data.maxCollectibleCreditPct ?? 0);
    } catch {
      setPlatformUserCount(0);
      setTopFanBonusPcts([]);
      setMaxCollectibleCreditPct(0);
    } finally {
      setLoadingPlatformUsers(false);
    }
  };

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
    fetchPlatformUserCount(platform);
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
  const shardChanceNum = Math.max(0, Math.min(100, Math.round(Number(shardChance) || 20)));
  const maxNum     = Math.max(1,    Number(maxP)     || 10);
  const totalWeight = items.reduce((s, i) => s + i.reachWeight, 0);
  const hasDmShare = items.some((i) => i.questType === 'dm_share');
  // Effektive Teilnehmeranzahl für Level-Bonus-Reserve: min(maxTeilnehmer, Platform-Nutzer)
  // Wenn noch keine Nutzerzahl geladen → Fallback auf maxNum
  const effectiveBonusParticipants = platformUserCount > 0 ? Math.min(maxNum, platformUserCount) : maxNum;
  // Abschluss-Bonus-Pool entfällt (kein Token-Bonus mehr)
  const abschlussBonusPool = 0;
  // Level-Bonus-Reserve: echte Boni bekannter Fans; fehlende Teilnehmer → niedrigster bekannter Wert + 2%
  const lowestKnownPct = topFanBonusPcts.length > 0 ? topFanBonusPcts[topFanBonusPcts.length - 1] : 0;
  const fallbackPct = lowestKnownPct + 2;
  const bonusSum = Array.from({ length: effectiveBonusParticipants }, (_, i) =>
    rewardNum * (topFanBonusPcts[i] ?? fallbackPct) / 100
  ).reduce((s, v) => s + v, 0);
  const collectiblesBuffer = rewardNum * maxCollectibleCreditPct / 100 * effectiveBonusParticipants;
  const levelBonusReserve = Math.round((bonusSum + collectiblesBuffer) * 1.02 * 100) / 100;
  const totalBudget = Math.round((rewardNum * maxNum + levelBonusReserve) * 100) / 100;
  const hasEnough   = creatorBalance >= totalBudget;

  const handleCreate = async () => {
    if (!items.length) { setError(t('cb.errSelectType', lang)); return; }
    if (!videoUrl.trim()) { setError(t('cb.errUrlMissing', lang)); return; }
    if (platform !== 'youtube' && !videoTitle.trim()) { setError(t('cb.errTitleMissing', lang)); return; }

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
          shardDropChance:     shardChanceNum,
          maxParticipants:     maxNum,
          durationHours:       Number(duration) || undefined,
          items:               items.map((i) => ({ questType: i.questType, reachWeight: i.reachWeight })),
          levelBonusBudget:    levelBonusReserve,
          secretCodes,
          storyToken:          hasDmShare ? (storyToken ?? undefined) : undefined,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Unbekannter Fehler');
      onCreated();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  // ── Schritt 4: LinkDM Story Mention einrichten + final bestätigen ───────────
  if (step === 4) {
    return (
      <Modal open={open} onClose={onClose} title={t('cb.step4Title', lang)} disableBackdropClose>
        <div className="space-y-4">
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 space-y-2">
            <p className="text-blue-300 text-xs font-semibold">
              {t('cb.linkdmHowTo', lang)}
            </p>
            <ol className="text-blue-200/90 text-xs space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>{t('cb.linkdmStep1', lang)}</li>
              <li>{t('cb.linkdmStep2', lang)}</li>
              <li>{t('cb.linkdmStep3', lang).split('app.linkdm.com/automation/mention').map((part, i) => i === 0 ? <React.Fragment key={i}>{part}<span className="font-mono text-blue-100">app.linkdm.com/automation/mention</span></React.Fragment> : <React.Fragment key={i}>{part}</React.Fragment>)}</li>
              <li>{t('cb.linkdmStep4', lang)}</li>
              <li>{t('cb.linkdmStep5', lang)}</li>
            </ol>
            <p className="text-amber-300/80 text-[11px] mt-2 flex items-start gap-1.5">
              <FaInfoCircle className="shrink-0 mt-0.5" size={10} />
              <span>{t('cb.linkdmNote', lang)}</span>
            </p>
          </div>

          {storyLink && (
            <div className="bg-pink-950/40 border border-pink-700/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <FaPaperPlane className="text-pink-400" size={13} />
                <p className="text-pink-200 text-sm font-semibold">{t('cb.storyLinkTitle', lang)}</p>
            </div>
            <p className="text-zinc-400 text-xs">
              {t('cb.storyLinkDesc', lang)}
            </p>
              <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-2">
                <FaLink size={10} className="text-pink-400 shrink-0" />
                <input
                  readOnly
                  value={storyLink}
                  className="flex-1 bg-transparent text-pink-300 text-xs font-mono outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(storyLink);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="shrink-0 bg-pink-700 hover:bg-pink-600 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {linkCopied ? <FaCheck size={10} /> : <FaCopy size={10} />}
                  {linkCopied ? t('cb.copied', lang) : t('cb.copy', lang)}
                </button>
              </div>
            </div>
          )}

          {!storyLink && (
            <p className="text-amber-400 text-xs">{t('cb.storyLinkError', lang)}</p>
          )}

          {error && <p className="text-amber-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setStep(3); setError(''); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2.5 font-semibold text-sm">
              {t('cb.back', lang)}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !hasEnough || !storyLink}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors"
            >
              {creating ? t('cb.creating', lang) : t('cb.confirmCreate', lang)}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const isBundle = items.length >= 2;
  const modalTitle = questMode === 'streaming'
    ? t('sq.createTitle', lang)
    : questMode === null
      ? t('creator.createQuest', lang)
      : step === 1
        ? t('cb.modalTitle', lang)
        : isBundle
          ? t('cb.modalTitleBundle', lang)
          : t('cb.modalTitle', lang);

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} disableBackdropClose>
      <div className="space-y-5">

        {/* ── Typ-Wähler ────────────────────────────────────────────────── */}
        {questMode === null && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm text-center">{t('cb.chooseTypeHint', lang)}</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Social Quest */}
              <button
                onClick={() => setQuestMode('social')}
                className="rounded-2xl border border-purple-600/40 bg-zinc-900 hover:bg-purple-900/30 transition-all p-5 flex flex-col items-center gap-3 group"
              >
                <div className="flex gap-1.5 items-center">
                  <FaYoutube className="text-red-500" size={18} />
                  <FaInstagram className="text-pink-500" size={18} />
                  <FaTiktok className="text-white" size={16} />
                  <FaFacebook className="text-blue-500" size={18} />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm group-hover:text-purple-300 transition-colors">{t('cb.typesSocial', lang)}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 leading-tight">{t('cb.typesSocialHint', lang)}</p>
                </div>
              </button>
              {/* Streaming Milestone */}
              <button
                onClick={() => setQuestMode('streaming')}
                className="rounded-2xl border border-green-600/40 bg-zinc-900 hover:bg-green-900/30 transition-all p-5 flex flex-col items-center gap-3 group"
              >
                <div className="flex gap-1.5 items-center">
                  <SiSpotify className="text-[#1DB954]" size={18} />
                  <SiApplemusic className="text-[#FC3C44]" size={18} />
                  <SiYoutubemusic className="text-[#FF0000]" size={18} />
                  <SiTidal className="text-[#00FFFF]" size={16} />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm group-hover:text-green-300 transition-colors">{t('cb.typeStreaming', lang)}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 leading-tight">{t('cb.typeStreamingHint', lang)}</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Streaming Milestone Formular ─────────────────────────────── */}
        {questMode === 'streaming' && (
          <div className="space-y-4">
            <button onClick={() => setQuestMode(null)} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              ← {t('btn.back', lang)}
            </button>

            {/* Beschreibung */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelDesc', lang)}</label>
              <textarea
                value={sqDesc}
                onChange={e => setSqDesc(e.target.value)}
                rows={2}
                placeholder={t('sq.placeholderDesc', lang)}
                maxLength={300}
                className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Plattform */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('sq.labelPlatform', lang)}</label>
              <div className="grid grid-cols-2 gap-2">
                {STREAMING_PLATFORMS.map(p => {
                  const Icon = p.icon;
                  const isSelected = sqPlatform === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setSqPlatform(p.value)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                        isSelected
                          ? `${p.bg} ${p.border} ${p.text}`
                          : 'bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:border-zinc-500/60 hover:text-zinc-200'
                      }`}
                    >
                      <Icon size={16} style={isSelected ? { color: p.color } : {}} />
                      {p.value === 'other' ? t('sq.platformOther', lang) : p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Track-Link */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelTrackUrl', lang)}</label>
              <input
                type="url"
                value={sqTrackUrl}
                onChange={e => setSqTrackUrl(e.target.value)}
                placeholder={t('sq.placeholderTrackUrl', lang)}
                className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-xs text-zinc-600 mt-1">{t('sq.hintTrackUrl', lang)}</p>
            </div>

            {/* Stream-Ziel */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelTarget', lang)}</label>
              <input
                type="number"
                value={sqTargetStreams}
                onChange={e => setSqTargetStreams(e.target.value)}
                onBlur={e => { const v = parseInt(e.target.value); setSqTargetStreams(String(isNaN(v) || v < 1 ? 1 : v)); }}
                min={1}
                className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Belohnungen */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('sq.labelRewardPer', lang)}</label>
                <input
                  type="number"
                  value={sqRewardPer}
                  onChange={e => setSqRewardPer(e.target.value)}
                  onBlur={e => { const v = parseFloat(e.target.value); setSqRewardPer(String(isNaN(v) || v < 0 ? 0 : v)); }}
                  min={0} step={10}
                  className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('sq.labelMaxPart', lang)}</label>
                <input
                  type="number"
                  value={sqMaxPart}
                  onChange={e => setSqMaxPart(e.target.value)}
                  onBlur={e => { const v = parseInt(e.target.value); setSqMaxPart(String(isNaN(v) || v < 1 ? 1 : v)); }}
                  min={1}
                  className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* REP-Bonus */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelRepReward', lang)}</label>
              <input
                type="number"
                value={sqRepReward}
                onChange={e => setSqRepReward(e.target.value)}
                onBlur={e => { const v = parseInt(e.target.value); setSqRepReward(String(isNaN(v) || v < 0 ? 0 : v)); }}
                min={0} step={5}
                className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Shard-Chance */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelShardChance', lang)}</label>
              <input
                type="number"
                value={sqShardChance}
                onChange={e => setSqShardChance(e.target.value)}
                onBlur={e => { const v = parseInt(e.target.value); setSqShardChance(String(isNaN(v) ? 0 : Math.max(0, Math.min(100, v)))); }}
                min={0} max={100} step={5}
                className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-xs text-zinc-600 mt-1">{t('sq.hintShardChance', lang)}</p>
            </div>

            {/* Mindest-Level */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('sq.labelMinLevel', lang)}</label>
              <input
                type="number"
                value={sqMinLevel}
                onChange={e => setSqMinLevel(e.target.value)}
                onBlur={e => { const v = parseInt(e.target.value); setSqMinLevel(String(isNaN(v) || v < 1 ? 1 : Math.min(100, v))); }}
                min={1} max={100} step={1}
                className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-xs text-zinc-600 mt-1">{t('sq.hintMinLevel', lang)}</p>
            </div>

            {/* Zeitfenster */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('sq.labelEnrollHours', lang)}</label>
                <input
                  type="number"
                  value={sqEnrollHours}
                  onChange={e => setSqEnrollHours(e.target.value)}
                  onBlur={e => { const v = parseInt(e.target.value); setSqEnrollHours(String(isNaN(v) || v < 1 ? 1 : Math.min(168, v))); }}
                  min={1} max={168}
                  className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <p className="text-xs text-zinc-600 mt-1">{t('sq.hintEnrollHours', lang)}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('sq.labelDeadlineHours', lang)}</label>
                <input
                  type="number"
                  value={sqDeadlineHours}
                  onChange={e => setSqDeadlineHours(e.target.value)}
                  onBlur={e => { const v = parseInt(e.target.value); const min = (parseInt(sqEnrollHours) || 1) + 1; setSqDeadlineHours(String(isNaN(v) || v < min ? min : Math.min(720, v))); }}
                  min={(parseInt(sqEnrollHours) || 1) + 1} max={720}
                  className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <p className="text-xs text-zinc-600 mt-1">{t('sq.hintDeadlineHours', lang)}</p>
              </div>
            </div>

            {/* Budget-Info */}
            <div className="rounded-lg bg-purple-900/30 border border-purple-500/30 p-3 text-sm">
              <p className="text-purple-300">
                {t('sq.budgetInfo', lang)}: <span className="font-bold text-white">{((parseFloat(sqRewardPer) || 0) * (parseInt(sqMaxPart) || 0)).toLocaleString()} D.FAITH</span>
              </p>
              <p className="text-zinc-500 text-xs mt-1">{t('sq.budgetHint', lang)}</p>
            </div>

            {sqError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{sqError}</p>}

            <button
              onClick={handleCreateStreamingQuest}
              disabled={sqCreating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sqCreating ? t('sq.creating', lang) : t('sq.createBtn', lang)}
            </button>
          </div>
        )}

        {/* ── Social Quest (bisherige Steps) ───────────────────────────── */}
        {questMode === 'social' && (
          <>

        {/* Schritt-Anzeige */}
        <div className="flex gap-2">
          {(hasDmShare ? [1, 2, 3, 4] : [1, 2, 3]).map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-purple-500' : 'bg-zinc-700'}`} />
          ))}
        </div>

        {/* ── Schritt 1: Plattform + Content ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">{t('cb.step1Hint', lang)}</p>

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
                    {t(platform === 'youtube' ? 'cb.selectYtVideo' : 'cb.selectTtVideo', lang)}
                  </label>
                  <button type="button" onClick={fetchQuestMedia} disabled={loadingQuestMedia}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                    <FaSync size={10} className={loadingQuestMedia ? 'animate-spin' : ''} /> {t('cb.refresh', lang)}
                  </button>
                </div>
                {loadingQuestMedia ? (
                  <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-900/40 rounded-xl">
                    <FaSync size={16} className="animate-spin mx-auto mb-2" />
                    {t('cb.loadingVideos', lang)}
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
                          <div className="relative w-full h-24"><Image src={item.thumbnail_url} alt="" fill className="object-cover" /></div>
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
                      ? <span className="text-amber-400">{questMediaError}</span>
                      : <>{t(platform === 'youtube' ? 'cb.noYtVideos' : 'cb.noTtVideos', lang)}</>
                    }
                  </div>
                )}
              </div>
            )}

            {/* ── Video-Picker Instagram ── */}
            {platform === 'instagram' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">{t('cb.selectIgReel', lang)}</label>
                  <button type="button" onClick={fetchIgMedia} disabled={loadingIgMedia}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                    <FaSync size={10} className={loadingIgMedia ? 'animate-spin' : ''} /> {t('cb.refresh', lang)}
                  </button>
                </div>
                {loadingIgMedia ? (
                  <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-900/40 rounded-xl">
                    <FaSync size={16} className="animate-spin mx-auto mb-2" />{t('cb.loadingReels', lang)}
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
                          <div className="relative w-full h-20"><Image src={item.thumbnail_url} alt="" fill className="object-cover" /></div>
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
                    {t('cb.noReels', lang)}
                  </div>
                )}
              </div>
            )}

            {/* ── Video-Picker Facebook ── */}
            {platform === 'facebook' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">{t('cb.selectFbPost', lang)}</label>
                  <button type="button" onClick={fetchFbMedia} disabled={loadingFbMedia}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                    <FaSync size={10} className={loadingFbMedia ? 'animate-spin' : ''} /> {t('cb.refresh', lang)}
                  </button>
                </div>
                {loadingFbMedia ? (
                  <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-900/40 rounded-xl">
                    <FaSync size={16} className="animate-spin mx-auto mb-2" />{t('cb.loadingPosts', lang)}
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
                            setVideoMediaId(item.post_id); // Facebook Post-ID als videoId speichern
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
                            <div className="relative w-full h-24"><Image src={item.thumbnail_url} alt="" fill className="object-cover" /></div>
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
                    {t('cb.noPosts', lang)}
                  </div>
                )}
              </div>
            )}

            {/* Beschreibung */}
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs">{t('cb.descLabel', lang)}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={t('cb.descPlaceholder', lang)}
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Ausgewähltes Video als Vorschau */}
            {videoUrl && videoTitle && (
              <div className="flex items-center gap-3 bg-purple-900/20 border border-purple-700/40 rounded-xl px-3 py-2">
                {videoThumbnail && (
                  <Image src={videoThumbnail} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover shrink-0" />
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
              {t('cb.next', lang)}
            </button>
          </div>
        )}

        {/* ── Schritt 2: Quest-Typen auswählen + Gewichte ─────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              {t('cb.step2Hint', lang)}
            </p>

            {/* Tipp */}
            <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 flex gap-2">
              <FaInfoCircle className="text-blue-400 mt-0.5 shrink-0" size={13} />
              <p className="text-blue-300 text-xs">
                {t('cb.tipText', lang)}
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
                        <span className="text-white text-sm font-semibold">{getTypeLabel(qt, lang)}</span>
                      </button>
                      {selected && item && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 text-xs">{t('cb.signalStrength', lang)}</span>
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
                          {tFmt('cb.rewardPoolShare', lang, { n: ((item.reachWeight / totalWeight) * 100).toFixed(0) })}
                        </p>
                        <span className="text-amber-400 text-xs font-semibold">+{item.reachWeight * 8} REP</span>
                      </div>
                    )}
                    {selected && qt === 'dm_share' && (
                      <p className="text-blue-400/70 text-[11px] mt-1 ml-7">{t('cb.dmShareStep4Hint', lang)}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Geheimcode festlegen (nur wenn 'secret'-Typ ausgewählt) */}
            {items.some((i) => i.questType === 'secret') && (
              <div className="bg-zinc-900/60 border border-yellow-800/40 rounded-xl p-3 space-y-2">
                <p className="text-yellow-300 text-xs font-semibold">{t('cb.secretCodeTitle', lang)}</p>
                <p className="text-zinc-400 text-xs">{t('cb.secretCodeDesc', lang)}</p>
                <input
                  type="text"
                  placeholder={t('cb.secretCodePh', lang)}
                  value={secretCodes['secret'] ?? ''}
                  onChange={(e) => setSecretCodes((prev) => ({ ...prev, secret: e.target.value.toUpperCase() }))}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-yellow-500 uppercase"
                  maxLength={50}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-3 font-semibold text-sm">
                {t('cb.back', lang)}
              </button>
              <button
                onClick={() => {
                  if (items.length < 1) { setError(t('cb.errSelectType', lang)); return; }
                  if (items.some((i) => i.questType === 'secret') && !secretCodes['secret']?.trim()) {
                    setError(t('cb.errSecretCode', lang));
                    return;
                  }
                  setError('');
                  setStep(3);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3 font-semibold text-sm"
              >
                {t('cb.next', lang)}
              </button>
            </div>
            {error && <p className="text-amber-400 text-sm">{error}</p>}
          </div>
        )}

        {/* ── Schritt 3: Reward + Budget ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            {/* 4 Felder kompakt */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('cb.rewardFanLabel', lang), val: reward, set: setReward, min: '0.01', stp: '0.01', disabled: false },
                { label: t('cb.shardChanceLabel', lang), val: shardChance, set: setShardChance, min: '0', stp: '1', disabled: items.length < 2 },
                { label: t('cb.maxParticipants', lang), val: maxP, set: setMaxP, min: '1', stp: '1', disabled: false },
                { label: t('cb.durationLabel', lang), val: duration, set: setDuration, min: '0', stp: '1', disabled: false },
              ].map(({ label, val, set, min, stp, disabled }) => (
                <div key={label} className="space-y-0.5">
                  <label className={`text-[11px] ${disabled ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    {label}{disabled ? ` ${t('cb.bundleOnly', lang)}` : ''}
                  </label>
                  <input
                    type="number" min={min} step={stp}
                    value={disabled ? '0' : val}
                    disabled={disabled}
                    onChange={(e) => { if (!disabled) set(e.target.value); }}
                    className={`w-full rounded-lg px-3 py-1.5 text-sm outline-none border ${
                      disabled
                        ? 'bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-800/60 border-zinc-700 text-white focus:border-purple-500'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Reward-Aufschlüsselung kompakt */}
            <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl px-3 py-2 space-y-1">
              <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-1.5">{t('cb.rewardPerFan', lang)}</p>
              {items.map((item) => {
                const share = totalWeight > 0 ? (item.reachWeight / totalWeight) * rewardNum : 0;
                return (
                  <div key={item.questType} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="text-zinc-400">{TYPE_ICONS[item.questType]}</span>
                      {getTypeLabel(item.questType, lang)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-amber-400">+{item.reachWeight * 8} REP</span>
                      <span className="text-purple-300 font-mono">{share.toFixed(2)}</span>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between text-xs border-t border-zinc-700/50 pt-1 mt-0.5">
                <span className="text-white font-semibold">{t('cb.totalPerFan', lang)}</span>
                <span className="text-green-400 font-mono font-bold">{rewardNum.toFixed(2)} D.FAITH</span>
              </div>
            </div>

            {/* Gesamtkosten */}
            <div className={`rounded-xl px-3 py-2.5 border space-y-1 ${
              hasEnough ? 'bg-green-950/30 border-green-800/40' : 'bg-amber-950/30 border-amber-800/40'
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-zinc-400 text-xs">{t('cb.budgetLock', lang)}</p>
                {!hasEnough && (
                  <button onClick={onOpenDeposit} className="text-blue-400 text-xs hover:underline">{t('cb.depositNow', lang)}</button>
                )}
              </div>
              {/* Budget-Aufschlüsselung */}
              <div className="space-y-0.5 text-xs text-zinc-500">
                <div className="flex justify-between">
                  <span>{t('cb.rewards', lang)} ({rewardNum.toFixed(2)} × {maxNum})</span>
                  <span className="font-mono">{(rewardNum * maxNum).toFixed(2)}</span>
                </div>
                {items.length >= 2 && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">{t('cb.shardDropBudget', lang)}</span>
                    <span className="font-mono text-amber-400">{shardChanceNum}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    {t('cb.levelBonusReserve', lang)}
                    {loadingPlatformUsers
                      ? <span className="text-zinc-600">{t('cb.levelBonusLoading', lang)}</span>
                      : <span className="text-zinc-600">
                          ({topFanBonusPcts.length < effectiveBonusParticipants
                            ? tFmt('cb.fanKnownRest', lang, { known: String(topFanBonusPcts.length), total: String(effectiveBonusParticipants), pct: String(fallbackPct) })
                            : tFmt('cb.fanRepBonus', lang, { n: String(effectiveBonusParticipants) })}
                          {maxCollectibleCreditPct > 0 && ` + Coll. +${maxCollectibleCreditPct}% ×${effectiveBonusParticipants}`}
                          {' '}× 1.02)
                        </span>
                    }
                  </span>
                  <span className="font-mono">{levelBonusReserve.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-1 mt-0.5">
                <div>
                  <p className={`font-bold font-mono text-sm ${hasEnough ? 'text-green-400' : 'text-amber-400'}`}>
                    {totalBudget.toFixed(2)} D.FAITH
                  </p>
                  <p className={`text-xs font-mono ${hasEnough ? 'text-green-600' : 'text-amber-400'}`}>
                    {t('cb.balanceLabel', lang)} {creatorBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="text-amber-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setError(''); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2.5 font-semibold text-sm">
                {t('cb.back', lang)}
              </button>
              <button
                onClick={() => {
                  if (hasDmShare) {
                    if (!storyToken) setStoryToken(crypto.randomUUID());
                    setError('');
                    setStep(4);
                    return;
                  }
                  void handleCreate();
                }}
                disabled={creating || !hasEnough || items.length < 1}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors"
              >
                {creating ? t('cb.creating', lang) : hasDmShare ? t('cb.toStep4', lang) : items.length >= 2 ? t('cb.createBundle', lang) : t('cb.createQuestBtn', lang)}
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </Modal>
  );
}
