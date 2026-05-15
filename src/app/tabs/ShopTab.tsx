'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  FaChevronLeft, FaPlus, FaTimes, FaMusic, FaVideo, FaGem, FaStar,
  FaCoins, FaCheck, FaExternalLinkAlt, FaTrash, FaShoppingBag,
} from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';

// ─── Typen ───────────────────────────────────────────────────────────────────

type ItemType = 'song' | 'video' | 'nft' | 'exclusive';

interface ShopItem {
  id: string;
  artistWallet: string;
  title: string;
  description: string;
  type: ItemType;
  priceCredits: number;
  priceTokens: number | null;
  contentUrl: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  purchased?: boolean;
}

interface ShopArtist {
  artistWallet: string;
  displayName: string | null;
  pictureUrl: string | null;
  itemCount: number;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function shortenWallet(w: string) {
  return w.length > 14 ? `${w.slice(0, 7)}…${w.slice(-5)}` : w;
}

const TYPE_LABELS: Record<ItemType, string> = {
  song: 'Song',
  video: 'Video',
  nft: 'NFT',
  exclusive: 'Exklusiv',
};

const TYPE_COLORS: Record<ItemType, string> = {
  song: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  video: 'bg-red-500/20 text-red-300 border-red-500/30',
  nft: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  exclusive: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

function TypeIcon({ type }: { type: ItemType }) {
  switch (type) {
    case 'song':      return <FaMusic size={11} />;
    case 'video':     return <FaVideo size={11} />;
    case 'nft':       return <FaGem size={11} />;
    case 'exclusive': return <FaStar size={11} />;
  }
}

// ─── Item-Karte ──────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onBuy,
  buying,
  walletAddress,
}: {
  item: ShopItem;
  onBuy: (item: ShopItem, paymentMethod: 'credits' | 'tokens') => void;
  buying: string | null;
  walletAddress: string | null;
}) {
  const [payMethod, setPayMethod] = useState<'credits' | 'tokens'>('credits');

  return (
    <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
      {item.imageUrl && (
        <div className="w-full h-36 overflow-hidden bg-zinc-800">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 space-y-3">
        {/* Typ-Badge + Titel + Preis */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[item.type]}`}>
              <TypeIcon type={item.type} />
              {TYPE_LABELS[item.type]}
            </span>
            <p className="text-white font-semibold text-sm mt-1.5 leading-snug">{item.title}</p>
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1">
              <FaCoins size={10} className="text-amber-400" />
              <span className="text-amber-300 font-bold text-xs">{item.priceCredits.toLocaleString('de-DE')}</span>
            </div>
          </div>
        </div>

        {/* Beschreibung */}
        {item.description && (
          <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{item.description}</p>
        )}

        {/* Kauf-Bereich */}
        {walletAddress && (
          item.purchased ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-900/30 border border-emerald-700/40 rounded-xl py-2 text-emerald-400 text-xs font-semibold">
                <FaCheck size={10} /> Gekauft
              </div>
              {item.contentUrl && (
                <a
                  href={item.contentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  <FaExternalLinkAlt size={9} /> Öffnen
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Zahlungsart-Toggle – immer sichtbar */}
              <div className="flex bg-zinc-800/80 rounded-xl p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setPayMethod('credits')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    payMethod === 'credits' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FaCoins size={10} /> Credits
                </button>
                <button
                  onClick={() => setPayMethod('tokens')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    payMethod === 'tokens' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <SiSolana size={10} /> Tokens
                </button>
              </div>
              <button
                onClick={() => onBuy(item, payMethod)}
                disabled={buying === item.id}
                className={`w-full flex items-center justify-center gap-2 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors ${
                  payMethod === 'tokens' ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'
                }`}
              >
                {buying === item.id
                  ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : payMethod === 'tokens'
                    ? <><SiSolana size={12} /> Mit Tokens kaufen</>
                    : <><FaCoins size={12} /> Mit Credits kaufen</>
                }
              </button>
            </div>
          )
        )}
        {!walletAddress && (
          <div className="text-center text-zinc-600 text-xs py-1">Anmelden zum Kaufen</div>
        )}
      </div>
    </div>
  );
}

// ─── Artist-Shop-Ansicht (Supporter) ─────────────────────────────────────────

function ArtistShopView({
  artist,
  walletAddress,
  onBack,
}: {
  artist: ShopArtist;
  walletAddress: string | null;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyResult, setBuyResult] = useState<{ itemId: string; contentUrl: string; type: string } | null>(null);
  const [buyError, setBuyError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    const url = walletAddress
      ? `/api/shop?artistWallet=${artist.artistWallet}&wallet=${walletAddress}`
      : `/api/shop?artistWallet=${artist.artistWallet}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setItems(data.map((i: Record<string, unknown>) => ({
        id: i.id,
        artistWallet: i.artist_wallet,
        title: i.title,
        description: i.description,
        type: i.type as ItemType,
        priceCredits: Number(i.price_credits),
        priceTokens: i.price_tokens !== null && i.price_tokens !== undefined ? Number(i.price_tokens) : null,
        contentUrl: i.content_url as string,
        imageUrl: i.image_url as string,
        isActive: i.is_active as boolean,
        createdAt: i.created_at as string,
        purchased: i.purchased as boolean,
      })));
    }
    setLoading(false);
  }, [artist.artistWallet, walletAddress]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleBuy = async (item: ShopItem, paymentMethod: 'credits' | 'tokens') => {
    if (!walletAddress) return;
    setBuying(item.id);
    setBuyError('');
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerWallet: walletAddress, itemId: item.id, paymentMethod }),
      });
      if (!res.ok) {
        const err = await res.json();
        setBuyError(err.error ?? 'Kauf fehlgeschlagen');
        return;
      }
      const data = await res.json();
      setBuyResult({ itemId: item.id, contentUrl: data.contentUrl, type: data.type });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, purchased: true } : i));
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Zurück-Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors px-4 pt-2"
      >
        <FaChevronLeft size={11} /> Alle Artists
      </button>

      {/* Artist-Header */}
      <div className="mx-4 bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 ring-2 ring-amber-500/30">
            {artist.pictureUrl
              ? <img src={artist.pictureUrl} alt="" className="w-14 h-14 object-cover" />
              : <div className="w-14 h-14 bg-amber-500/20 flex items-center justify-center"><FaStar className="text-amber-400" size={20} /></div>}
          </div>
          <div>
            <p className="text-white font-bold text-base">
              {artist.displayName || shortenWallet(artist.artistWallet)}
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">{artist.itemCount} {artist.itemCount === 1 ? 'Item' : 'Items'} im Shop</p>
          </div>
        </div>
      </div>

      {/* Fehler-Meldung */}
      {buyError && (
        <div className="mx-4 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center justify-between">
          <span>{buyError}</span>
          <button onClick={() => setBuyError('')}><FaTimes size={12} /></button>
        </div>
      )}

      {/* Kauf-Erfolg */}
      {buyResult && (
        <div className="mx-4 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-300 text-sm">
            <FaCheck size={12} /> Kauf erfolgreich!
          </div>
          <div className="flex items-center gap-2">
            {buyResult.contentUrl && (
              <a href={buyResult.contentUrl} target="_blank" rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
                <FaExternalLinkAlt size={9} /> Öffnen
              </a>
            )}
            <button onClick={() => setBuyResult(null)} className="text-zinc-500 hover:text-zinc-300">
              <FaTimes size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Item-Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="mx-4 bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
          Dieser Artist hat noch keine Items im Shop.
        </div>
      ) : (
        <div className="px-4 grid grid-cols-1 gap-3">
          {items.map(item => (
            <ItemCard key={item.id} item={item} onBuy={handleBuy} buying={buying} walletAddress={walletAddress} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mein Shop (Artist-Modus) ─────────────────────────────────────────────────

function MyShopPanel({ walletAddress }: { walletAddress: string }) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Formular-State
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fType, setFType] = useState<ItemType>('song');
  const [fPrice, setFPrice] = useState('0');
  const [fContent, setFContent] = useState('');
  const [fImage, setFImage] = useState('');

  const loadMyItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/shop?artistWallet=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.map((i: Record<string, unknown>) => ({
        id: i.id,
        artistWallet: i.artist_wallet,
        title: i.title,
        description: i.description,
        type: i.type as ItemType,
        priceCredits: Number(i.price_credits),
        priceTokens: i.price_tokens !== null && i.price_tokens !== undefined ? Number(i.price_tokens) : null,
        contentUrl: i.content_url as string,
        imageUrl: i.image_url as string,
        isActive: i.is_active as boolean,
        createdAt: i.created_at as string,
      })));
    }
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { loadMyItems(); }, [loadMyItems]);

  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFType('song'); setFPrice('0');
    setFContent(''); setFImage(''); setFormError('');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!fTitle.trim()) { setFormError('Titel ist Pflicht'); return; }
    const price = parseInt(fPrice, 10);
    if (isNaN(price) || price < 0) { setFormError('Ungültiger Preis'); return; }

    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          title: fTitle,
          description: fDesc,
          type: fType,
          priceCredits: price,
          contentUrl: fContent,
          imageUrl: fImage,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? 'Fehler beim Erstellen');
        return;
      }
      resetForm();
      loadMyItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    await fetch('/api/shop', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, itemId }),
    });
    setItems(prev => prev.filter(i => i.id !== itemId));
    setDeleting(null);
  };

  return (
    <div className="px-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em]">Mein Shop</p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <FaPlus size={9} /> Neues Item
          </button>
        )}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white text-sm font-semibold">Neues Item</p>
            <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-300"><FaTimes size={13} /></button>
          </div>

          {/* Titel */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Titel *</label>
            <input
              value={fTitle}
              onChange={e => setFTitle(e.target.value)}
              placeholder="z.B. Unreleased Track Vol. 1"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Beschreibung</label>
            <textarea
              value={fDesc}
              onChange={e => setFDesc(e.target.value)}
              rows={2}
              placeholder="Was erhalten die Käufer?"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Typ + Preise */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Typ *</label>
              <select
                value={fType}
                onChange={e => setFType(e.target.value as ItemType)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                <option value="song">Song</option>
                <option value="video">Video</option>
                <option value="nft">NFT</option>
                <option value="exclusive">Exklusiv</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Preis Credits *</label>
              <input
                type="number"
                min="0"
                value={fPrice}
                onChange={e => setFPrice(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Content-URL */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Content-URL (nach Kauf sichtbar)</label>
            <input
              value={fContent}
              onChange={e => setFContent(e.target.value)}
              placeholder="https://… (Link, Drive, etc.)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Bild-URL */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Vorschaubild-URL (optional)</label>
            <input
              value={fImage}
              onChange={e => setFImage(e.target.value)}
              placeholder="https://… (Bild-Link)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {formError && (
            <p className="text-red-400 text-xs">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Item erstellen'}
            </button>
            <button onClick={resetForm} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Item-Liste */}
      {loading ? (
        <div className="flex justify-center py-10">
          <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
          Noch keine Items. Erstelle deinen ersten Shop-Eintrag!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[item.type]}`}>
                        <TypeIcon type={item.type} />
                        {TYPE_LABELS[item.type]}
                      </span>
                    </div>
                    <p className="text-white text-sm font-semibold mt-1 truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{item.description}</p>
                    )}
                    <p className="text-amber-400 text-xs mt-1 font-semibold flex items-center gap-1">
                      <FaCoins size={9} /> {item.priceCredits.toLocaleString('de-DE')} Credits / Tokens
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="shrink-0 text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors p-1"
                >
                  {deleting === item.id
                    ? <span className="w-3.5 h-3.5 border border-red-400/30 border-t-red-400 rounded-full animate-spin block" />
                    : <FaTrash size={12} />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Artist-Auswahl (Supporter-Liste) ────────────────────────────────────────

function ArtistList({
  walletAddress,
  onSelect,
}: {
  walletAddress: string | null;
  onSelect: (artist: ShopArtist) => void;
}) {
  const [artists, setArtists] = useState<ShopArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/shop/artists')
      .then(r => r.ok ? r.json() : [])
      .then((data: Record<string, unknown>[]) => setArtists(data.map(a => ({
        artistWallet: a.artist_wallet as string,
        displayName: a.display_name as string | null,
        pictureUrl: a.picture_url as string | null,
        itemCount: a.item_count as number,
      }))))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="mx-4 bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
        Noch keine Artists haben Items im Shop.
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Artists</p>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        {artists.map(artist => (
          <button
            key={artist.artistWallet}
            onClick={() => onSelect(artist)}
            className="flex flex-col items-center gap-2 shrink-0 w-[68px] group"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.25)] transition-all group-hover:scale-105">
                {artist.pictureUrl
                  ? <img src={artist.pictureUrl} alt="" className="w-14 h-14 object-cover" />
                  : <div className="w-14 h-14 bg-amber-500/20 flex items-center justify-center">
                      <FaStar className="text-amber-400" size={18} />
                    </div>}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                <FaShoppingBag size={8} />
              </div>
            </div>
            <p className="text-xs text-zinc-300 text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">
              {artist.displayName || shortenWallet(artist.artistWallet)}
            </p>
          </button>
        ))}
      </div>
      <p className="text-zinc-600 text-xs">Tippe auf einen Artist um seinen Shop zu öffnen.</p>
    </div>
  );
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

export default function ShopTab() {
  const { user, isLoaded } = useUser();
  const walletAddress = user?.id ?? null;

  const [mode, setMode] = useState<'supporter' | 'artist'>('supporter');
  const [isArtist, setIsArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<ShopArtist | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsArtist(!!(data?.profile?.isArtist)));
  }, [walletAddress]);

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 pt-1">
            <img src="/D.FAITH.png" alt="D.FAITH" className="w-10 h-10 rounded-full object-contain shrink-0" />
            <div>
              <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
              <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                Shop · Exklusive Inhalte
              </p>
            </div>
          </div>
        </div>

        {/* ── Modus-Toggle (nur für Artists) ── */}
        {isArtist && (
          <div className="px-4 mb-4">
            <div className="flex bg-zinc-900/70 rounded-xl p-1 border border-white/[0.07]">
              <button
                onClick={() => { setMode('supporter'); setSelectedArtist(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'supporter' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FaShoppingBag size={13} /> Shop durchsuchen
              </button>
              <button
                onClick={() => setMode('artist')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'artist' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FaPlus size={13} /> Mein Shop
              </button>
            </div>
          </div>
        )}

        {/* ── Nicht eingeloggt ── */}
        {!isLoaded || (!walletAddress && isLoaded) ? (
          <div className="mx-4 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-6 text-center text-zinc-400 text-sm">
            {!isLoaded ? 'Lädt…' : 'Bitte einloggen um den Shop zu nutzen.'}
          </div>
        ) : mode === 'artist' && isArtist ? (
          /* ── Artist: Mein Shop ── */
          <MyShopPanel walletAddress={walletAddress!} />
        ) : selectedArtist ? (
          /* ── Supporter: Einzelner Artist-Shop ── */
          <ArtistShopView
            artist={selectedArtist}
            walletAddress={walletAddress}
            onBack={() => setSelectedArtist(null)}
          />
        ) : (
          /* ── Supporter: Artist-Liste ── */
          <ArtistList walletAddress={walletAddress} onSelect={setSelectedArtist} />
        )}
      </div>
    </div>
  );
}
