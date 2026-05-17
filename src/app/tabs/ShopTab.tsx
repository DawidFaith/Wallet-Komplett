'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { upload } from '@vercel/blob/client';
import {
  FaChevronLeft, FaPlus, FaTimes, FaMusic, FaVideo, FaGem, FaStar,
  FaCoins, FaCheck, FaExternalLinkAlt, FaTrash, FaShoppingBag,
  FaPlay, FaPause, FaDownload, FaBoxOpen, FaLock, FaChevronUp, FaChevronDown, FaEdit,
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
  requiredLevel: number;
}

interface ShopArtist {
  artistWallet: string;
  displayName: string | null;
  pictureUrl: string | null;
  itemCount: number;
  rewardToken: string | null;
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
  artistRewardToken,
  userLevel = 0,
}: {
  item: ShopItem;
  onBuy: (item: ShopItem, paymentMethod: 'credits' | 'tokens') => void;
  buying: string | null;
  walletAddress: string | null;
  artistRewardToken?: string | null;
  userLevel?: number;
}) {
  const [payMethod, setPayMethod] = useState<'credits' | 'tokens'>('credits');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenLabel = artistRewardToken ?? 'D.FAITH';
  const isLocked = item.requiredLevel > 0 && userLevel < item.requiredLevel;

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.play();
      setPreviewPlaying(true);
    }
  };

  const fallbackGradient: Record<ItemType, string> = {
    song:      'from-violet-900/60 to-zinc-900',
    video:     'from-red-900/60 to-zinc-900',
    nft:       'from-amber-900/60 to-zinc-900',
    exclusive: 'from-emerald-900/60 to-zinc-900',
  };

  return (
    <div className={`bg-zinc-900 border rounded-2xl overflow-hidden shadow-xl transition-opacity ${isLocked ? 'border-zinc-700/40 opacity-80' : 'border-white/[0.08]'}`}>
      {/* Cover */}
      <div className="relative aspect-[16/7] overflow-hidden bg-zinc-800">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className={`w-full h-full object-cover ${isLocked ? 'grayscale' : ''}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${fallbackGradient[item.type]}`}>
            <span className="opacity-20 scale-[3]"><TypeIcon type={item.type} /></span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />
        {/* Lock-Overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div className="w-10 h-10 rounded-full bg-zinc-800/90 border border-zinc-600/50 flex items-center justify-center mb-2">
              <FaLock size={16} className="text-zinc-400" />
            </div>
            <p className="text-zinc-300 text-xs font-bold">Level {item.requiredLevel} erforderlich</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">Dein Level: {userLevel}</p>
          </div>
        )}
        {/* Typ-Badge oben links */}
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${TYPE_COLORS[item.type]}`}>
          <TypeIcon type={item.type} /> {TYPE_LABELS[item.type]}
        </span>
        {/* Level-Badge oben rechts (nur wenn Level-Pflicht) */}
        {item.requiredLevel > 0 && (
          <span className={`absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${
            isLocked
              ? 'bg-zinc-800/80 border-zinc-600/40 text-zinc-400'
              : 'bg-amber-900/70 border-amber-600/40 text-amber-300'
          }`}>
            <FaStar size={7} /> Lvl {item.requiredLevel}+
          </span>
        )}
        {/* Preis-Badge unten rechts */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-amber-500/30 rounded-xl px-2.5 py-1">
          <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
          <span className="text-amber-300 font-bold text-xs">{item.priceCredits.toLocaleString('de-DE')} {tokenLabel} Credits</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-white font-bold text-base leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 mt-1">{item.description}</p>
          )}
        </div>

        {/* 30s Vorschau für Songs (nicht gekauft) */}
        {item.type === 'song' && item.contentUrl && !item.purchased && (
          <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
            <audio
              ref={audioRef}
              src={item.contentUrl}
              onTimeUpdate={() => {
                if (audioRef.current && audioRef.current.currentTime >= 30) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                  setPreviewPlaying(false);
                }
              }}
              onEnded={() => setPreviewPlaying(false)}
            />
            <button
              onClick={togglePreview}
              className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0 hover:bg-amber-400 transition-colors"
            >
              {previewPlaying ? <FaPause size={9} className="text-black" /> : <FaPlay size={9} className="text-black ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 text-xs font-medium truncate">Vorschau (30 Sek.)</p>
              <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: previewPlaying ? '100%' : '0%', transition: previewPlaying ? 'width 30s linear' : 'none' }}
                />
              </div>
            </div>
            <span className="text-zinc-600 text-[10px] shrink-0">30s</span>
          </div>
        )}

        {walletAddress ? (
          isLocked ? (
            <div className="flex items-center gap-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-3">
              <FaLock size={13} className="text-zinc-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-zinc-400 text-xs font-bold">Gesperrt – Level {item.requiredLevel} erforderlich</p>
                <p className="text-zinc-600 text-[10px] mt-0.5">Sammle mehr Reputation um dieses Item freizuschalten.</p>
              </div>
            </div>
          ) : item.purchased ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-900/30 border border-emerald-700/40 rounded-xl py-2.5 text-emerald-400 text-xs font-bold">
                <FaCheck size={10} /> Bereits gekauft
              </div>
              {item.contentUrl && (
                <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-300 text-xs font-semibold transition-colors">
                  <FaExternalLinkAlt size={9} /> Öffnen
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex bg-zinc-800 rounded-xl p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setPayMethod('credits')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    payMethod === 'credits' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FaCoins size={10} /> {tokenLabel} Credits
                </button>
                <button
                  onClick={() => setPayMethod('tokens')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    payMethod === 'tokens' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <SiSolana size={10} /> {tokenLabel} Tokens
                </button>
              </div>
              <button
                onClick={() => onBuy(item, payMethod)}
                disabled={buying === item.id}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors ${
                  payMethod === 'tokens'
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                }`}
              >
                {buying === item.id
                  ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : payMethod === 'tokens'
                    ? <><SiSolana size={13} /> Kaufen mit {tokenLabel} Tokens</>
                    : <><FaCoins size={13} /> Kaufen mit {tokenLabel} Credits</>
                }
              </button>
            </div>
          )
        ) : (
          <p className="text-center text-zinc-600 text-xs py-2">Bitte einloggen zum Kaufen</p>
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
  creditBalance,
  onPurchased,
  onGoToInventory,
}: {
  artist: ShopArtist;
  walletAddress: string | null;
  onBack: () => void;
  creditBalance?: number | null;
  onPurchased?: () => void;
  onGoToInventory?: () => void;
}) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyResult, setBuyResult] = useState<{ itemId: string; contentUrl: string; type: string; title: string; paymentMethod: string } | null>(null);
  const [buyCelebration, setBuyCelebration] = useState<{ title: string; type: ItemType; price: number; paymentMethod: string } | null>(null);
  const [buyError, setBuyError] = useState('');
  const [userLevel, setUserLevel] = useState(0);

  // User-Level für diesen Artist laden
  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/reputation?wallet=${walletAddress}&artistWallet=${artist.artistWallet}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.level !== undefined) setUserLevel(Number(data.level)); })
      .catch(() => {});
  }, [walletAddress, artist.artistWallet]);

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
        requiredLevel: Number(i.required_level ?? 0),
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
      setBuyResult({ itemId: item.id, contentUrl: data.contentUrl, type: data.type, title: item.title, paymentMethod });
      setBuyCelebration({ title: item.title, type: item.type, price: item.priceCredits, paymentMethod });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, purchased: true } : i));
      onPurchased?.();
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
      <div className="mx-4 bg-zinc-900/80 border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full shrink-0 ring-2 ring-amber-500/40 shadow-[0_0_14px_rgba(245,158,11,0.2)]">
            {artist.pictureUrl
              ? <img src={artist.pictureUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
              : <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center"><FaStar className="text-amber-400" size={20} /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">
              {artist.displayName || shortenWallet(artist.artistWallet)}
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">{loading ? '…' : `${items.length} ${items.length === 1 ? 'Item' : 'Items'} im Shop`}</p>
          </div>
          {creditBalance !== null && creditBalance !== undefined && (
            <div className="shrink-0 flex flex-col items-end gap-0.5">
              <span className="text-zinc-500 text-[9px] uppercase tracking-widest">Guthaben</span>
              <span className="flex items-center gap-1 text-amber-300 font-bold text-sm">
                {creditBalance.toFixed(2)}
                <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
                {artist.rewardToken ?? 'D.FAITH'} Credits
              </span>
            </div>
          )}
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
        <div className="mx-4 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
              <FaCheck size={12} /> Kauf erfolgreich!
            </div>
            <button onClick={() => setBuyResult(null)} className="text-zinc-500 hover:text-zinc-300">
              <FaTimes size={12} />
            </button>
          </div>
          <p className="text-zinc-400 text-xs mb-2">«{buyResult.title}» ist jetzt in deinem Inventar.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setBuyResult(null); onGoToInventory?.(); }}
              className="flex items-center gap-1.5 bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-600/40 rounded-xl px-3 py-1.5 text-emerald-300 text-xs font-bold transition-colors"
            >
              <FaBoxOpen size={10} /> Zum Inventar
            </button>
            {buyResult.contentUrl && (
              <a href={buyResult.contentUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-zinc-300 text-xs font-semibold transition-colors">
                <FaExternalLinkAlt size={9} /> Direkt öffnen
              </a>
            )}
          </div>
        </div>
      )}

      {/* Kauf-Celebration */}
      {buyCelebration && (
        <div
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setBuyCelebration(null)}
        >
          <style>{`
            @keyframes shopBuyFlyUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-160px) scale(0.3); opacity: 0; } }
            @keyframes shopBuyPop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
            @keyframes shopBuyGlow { 0%,100% { text-shadow: 0 0 20px #10b981, 0 0 40px #10b981; } 50% { text-shadow: 0 0 40px #34d399, 0 0 80px #34d399; } }
            .shop-buy-particle { position: absolute; animation: shopBuyFlyUp 1.4s ease-out forwards; font-size: 1.3rem; }
          `}</style>
          {['🎵','✨','🛍️','💫','🎶','✨','🎵','🌟','💎','✨'].map((s, i) => (
            <span key={i} className="shop-buy-particle" style={{ left: `${8 + i * 9}%`, bottom: `${18 + (i % 3) * 16}%`, animationDelay: `${i * 0.1}s`, animationDuration: `${1.2 + (i % 4) * 0.2}s` }}>{s}</span>
          ))}
          <div
            className="relative bg-zinc-900 border border-emerald-500/40 rounded-3xl p-8 mx-6 text-center shadow-2xl max-w-sm w-full"
            style={{ animation: 'shopBuyPop 0.5s ease-out forwards' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-5xl mb-3">{buyCelebration.type === 'song' ? '🎵' : buyCelebration.type === 'video' ? '🎬' : buyCelebration.type === 'nft' ? '💎' : '⭐'}</p>
            <p
              className="text-emerald-300 font-black text-3xl mb-1"
              style={{ animation: 'shopBuyPop 0.6s ease-out forwards, shopBuyGlow 2s ease-in-out infinite' }}
            >
              Gekauft!
            </p>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mb-4 mt-3">
              <p className="text-zinc-400 text-xs mb-0.5">{TYPE_LABELS[buyCelebration.type]}</p>
              <p className="text-white text-sm font-semibold line-clamp-2">{buyCelebration.title}</p>
            </div>
            <p className="text-zinc-400 text-xs mb-5">
              {buyCelebration.paymentMethod === 'tokens' ? '💠 Bezahlt mit Tokens' : `💰 ${buyCelebration.price.toLocaleString('de-DE')} Credits`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setBuyCelebration(null); onGoToInventory?.(); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 rounded-2xl transition-colors text-sm"
              >
                <FaBoxOpen size={13} /> Zum Inventar
              </button>
              <button
                onClick={() => setBuyCelebration(null)}
                className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors"
              >
                Weiter shoppen
              </button>
            </div>
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
          {items.filter(item => !item.purchased).length === 0 ? (
            <div className="bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
              Alle Items wurden bereits von dir gekauft.
            </div>
          ) : (
            items.filter(item => !item.purchased).map(item => (
              <ItemCard key={item.id} item={item} onBuy={handleBuy} buying={buying} walletAddress={walletAddress} artistRewardToken={artist.rewardToken} userLevel={userLevel} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inventar (alle gekauften Items) ─────────────────────────────────────────

interface InventoryItem {
  id: string;
  artistWallet: string;
  title: string;
  description: string;
  type: ItemType;
  contentUrl: string;
  imageUrl: string;
  purchasedAt: string;
  artistName: string | null;
  artistPicture: string | null;
  isActive: boolean;
}

function InventoryItemCard({ item }: { item: InventoryItem }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const fallbackGradient: Record<ItemType, string> = {
    song:      'from-violet-900/60 to-zinc-900',
    video:     'from-red-900/60 to-zinc-900',
    nft:       'from-amber-900/60 to-zinc-900',
    exclusive: 'from-emerald-900/60 to-zinc-900',
  };

  return (
    <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
      {/* Cover */}
      <div className="relative aspect-[16/7] overflow-hidden bg-zinc-800">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${fallbackGradient[item.type]}`}>
            <span className="opacity-20 scale-[3]"><TypeIcon type={item.type} /></span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${TYPE_COLORS[item.type]}`}>
          <TypeIcon type={item.type} /> {TYPE_LABELS[item.type]}
        </span>
        {item.isActive ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/70 border border-emerald-700/40 text-emerald-400 backdrop-blur-md">
            <FaCheck size={8} /> Gekauft
          </span>
        ) : (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-600/40 text-zinc-400 backdrop-blur-md">
            <FaCheck size={8} /> Gekauft · Nicht mehr im Shop
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-bold text-base leading-snug truncate">{item.title}</p>
            {item.description && <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 mt-1">{item.description}</p>}
          </div>
          {item.artistName && (
            <div className="flex items-center gap-1.5 shrink-0">
              {item.artistPicture
                ? <img src={item.artistPicture} alt="" className="w-5 h-5 rounded-full object-cover" />
                : <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center"><FaStar size={8} className="text-amber-400" /></div>}
              <span className="text-zinc-400 text-xs truncate max-w-[80px]">{item.artistName}</span>
            </div>
          )}
        </div>

        {/* Song: Audio-Player */}
        {item.type === 'song' && item.contentUrl && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
              <audio ref={audioRef} src={item.contentUrl} onEnded={() => setPlaying(false)} />
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 hover:bg-amber-400 transition-colors"
              >
                {playing ? <FaPause size={10} className="text-black" /> : <FaPlay size={10} className="text-black ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 text-xs font-semibold truncate">{item.title}</p>
                <p className="text-zinc-500 text-[10px]">Voller Song</p>
              </div>
            </div>
            <a
              href={item.contentUrl}
              download
              className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-zinc-300 text-xs font-semibold transition-colors"
            >
              <FaDownload size={10} /> Download
            </a>
          </div>
        )}

        {/* Video: Link öffnen */}
        {item.type === 'video' && item.contentUrl && (
          <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-red-900/20 hover:bg-red-900/30 border border-red-800/30 rounded-xl py-2.5 text-red-300 text-xs font-semibold transition-colors">
            <FaVideo size={11} /> Video ansehen
          </a>
        )}

        {/* NFT / Exclusive: Inhalt öffnen */}
        {(item.type === 'nft' || item.type === 'exclusive') && item.contentUrl && (
          <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/30 rounded-xl py-2.5 text-amber-300 text-xs font-semibold transition-colors">
            <FaExternalLinkAlt size={10} /> Inhalt öffnen
          </a>
        )}
      </div>
    </div>
  );
}

function InventoryPanel({ walletAddress }: { walletAddress: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setApiError('');
    fetch(`/api/shop/inventory?wallet=${encodeURIComponent(walletAddress)}`)
      .then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error ?? `HTTP ${r.status}`); }
        return r.json();
      })
      .then((data: Array<Record<string, unknown>>) => {
        const mapped = data.map(i => ({
          id: String(i.id),
          artistWallet: String(i.artist_wallet),
          title: String(i.title),
          description: String(i.description ?? ''),
          type: i.type as ItemType,
          contentUrl: String(i.content_url ?? ''),
          imageUrl: String(i.image_url ?? ''),
          purchasedAt: String(i.purchased_at ?? ''),
          artistName: i.artist_name ? String(i.artist_name) : null,
          artistPicture: i.artist_picture ? String(i.artist_picture) : null,
          isActive: Boolean(i.is_active),
        }));
        setItems(mapped);
        // Alle Artists standardmäßig ausklappen
        setExpandedArtists(new Set(mapped.map(it => it.artistWallet)));
      })
      .catch(err => setApiError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  useEffect(() => { load(); }, [load]);

  // Items nach Artist gruppieren
  const groups = Array.from(
    items.reduce((map, item) => {
      if (!map.has(item.artistWallet)) {
        map.set(item.artistWallet, { wallet: item.artistWallet, name: item.artistName, picture: item.artistPicture, items: [] });
      }
      map.get(item.artistWallet)!.items.push(item);
      return map;
    }, new Map<string, { wallet: string; name: string | null; picture: string | null; items: InventoryItem[] }>())
    .values()
  );

  const toggleArtist = (wallet: string) => {
    setExpandedArtists(prev => {
      const next = new Set(prev);
      if (next.has(wallet)) next.delete(wallet); else next.add(wallet);
      return next;
    });
  };

  return (
    <div className="px-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em]">Mein Inventar</p>
        <span className="text-zinc-600 text-xs">{items.length} Item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* API-Fehler */}
      {apiError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-red-300 text-xs">{apiError}</p>
          <button onClick={load} className="text-red-300 hover:text-red-100 text-xs font-bold shrink-0">Erneut</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 && !apiError ? (
        <div className="bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-10 text-center">
          <FaBoxOpen size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-semibold">Noch keine Käufe</p>
          <p className="text-zinc-600 text-xs mt-1">Hier erscheinen alle deine gekauften Inhalte.</p>
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {groups.map(group => (
            <div key={group.wallet}>
              {/* Artist-Sektionskopf */}
              <button
                onClick={() => toggleArtist(group.wallet)}
                className="w-full flex items-center gap-3 mb-3 group"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full ring-2 ring-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                    {group.picture
                      ? <img src={group.picture} alt="" className="w-11 h-11 rounded-full object-cover" />
                      : <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500/30 to-zinc-800 flex items-center justify-center">
                          <FaStar className="text-amber-400" size={16} />
                        </div>}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow">
                    {group.items.length}
                  </div>
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white font-bold text-sm truncate">
                    {group.name || shortenWallet(group.wallet)}
                  </p>
                  <p className="text-zinc-500 text-[10px]">
                    {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'} gekauft
                  </p>
                </div>

                {/* Collapse-Pfeil */}
                <div className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  {expandedArtists.has(group.wallet)
                    ? <FaChevronUp size={11} />
                    : <FaChevronDown size={11} />}
                </div>
              </button>

              {/* Items dieser Gruppe */}
              {expandedArtists.has(group.wallet) && (
                <div className="space-y-3 pl-2 border-l-2 border-amber-500/20 ml-5">
                  {group.items.map(item => <InventoryItemCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mein Shop (Artist-Modus) ─────────────────────────────────────────────────

function MyShopPanel({ walletAddress, creditBalance, rewardToken }: { walletAddress: string; creditBalance: number | null; rewardToken?: string | null }) {
  const myTokenLabel = rewardToken ?? 'D.FAITH';
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Edit-State (inline Bearbeitung bestehender Items)
  type EditData = {
    id: string; title: string; desc: string; type: ItemType;
    price: string; tokens: string; level: string; content: string; image: string;
  };
  const [editData, setEditData] = useState<EditData | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadingEditContent, setUploadingEditContent] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  // Formular-State
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fType, setFType] = useState<ItemType>('song');
  const [fPrice, setFPrice] = useState('0');
  const [fRequiredLevel, setFRequiredLevel] = useState('0');
  const [fContent, setFContent] = useState('');
  const [fImage, setFImage] = useState('');
  const [uploadingContent, setUploadingContent] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleUpload = async (file: File, type: 'content' | 'image') => {
    const setUploading = type === 'content' ? setUploadingContent : setUploadingImage;
    const setUrl       = type === 'content' ? setFContent : setFImage;
    setUploading(true);
    setFormError('');
    try {
      // Sicheren Dateinamen erzeugen – Artist-eigener Unterordner
      const ext        = file.name.replace(/.*\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const timestamp  = Date.now();
      const safeWallet = walletAddress.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
      const pathname   = `shop/${type === 'image' ? 'images' : 'content'}/${safeWallet}/${timestamp}.${ext}`;

      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/shop/upload',
        clientPayload: JSON.stringify({ fileType: type, wallet: walletAddress }),
      });
      setUrl(blob.url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

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
        requiredLevel: Number(i.required_level ?? 0),
      })));
    }
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { loadMyItems(); }, [loadMyItems]);

  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFType('song'); setFPrice('0');
    setFRequiredLevel('0'); setFContent(''); setFImage(''); setFormError('');
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
          requiredLevel: parseInt(fRequiredLevel, 10) || 0,
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

  const startEdit = (item: ShopItem) => {
    setEditData({
      id: item.id,
      title: item.title,
      desc: item.description,
      type: item.type,
      price: String(item.priceCredits),
      tokens: item.priceTokens != null ? String(item.priceTokens) : '',
      level: String(item.requiredLevel),
      content: item.contentUrl,
      image: item.imageUrl,
    });
    setEditError('');
  };

  const cancelEdit = () => { setEditData(null); setEditError(''); };

  const handleEditUpload = async (file: File, field: 'content' | 'image') => {
    const setUploading = field === 'content' ? setUploadingEditContent : setUploadingEditImage;
    setUploading(true);
    setEditError('');
    try {
      const ext = file.name.replace(/.*\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const safeWallet = walletAddress.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
      const pathname = `shop/${field === 'image' ? 'images' : 'content'}/${safeWallet}/${Date.now()}.${ext}`;
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/shop/upload',
        clientPayload: JSON.stringify({ fileType: field, wallet: walletAddress }),
      });
      setEditData(prev => prev ? { ...prev, [field === 'content' ? 'content' : 'image']: blob.url } : prev);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!editData) return;
    if (!editData.title.trim()) { setEditError('Titel ist Pflicht'); return; }
    const price = parseInt(editData.price, 10);
    if (isNaN(price) || price < 0) { setEditError('Ungültiger Preis'); return; }
    const tokensRaw = editData.tokens.trim();
    const tokens = tokensRaw === '' ? null : parseFloat(tokensRaw);
    if (tokensRaw !== '' && (isNaN(tokens!) || tokens! < 0)) { setEditError('Ungültiger Token-Preis'); return; }

    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          itemId: editData.id,
          title: editData.title,
          description: editData.desc,
          type: editData.type,
          priceCredits: price,
          priceTokens: tokens,
          contentUrl: editData.content,
          imageUrl: editData.image,
          requiredLevel: parseInt(editData.level, 10) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setEditError(err.error ?? 'Fehler beim Speichern');
        return;
      }
      setItems(prev => prev.map(i =>
        i.id === editData.id
          ? { ...i, title: editData.title, description: editData.desc, type: editData.type,
              priceCredits: price, priceTokens: tokens, contentUrl: editData.content,
              imageUrl: editData.image, requiredLevel: parseInt(editData.level, 10) || 0 }
          : i,
      ));
      setEditData(null);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="px-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em]">Mein Shop</p>
        {creditBalance !== null && (
          <span className="flex items-center gap-1.5 text-amber-300 font-bold text-sm">
            {creditBalance.toFixed(2)}
            <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
            {myTokenLabel} Credits
          </span>
        )}
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

          {/* Mindest-Level */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">
              Mindest-Level <span className="text-zinc-600 normal-case">(0 = kein Level erforderlich)</span>
            </label>
            <input
              type="number"
              min="0"
              value={fRequiredLevel}
              onChange={e => setFRequiredLevel(e.target.value)}
              placeholder="0"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
            />
            {parseInt(fRequiredLevel, 10) > 0 && (
              <p className="text-amber-400 text-[10px] mt-1 flex items-center gap-1">
                <FaStar size={8} /> Nur Fans ab Level {fRequiredLevel} können dieses Item kaufen.
              </p>
            )}
          </div>

          {/* Content-Datei */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Content-Datei (nach Kauf sichtbar) *</label>
            <div className="flex gap-2">
              <label className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                uploadingContent
                  ? 'bg-zinc-700 text-zinc-500 pointer-events-none'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
              }`}>
                {uploadingContent
                  ? <><span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> Lädt…</>
                  : <><FaMusic size={11} /> Hochladen</>}
                <input
                  type="file"
                  className="hidden"
                  accept="audio/*,video/*,.pdf,.zip"
                  disabled={uploadingContent}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'content'); e.target.value = ''; }}
                />
              </label>
              <input
                value={fContent}
                onChange={e => setFContent(e.target.value)}
                placeholder="oder URL einfügen (https://…)"
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            {fContent && <p className="text-emerald-400 text-[10px] mt-1 truncate">✓ {fContent}</p>}
          </div>

          {/* Vorschaubild */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Vorschaubild (optional)</label>
            <div className="flex gap-2 items-start">
              <label className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                uploadingImage
                  ? 'bg-zinc-700 text-zinc-500 pointer-events-none'
                  : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30'
              }`}>
                {uploadingImage
                  ? <><span className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" /> Lädt…</>
                  : <><FaStar size={10} /> Bild</> }
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'image'); e.target.value = ''; }}
                />
              </label>
              <input
                value={fImage}
                onChange={e => setFImage(e.target.value)}
                placeholder="oder Bild-URL"
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            {fImage && (
              <img src={fImage} alt="Vorschau" className="mt-2 w-20 h-20 rounded-xl object-cover border border-white/10" />
            )}
          </div>

          {formError && (
            <p className="text-red-400 text-xs">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || uploadingContent || uploadingImage}
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
              {editData?.id === item.id ? (
                /* ── Inline-Edit-Formular ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white text-sm font-semibold">Item bearbeiten</p>
                    <button onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-300"><FaTimes size={13} /></button>
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Titel *</label>
                    <input value={editData.title} onChange={e => setEditData(d => d && { ...d, title: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Beschreibung</label>
                    <textarea value={editData.desc} onChange={e => setEditData(d => d && { ...d, desc: e.target.value })}
                      rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Typ</label>
                      <select value={editData.type} onChange={e => setEditData(d => d && { ...d, type: e.target.value as ItemType })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50">
                        <option value="song">Song</option>
                        <option value="video">Video</option>
                        <option value="nft">NFT</option>
                        <option value="exclusive">Exklusiv</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Preis Credits *</label>
                      <input type="number" min="0" value={editData.price}
                        onChange={e => setEditData(d => d && { ...d, price: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Token-Preis <span className="text-zinc-600 normal-case">(opt.)</span></label>
                      <input type="number" min="0" step="0.000001" value={editData.tokens} placeholder="leer = keiner"
                        onChange={e => setEditData(d => d && { ...d, tokens: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-zinc-600" />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Mindest-Level</label>
                      <input type="number" min="0" value={editData.level}
                        onChange={e => setEditData(d => d && { ...d, level: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>

                  {/* Content-Datei */}
                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Content-Datei</label>
                    <div className="flex gap-2">
                      <label className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        uploadingEditContent ? 'bg-zinc-700 text-zinc-500 pointer-events-none' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                      }`}>
                        {uploadingEditContent ? <><span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> Lädt…</> : <><FaMusic size={11} /> Ändern</>}
                        <input type="file" className="hidden" accept="audio/*,video/*,.pdf,.zip" disabled={uploadingEditContent}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleEditUpload(f, 'content'); e.target.value = ''; }} />
                      </label>
                      <input value={editData.content} onChange={e => setEditData(d => d && { ...d, content: e.target.value })}
                        placeholder="URL" className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    {editData.content && <p className="text-emerald-400 text-[10px] mt-1 truncate">✓ {editData.content}</p>}
                  </div>

                  {/* Vorschaubild */}
                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Vorschaubild</label>
                    <div className="flex gap-2 items-start">
                      <label className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        uploadingEditImage ? 'bg-zinc-700 text-zinc-500 pointer-events-none' : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30'
                      }`}>
                        {uploadingEditImage ? <><span className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" /> Lädt…</> : <><FaStar size={10} /> Bild</>}
                        <input type="file" className="hidden" accept="image/*" disabled={uploadingEditImage}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleEditUpload(f, 'image'); e.target.value = ''; }} />
                      </label>
                      <input value={editData.image} onChange={e => setEditData(d => d && { ...d, image: e.target.value })}
                        placeholder="Bild-URL" className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50" />
                    </div>
                    {editData.image && <img src={editData.image} alt="Vorschau" className="mt-2 w-16 h-16 rounded-xl object-cover border border-white/10" />}
                  </div>

                  {editError && <p className="text-red-400 text-xs">{editError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleEdit} disabled={editSaving || uploadingEditContent || uploadingEditImage}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors">
                      {editSaving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><FaCheck size={11} /> Speichern</>}
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normale Item-Ansicht ── */
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
                        {item.requiredLevel > 0 && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-900/40 border-amber-700/40 text-amber-400">
                            <FaLock size={7} /> Lvl {item.requiredLevel}+
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-semibold mt-1 truncate">{item.title}</p>
                      {item.description && (
                        <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-amber-400 text-xs mt-1 font-semibold flex items-center gap-1">
                        <FaCoins size={9} /> {item.priceCredits.toLocaleString('de-DE')} {myTokenLabel} Credits
                        {item.priceTokens != null && <> · {item.priceTokens} {myTokenLabel} Tokens</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-zinc-500 hover:text-amber-400 transition-colors p-1"
                      title="Bearbeiten"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors p-1"
                    >
                      {deleting === item.id
                        ? <span className="w-3.5 h-3.5 border border-red-400/30 border-t-red-400 rounded-full animate-spin block" />
                        : <FaTrash size={12} />
                      }
                    </button>
                  </div>
                </div>
              )}
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
        rewardToken: a.reward_token as string | null ?? null,
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
              <div className="w-14 h-14 rounded-full ring-2 ring-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.25)] transition-all group-hover:scale-105">
                {artist.pictureUrl
                  ? <img src={artist.pictureUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                  : <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
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

  const [mode, setMode] = useState<'supporter' | 'inventory' | 'artist'>('supporter');
  const [isArtist, setIsArtist] = useState(false);
  const [myRewardToken, setMyRewardToken] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ShopArtist | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const loadCredits = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/youtube-quests/creator-balance?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setCreditBalance(typeof data.balance === 'number' ? data.balance : Number(data.balance ?? 0));
      }
    } catch { /* ignorieren */ }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setIsArtist(!!(data?.profile?.isArtist));
        setMyRewardToken(data?.profile?.rewardToken ?? null);
      });
  }, [walletAddress]);

  useEffect(() => { loadCredits(); }, [loadCredits]);

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="px-4 pt-6 pb-2">
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

        {/* ── Modus-Toggle ── */}
        {walletAddress && (
          <div className="px-4 mb-4">
            <div className="flex bg-zinc-900/70 rounded-xl p-1 border border-white/[0.07]">
              <button
                onClick={() => { setMode('supporter'); setSelectedArtist(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'supporter' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FaShoppingBag size={11} /> Shop
              </button>
              <button
                onClick={() => { setMode('inventory'); setSelectedArtist(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'inventory' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FaBoxOpen size={11} /> Inventar
              </button>
              {isArtist && (
                <button
                  onClick={() => setMode('artist')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'artist' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FaPlus size={11} /> Mein Shop
                </button>
              )}
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
          <MyShopPanel walletAddress={walletAddress!} creditBalance={creditBalance} rewardToken={myRewardToken} />
        ) : mode === 'inventory' ? (
          /* ── Inventar ── */
          <InventoryPanel walletAddress={walletAddress!} />
        ) : selectedArtist ? (
          /* ── Supporter: Einzelner Artist-Shop ── */
          <ArtistShopView
            artist={selectedArtist}
            walletAddress={walletAddress}
            onBack={() => setSelectedArtist(null)}
            creditBalance={creditBalance}
            onPurchased={loadCredits}
            onGoToInventory={() => { setMode('inventory'); setSelectedArtist(null); }}
          />
        ) : (
          /* ── Supporter: Artist-Liste ── */
          <ArtistList walletAddress={walletAddress} onSelect={setSelectedArtist} />
        )}
      </div>
    </div>
  );
}
