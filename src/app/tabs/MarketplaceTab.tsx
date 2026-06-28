"use client";
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { GiCrystalShine } from 'react-icons/gi';
import { FaTag, FaTimes, FaCheckCircle, FaExclamationTriangle, FaGem, FaPlus, FaStar, FaCoins, FaMusic, FaSortAmountUp, FaSortAmountDown, FaClock, FaSlidersH } from 'react-icons/fa';
import { MdSell, MdStorefront } from 'react-icons/md';
import { HiOutlineViewGrid } from 'react-icons/hi';
import { RiUserStarFill } from 'react-icons/ri';

// ─── Typen ────────────────────────────────────────────────────────────────────

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

interface NftAttribute { trait_type: string; value: string; }

interface Listing {
  id: string;
  mint_address: string;
  seller_wallet: string;
  price_dfaith: string;
  collection_name: string | null;
  rarity: string | null;
  image_url: string | null;
  nft_name: string | null;
  artist_name: string | null;
  artist_picture: string | null;
  listed_at: string;
  status: string;
  nft_type?: string | null;
  description?: string | null;
  content_url?: string | null;
  edition_number?: number | null;
  attributes?: NftAttribute[] | null;
}

interface OwnedNft {
  id: string;
  nft_mint_address: string;
  rarity: string;
  collection_id: string;
  collection_name?: string;
  image_url?: string;
  artist_name?: string;
  nft_collection_mint?: string;
  source?: 'db' | 'chain' | 'shop';
  editionNumber?: number | null;
  description?: string | null;
  contentUrl?: string | null;
  attributes?: { trait_type: string; value: string }[];
}

// ─── Rarity-Konfiguration ─────────────────────────────────────────────────────

const RARITY_CFG: Record<Rarity, {
  border: string; text: string; bg: string; glow: string; badge: string; label: string;
}> = {
  common:    { border: 'border-zinc-500/60',  text: 'text-zinc-300',   bg: 'bg-zinc-800/50',   glow: '',                                              badge: 'bg-zinc-600 text-zinc-100',         label: 'Common'    },
  uncommon:  { border: 'border-green-500/70', text: 'text-green-400',  bg: 'bg-green-950/40',  glow: 'shadow-[0_0_14px_rgba(74,222,128,0.25)]',       badge: 'bg-green-600 text-white',           label: 'Uncommon'  },
  rare:      { border: 'border-blue-500/70',  text: 'text-blue-400',   bg: 'bg-blue-950/40',   glow: 'shadow-[0_0_16px_rgba(96,165,250,0.3)]',        badge: 'bg-blue-600 text-white',            label: 'Rare'      },
  epic:      { border: 'border-purple-500/70',text: 'text-purple-400', bg: 'bg-purple-950/40', glow: 'shadow-[0_0_18px_rgba(167,139,250,0.35)]',      badge: 'bg-purple-600 text-white',          label: 'Epic'      },
  legendary: { border: 'border-amber-400/80', text: 'text-amber-300',  bg: 'bg-amber-950/40',  glow: 'shadow-[0_0_22px_rgba(251,191,36,0.4)]',        badge: 'bg-amber-500 text-black font-black', label: 'Legendary' },
  mythic:    { border: 'border-rose-400/80',  text: 'text-rose-300',   bg: 'bg-rose-950/40',   glow: 'shadow-[0_0_28px_rgba(244,63,94,0.5)]',         badge: 'bg-rose-500 text-white font-black',  label: 'Mythic'    },
};
const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function rc(r: string | null | undefined) {
  return RARITY_CFG[(r?.toLowerCase() ?? 'common') as Rarity] ?? RARITY_CFG.common;
}

// ─── Artist Avatar ────────────────────────────────────────────────────────────

function artistColor(name: string) {
  const colors = [
    'bg-violet-600','bg-blue-600','bg-cyan-600','bg-teal-600',
    'bg-green-600','bg-amber-600','bg-orange-600','bg-rose-600',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function ArtistAvatar({ name, picture, size = 'md' }: {
  name: string;
  picture?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'sm' ? 'w-5 h-5'   : size === 'lg' ? 'w-14 h-14' : 'w-7 h-7';
  const px  = size === 'sm' ? 20           : size === 'lg' ? 56          : 28;
  const txt = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-base' : 'text-[10px]';
  if (picture) {
    return (
      <Image
        src={picture}
        alt={name}
        width={px}
        height={px}
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div className={`${dim} ${txt} ${artistColor(name)} rounded-full flex items-center justify-center font-black text-white shrink-0`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

const RARITY_WORDS = new Set(['common','uncommon','rare','epic','legendary','mythic']);

function stripRarity(name: string): string {
  return name.replace(/\s*[-–—]\s*(Common|Uncommon|Rare|Epic|Legendary|Mythic)$/i, '').trim();
}

function detectCategory(l: { attributes?: NftAttribute[] | null }): 'collectible' | 'song' {
  const attrs = l.attributes ?? [];
  if (attrs.some(a => a.trait_type === 'Type' && a.value === 'Music')) return 'song';
  return 'collectible';
}

function fmtBonus(v: string): string {
  const s = v.trim();
  const withPlus = s.startsWith('+') || s.startsWith('-') ? s : `+${s}`;
  return withPlus.endsWith('%') ? withPlus : `${withPlus}%`;
}

function ListingCard({ listing, isSelf, onBuy, onCancel, cancelLoading }: {
  listing: Listing;
  isSelf: boolean;
  onBuy: (l: Listing) => void;
  onCancel: (l: Listing) => void;
  cancelLoading: boolean;
}) {
  const isSong = listing.nft_type === 'song' || detectCategory(listing) === 'song';
  const cfg    = isSong ? null : rc(listing.rarity);

  const [playing, setPlaying] = useState(false);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!listing.content_url) return;
    if (!audioRef[0]) {
      const audio = new Audio(listing.content_url);
      audioRef[1](audio);
      audio.play();
      setPlaying(true);
      audio.onended = () => setPlaying(false);
    } else if (playing) {
      audioRef[0].pause();
      setPlaying(false);
    } else {
      audioRef[0].play();
      setPlaying(true);
    }
  };

  const displayName = listing.collection_name ?? listing.nft_name ?? '—';
  const artist      = listing.artist_name && !RARITY_WORDS.has(listing.artist_name.toLowerCase())
    ? listing.artist_name : null;

  const cleanName = stripRarity(listing.collection_name ?? listing.nft_name ?? '');

  // Fallback-Beschreibung für Collectibles die ohne Beschreibung erstellt wurden
  const description = listing.description
    || (!isSong && cleanName
        ? `${cfg!.label} D.FAITH Collectible from the "${cleanName}" series.`
        : null);

  const attrs       = listing.attributes ?? [];
  const repBonus    = attrs.find(a => a.trait_type.toLowerCase().includes('rep'));
  const creditBonus = attrs.find(a => a.trait_type.toLowerCase().includes('credit'));
  const shardBonus  = attrs.find(a => a.trait_type.toLowerCase().includes('shard'));
  const hasBoosts   = repBonus || creditBonus || shardBonus;

  const cardBorder = isSong ? 'border-amber-500/30' : cfg!.border;
  const cardBg     = isSong ? 'bg-[#181818]'        : cfg!.bg;
  const cardGlow   = isSong ? ''                    : cfg!.glow;

  return (
    <div className={`relative flex flex-col rounded-2xl border ${cardBorder} ${cardBg} ${cardGlow} overflow-hidden group transition-all duration-200 hover:scale-[1.02]`}>
      {isSelf && (
        <div className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase tracking-wider bg-amber-500/90 text-black rounded-full px-2 py-0.5">
          Dein
        </div>
      )}

      {/* Bild */}
      <div className="relative w-full aspect-square bg-black/30">
        {listing.image_url ? (
          <Image src={listing.image_url} alt={displayName} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isSong
              ? <FaMusic className="text-amber-400 opacity-30" size={40} />
              : <GiCrystalShine className={`${cfg!.text} opacity-30`} size={40} />}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Badge oben rechts */}
        {isSong ? (
          <div className="absolute top-2 right-2 z-10 text-[8px] font-bold rounded-full px-1.5 py-0.5 bg-amber-500/80 text-black flex items-center gap-0.5">
            <FaMusic size={6} />
            {listing.edition_number != null ? `#${listing.edition_number}` : 'Song'}
          </div>
        ) : (
          <div className={`absolute top-2 right-2 z-10 text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${cfg!.badge}`}>
            {cfg!.label}
          </div>
        )}

        {/* Play-Button für Song-NFTs */}
        {isSong && listing.content_url && (
          <button
            onClick={togglePlay}
            className="absolute bottom-2 right-2 z-10 w-10 h-10 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
          >
            {playing
              ? <span className="flex gap-0.5"><span className="w-[3px] h-3 bg-black rounded-sm" /><span className="w-[3px] h-3 bg-black rounded-sm" /></span>
              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
            }
          </button>
        )}

        {/* Boost-Overlay (nur Collectibles) */}
        {hasBoosts && !isSong && (
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 flex gap-1.5">
            {repBonus && (
              <div className="flex items-center gap-1 bg-violet-900/80 border border-violet-500/50 rounded-lg px-1.5 py-0.5 backdrop-blur-sm">
                <FaStar size={7} className="text-violet-300 shrink-0" />
                <span className="text-violet-200 text-[9px] font-black leading-none">{fmtBonus(repBonus.value)}</span>
              </div>
            )}
            {creditBonus && (
              <div className="flex items-center gap-1 bg-amber-900/80 border border-amber-500/50 rounded-lg px-1.5 py-0.5 backdrop-blur-sm">
                <FaCoins size={7} className="text-amber-300 shrink-0" />
                <span className="text-amber-200 text-[9px] font-black leading-none">{fmtBonus(creditBonus.value)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-2 flex-1">
        {/* Name + Artist */}
        <div className="flex items-start gap-1.5 min-w-0">
          {artist && <ArtistAvatar name={artist} picture={listing.artist_picture} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className={`font-black text-[11px] truncate leading-tight ${isSong ? 'text-amber-300' : cfg!.text}`}>
              {displayName}
            </p>
            {artist && (
              <p className="text-zinc-500 text-[9px] truncate leading-tight">{artist}</p>
            )}
          </div>
        </div>

        {/* Beschreibung */}
        {description && (
          <p className="text-zinc-400 text-[9px] leading-relaxed">{description}</p>
        )}

        {/* Attribute-Chips */}
        {isSong ? (
          <div className="flex flex-wrap gap-1">
            <span className="text-[8px] bg-zinc-800 text-zinc-400 rounded-full px-1.5 py-0.5">Musik</span>
            <span className="text-[8px] bg-zinc-800 text-zinc-400 rounded-full px-1.5 py-0.5">D.FAITH</span>
            {listing.edition_number != null && (
              <span className="text-[8px] bg-amber-900/40 text-amber-400 rounded-full px-1.5 py-0.5 border border-amber-500/30">Edition #{listing.edition_number}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <span className="text-[8px] bg-zinc-800 text-zinc-400 rounded-full px-1.5 py-0.5">Collectible</span>
            <span className="text-[8px] bg-zinc-800 text-zinc-400 rounded-full px-1.5 py-0.5">D.FAITH</span>
            {repBonus && (
              <span className={`text-[8px] rounded-full px-1.5 py-0.5 border ${cfg!.border} ${cfg!.text} bg-black/30`}>
                REP {fmtBonus(repBonus.value)}
              </span>
            )}
            {creditBonus && (
              <span className="text-[8px] bg-amber-900/30 text-amber-400 rounded-full px-1.5 py-0.5 border border-amber-500/30">
                Credits {fmtBonus(creditBonus.value)}
              </span>
            )}
            {shardBonus && (
              <span className="text-[8px] bg-cyan-900/30 text-cyan-400 rounded-full px-1.5 py-0.5 border border-cyan-500/30">
                Shard {fmtBonus(shardBonus.value)}
              </span>
            )}
          </div>
        )}

        {/* Preis + Aktion */}
        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-white/[0.06]">
          <div>
            <span className={`font-black text-sm flex items-center gap-1 ${isSong ? 'text-amber-400' : cfg!.text}`}>
              <FaTag size={8} />
              {Number(listing.price_dfaith).toLocaleString('de-DE')}
            </span>
            <span className="text-[9px] text-zinc-600">D.FAITH</span>
          </div>

          {isSelf ? (
            <button
              onClick={() => onCancel(listing)}
              disabled={cancelLoading}
              className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl px-2.5 py-1 transition-colors disabled:opacity-50 font-semibold"
            >
              {cancelLoading ? '…' : 'Storno'}
            </button>
          ) : (
            <button
              onClick={() => onBuy(listing)}
              className={`text-[10px] font-bold rounded-xl px-2.5 py-1 transition-all border ${isSong ? 'border-amber-500/40 bg-amber-950/20 text-amber-400 hover:bg-amber-900/30' : `${cfg!.border} ${cfg!.bg} ${cfg!.text} hover:brightness-125`} active:scale-95`}
            >
              Kaufen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kauf-Modal ───────────────────────────────────────────────────────────────

function BuyModal({ listing, balance, walletAddress, onClose, onSuccess }: {
  listing: Listing;
  balance: number;
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const price   = Number(listing.price_dfaith);
  const enough  = balance >= price;
  const isSong  = listing.nft_type === 'song' || detectCategory(listing) === 'song';
  const cfg     = isSong ? null : rc(listing.rarity);
  const cleanName   = stripRarity(listing.collection_name ?? listing.nft_name ?? '');
  const description = listing.description
    || (!isSong && cleanName
        ? `${cfg!.label} D.FAITH Collectible from the "${cleanName}" series.`
        : null);

  const handleBuy = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/marketplace/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerWallet: walletAddress, listingId: listing.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Kauf fehlgeschlagen');
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-[#161410] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-black text-white text-base">NFT kaufen</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <FaTimes size={14} />
          </button>
        </div>

        {/* NFT-Vorschau */}
        <div className={`rounded-xl border p-3 mb-4 flex gap-3 items-start ${isSong ? 'border-amber-500/30 bg-amber-950/20' : `${cfg!.border} ${cfg!.bg} ${cfg!.glow}`}`}>
          {listing.image_url ? (
            <Image src={listing.image_url} alt="" width={56} height={56} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10" />
          ) : (
            <div className={`w-14 h-14 rounded-lg bg-black/30 shrink-0 flex items-center justify-center border ${isSong ? 'border-amber-500/30' : cfg!.border}`}>
              {isSong ? <FaMusic className="text-amber-400" size={20} /> : <GiCrystalShine className={cfg!.text} size={20} />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {isSong ? (
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[8px] font-bold rounded-full px-1.5 py-0.5 bg-amber-500/80 text-black flex items-center gap-0.5">
                  <FaMusic size={6} /> {listing.edition_number != null ? `Edition #${listing.edition_number}` : 'Song NFT'}
                </span>
              </div>
            ) : (
              <div className={`inline-block text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 mb-1 ${cfg!.badge}`}>
                {cfg!.label}
              </div>
            )}
            <p className={`font-black text-sm truncate ${isSong ? 'text-amber-300' : cfg!.text}`}>{listing.collection_name ?? listing.nft_name ?? '—'}</p>
            {listing.artist_name && <p className="text-zinc-500 text-[10px]">von {listing.artist_name}</p>}
            {isSong && description && (
              <p className="text-zinc-400 text-[9px] leading-relaxed mt-1">{description}</p>
            )}
            {!isSong && listing.attributes && (() => {
              const boosts = listing.attributes!.filter(a =>
                ['Rep Bonus', 'Credit Bonus', 'Shard Bonus', 'Bonus'].some(k => a.trait_type.includes(k))
              );
              return boosts.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {boosts.map(a => (
                    <span key={a.trait_type} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg!.border} ${cfg!.text} bg-black/30`}>
                      {a.trait_type.replace(' Bonus', '')} {a.value}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Preisübersicht */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Preis</span>
            <span className={`font-black ${isSong ? 'text-amber-400' : cfg!.text}`}>{price.toLocaleString('de-DE')} D.FAITH</span>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Artist Royalty (5%)</span>
            <span>{(price * 0.05).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Plattformgebühr (2.5%)</span>
            <span>{(price * 0.025).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Verkäufer erhält</span>
            <span>{(price * 0.925).toFixed(2)}</span>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <div className={`flex justify-between text-xs font-semibold ${enough ? 'text-zinc-300' : 'text-red-400'}`}>
            <span>Dein Guthaben</span>
            <span>{balance.toLocaleString('de-DE')} D.FAITH</span>
          </div>
        </div>

        {!enough && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs mb-4">
            <FaExclamationTriangle size={12} className="shrink-0" />
            <span>Nicht genug D.FAITH — benötigt {price.toLocaleString('de-DE')}</span>
          </div>
        )}

        {done ? (
          <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm font-semibold">
            <FaCheckCircle size={14} /> NFT erfolgreich gekauft!
          </div>
        ) : (
          <>
            {error && <p className="text-red-400 text-xs mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}
            <button
              onClick={handleBuy}
              disabled={loading || !enough}
              className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Kaufe…
                </span>
              ) : `${price.toLocaleString('de-DE')} D.FAITH bezahlen`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Aufladen-Modal ───────────────────────────────────────────────────────────

function DepositModal({ walletAddress, onClose, onSuccess }: {
  walletAddress: string;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}) {
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [loading, setLoading]           = useState(true);
  const [amount, setAmount]             = useState('');
  const [depositing, setDepositing]     = useState(false);
  const [error, setError]               = useState('');
  const [done, setDone]                 = useState(false);

  useEffect(() => {
    async function loadBalance() {
      try {
        const addrRes  = await fetch(`/api/solana/create-account?walletAddress=${walletAddress}`);
        const addrData = await addrRes.json();
        const solAddr: string | null = addrData.solanaAddress ?? null;
        if (!solAddr) { setLoading(false); return; }
        const balRes  = await fetch(`/api/solana/balance?solanaAddress=${solAddr}`);
        const balData = await balRes.json();
        setTokenBalance(Number(balData.dfaithBalance ?? 0));
      } catch { setTokenBalance(0); }
      finally { setLoading(false); }
    }
    loadBalance();
  }, [walletAddress]);

  const handleDeposit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (tokenBalance !== null && amt > tokenBalance) {
      setError(`Nicht genug Tokens — verfügbar: ${tokenBalance.toFixed(2)}`);
      return;
    }
    setDepositing(true);
    setError('');
    try {
      const res  = await fetch('/api/marketplace/deposit-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setDone(true);
      setTimeout(() => { onSuccess(amt); onClose(); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setDepositing(false);
    }
  };

  const max = tokenBalance ?? 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-[#161410] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <FaPlus className="text-amber-400" size={14} />
            Credits aufladen
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 mb-4 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Wie funktioniert es?</p>
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-amber-400 font-black shrink-0">1.</span>
            <span>Du sendest D.FAITH-Token aus deinem Platform-Wallet ins Treasury</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-amber-400 font-black shrink-0">2.</span>
            <span>Die Plattform schreibt dir den Gegenwert als Credits gut</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-amber-400 font-black shrink-0">3.</span>
            <span>Mit Credits kannst du NFTs auf dem Marktplatz kaufen</span>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">Verfügbare Tokens</span>
            {loading ? (
              <span className="text-zinc-600 text-xs">Wird geladen…</span>
            ) : (
              <span className="text-amber-300 font-black text-sm">{max.toLocaleString('de-DE', { maximumFractionDigits: 2 })} DFAITH</span>
            )}
          </div>
        </div>

        {done ? (
          <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 text-sm font-semibold">
            <FaCheckCircle size={14} /> Credits erfolgreich aufgeladen!
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Betrag in D.FAITH</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max={max}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="z.B. 100"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-amber-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
                <button
                  onClick={() => setAmount(String(Math.floor(max)))}
                  disabled={max <= 0}
                  className="shrink-0 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-xl px-3 transition-colors disabled:opacity-30"
                >
                  MAX
                </button>
              </div>
              {amount && Number(amount) > 0 && (
                <p className="text-zinc-500 text-[10px] mt-1.5">
                  = <span className="text-amber-400 font-bold">{Number(amount).toLocaleString('de-DE')} D.FAITH Credits</span>
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs mb-4">
                <FaExclamationTriangle size={10} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleDeposit}
              disabled={depositing || !amount || Number(amount) <= 0 || loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
            >
              {depositing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Wird aufgeladen…
                </span>
              ) : 'Tokens zu Credits umwandeln'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Verkaufen-Modal ──────────────────────────────────────────────────────────

function SellModal({ walletAddress, onClose, onSuccess }: {
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ownedNfts, setOwnedNfts]     = useState<OwnedNft[]>([]);
  const [loadingNfts, setLoadingNfts] = useState(true);
  const [selected, setSelected]       = useState<OwnedNft | null>(null);
  const [price, setPrice]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [done, setDone]               = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    async function load() {
      setLoadingNfts(true);
      try {
        const safeJson = async (res: Response) => { try { return await res.json(); } catch { return null; } };

        const [dbRes, addrRes, shopRes, listingsRes] = await Promise.all([
          fetch(`/api/collectibles?wallet=${walletAddress}`),
          fetch(`/api/solana/create-account?walletAddress=${walletAddress}`),
          fetch(`/api/nfts?wallet=${walletAddress}`),
          fetch(`/api/marketplace?seller=${walletAddress}`),
        ]);

        const [dbData, addrData, shopData, listingsData] = await Promise.all([
          safeJson(dbRes),
          safeJson(addrRes),
          safeJson(shopRes),
          safeJson(listingsRes),
        ]);

        const solanaAddress: string | null = addrData?.solanaAddress ?? null;

        // Bereits aktiv gelistete Mints — diese aus der Auswahl ausschließen
        const listingsArr: any[] = Array.isArray(listingsData)
          ? listingsData
          : (listingsData?.listings ?? []);
        const listedMints = new Set<string>(
          listingsArr.map((l: any) => l.mint_address as string)
        );

        // Shop-NFTs: DB-Purchase-Daten aufbauen (printMint → shop data map)
        const shopDataArr: any[] = Array.isArray(shopData) ? shopData : [];
        const shopByMint = new Map<string, any>();
        shopDataArr.forEach((s: any) => { if (s.printMint) shopByMint.set(s.printMint as string, s); });

        // Helius-NFTs laden (für Attribute aller D.FAITH-Collectibles + Bild-Fallback)
        let heliusMap = new Map<string, any>();
        if (solanaAddress) {
          try {
            const nftRes  = await fetch(`/api/solana/nfts?solanaAddress=${solanaAddress}`);
            const nftData = await safeJson(nftRes);
            const walletNfts: any[] = Array.isArray(nftData) ? nftData : [];
            walletNfts.forEach(n => heliusMap.set(n.mint as string, n));
          } catch { /* Helius nicht erreichbar — nur DB-Daten */ }
        }

        // DB-Collectibles — mit Helius-Attributen anreichern
        const dbNfts: OwnedNft[] = ((dbData?.collectibles) ?? [])
          .filter((c: any) => c.nftMintAddress && !listedMints.has(c.nftMintAddress as string))
          .map((c: any) => {
            const helius = heliusMap.get(c.nftMintAddress as string);
            return {
              id:                  c.id,
              nft_mint_address:    c.nftMintAddress,
              rarity:              c.rarity,
              collection_id:       c.collectionId ?? '',
              collection_name:     c.collectionName ?? undefined,
              image_url:           c.collectionImageUrl ?? c.imageUrl ?? undefined,
              artist_name:         c.artistName ?? undefined,
              nft_collection_mint: c.nftCollectionMint ?? undefined,
              source:              'db' as const,
              attributes:          helius?.attributes ?? [],
            };
          });

        // Alle bekannten Mints (Collectibles + Shop) zum Entduplizieren
        const dbMints       = new Set(dbNfts.map(n => n.nft_mint_address));
        const allKnownMints = new Set([...dbMints, ...shopByMint.keys()]);

        // Chain-only Collectibles (D.FAITH, nicht in DB, nicht als Shop erkannt)
        const chainNfts: OwnedNft[] = Array.from(heliusMap.values())
          .filter((n: any) => n.isDfaith && !allKnownMints.has(n.mint as string) && !listedMints.has(n.mint as string))
          .map((n: any): OwnedNft => {
            const rarityAttr = (n.attributes ?? []).find((a: any) => a.trait_type === 'Rarity');
            return {
              id:                  n.mint as string,
              nft_mint_address:    n.mint as string,
              rarity:              ((rarityAttr?.value as string | undefined) ?? 'common').toLowerCase(),
              collection_id:       (n.collection as string | null) ?? '',
              collection_name:     (n.name as string | null) ?? undefined,
              image_url:           (n.image as string | null) ?? undefined,
              artist_name:         undefined,
              nft_collection_mint: (n.collection as string | null) ?? undefined,
              source:              'chain',
              attributes:          n.attributes ?? [],
            };
          });

        // Shop-NFTs (Artist Shop Print Editions) — über DB-printMint identifiziert
        // isDfaith=false bei Helius kein Problem, da printMint aus DB kommt
        const shopNfts: OwnedNft[] = [];
        shopByMint.forEach((s, mint) => {
          if (listedMints.has(mint)) return;
          const helius = heliusMap.get(mint);
          shopNfts.push({
            id:                  s.purchaseId,
            nft_mint_address:    mint,
            rarity:              'common',
            collection_id:       s.masterEditionMint ?? s.itemId ?? '',
            collection_name:     s.title ?? helius?.name ?? undefined,
            image_url:           s.imageUrl ?? helius?.image ?? undefined,
            artist_name:         s.artistName ?? undefined,
            nft_collection_mint: s.masterEditionMint ?? undefined,
            source:              'shop' as const,
            editionNumber:       s.editionNumber ?? null,
            description:         s.description ?? null,
            contentUrl:          s.contentUrl ?? null,
            attributes: [
              { trait_type: 'Type',     value: 'Music'   },
              { trait_type: 'Platform', value: 'D.FAITH' },
              ...(s.artistName ? [{ trait_type: 'Artist', value: s.artistName }] : []),
            ],
          });
        });

        setOwnedNfts([...dbNfts, ...chainNfts, ...shopNfts]);
      } catch (e) {
        console.error('[SellModal] load error:', e);
      } finally {
        setLoadingNfts(false);
      }
    }
    load();
  }, [walletAddress]);

  const handleList = async () => {
    if (!selected || !price || Number(price) <= 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          mintAddress:       selected.nft_mint_address,
          priceDfaith:       Number(price),
          collectionId:      selected.collection_id,
          collectionName:    selected.collection_name,
          rarity:            selected.rarity,
          imageUrl:          selected.image_url,
          nftName:           selected.source === 'shop'
            ? `${selected.collection_name ?? ''}${selected.editionNumber != null ? ` — Edition #${selected.editionNumber}` : ''}`.trim()
            : `${selected.collection_name ?? ''} — ${selected.rarity ?? ''}`.trim(),
          artistName:        selected.artist_name,
          nftCollectionMint: selected.nft_collection_mint ?? null,
          nftType:           selected.source === 'shop' ? 'song' : 'collectible',
          description:       selected.description ?? null,
          contentUrl:        selected.contentUrl ?? null,
          editionNumber:     selected.editionNumber ?? null,
          attributes:        selected.attributes?.length ? selected.attributes : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const selectedIsSong = selected?.source === 'shop';
  const cfg = selected && !selectedIsSong ? rc(selected.rarity) : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-[#161410] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <MdSell className="text-amber-400" size={16} />
            NFT verkaufen
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <FaTimes size={14} />
          </button>
        </div>

        {done ? (
          <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 text-sm font-semibold">
            <FaCheckCircle size={14} /> NFT erfolgreich eingestellt!
          </div>
        ) : loadingNfts ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <span className="w-7 h-7 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-zinc-500 text-xs">Lade deine NFTs…</p>
          </div>
        ) : ownedNfts.length === 0 ? (
          <div className="text-center py-8">
            <FaGem className="text-zinc-700 mx-auto mb-3" size={28} />
            <p className="text-zinc-400 text-sm font-semibold mb-1">Keine D.FAITH NFTs gefunden</p>
            <p className="text-zinc-600 text-xs">Kaufe oder minte zuerst ein NFT im Artist Shop oder in deiner Sammlung.</p>
          </div>
        ) : (
          <>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">NFT auswählen</p>
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-60 overflow-y-auto pr-1 scrollbar-none">
              {ownedNfts.map((nft) => {
                const isSong = nft.source === 'shop';
                const c      = isSong ? null : rc(nft.rarity);
                const isSel  = selected?.nft_mint_address === nft.nft_mint_address;
                const cardBorder = isSong ? 'border-amber-500/40' : c!.border;
                const cardBg     = isSong ? 'bg-amber-950/20'     : c!.bg;
                const cardGlow   = isSong ? (isSel ? 'shadow-[0_0_14px_rgba(251,191,36,0.3)]' : '') : (isSel ? c!.glow : '');
                return (
                  <button
                    key={nft.nft_mint_address}
                    onClick={() => setSelected(nft)}
                    className={`relative rounded-xl border overflow-hidden text-left transition-all ${cardBorder} ${cardBg} ${cardGlow} ${isSel ? 'ring-2 ring-amber-400' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <div className="relative w-full aspect-square bg-black/30">
                      {nft.image_url ? (
                        <Image src={nft.image_url} alt="" fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isSong
                            ? <FaMusic className="text-amber-400 opacity-40" size={24} />
                            : <GiCrystalShine className={`${c!.text} opacity-40`} size={24} />
                          }
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      {isSong ? (
                        <div className="absolute top-1.5 right-1.5 text-[8px] font-bold rounded-full px-1.5 py-0.5 bg-amber-500/80 text-black flex items-center gap-0.5">
                          <FaMusic size={6} /> {nft.editionNumber != null ? `#${nft.editionNumber}` : 'Song'}
                        </div>
                      ) : (
                        <div className={`absolute top-1.5 right-1.5 text-[8px] font-bold uppercase rounded-full px-1.5 py-0.5 ${c!.badge}`}>
                          {c!.label}
                        </div>
                      )}
                      {isSel && (
                        <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                          <FaCheckCircle size={10} className="text-black" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className={`text-[10px] font-black truncate ${isSong ? 'text-amber-300' : c!.text}`}>{nft.collection_name ?? nft.id.slice(0, 8) + '…'}</p>
                      {nft.artist_name && <p className="text-zinc-600 text-[9px] truncate">von {nft.artist_name}</p>}
                      {nft.attributes && nft.attributes.filter(a => ['Rep Bonus', 'Credit Bonus'].includes(a.trait_type)).map(a => (
                        <p key={a.trait_type} className="text-[8px] text-zinc-500">{a.trait_type}: {a.value}</p>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className={`rounded-xl border p-3 mb-4 ${selectedIsSong ? 'border-amber-500/40 bg-amber-950/20' : `${cfg!.border} ${cfg!.bg}`}`}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Ausgewählt</p>
                <div className="flex items-center gap-2">
                  {selected.image_url && (
                    <Image src={selected.image_url} alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/10" />
                  )}
                  <div className="min-w-0">
                    <p className={`font-black text-xs truncate ${selectedIsSong ? 'text-amber-300' : cfg!.text}`}>{selected.collection_name}</p>
                    <p className={`text-[9px] ${selectedIsSong ? 'text-amber-400/70' : `${cfg!.text}/70`}`}>
                      {selectedIsSong
                        ? `Song NFT${selected.editionNumber != null ? ` — Edition #${selected.editionNumber}` : ''}`
                        : cfg!.label}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Preis in D.FAITH</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="z.B. 500"
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-amber-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 text-xs font-bold">D.FAITH</span>
              </div>
              {price && Number(price) > 0 && (
                <p className="text-zinc-500 text-[10px] mt-1.5">
                  Du erhältst: <span className="text-amber-400 font-bold">{(Number(price) * 0.925).toFixed(2)} D.FAITH</span> (nach 5% Royalty + 2.5% Gebühr)
                </p>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>
            )}

            <button
              onClick={handleList}
              disabled={loading || !selected || !price || Number(price) <= 0}
              className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Wird eingestellt…
                </span>
              ) : 'NFT einstellen'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function MarketplaceTab() {
  const { user }          = useUser();
  const walletAddress     = user?.id ?? '';

  const [view, setView]               = useState<'browse' | 'my'>('browse');
  const [listings, setListings]       = useState<Listing[]>([]);
  const [myListings, setMyListings]   = useState<Listing[]>([]);
  const [loading, setLoading]         = useState(true);
  const [balance, setBalance]         = useState(0);
  const [categoryFilter, setCategoryFilter]     = useState<'all' | 'collectible' | 'song'>('all');
  const [sortOrder, setSortOrder]               = useState<'price_asc' | 'price_desc' | 'newest'>('price_asc');
  const [rarityFilter, setRarityFilter]         = useState<string>('all');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter]         = useState<string | null>(null);
  const [buyTarget, setBuyTarget]         = useState<Listing | null>(null);
  const [showSell, setShowSell]           = useState(false);
  const [showDeposit, setShowDeposit]     = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, balRes] = await Promise.all([
        fetch('/api/marketplace'),
        walletAddress ? fetch(`/api/youtube-quests/rewards?wallet=${walletAddress}`) : Promise.resolve(null),
      ]);
      const listData = await listRes.json();
      setListings(listData.listings ?? []);
      if (balRes) {
        const balData = await balRes.json();
        setBalance(Number(balData.balance ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);


  const loadMyListings = useCallback(async () => {
    if (!walletAddress) return;
    const res  = await fetch(`/api/marketplace?seller=${walletAddress}`);
    const data = await res.json();
    setMyListings(data.listings ?? []);
  }, [walletAddress]);

  useEffect(() => { loadListings(); }, [loadListings]);
  // Immer beim Mount laden damit der Badge-Zähler sofort stimmt
  useEffect(() => { if (walletAddress) loadMyListings(); }, [walletAddress, loadMyListings]);
  // Bei Tab-Wechsel zu "Meine Listings" aktualisieren
  useEffect(() => { if (view === 'my') loadMyListings(); }, [view, loadMyListings]);

  const handleCancel = async (listing: Listing) => {
    setCancelLoading(listing.id);
    try {
      await fetch('/api/marketplace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, listingId: listing.id }),
      });
      await Promise.all([loadMyListings(), loadListings()]);
    } finally {
      setCancelLoading(null);
    }
  };

  // Dynamische Kollektion-Chips — Rarity-Suffix aus collection_name entfernen
  const collectionStats = (() => {
    const map = new Map<string, number>();
    listings.filter(l => detectCategory(l) === 'collectible').forEach(l => {
      const n = l.collection_name ? stripRarity(l.collection_name) : null;
      if (n) map.set(n, (map.get(n) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();

  // Künstler-Statistiken aus allen Listings (Raritätswörter ignorieren)
  const artistStats = (() => {
    const map = new Map<string, { count: number; picture: string | null }>();
    listings.forEach(l => {
      const a = l.artist_name;
      if (a && !RARITY_WORDS.has(a.toLowerCase())) {
        const prev = map.get(a);
        map.set(a, { count: (prev?.count ?? 0) + 1, picture: prev?.picture ?? l.artist_picture ?? null });
      }
    });
    return [...map.entries()].map(([name, d]) => ({ name, count: d.count, picture: d.picture })).sort((a, b) => b.count - a.count);
  })();

  const baseListings = view === 'browse' ? listings : myListings;
  const visibleListings = (() => {
    let result = baseListings;
    if (categoryFilter !== 'all') result = result.filter(l => detectCategory(l) === categoryFilter);
    if (collectionFilter)         result = result.filter(l => stripRarity(l.collection_name ?? '') === collectionFilter);
    if (artistFilter)             result = result.filter(l => l.artist_name === artistFilter);
    if (rarityFilter !== 'all')   result = result.filter(l => l.rarity === rarityFilter);
    return [...result].sort((a, b) => {
      if (sortOrder === 'price_asc')  return Number(a.price_dfaith) - Number(b.price_dfaith);
      if (sortOrder === 'price_desc') return Number(b.price_dfaith) - Number(a.price_dfaith);
      return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
    });
  })();

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={40} height={40} className="w-10 h-10 rounded-full object-contain shrink-0" />
            <div>
              <h1 className="text-white font-black text-xl tracking-wide">D.FAITH Marktplatz</h1>
              <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                NFTs kaufen · verkaufen
              </p>
            </div>
          </div>

          {/* Balance-Karte */}
          {walletAddress && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex gap-3 items-center flex-1 min-w-0">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Credits</p>
                  <p className="text-amber-300 font-black text-xl leading-none">{balance.toLocaleString('de-DE')}</p>
                  <p className="text-zinc-500 text-[9px] mt-0.5">D.FAITH Credits</p>
                </div>
                <button
                  onClick={() => setShowDeposit(true)}
                  className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold rounded-xl px-3 py-2 text-xs transition-all shrink-0"
                >
                  <FaPlus size={9} /> Aufladen
                </button>
              </div>
              <button
                onClick={() => setShowSell(true)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black rounded-xl px-4 py-2.5 text-sm transition-all shrink-0"
              >
                <MdSell size={14} />
                Verkaufen
              </button>
            </div>
          )}
        </div>

        {/* ── Tab-Toggle ──────────────────────────────────────────────────────── */}
        <div className="mx-4 mb-4">
          <div className="flex bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1">
            <button
              onClick={() => setView('browse')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                view === 'browse'
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <HiOutlineViewGrid size={13} /> Alle Listings
              {listings.length > 0 && (
                <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black rounded-full px-1.5 py-0.5">
                  {listings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView('my')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                view === 'my'
                  ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <FaTag size={11} /> Meine Listings
              {myListings.length > 0 && (
                <span className="bg-violet-500/20 text-violet-300 text-[9px] font-black rounded-full px-1.5 py-0.5">
                  {myListings.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Kategorie-Tabs + Filter-Button ──────────────────────────────────── */}
        {view === 'browse' && (() => {
          const activeCount =
            (sortOrder !== 'price_asc' ? 1 : 0) +
            (rarityFilter !== 'all'    ? 1 : 0) +
            (collectionFilter          ? 1 : 0) +
            (artistFilter              ? 1 : 0);
          return (
            <div className="flex items-center gap-2 px-4 mb-3">
              {/* Kategorie-Tabs */}
              <div className="flex gap-0.5 flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 min-w-0">
                {([
                  { key: 'all',         icon: <HiOutlineViewGrid size={11} />, label: 'Alle'         },
                  { key: 'collectible', icon: <GiCrystalShine size={11} />,   label: 'Collectibles'  },
                  { key: 'song',        icon: <FaMusic size={10} />,           label: 'Artist Shop'   },
                ] as const).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCategoryFilter(key);
                      setCollectionFilter(null);
                      setArtistFilter(null);
                      if (key === 'song') setRarityFilter('all');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all truncate ${
                      categoryFilter === key
                        ? key === 'collectible' ? 'bg-violet-500/15 border border-violet-500/25 text-violet-300'
                          : key === 'song'      ? 'bg-rose-500/15 border border-rose-500/25 text-rose-300'
                          :                       'bg-amber-500/15 border border-amber-500/25 text-amber-300'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {icon}<span className="hidden xs:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Filter-Button */}
              <button
                onClick={() => setShowFilterSheet(true)}
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  activeCount > 0
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FaSlidersH size={12} />
                {activeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          );
        })()}

        {/* ── Filter-Sheet ─────────────────────────────────────────────────────── */}
        {showFilterSheet && (
          <>
            <div
              className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
              onClick={() => setShowFilterSheet(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141210] border-t border-white/[0.08] rounded-t-3xl max-h-[82vh] overflow-y-auto pb-safe">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3">
                <span className="font-black text-white text-base">Filter & Sortierung</span>
                <button
                  onClick={() => {
                    setSortOrder('price_asc');
                    setRarityFilter('all');
                    setCollectionFilter(null);
                    setArtistFilter(null);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold"
                >
                  Zurücksetzen
                </button>
              </div>

              {/* Sortierung */}
              <div className="px-5 mb-5">
                <p className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-2.5">Sortierung</p>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'price_asc',  icon: <FaSortAmountUp size={10} />,   label: 'Preis aufsteigend'  },
                    { key: 'price_desc', icon: <FaSortAmountDown size={10} />, label: 'Preis absteigend'   },
                    { key: 'newest',     icon: <FaClock size={10} />,          label: 'Neueste zuerst'     },
                  ] as const).map(({ key, icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setSortOrder(key)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                        sortOrder === key
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seltenheit (nur Collectibles) */}
              {categoryFilter !== 'song' && (
                <div className="px-5 mb-5">
                  <p className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-2.5">Seltenheit</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['all', ...RARITY_ORDER] as const).map((r) => {
                      const c = r !== 'all' ? RARITY_CFG[r as Rarity] : null;
                      const isActive = rarityFilter === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setRarityFilter(r)}
                          className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                            isActive
                              ? c ? `${c.border} ${c.bg} ${c.text}` : 'border-white/25 bg-white/[0.08] text-white'
                              : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {r === 'all' ? 'Alle' : RARITY_CFG[r as Rarity].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Kollektion (wenn vorhanden) */}
              {categoryFilter !== 'song' && collectionStats.length > 0 && (
                <div className="px-5 mb-5">
                  <p className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-2.5">Kollektion</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setCollectionFilter(null)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                        !collectionFilter
                          ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Alle
                    </button>
                    {collectionStats.map(({ name, count }) => (
                      <button
                        key={name}
                        onClick={() => setCollectionFilter(collectionFilter === name ? null : name)}
                        className={`flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                          collectionFilter === name
                            ? 'border-violet-400/50 bg-violet-500/10 text-violet-300'
                            : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {name}<span className="text-[10px] opacity-40">·{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Künstler (Artist Shop) */}
              {categoryFilter !== 'collectible' && artistStats.length > 0 && (
                <div className="px-5 mb-5">
                  <p className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-2.5">Künstler</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setArtistFilter(null)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                        !artistFilter
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <RiUserStarFill size={11} /> Alle
                    </button>
                    {artistStats.map(({ name, picture }) => (
                      <button
                        key={name}
                        onClick={() => setArtistFilter(artistFilter === name ? null : name)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                          artistFilter === name
                            ? 'border-rose-400/50 bg-rose-500/10 text-rose-200'
                            : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <ArtistAvatar name={name} picture={picture} size="sm" />
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fertig-Button */}
              <div className="px-5 pt-2 pb-10">
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl text-sm transition-all"
                >
                  Fertig
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Künstler-Avatare (immer sichtbar beim Browsen) ──────────────────── */}
        {view === 'browse' && artistStats.length > 0 && (
          <div className="px-4 mb-4">
            <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
              <button
                onClick={() => setArtistFilter(null)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group"
              >
                <div className={`rounded-full ring-2 transition-all group-hover:scale-105 ${
                  artistFilter === null
                    ? 'ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'ring-white/20'
                }`}>
                  <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <RiUserStarFill size={22} className={artistFilter === null ? 'text-amber-400' : 'text-zinc-500'} />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-300 text-center leading-tight group-hover:text-white transition-colors">Alle</p>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  artistFilter === null ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-zinc-500'
                }`}>{listings.length}</span>
              </button>

              {artistStats.map(({ name, count, picture }) => {
                const isActive = artistFilter === name;
                return (
                  <button
                    key={name}
                    onClick={() => setArtistFilter(isActive ? null : name)}
                    className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group"
                  >
                    <div className={`rounded-full ring-2 transition-all group-hover:scale-105 ${
                      isActive
                        ? 'ring-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.55)]'
                        : 'ring-white/20'
                    }`}>
                      <ArtistAvatar name={name} picture={picture} size="lg" />
                    </div>
                    <p className="text-[10px] text-zinc-300 text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">{name}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-zinc-500'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Listings ────────────────────────────────────────────────────────── */}
        <div className="px-4">
          {loading && view === 'browse' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-zinc-500 text-xs">Lade Listings…</p>
            </div>
          ) : visibleListings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <MdStorefront className="text-zinc-600" size={28} />
              </div>
              <p className="text-zinc-400 font-semibold text-sm mb-1">
                {view === 'my' ? 'Du hast keine aktiven Listings' : 'Keine NFTs gelistet'}
              </p>
              <p className="text-zinc-600 text-xs">
                {view === 'my' ? 'Stelle dein erstes NFT ein und verdiene D.FAITH.' : 'Schau bald wieder vorbei — der Marktplatz füllt sich.'}
              </p>
              {view === 'my' && (
                <button
                  onClick={() => setShowSell(true)}
                  className="mt-4 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 rounded-full px-4 py-1.5"
                >
                  NFT einstellen →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isSelf={l.seller_wallet === walletAddress.toLowerCase()}
                  onBuy={setBuyTarget}
                  onCancel={handleCancel}
                  cancelLoading={cancelLoading === l.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Kauf-Modal ──────────────────────────────────────────────────────────── */}
      {buyTarget && (
        <BuyModal
          listing={buyTarget}
          balance={balance}
          walletAddress={walletAddress}
          onClose={() => setBuyTarget(null)}
          onSuccess={() => { setBuyTarget(null); loadListings(); }}
        />
      )}

      {/* ── Verkaufen-Modal ─────────────────────────────────────────────────────── */}
      {showSell && (
        <SellModal
          walletAddress={walletAddress}
          onClose={() => setShowSell(false)}
          onSuccess={() => { setShowSell(false); loadListings(); loadMyListings(); }}
        />
      )}

      {/* ── Aufladen-Modal ──────────────────────────────────────────────────────── */}
      {showDeposit && (
        <DepositModal
          walletAddress={walletAddress}
          onClose={() => setShowDeposit(false)}
          onSuccess={(amt) => {
            setBalance(prev => prev + amt);
            setShowDeposit(false);
          }}
        />
      )}
    </div>
  );
}
