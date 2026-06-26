"use client";
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { GiCrystalShine } from 'react-icons/gi';
import { FaTag, FaStore, FaTimes, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { MdSell } from 'react-icons/md';

// ─── Typen ────────────────────────────────────────────────────────────────────

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
  listed_at: string;
  status: string;
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
}

// ─── Rarity-Farben ────────────────────────────────────────────────────────────

const RARITY_STYLE: Record<Rarity, { border: string; text: string; bg: string; glow: string }> = {
  common:    { border: 'border-zinc-500',   text: 'text-zinc-300',   bg: 'bg-zinc-800/60',     glow: '' },
  uncommon:  { border: 'border-green-500',  text: 'text-green-400',  bg: 'bg-green-950/40',    glow: 'shadow-[0_0_10px_rgba(74,222,128,0.3)]' },
  rare:      { border: 'border-blue-500',   text: 'text-blue-400',   bg: 'bg-blue-950/40',     glow: 'shadow-[0_0_12px_rgba(96,165,250,0.35)]' },
  epic:      { border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-950/40',   glow: 'shadow-[0_0_14px_rgba(167,139,250,0.45)]' },
  legendary: { border: 'border-amber-400',  text: 'text-amber-400',  bg: 'bg-amber-950/40',    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.5)]' },
  mythic:    { border: 'border-rose-400',   text: 'text-rose-400',   bg: 'bg-rose-950/40',     glow: 'shadow-[0_0_22px_rgba(244,63,94,0.6)]' },
};
const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
  epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic',
};

function rarityStyle(r: string | null) {
  return RARITY_STYLE[(r?.toLowerCase() ?? 'common') as Rarity] ?? RARITY_STYLE.common;
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, walletAddress, onBuy, onCancel, isSelf }: {
  listing: Listing;
  walletAddress: string;
  onBuy: (l: Listing) => void;
  onCancel: (l: Listing) => void;
  isSelf: boolean;
}) {
  const rs = rarityStyle(listing.rarity);
  return (
    <div className={`rounded-xl border ${rs.border} ${rs.bg} ${rs.glow} p-3 flex flex-col gap-2`}>
      {listing.image_url ? (
        <div className="relative w-full aspect-square rounded-lg overflow-hidden">
          <Image src={listing.image_url} alt={listing.nft_name ?? ''} fill className="object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-square rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <GiCrystalShine className="text-zinc-600" size={32} />
        </div>
      )}

      <div className="min-w-0">
        <p className={`font-bold text-sm truncate ${rs.text}`}>
          {listing.nft_name || listing.collection_name || '—'}
        </p>
        {listing.rarity && (
          <p className={`text-[10px] font-semibold ${rs.text}/80`}>
            {RARITY_LABEL[(listing.rarity.toLowerCase() as Rarity)] ?? listing.rarity}
          </p>
        )}
        {listing.artist_name && (
          <p className="text-zinc-500 text-[10px] truncate">von {listing.artist_name}</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/10">
        <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
          <FaTag size={10} />
          {Number(listing.price_dfaith).toLocaleString('de-DE')} D.FAITH
        </span>
        {isSelf ? (
          <button
            onClick={() => onCancel(listing)}
            className="text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-md px-2 py-1 transition-colors"
          >
            Stornieren
          </button>
        ) : (
          <button
            onClick={() => onBuy(listing)}
            className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md px-2 py-1 transition-colors"
          >
            Kaufen
          </button>
        )}
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

  const price = Number(listing.price_dfaith);
  const enough = balance >= price;
  const rs = rarityStyle(listing.rarity);

  const handleBuy = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/marketplace/buy', {
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a1810] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-white text-base">NFT kaufen</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><FaTimes size={16} /></button>
        </div>

        {/* NFT-Vorschau */}
        <div className={`rounded-xl border ${rs.border} ${rs.bg} p-3 mb-4 flex gap-3 items-center`}>
          {listing.image_url ? (
            <Image src={listing.image_url} alt="" width={56} height={56} className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-white/5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className={`font-bold text-sm truncate ${rs.text}`}>{listing.nft_name || listing.collection_name}</p>
            {listing.rarity && <p className={`text-[10px] ${rs.text}/70`}>{RARITY_LABEL[(listing.rarity.toLowerCase() as Rarity)] ?? listing.rarity}</p>}
            {listing.artist_name && <p className="text-zinc-500 text-[10px]">von {listing.artist_name}</p>}
          </div>
        </div>

        {/* Preisübersicht */}
        <div className="space-y-1.5 text-sm mb-4">
          <div className="flex justify-between text-zinc-300">
            <span>Preis</span>
            <span className="text-amber-400 font-bold">{price.toLocaleString('de-DE')} D.FAITH</span>
          </div>
          <div className="flex justify-between text-zinc-500 text-xs">
            <span>Artist-Royalty (5%)</span>
            <span>{(price * 0.05).toFixed(2)} D.FAITH</span>
          </div>
          <div className="flex justify-between text-zinc-500 text-xs">
            <span>Plattformgebühr (2.5%)</span>
            <span>{(price * 0.025).toFixed(2)} D.FAITH</span>
          </div>
          <div className="flex justify-between text-zinc-500 text-xs">
            <span>Verkäufer erhält</span>
            <span>{(price * 0.925).toFixed(2)} D.FAITH</span>
          </div>
          <div className={`flex justify-between text-xs pt-1 border-t border-white/10 ${enough ? 'text-zinc-400' : 'text-red-400'}`}>
            <span>Dein Guthaben</span>
            <span>{balance.toLocaleString('de-DE')} D.FAITH</span>
          </div>
        </div>

        {!enough && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs mb-4">
            <FaExclamationTriangle size={12} />
            <span>Nicht genug D.FAITH — benötigt: {price.toLocaleString('de-DE')}</span>
          </div>
        )}

        {done ? (
          <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
            <FaCheckCircle size={14} />
            NFT erfolgreich gekauft!
          </div>
        ) : (
          <>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              onClick={handleBuy}
              disabled={loading || !enough}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl py-3 text-sm transition-colors"
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

// ─── Verkaufen-Modal ──────────────────────────────────────────────────────────

function SellModal({ walletAddress, onClose, onSuccess }: {
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ownedNfts, setOwnedNfts]   = useState<OwnedNft[]>([]);
  const [loadingNfts, setLoadingNfts] = useState(true);
  const [selected, setSelected]     = useState<OwnedNft | null>(null);
  const [price, setPrice]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [done, setDone]             = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingNfts(true);
      try {
        const res  = await fetch(`/api/collectibles?wallet=${walletAddress}`);
        const data = await res.json();
        const minted: OwnedNft[] = (data.collectibles ?? [])
          .filter((c: any) => c.nftMintAddress)
          .map((c: any) => ({
            id:                  c.id,
            nft_mint_address:    c.nftMintAddress,
            rarity:              c.rarity,
            collection_id:       c.collectionId,
            collection_name:     c.collectionName,
            image_url:           c.imageUrl,
            artist_name:         c.artistName,
            nft_collection_mint: c.nftCollectionMint,
          }));
        setOwnedNfts(minted);
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
          mintAddress:    selected.nft_mint_address,
          priceDfaith:    Number(price),
          collectionId:   selected.collection_id,
          collectionName: selected.collection_name,
          rarity:         selected.rarity,
          imageUrl:       selected.image_url,
          nftName:        `${selected.collection_name ?? ''} — ${selected.rarity ?? ''}`.trim(),
          artistName:     selected.artist_name,
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

  const rs = selected ? rarityStyle(selected.rarity) : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a1810] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-white text-base">NFT verkaufen</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><FaTimes size={16} /></button>
        </div>

        {done ? (
          <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 text-sm">
            <FaCheckCircle size={14} />
            NFT erfolgreich eingestellt!
          </div>
        ) : (
          <>
            {loadingNfts ? (
              <div className="flex justify-center py-8">
                <span className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : ownedNfts.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-6">Keine geminteten NFTs gefunden.</p>
            ) : (
              <>
                <p className="text-zinc-400 text-xs mb-3">Wähle ein NFT zum Verkaufen:</p>
                <div className="grid grid-cols-2 gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
                  {ownedNfts.map((nft) => {
                    const nrs = rarityStyle(nft.rarity);
                    const isSelected = selected?.nft_mint_address === nft.nft_mint_address;
                    return (
                      <button
                        key={nft.nft_mint_address}
                        onClick={() => setSelected(nft)}
                        className={`rounded-lg border p-2 text-left transition-all ${nrs.border} ${nrs.bg} ${isSelected ? 'ring-2 ring-amber-400' : 'opacity-70 hover:opacity-100'}`}
                      >
                        {nft.image_url ? (
                          <Image src={nft.image_url} alt="" width={64} height={64} className="w-full aspect-square rounded object-cover mb-1" />
                        ) : (
                          <div className="w-full aspect-square rounded bg-white/5 mb-1" />
                        )}
                        <p className={`text-[10px] font-semibold truncate ${nrs.text}`}>{RARITY_LABEL[(nft.rarity.toLowerCase() as Rarity)] ?? nft.rarity}</p>
                        <p className="text-zinc-500 text-[9px] truncate">{nft.collection_name ?? '—'}</p>
                      </button>
                    );
                  })}
                </div>

                {selected && rs && (
                  <div className={`rounded-lg border ${rs.border} ${rs.bg} p-2 mb-4 text-xs flex items-center gap-2`}>
                    <span className={rs.text}>✓ Ausgewählt:</span>
                    <span className="text-zinc-300 truncate">{selected.collection_name} — {RARITY_LABEL[(selected.rarity.toLowerCase() as Rarity)] ?? selected.rarity}</span>
                  </div>
                )}

                <div className="mb-4">
                  <label className="text-zinc-400 text-xs block mb-1">Preis in D.FAITH</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="z.B. 500"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none pr-20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 text-xs font-semibold">D.FAITH</span>
                  </div>
                  {price && Number(price) > 0 && (
                    <p className="text-zinc-500 text-[10px] mt-1">Du erhältst: {(Number(price) * 0.925).toFixed(2)} D.FAITH (nach 5% Royalty + 2.5% Gebühr)</p>
                  )}
                </div>

                {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

                <button
                  onClick={handleList}
                  disabled={loading || !selected || !price || Number(price) <= 0}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl py-3 text-sm transition-colors"
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function MarketplaceTab() {
  const { user } = useUser();
  const walletAddress = user?.id ?? '';

  const [view, setView]             = useState<'browse' | 'my'>('browse');
  const [listings, setListings]     = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading]       = useState(true);
  const [balance, setBalance]       = useState(0);
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [buyTarget, setBuyTarget]   = useState<Listing | null>(null);
  const [showSell, setShowSell]     = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const url = rarityFilter !== 'all'
        ? `/api/marketplace?rarity=${rarityFilter}`
        : '/api/marketplace';
      const [listRes, balRes] = await Promise.all([
        fetch(url),
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
  }, [rarityFilter, walletAddress]);

  const loadMyListings = useCallback(async () => {
    if (!walletAddress) return;
    const res  = await fetch(`/api/marketplace?seller=${walletAddress}`);
    const data = await res.json();
    setMyListings(data.listings ?? []);
  }, [walletAddress]);

  useEffect(() => { loadListings(); }, [loadListings]);
  useEffect(() => { if (view === 'my') loadMyListings(); }, [view, loadMyListings]);

  const handleCancel = async (listing: Listing) => {
    setCancelLoading(listing.id);
    try {
      await fetch('/api/marketplace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, listingId: listing.id }),
      });
      await loadMyListings();
      if (view === 'browse') await loadListings();
    } finally {
      setCancelLoading(null);
    }
  };

  const visibleListings = view === 'browse'
    ? listings.filter(l => l.seller_wallet !== walletAddress.toLowerCase())
    : myListings;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaStore className="text-amber-400" size={18} />
          <h2 className="text-white font-bold text-lg">Marktplatz</h2>
        </div>
        {walletAddress && (
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              {balance.toLocaleString('de-DE')} D.FAITH
            </span>
            <button
              onClick={() => setShowSell(true)}
              className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-3 py-1.5 transition-colors"
            >
              <MdSell size={12} />
              Verkaufen
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-1 bg-zinc-900/60 rounded-xl p-1">
        {(['browse', 'my'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              view === v ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {v === 'browse' ? 'Alle Listings' : 'Meine Listings'}
          </button>
        ))}
      </div>

      {/* Rarity-Filter (nur Browse) */}
      {view === 'browse' && (
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...RARITY_ORDER].map((r) => {
            const rs = r !== 'all' ? RARITY_STYLE[r as Rarity] : null;
            return (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  rarityFilter === r
                    ? rs
                      ? `${rs.border} ${rs.bg} ${rs.text}`
                      : 'border-amber-400 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {r === 'all' ? 'Alle' : RARITY_LABEL[r as Rarity]}
              </button>
            );
          })}
        </div>
      )}

      {/* Listings Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : visibleListings.length === 0 ? (
        <div className="text-center py-12">
          <FaStore className="text-zinc-700 mx-auto mb-3" size={36} />
          <p className="text-zinc-500 text-sm">
            {view === 'my' ? 'Du hast keine aktiven Listings.' : 'Keine NFTs gelistet.'}
          </p>
          {view === 'my' && (
            <button
              onClick={() => setShowSell(true)}
              className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Jetzt NFT einstellen →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleListings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              walletAddress={walletAddress}
              isSelf={l.seller_wallet === walletAddress.toLowerCase()}
              onBuy={setBuyTarget}
              onCancel={cancelLoading === l.id ? () => {} : handleCancel}
            />
          ))}
        </div>
      )}

      {/* Kauf-Modal */}
      {buyTarget && (
        <BuyModal
          listing={buyTarget}
          balance={balance}
          walletAddress={walletAddress}
          onClose={() => setBuyTarget(null)}
          onSuccess={() => { setBuyTarget(null); loadListings(); }}
        />
      )}

      {/* Verkaufen-Modal */}
      {showSell && (
        <SellModal
          walletAddress={walletAddress}
          onClose={() => setShowSell(false)}
          onSuccess={() => { setShowSell(false); loadListings(); loadMyListings(); }}
        />
      )}
    </div>
  );
}
