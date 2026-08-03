"use client";
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { FaPlus, FaGift, FaCopy, FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaLock } from 'react-icons/fa';
import { upload } from '@vercel/blob/client';

// ─── Giveaways (Artist-Tool) ──────────────────────────────────────────────────

type GiveawayPlatformKey = 'instagram' | 'tiktok' | 'facebook' | 'youtube';

const GIVEAWAY_PLATFORM_META: Record<GiveawayPlatformKey, { label: string; icon: ReactNode }> = {
  instagram: { label: 'Instagram', icon: <FaInstagram className="text-pink-500" size={13} /> },
  tiktok:    { label: 'TikTok',    icon: <FaTiktok className="text-zinc-200" size={12} /> },
  facebook:  { label: 'Facebook',  icon: <FaFacebook className="text-blue-500" size={13} /> },
  youtube:   { label: 'YouTube',   icon: <FaYoutube className="text-red-500" size={13} /> },
};
const GIVEAWAY_PLATFORMS: GiveawayPlatformKey[] = ['instagram', 'tiktok', 'facebook', 'youtube'];

interface GiveawayCampaignData {
  id: string;
  title: string;
  imageUrl: string | null;
  requiredText: string;
  creditReward: number;
  maxWinners: number;
  winnerCount: number;
  status: 'active' | 'ended';
  platforms: { platform: GiveawayPlatformKey; postUrl: string }[];
}

function GiveawaysPanel({ artistWallet }: { artistWallet: string }) {
  const [campaigns, setCampaigns] = useState<GiveawayCampaignData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');
  const [copiedId, setCopiedId]   = useState<string | null>(null);

  const [title, setTitle]                 = useState('');
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [creditReward, setCreditReward]   = useState('50');
  const [maxWinners, setMaxWinners]       = useState('20');
  const [requiredText, setRequiredText]   = useState('dfaith');
  const [enabledPlatforms, setEnabledPlatforms] = useState<Partial<Record<GiveawayPlatformKey, boolean>>>({});
  const [platformUrls, setPlatformUrls]         = useState<Partial<Record<GiveawayPlatformKey, string>>>({});

  const load = useCallback(async () => {
    if (!artistWallet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/giveaways/campaigns?artistWallet=${artistWallet}`);
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, [artistWallet]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setTitle(''); setImageFile(null); setImagePreview(null);
    setCreditReward('50'); setMaxWinners('20'); setRequiredText('dfaith');
    setEnabledPlatforms({}); setPlatformUrls({});
  };

  const handleCreate = async () => {
    setError('');
    const reward  = Math.round(Number(creditReward));
    const winners = Math.round(Number(maxWinners));
    const platforms = GIVEAWAY_PLATFORMS
      .filter(p => enabledPlatforms[p])
      .map(p => ({ platform: p, postUrl: (platformUrls[p] ?? '').trim() }));

    if (!title.trim()) return setError('Bitte einen Titel eingeben.');
    if (!reward || reward <= 0) return setError('Ungültige Credit-Belohnung.');
    if (!winners || winners <= 0) return setError('Ungültige Gewinneranzahl.');
    if (platforms.length === 0) return setError('Mindestens eine Plattform aktivieren.');
    if (platforms.some(p => !p.postUrl)) return setError('Bitte für jede aktivierte Plattform einen Link angeben.');

    setCreating(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const blob = await upload(`giveaways/${artistWallet}/${Date.now()}-${imageFile.name}`, imageFile, {
          access: 'public',
          handleUploadUrl: '/api/giveaways/upload',
          clientPayload: JSON.stringify({ wallet: artistWallet }),
        });
        imageUrl = blob.url;
      }
      const res = await fetch('/api/giveaways/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistWallet, title: title.trim(), imageUrl,
          requiredText: requiredText.trim() || 'dfaith',
          creditReward: reward, maxWinners: winners, platforms,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler beim Erstellen.'); return; }
      setShowCreate(false);
      resetForm();
      await load();
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setCreating(false);
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm('Gewinnspiel wirklich beenden? Nicht genutztes Budget wird dir zurückerstattet.')) return;
    await fetch(`/api/giveaways/campaigns/${id}?artistWallet=${artistWallet}`, { method: 'DELETE' });
    await load();
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/win/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  return (
    <div className="px-4">
      <button
        onClick={() => setShowCreate(v => !v)}
        className="w-full mb-4 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl py-3 text-sm transition-all"
      >
        <FaPlus size={11} /> {showCreate ? 'Abbrechen' : 'Neues Gewinnspiel erstellen'}
      </button>

      {showCreate && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">Banner (optional)</label>
            <label className="flex items-center justify-center bg-white/[0.03] border border-dashed border-white/[0.15] rounded-xl h-24 cursor-pointer overflow-hidden">
              {imagePreview ? (
                <Image src={imagePreview} alt="" width={400} height={96} className="w-full h-full object-cover" />
              ) : (
                <span className="text-zinc-500 text-xs">Bild wählen</span>
              )}
              <input
                type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImageFile(f);
                  setImagePreview(URL.createObjectURL(f));
                }}
              />
            </label>
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">Titel</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="z.B. Katze Release Giveaway"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">Credits / Gewinner</label>
              <input
                type="number" min={1} value={creditReward} onChange={e => setCreditReward(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">Max. Gewinner</label>
              <input
                type="number" min={1} value={maxWinners} onChange={e => setMaxWinners(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-amber-300 text-xs font-semibold">
            Budget: {((Number(creditReward) || 0) * (Number(maxWinners) || 0)).toLocaleString('de-DE')} Credits werden bei Erstellung reserviert
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">Kommentar-Wort</label>
            <input
              value={requiredText} onChange={e => setRequiredText(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 text-[10px] uppercase tracking-widest block">Plattformen (mind. 1)</label>
            {GIVEAWAY_PLATFORMS.map(p => (
              <div key={p} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-200 mb-1.5 cursor-pointer">
                  <input
                    type="checkbox" checked={!!enabledPlatforms[p]}
                    onChange={e => setEnabledPlatforms(prev => ({ ...prev, [p]: e.target.checked }))}
                  />
                  {GIVEAWAY_PLATFORM_META[p].icon} {GIVEAWAY_PLATFORM_META[p].label}
                </label>
                {enabledPlatforms[p] && (
                  <input
                    value={platformUrls[p] ?? ''}
                    onChange={e => setPlatformUrls(prev => ({ ...prev, [p]: e.target.value }))}
                    placeholder="Link zum Post / Reel / Video"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                  />
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

          <button
            onClick={handleCreate} disabled={creating}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
          >
            {creating ? 'Wird erstellt…' : 'Gewinnspiel starten'}
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
          <p className="text-zinc-400 font-semibold text-sm">Noch keine Gewinnspiele</p>
          <p className="text-zinc-600 text-xs mt-1">Erstelle eins, um Fans über Social Media zu gewinnen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              {c.imageUrl && (
                <Image src={c.imageUrl} alt={c.title} width={600} height={160} className="w-full h-32 object-cover" />
              )}
              <div className="p-3.5">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="font-bold text-sm text-white truncate">{c.title}</p>
                  <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full ${
                    c.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {c.status === 'active' ? 'Aktiv' : 'Beendet'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {c.platforms.map(p => <span key={p.platform}>{GIVEAWAY_PLATFORM_META[p.platform]?.icon}</span>)}
                </div>
                <p className="text-zinc-500 text-xs mb-3">
                  {c.winnerCount} / {c.maxWinners} Gewinner &middot; {c.creditReward} Credits je Gewinner
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyLink(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl py-2 text-xs font-semibold text-zinc-200 transition-all"
                  >
                    <FaCopy size={10} /> {copiedId === c.id ? 'Kopiert!' : 'Link kopieren'}
                  </button>
                  {c.status === 'active' && (
                    <button
                      onClick={() => handleEnd(c.id)}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl py-2 text-xs font-semibold transition-all"
                    >
                      Beenden
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GiveawaysTab() {
  const { user } = useUser();
  const walletAddress = user?.id ?? '';
  const [isArtist, setIsArtist] = useState<boolean | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsArtist(!!(data?.profile?.isArtist)))
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
                <FaGift className="text-rose-400" size={17} /> Giveaways
              </h1>
              <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                Fans über Social Media gewinnen
              </p>
            </div>
          </div>
        </div>

        {isArtist === null ? (
          <div className="flex justify-center py-16">
            <span className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : isArtist ? (
          <GiveawaysPanel artistWallet={walletAddress} />
        ) : (
          <div className="text-center py-16 px-6">
            <FaLock className="text-zinc-600 mx-auto mb-3" size={26} />
            <p className="text-zinc-400 font-semibold text-sm">Nur für Künstler verfügbar</p>
            <p className="text-zinc-600 text-xs mt-1">Dieser Bereich ist Artists vorbehalten.</p>
          </div>
        )}
      </div>
    </div>
  );
}
