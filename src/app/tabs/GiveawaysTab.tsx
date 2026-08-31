"use client";
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { FaPlus, FaGift, FaCopy, FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaLock, FaSync, FaCoins } from 'react-icons/fa';
import { upload } from '@vercel/blob/client';
import { useLang } from '../components/LangContext';
import { t, tFmt } from '../utils/i18n';
import { slugify } from '../utils/slug';

// ─── Giveaways (Artist-Tool) ──────────────────────────────────────────────────

type GiveawayPlatformKey = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'instagram_polska' | 'tiktok_polska';
// "Wire"-Plattform: welcher available-media-Endpoint + welches Antwortformat gilt.
// instagram_polska/tiktok_polska sind eigene Kampagnen-Slots (eigener Post, eigene
// Auswahl), technisch aber identisch zu instagram/tiktok — nur der Account (Wallet)
// unterscheidet sich.
type WirePlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube';
function wirePlatformOf(p: GiveawayPlatformKey): WirePlatform {
  if (p === 'instagram_polska') return 'instagram';
  if (p === 'tiktok_polska') return 'tiktok';
  return p;
}

const GIVEAWAY_PLATFORM_META: Record<GiveawayPlatformKey, { label: string; icon: ReactNode }> = {
  instagram:         { label: 'Instagram',        icon: <FaInstagram className="text-pink-500" size={13} /> },
  tiktok:            { label: 'TikTok',            icon: <FaTiktok className="text-zinc-200" size={12} /> },
  facebook:          { label: 'Facebook',          icon: <FaFacebook className="text-blue-500" size={13} /> },
  youtube:           { label: 'YouTube',           icon: <FaYoutube className="text-red-500" size={13} /> },
  instagram_polska:  { label: 'Instagram (Polska)', icon: <FaInstagram className="text-pink-500" size={13} /> },
  tiktok_polska:     { label: 'TikTok (Polska)',    icon: <FaTiktok className="text-zinc-200" size={12} /> },
};
// Reihenfolge in der Erstellungs-Form; die _polska-Einträge werden nur für Dawid
// Faith eingeblendet (siehe isDawidFaith-Filter beim Rendern).
const GIVEAWAY_PLATFORMS: GiveawayPlatformKey[] = ['instagram', 'instagram_polska', 'tiktok', 'tiktok_polska', 'facebook', 'youtube'];

const AVAILABLE_MEDIA_ENDPOINT: Record<WirePlatform, string> = {
  instagram: '/api/instagram-quests/available-media',
  tiktok:    '/api/tiktok-quests/available-media',
  facebook:  '/api/facebook-quests/available-media',
  youtube:   '/api/youtube-quests/available-media',
};

// Zusätzliche Accounts, von denen Dawid Faith Instagram/TikTok-Beiträge für
// Giveaways auswählen kann (virtuelle Platform-Wallets, siehe lib/platformAccounts.ts).
// Facebook bewusst ausgenommen: die Kommentar-Verifizierung dort hängt am fest
// hinterlegten Dawid-Faith-Page-Token, nicht an frei wählbaren Accounts.
const DAWID_FAITH_WALLET = 'user_3dfvunr7ziaywue8bhzdqw2blsw';
const POLSKA_WALLET = 'platform_dawid_faith_polska';

/** Für _polska-Slots wird immer die Polska-Wallet durchsucht, sonst die des Artists. */
function walletForPlatform(p: GiveawayPlatformKey, artistWallet: string): string {
  return (p === 'instagram_polska' || p === 'tiktok_polska') ? POLSKA_WALLET : artistWallet;
}

interface MediaPickItem {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
}

/** Normalisiert die unterschiedlichen available-media Antwortformate der 4 Plattformen. */
async function fetchAvailableMedia(platform: GiveawayPlatformKey, wallet: string, loadErrorMessage: string): Promise<{ items: MediaPickItem[]; hint?: string; error?: string }> {
  const wire = wirePlatformOf(platform);
  try {
    const res = await fetch(`${AVAILABLE_MEDIA_ENDPOINT[wire]}?wallet=${encodeURIComponent(wallet)}`);
    const data = await res.json();
    if (data.error) return { items: [], error: data.error };

    const raw: any[] = Array.isArray(data.media) ? data.media : [];
    let items: MediaPickItem[] = [];

    if (wire === 'instagram') {
      items = raw.map(m => ({
        id: String(m.graph_media_id || m.shortcode || ''),
        url: String(m.permalink || ''),
        thumbnail: String(m.thumbnail_url || m.media_url || ''),
        title: String(m.caption || '').slice(0, 70),
      }));
    } else if (wire === 'facebook') {
      items = raw.map(m => ({
        id: String(m.post_id || ''),
        url: String(m.permalink || ''),
        thumbnail: String(m.thumbnail_url || ''),
        title: String(m.caption || '').slice(0, 70),
      }));
    } else {
      // tiktok + youtube teilen sich das gleiche Format
      items = raw.map(m => ({
        id: String(m.video_id || ''),
        url: String(m.video_url || ''),
        thumbnail: String(m.thumbnail_url || ''),
        title: String(m.title || '').slice(0, 70),
      }));
    }

    return { items: items.filter(i => i.id && i.url), hint: data.hint };
  } catch {
    return { items: [], error: loadErrorMessage };
  }
}

interface GiveawayCampaignData {
  id: string;
  title: string;
  imageUrl: string | null;
  mediaType: 'image' | 'video';
  requiredText: string;
  creditReward: number;
  repReward: number;
  shardReward: number;
  maxWinners: number;
  winnerCount: number;
  status: 'active' | 'ended';
  platforms: { platform: GiveawayPlatformKey; postUrl: string }[];
}

function GiveawaysPanel({ artistWallet, artistName }: { artistWallet: string; artistName: string | null }) {
  const lang = useLang();
  const isDawidFaith = artistWallet.toLowerCase() === DAWID_FAITH_WALLET;
  const [campaigns, setCampaigns] = useState<GiveawayCampaignData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [balance, setBalance]     = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');
  const [copiedPermanent, setCopiedPermanent] = useState(false);

  const [title, setTitle]                 = useState('');
  const [mediaFile, setMediaFile]         = useState<File | null>(null);
  const [mediaPreview, setMediaPreview]   = useState<string | null>(null);
  const [mediaType, setMediaType]         = useState<'image' | 'video'>('image');
  const [creditReward, setCreditReward]   = useState('50');
  const [repReward, setRepReward]         = useState('0');
  const [shardReward, setShardReward]     = useState('0');
  const [maxWinners, setMaxWinners]       = useState('20');
  const [requiredText, setRequiredText]   = useState('dfaith');
  const [releaseAt, setReleaseAt]         = useState('');
  const [presaveUrl, setPresaveUrl]       = useState('');
  const [enabledPlatforms, setEnabledPlatforms] = useState<Partial<Record<GiveawayPlatformKey, boolean>>>({});
  const [platformUrls, setPlatformUrls]         = useState<Partial<Record<GiveawayPlatformKey, string>>>({});
  const [platformMediaIds, setPlatformMediaIds] = useState<Partial<Record<GiveawayPlatformKey, string>>>({});
  const [mediaLists, setMediaLists]     = useState<Partial<Record<GiveawayPlatformKey, MediaPickItem[]>>>({});
  const [mediaLoading, setMediaLoading] = useState<Partial<Record<GiveawayPlatformKey, boolean>>>({});
  const [mediaHint, setMediaHint]       = useState<Partial<Record<GiveawayPlatformKey, string>>>({});
  // Premiere-Giveaway (nur YouTube): Checkbox + automatisch/manuell gesetzter Live-Start.
  const [premiereEnabled, setPremiereEnabled]   = useState(false);
  const [premiereStartsAt, setPremiereStartsAt] = useState('');
  const [premiereLoading, setPremiereLoading]   = useState(false);

  // "Plattform nachträglich hinzufügen" — für laufende Kampagnen, bei denen der
  // Artist nicht alle Plattformen gleichzeitig posten kann (z.B. erst Instagram,
  // TikTok/Facebook/YouTube dann einen Tag später).
  const [addPlatformOpenFor, setAddPlatformOpenFor] = useState<string | null>(null);
  const [addPlatformSelected, setAddPlatformSelected] = useState<GiveawayPlatformKey | ''>('');
  const [addPlatformUrl, setAddPlatformUrl] = useState('');
  const [addPlatformPremiereEnabled, setAddPlatformPremiereEnabled] = useState(false);
  const [addPlatformPremiereStartsAt, setAddPlatformPremiereStartsAt] = useState('');
  const [addPlatformSubmitting, setAddPlatformSubmitting] = useState(false);
  const [addPlatformError, setAddPlatformError] = useState('');

  const load = useCallback(async () => {
    if (!artistWallet) return;
    setLoading(true);
    try {
      const [campaignsRes, balanceRes] = await Promise.all([
        fetch(`/api/giveaways/campaigns?artistWallet=${artistWallet}`),
        fetch(`/api/youtube-quests/creator-balance?wallet=${artistWallet}`),
      ]);
      const data = await campaignsRes.json();
      setCampaigns(data.campaigns ?? []);
      if (balanceRes.ok) {
        const balData = await balanceRes.json();
        setBalance(typeof balData.balance === 'number' ? balData.balance : Number(balData.balance ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }, [artistWallet]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setTitle(''); setMediaFile(null); setMediaPreview(null); setMediaType('image');
    setCreditReward('50'); setRepReward('0'); setShardReward('0'); setMaxWinners('20'); setRequiredText('dfaith');
    setReleaseAt(''); setPresaveUrl('');
    setEnabledPlatforms({}); setPlatformUrls({}); setPlatformMediaIds({});
    setMediaLists({}); setMediaLoading({}); setMediaHint({});
    setPremiereEnabled(false); setPremiereStartsAt('');
  };

  const loadMediaForPlatform = async (p: GiveawayPlatformKey) => {
    setMediaLoading(prev => ({ ...prev, [p]: true }));
    setMediaHint(prev => ({ ...prev, [p]: '' }));
    const wallet = walletForPlatform(p, artistWallet);
    const { items, hint, error: err } = await fetchAvailableMedia(p, wallet, t('gw.errMediaLoad', lang));
    setMediaLists(prev => ({ ...prev, [p]: items }));
    if (hint || err) setMediaHint(prev => ({ ...prev, [p]: hint || err || '' }));
    setMediaLoading(prev => ({ ...prev, [p]: false }));
  };

  const togglePlatform = (p: GiveawayPlatformKey, checked: boolean) => {
    setEnabledPlatforms(prev => ({ ...prev, [p]: checked }));
    if (checked && !mediaLists[p] && !mediaLoading[p]) {
      loadMediaForPlatform(p);
    }
  };

  const fetchPremiereStart = (videoIdOrUrl: string) => {
    if (!videoIdOrUrl.trim()) return;
    setPremiereLoading(true);
    setPremiereStartsAt('');
    fetch(`/api/giveaways/youtube-premiere-info?videoId=${encodeURIComponent(videoIdOrUrl)}`)
      .then(res => res.json())
      .then(data => {
        if (data.startsAt) {
          // datetime-local erwartet lokale Zeit ohne Zeitzonen-Suffix
          const local = new Date(data.startsAt);
          local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
          setPremiereStartsAt(local.toISOString().slice(0, 16));
        }
      })
      .catch(() => {})
      .finally(() => setPremiereLoading(false));
  };

  const pickMedia = (p: GiveawayPlatformKey, item: MediaPickItem) => {
    setPlatformUrls(prev => ({ ...prev, [p]: item.url }));
    setPlatformMediaIds(prev => ({ ...prev, [p]: item.id }));
    if (p === 'youtube' && premiereEnabled) fetchPremiereStart(item.id);
  };

  const handleCreate = async () => {
    setError('');
    const reward  = Math.round(Number(creditReward));
    const repRewardNum = Math.max(0, Math.round(Number(repReward) || 0));
    const shardRewardNum = Math.max(0, Math.round(Number(shardReward) || 0));
    const winners = Math.round(Number(maxWinners));
    const platforms = GIVEAWAY_PLATFORMS
      .filter(p => enabledPlatforms[p])
      .map(p => ({
        platform: p,
        postUrl: (platformUrls[p] ?? '').trim(),
        mediaId: platformMediaIds[p] ?? null,
        premiereStartsAt: p === 'youtube' && premiereEnabled && premiereStartsAt
          ? new Date(premiereStartsAt).toISOString()
          : null,
      }));

    if (!title.trim()) return setError(t('gw.errTitleRequired', lang));
    if (!reward || reward <= 0) return setError(t('gw.errInvalidReward', lang));
    if (!winners || winners <= 0) return setError(t('gw.errInvalidWinners', lang));
    if (platforms.length === 0) return setError(t('gw.errNoPlatform', lang));
    if (platforms.some(p => !p.postUrl)) return setError(t('gw.errMissingLink', lang));
    if (balance !== null && reward * winners > balance) {
      return setError(tFmt('gw.errInsufficientBudget', lang, {
        needed: (reward * winners).toLocaleString('de-DE'),
        available: balance.toLocaleString('de-DE'),
      }));
    }

    setCreating(true);
    try {
      let mediaUrl: string | null = null;
      if (mediaFile) {
        const blob = await upload(`giveaways/${artistWallet}/${Date.now()}-${mediaFile.name}`, mediaFile, {
          access: 'public',
          handleUploadUrl: '/api/giveaways/upload',
          clientPayload: JSON.stringify({ wallet: artistWallet }),
        });
        mediaUrl = blob.url;
      }
      const res = await fetch('/api/giveaways/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistWallet, title: title.trim(), imageUrl: mediaUrl, mediaType,
          requiredText: requiredText.trim() || 'dfaith',
          creditReward: reward, repReward: repRewardNum, shardReward: shardRewardNum, maxWinners: winners, platforms,
          releaseAt: releaseAt || null,
          presaveUrl: presaveUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t('gw.errGeneric', lang)); return; }
      setShowCreate(false);
      resetForm();
      await load();
    } catch {
      setError(t('gw.errNetwork', lang));
    } finally {
      setCreating(false);
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm(t('gw.confirmEnd', lang))) return;
    await fetch(`/api/giveaways/campaigns/${id}?artistWallet=${artistWallet}`, { method: 'PATCH' });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('gw.confirmDelete', lang))) return;
    await fetch(`/api/giveaways/campaigns/${id}?artistWallet=${artistWallet}`, { method: 'DELETE' });
    await load();
  };

  const openAddPlatform = (campaignId: string) => {
    setAddPlatformOpenFor(prev => prev === campaignId ? null : campaignId);
    setAddPlatformSelected(''); setAddPlatformUrl('');
    setAddPlatformPremiereEnabled(false); setAddPlatformPremiereStartsAt('');
    setAddPlatformError('');
  };

  const handleAddPlatform = async (campaignId: string) => {
    if (!addPlatformSelected || !addPlatformUrl.trim()) return;
    setAddPlatformSubmitting(true);
    setAddPlatformError('');
    try {
      const res = await fetch(`/api/giveaways/campaigns/${campaignId}/platforms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistWallet,
          platform: addPlatformSelected,
          postUrl: addPlatformUrl.trim(),
          premiereStartsAt: addPlatformSelected === 'youtube' && addPlatformPremiereEnabled && addPlatformPremiereStartsAt
            ? new Date(addPlatformPremiereStartsAt).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddPlatformError(data.error ?? t('gw.errGeneric', lang)); return; }
      setAddPlatformOpenFor(null);
      await load();
    } catch {
      setAddPlatformError(t('gw.errNetwork', lang));
    } finally {
      setAddPlatformSubmitting(false);
    }
  };

  // Permanenter Link, immer gleich — zeigt automatisch die neueste Kampagne dieses
  // Artists an. Wichtig für automatisierte Antworten (z.B. TikTok-Kommentar-Bots),
  // die sonst pro Kampagne neu durch den App-Review müssten. Nutzt den lesbaren
  // Namens-Slug statt der rohen Wallet-ID, sofern ein Anzeigename gesetzt ist.
  const linkSlug = artistName ? slugify(artistName) : '';
  const permanentLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/win/${linkSlug || artistWallet}`;

  const copyPermanentLink = () => {
    navigator.clipboard.writeText(permanentLink).then(() => {
      setCopiedPermanent(true);
      setTimeout(() => setCopiedPermanent(false), 2000);
    }).catch(() => {});
  };

  const hasActiveCampaign = campaigns.some(c => c.status === 'active');

  return (
    <div className="px-4">
      {/* ── Guthaben ── */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">{t('gw.balanceLabel', lang)}</p>
          <p className="text-amber-300 font-black text-xl leading-none flex items-center gap-1.5">
            <FaCoins size={14} />{balance === null ? '…' : balance.toLocaleString('de-DE')}
          </p>
          <p className="text-zinc-500 text-[9px] mt-0.5">{t('gw.creditsUnit', lang)}</p>
        </div>
        <p className="text-zinc-500 text-[10px] max-w-[130px] text-right leading-snug">
          {t('gw.balanceHint', lang)}
        </p>
      </div>

      {/* ── Permanenter Link ── */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('gw.permanentLinkLabel', lang)}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate text-amber-300 text-xs bg-black/20 rounded-lg px-2.5 py-2">{permanentLink}</code>
          <button
            onClick={copyPermanentLink}
            className="shrink-0 flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
          >
            <FaCopy size={10} /> {copiedPermanent ? t('gw.copied', lang) : t('gw.copyLink', lang)}
          </button>
        </div>
        <p className="text-zinc-500 text-[10px] mt-1.5">{t('gw.permanentLinkHint', lang)}</p>
      </div>

      <button
        onClick={() => setShowCreate(v => !v)}
        disabled={hasActiveCampaign && !showCreate}
        className="w-full mb-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
      >
        <FaPlus size={11} /> {showCreate ? t('gw.cancelButton', lang) : t('gw.newCampaignButton', lang)}
      </button>
      {hasActiveCampaign && !showCreate && (
        <p className="text-zinc-500 text-[10px] text-center mb-4">{t('gw.activeCampaignBlocksNew', lang)}</p>
      )}

      {showCreate && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.bannerLabel', lang)}</label>
            <label className="flex items-center justify-center bg-white/[0.03] border border-dashed border-white/[0.15] rounded-xl h-28 cursor-pointer overflow-hidden">
              {mediaPreview ? (
                mediaType === 'video' ? (
                  <video src={mediaPreview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                ) : (
                  <Image src={mediaPreview} alt="" width={400} height={112} className="w-full h-full object-cover" />
                )
              ) : (
                <span className="text-zinc-500 text-xs">{t('gw.bannerPlaceholder', lang)}</span>
              )}
              <input
                type="file" accept="image/*,video/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setMediaFile(f);
                  setMediaType(f.type.startsWith('video/') ? 'video' : 'image');
                  setMediaPreview(URL.createObjectURL(f));
                }}
              />
            </label>
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.titleLabel', lang)}</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('gw.titlePlaceholder', lang)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.creditPerWinnerLabel', lang)}</label>
              <input
                type="number" min={1} value={creditReward} onChange={e => setCreditReward(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.maxWinnersLabel', lang)}</label>
              <input
                type="number" min={1} value={maxWinners} onChange={e => setMaxWinners(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.repPerWinnerLabel', lang)}</label>
              <input
                type="number" min={0} value={repReward} onChange={e => setRepReward(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.shardPerWinnerLabel', lang)}</label>
              <input
                type="number" min={0} value={shardReward} onChange={e => setShardReward(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
            balance !== null && (Number(creditReward) || 0) * (Number(maxWinners) || 0) > balance
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            {tFmt('gw.budgetText', lang, { amount: ((Number(creditReward) || 0) * (Number(maxWinners) || 0)).toLocaleString('de-DE') })}
            {balance !== null && tFmt('gw.budgetAvailable', lang, { n: balance.toLocaleString('de-DE') })}
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.commentWordLabel', lang)}</label>
            <input
              value={requiredText} onChange={e => setRequiredText(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
            />
            <p className="text-zinc-600 text-[10px] mt-1">{tFmt('gw.commentWordHint', lang, { word: requiredText || 'dfaith' })}</p>
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.releaseAtLabel', lang)}</label>
            <input
              type="datetime-local" value={releaseAt} onChange={e => setReleaseAt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
            />
            <p className="text-zinc-600 text-[10px] mt-1">{t('gw.releaseAtHint', lang)}</p>
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('gw.presaveUrlLabel', lang)}</label>
            <input
              type="url" value={presaveUrl} onChange={e => setPresaveUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
            />
            <p className="text-zinc-600 text-[10px] mt-1">{t('gw.presaveUrlHint', lang)}</p>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block">{t('gw.platformsLabel', lang)}</label>
            {GIVEAWAY_PLATFORMS.filter(p => isDawidFaith || !p.endsWith('_polska')).map(p => (
              <div key={p} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-200 mb-1.5 cursor-pointer">
                  <input
                    type="checkbox" checked={!!enabledPlatforms[p]}
                    onChange={e => togglePlatform(p, e.target.checked)}
                  />
                  {GIVEAWAY_PLATFORM_META[p].icon} {GIVEAWAY_PLATFORM_META[p].label}
                </label>
                {enabledPlatforms[p] && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-zinc-500 text-[10px]">{t('gw.availableMedia', lang)}</p>
                      <button
                        onClick={() => loadMediaForPlatform(p)}
                        disabled={mediaLoading[p]}
                        className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-semibold disabled:opacity-50"
                      >
                        <FaSync size={9} className={mediaLoading[p] ? 'animate-spin' : ''} /> {t('gw.refresh', lang)}
                      </button>
                    </div>

                    {mediaLoading[p] ? (
                      <div className="flex justify-center py-4">
                        <span className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      </div>
                    ) : (mediaLists[p]?.length ?? 0) > 0 ? (
                      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                        {mediaLists[p]!.map(item => (
                          <button
                            key={item.id}
                            onClick={() => pickMedia(p, item)}
                            title={item.title}
                            className={`shrink-0 w-16 rounded-lg overflow-hidden border-2 transition-all ${
                              platformMediaIds[p] === item.id ? 'border-amber-400' : 'border-transparent'
                            }`}
                          >
                            {item.thumbnail ? (
                              <Image src={item.thumbnail} alt="" width={64} height={64} className="w-16 h-16 object-cover" unoptimized />
                            ) : (
                              <div className="w-16 h-16 bg-white/[0.06] flex items-center justify-center text-zinc-600 text-[9px]">?</div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : mediaHint[p] ? (
                      <p className="text-amber-400/80 text-[10px] bg-amber-500/5 rounded-lg p-2">{mediaHint[p]}</p>
                    ) : (
                      <p className="text-zinc-600 text-[10px]">{t('gw.noVideosFound', lang)}</p>
                    )}

                    <input
                      value={platformUrls[p] ?? ''}
                      onChange={e => {
                        setPlatformUrls(prev => ({ ...prev, [p]: e.target.value }));
                        setPlatformMediaIds(prev => ({ ...prev, [p]: '' }));
                      }}
                      onBlur={e => {
                        if (p === 'youtube' && premiereEnabled && e.target.value.trim()) fetchPremiereStart(e.target.value.trim());
                      }}
                      placeholder={t('gw.manualLinkPlaceholder', lang)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                    />

                    {p === 'youtube' && (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 space-y-1.5">
                        <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox" checked={premiereEnabled}
                            onChange={e => { setPremiereEnabled(e.target.checked); if (!e.target.checked) setPremiereStartsAt(''); }}
                          />
                          🔴 {t('gw.premiereLabel', lang)}
                        </label>
                        {premiereEnabled && (
                          <>
                            <p className="text-zinc-600 text-[10px]">{t('gw.premiereHint', lang)}</p>
                            {premiereLoading ? (
                              <p className="text-zinc-500 text-[10px]">{t('gw.premiereLoading', lang)}</p>
                            ) : (
                              <input
                                type="datetime-local" value={premiereStartsAt}
                                onChange={e => setPremiereStartsAt(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

          <button
            onClick={handleCreate} disabled={creating}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
          >
            {creating ? t('gw.creatingCampaign', lang) : t('gw.startCampaign', lang)}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <FaGift className="text-zinc-600 mx-auto mb-3" size={28} />
          <p className="text-zinc-400 font-semibold text-sm">{t('gw.noCampaigns', lang)}</p>
          <p className="text-zinc-600 text-xs mt-1">{t('gw.noCampaignsHint', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              {c.imageUrl && (
                c.mediaType === 'video' ? (
                  <video src={c.imageUrl} className="w-full h-32 object-cover" muted autoPlay loop playsInline />
                ) : (
                  <Image src={c.imageUrl} alt={c.title} width={600} height={160} className="w-full h-32 object-cover" />
                )
              )}
              <div className="p-3.5">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="font-bold text-sm text-white truncate">{c.title}</p>
                  <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full ${
                    c.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {c.status === 'active' ? t('gw.statusActive', lang) : t('gw.statusEnded', lang)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {c.platforms.map(p => <span key={p.platform}>{GIVEAWAY_PLATFORM_META[p.platform]?.icon}</span>)}
                  {c.status === 'active' && GIVEAWAY_PLATFORMS.some(p => (isDawidFaith || !p.endsWith('_polska')) && !c.platforms.some(cp => cp.platform === p)) && (
                    <button
                      onClick={() => openAddPlatform(c.id)}
                      className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-semibold ml-1"
                    >
                      <FaPlus size={8} /> {t('gw.addPlatform', lang)}
                    </button>
                  )}
                </div>

                {addPlatformOpenFor === c.id && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-3 space-y-2">
                    <select
                      value={addPlatformSelected}
                      onChange={e => { setAddPlatformSelected(e.target.value as GiveawayPlatformKey); setAddPlatformUrl(''); setAddPlatformError(''); }}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                    >
                      <option value="">{t('gw.selectPlatform', lang)}</option>
                      {GIVEAWAY_PLATFORMS.filter(p => (isDawidFaith || !p.endsWith('_polska')) && !c.platforms.some(cp => cp.platform === p)).map(p => (
                        <option key={p} value={p}>{GIVEAWAY_PLATFORM_META[p].label}</option>
                      ))}
                    </select>
                    {addPlatformSelected && (
                      <>
                        <input
                          value={addPlatformUrl}
                          onChange={e => setAddPlatformUrl(e.target.value)}
                          placeholder={t('gw.manualLinkPlaceholder', lang)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                        />
                        {addPlatformSelected === 'youtube' && (
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 space-y-1.5">
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-200 cursor-pointer">
                              <input
                                type="checkbox" checked={addPlatformPremiereEnabled}
                                onChange={e => { setAddPlatformPremiereEnabled(e.target.checked); if (!e.target.checked) setAddPlatformPremiereStartsAt(''); }}
                              />
                              🔴 {t('gw.premiereLabel', lang)}
                            </label>
                            {addPlatformPremiereEnabled && (
                              <input
                                type="datetime-local" value={addPlatformPremiereStartsAt}
                                onChange={e => setAddPlatformPremiereStartsAt(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                              />
                            )}
                          </div>
                        )}
                        {addPlatformError && <p className="text-red-400 text-[10px]">{addPlatformError}</p>}
                        <button
                          onClick={() => handleAddPlatform(c.id)}
                          disabled={addPlatformSubmitting || !addPlatformUrl.trim()}
                          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-lg py-2 text-xs transition-all"
                        >
                          {addPlatformSubmitting ? t('gw.creatingCampaign', lang) : t('gw.addPlatformSubmit', lang)}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-zinc-500 text-xs">
                    {tFmt('gw.winnersProgress', lang, { count: c.winnerCount, max: c.maxWinners, reward: c.creditReward })}
                  </p>
                  {(c.repReward > 0 || c.shardReward > 0) && (
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {c.repReward > 0 && tFmt('gw.plusRep', lang, { n: c.repReward })}
                      {c.repReward > 0 && c.shardReward > 0 && ' · '}
                      {c.shardReward > 0 && tFmt('gw.plusShard', lang, { n: c.shardReward })}
                    </p>
                  )}
                </div>
                {c.status === 'active' ? (
                  <button
                    onClick={() => handleEnd(c.id)}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl py-2 text-xs font-semibold transition-all"
                  >
                    {t('gw.endCampaign', lang)}
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl py-2 text-xs font-semibold transition-all"
                  >
                    {t('gw.deleteCampaign', lang)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GiveawaysTab() {
  const lang = useLang();
  const { user } = useUser();
  const walletAddress = user?.id ?? '';
  const [isArtist, setIsArtist] = useState<boolean | null>(null);
  const [artistName, setArtistName] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setIsArtist(!!(data?.profile?.isArtist));
        setArtistName(data?.profile?.displayName ?? data?.profile?.clerkName ?? null);
      })
      .catch(() => setIsArtist(false));
  }, [walletAddress]);

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={40} height={40} className="w-10 h-10 rounded-full object-contain shrink-0" />
            <div>
              <h1 className="text-white font-black text-xl tracking-wide flex items-center gap-2">
                <FaGift className="text-rose-400" size={17} /> {t('gw.title', lang)}
              </h1>
              <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                {t('gw.subtitle', lang)}
              </p>
            </div>
          </div>
        </div>

        {isArtist === null ? (
          <div className="flex justify-center py-16">
            <span className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : isArtist ? (
          <GiveawaysPanel artistWallet={walletAddress} artistName={artistName} />
        ) : (
          <div className="text-center py-16 px-6">
            <FaLock className="text-zinc-600 mx-auto mb-3" size={26} />
            <p className="text-zinc-400 font-semibold text-sm">{t('gw.artistOnly', lang)}</p>
            <p className="text-zinc-600 text-xs mt-1">{t('gw.artistOnlyHint', lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
