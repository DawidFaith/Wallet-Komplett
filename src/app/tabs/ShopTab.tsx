'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import {
  FaChevronLeft, FaPlus, FaTimes, FaMusic, FaVideo, FaGem, FaCertificate, FaStar,
  FaCoins, FaCheck, FaExternalLinkAlt, FaTrash, FaShoppingBag,
  FaPlay, FaPause, FaDownload, FaBoxOpen, FaLock, FaChevronUp, FaChevronDown, FaEdit,
  FaCreditCard,
} from 'react-icons/fa';
import CreditsCardCheckout from '../components/CreditsCardCheckout';
import IdentityVerifyModal from './profile/IdentityVerifyModal';
import { SiSolana } from 'react-icons/si';
import { useLang } from '../components/LangContext';
import { t, tFmt } from '../utils/i18n';

// Fehlercodes von /api/shop/purchase → i18n-Key, damit die Meldung in der
// Sprache des Nutzers erscheint statt im festen Deutsch der API-Antwort.
const PURCHASE_ERROR_KEYS: Record<string, string> = {
  no_body:                     'shop.errNoBody',
  missing_fields:              'shop.errMissingFields',
  invalid_payment_method:      'shop.errInvalidPaymentMethod',
  item_not_found:              'shop.errItemNotFound',
  sold_out:                    'shop.errSoldOut',
  token_not_configured:        'shop.errTokenNotConfigured',
  no_solana_wallet:            'shop.errNoSolanaWallet',
  insufficient_credits:        'shop.errInsufficientCredits',
  insufficient_tokens:         'shop.errInsufficientTokens',
  artist_no_solana_wallet:     'shop.errArtistNoSolanaWallet',
  token_transfer_failed:       'shop.errTokenTransferFailed',
  no_onchain_collection:       'shop.errNoOnchainCollection',
  nft_mint_failed_refunded:    'shop.errNftMintFailedRefunded',
  nft_mint_failed_no_refund:   'shop.errNftMintFailedNoRefund',
  unexpected_error:            'shop.buyFailed',
};

// ─── Typen ───────────────────────────────────────────────────────────────────

type ItemType = 'song' | 'video' | 'nft' | 'exclusive'; // video/exclusive: nur noch Anzeige, Neu-Erstellung nur 'song'

interface ShopItem {
  id: string;
  artistWallet: string;
  artistName: string | null;
  title: string;
  description: string;
  type: ItemType;
  priceCredits: number;
  priceTokens: number | null;
  contentUrl: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  ownedCount?: number;
  requiredLevel: number;
  nftMaxSupply: number | null;
  isNftEnabled: boolean;
  masterEditionMint: string | null;
  soldCount: number;
  editionCount?: number;
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

/** Wandelt einen YouTube-Link (watch/youtu.be/shorts) in eine Embed-URL um, sonst null. */
function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/embed/')[1];
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/shorts/')[1];
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

/** Extrahiert die YouTube-Video-ID aus einem beliebigen YouTube-Link, sonst null. */
function getYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1] || null;
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Von YouTube bereitgestelltes Vorschaubild des Videos (kein eigener Upload nötig). */
function getYoutubeThumbnailUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** Cover-Bild fürs Item: eigener Upload, sonst bei Videos automatisch das YouTube-Thumbnail. */
function getDisplayImageUrl(item: { type: ItemType; imageUrl: string; contentUrl: string }): string | null {
  if (item.imageUrl) return item.imageUrl;
  if (item.type === 'video') return getYoutubeThumbnailUrl(item.contentUrl);
  return null;
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

/** Kleine Badges, die den Item-Typ auf einen Blick zeigen — Teil des Kartentexts, nicht auf dem Cover. */
function ItemTypeBadge({ type }: { type: ItemType }) {
  const NFT_PILL = { label: 'NFT', icon: <FaCertificate size={8} />, color: 'text-amber-300' };
  const pills: { label: string; icon: React.ReactNode; color: string }[] =
    type === 'song'
      ? [{ label: 'MP3', icon: <FaMusic size={8} />, color: 'text-violet-300' }, NFT_PILL]
      : type === 'video'
      ? [{ label: 'Video', icon: <FaVideo size={8} />, color: 'text-red-300' }]
      : [NFT_PILL];

  return (
    <div className="flex items-center justify-end gap-1">
      {pills.map(p => (
        <span key={p.label} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-white/5 border border-white/10 ${p.color}`}>
          {p.icon} {p.label}
        </span>
      ))}
    </div>
  );
}

// ─── Item-Karte (kompakt, öffnet Detail-Modal) ────────────────────────────────

function ItemCard({
  item,
  artistRewardToken,
  userLevel = 0,
  onOpen,
}: {
  item: ShopItem;
  artistRewardToken?: string | null;
  userLevel?: number;
  onOpen: (item: ShopItem) => void;
}) {
  const tokenLabel = artistRewardToken ?? 'D.FAITH';
  const isLocked   = item.requiredLevel > 0 && userLevel < item.requiredLevel;
  const remaining  = item.isNftEnabled && item.nftMaxSupply != null ? item.nftMaxSupply - item.soldCount : null;
  const isSoldOut  = remaining !== null && remaining <= 0;

  const fallbackGradient: Record<ItemType, string> = {
    song:      'from-violet-900/60 to-zinc-900',
    video:     'from-red-900/60 to-zinc-900',
    nft:       'from-amber-900/60 to-zinc-900',
    exclusive: 'from-emerald-900/60 to-zinc-900',
  };
  const displayImage = getDisplayImageUrl(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group relative flex flex-col rounded-xl overflow-hidden text-left transition-all duration-200 ${
        isLocked
          ? 'bg-[#181818] opacity-60'
          : 'bg-[#181818] hover:bg-[#282828]'
      }`}
    >
      {/* ── Album-Art (quadratisch) ── */}
      <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-2xl m-3 mb-0" style={{ width: 'calc(100% - 1.5rem)' }}>
        {displayImage ? (
          <>
            <Image src={displayImage} alt="" fill className={`object-cover scale-110 blur-xl opacity-40 ${isLocked ? 'grayscale' : ''}`} />
            <Image src={displayImage} alt={item.title} fill className={`object-contain ${isLocked ? 'grayscale' : ''}`} />
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${fallbackGradient[item.type]}`}>
            <span className="opacity-30 text-5xl"><TypeIcon type={item.type} /></span>
          </div>
        )}

        {/* Sold-Out-Overlay */}
        {isSoldOut && !isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
            <p className="text-white text-xs font-black tracking-widest uppercase">Ausverkauft</p>
          </div>
        )}

        {/* Lock-Overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-[2px]">
            <FaLock size={20} className="text-zinc-300 mb-1.5" />
            <p className="text-white text-[10px] font-bold">Level {item.requiredLevel}</p>
          </div>
        )}

        {/* Besitz-Badge */}
        {(item.ownedCount ?? 0) > 0 && (
          <div className="absolute top-2 right-2 bg-amber-400 rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
            <FaCheck size={9} className="text-black" />
          </div>
        )}
      </div>

      {/* ── Textbereich (kompakt) ── */}
      <div className="px-3 pt-2 pb-3 flex flex-col gap-0.5">
        <p className="text-white font-bold text-sm leading-snug line-clamp-1">{item.title}</p>
        {item.artistName && (
          <p className="text-amber-300/80 text-[11px] font-semibold line-clamp-1">{item.artistName}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {item.requiredLevel > 0 && (
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              isLocked ? 'bg-zinc-700 text-zinc-400' : 'bg-amber-900/60 text-amber-400'
            }`}>
              <FaStar size={6} /> {item.requiredLevel}
            </span>
          )}
          <span className={`text-[11px] font-semibold ${isLocked ? 'text-zinc-500' : 'text-zinc-300'}`}>
            {item.priceCredits.toLocaleString('de-DE')} {tokenLabel}
          </span>
        </div>
        <ItemTypeBadge type={item.type} />
      </div>
    </button>
  );
}

// ─── Item-Detail-Modal (Beschreibung, Preview, Kauf) ──────────────────────────

function ItemDetailModal({
  item,
  onClose,
  onBuy,
  buying,
  walletAddress,
  artistRewardToken,
  userLevel = 0,
}: {
  item: ShopItem;
  onClose: () => void;
  onBuy: (item: ShopItem, paymentMethod: 'credits' | 'tokens') => void;
  buying: string | null;
  walletAddress: string | null;
  artistRewardToken?: string | null;
  userLevel?: number;
}) {
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lang = useLang();
  const tokenLabel = artistRewardToken ?? 'D.FAITH';
  const isLocked   = item.requiredLevel > 0 && userLevel < item.requiredLevel;
  const remaining  = item.isNftEnabled && item.nftMaxSupply != null ? item.nftMaxSupply - item.soldCount : null;
  const isSoldOut  = remaining !== null && remaining <= 0;

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
    <div
      className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-[#161410] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Album-Art (groß) ── */}
        <div className="relative w-full aspect-square overflow-hidden">
          {getDisplayImageUrl(item) ? (
            <>
              <Image src={getDisplayImageUrl(item)!} alt="" fill className={`object-cover scale-110 blur-xl opacity-40 ${isLocked ? 'grayscale' : ''}`} />
              <Image src={getDisplayImageUrl(item)!} alt={item.title} fill className={`object-contain ${isLocked ? 'grayscale' : ''}`} />
            </>
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${fallbackGradient[item.type]}`}>
              <span className="opacity-30 text-6xl"><TypeIcon type={item.type} /></span>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
          >
            <FaTimes size={14} />
          </button>

          {/* Preview-Play (nur Song) */}
          {item.type === 'song' && item.contentUrl && !isLocked && (
            <>
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
                className="absolute bottom-2 left-2 w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center shadow-xl transition-all duration-200"
              >
                {previewPlaying
                  ? <FaPause size={13} className="text-black" />
                  : <FaPlay size={13} className="text-black ml-0.5" />
                }
              </button>
              {previewPlaying && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/30">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: '100%', transition: 'width 30s linear', animationFillMode: 'forwards' }} />
                </div>
              )}
            </>
          )}

          {/* Sold-Out-Overlay */}
          {isSoldOut && !isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
              <p className="text-white text-sm font-black tracking-widest uppercase">Ausverkauft</p>
              <p className="text-zinc-400 text-[10px] mt-1">{item.nftMaxSupply} / {item.nftMaxSupply} Editionen</p>
            </div>
          )}

          {/* Lock-Overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-[2px]">
              <FaLock size={22} className="text-zinc-300 mb-2" />
              <p className="text-white text-[11px] font-bold">Level {item.requiredLevel}</p>
            </div>
          )}
        </div>

        {/* ── Textbereich ── */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-snug">{item.title}</p>
              {item.artistName && (
                <p className="text-amber-300/80 text-xs font-semibold mt-0.5">{item.artistName}</p>
              )}
            </div>
            <ItemTypeBadge type={item.type} />
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed mt-2">
            {item.description || TYPE_LABELS[item.type]}
          </p>

          {/* NFT-Attribute */}
          {item.isNftEnabled && (
            <div className="flex flex-wrap gap-1 mt-3">
              {[
                ['Type', 'Music'],
                ['Platform', 'D.FAITH'],
                ['Royalties', '5%'],
              ].map(([k, v]) => (
                <span key={k} className="bg-zinc-800/80 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[9px] text-zinc-400">
                  <span className="text-zinc-600">{k}:</span> {v}
                </span>
              ))}
              {item.nftMaxSupply != null && (
                <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold border ${
                  isSoldOut
                    ? 'bg-red-900/40 border-red-500/30 text-red-400'
                    : remaining !== null && remaining <= Math.ceil(item.nftMaxSupply * 0.1)
                      ? 'bg-amber-900/40 border-amber-500/30 text-amber-400'
                      : 'bg-zinc-800/80 border-white/[0.06] text-zinc-400'
                }`}>
                  {isSoldOut
                    ? 'Ausverkauft'
                    : `${remaining} / ${item.nftMaxSupply} verfügbar`}
                </span>
              )}
              {item.masterEditionMint && (
                <a
                  href={`https://solscan.io/token/${item.masterEditionMint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 bg-violet-900/30 border border-violet-500/20 rounded-md px-1.5 py-0.5 text-[9px] text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <FaGem size={7} /> NFT
                </a>
              )}
            </div>
          )}

          {/* Preis-Zeile */}
          <div className="flex items-center gap-1.5 mt-3">
            {item.requiredLevel > 0 && (
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                isLocked ? 'bg-zinc-700 text-zinc-400' : 'bg-amber-900/60 text-amber-400'
              }`}>
                <FaStar size={6} /> {item.requiredLevel}
              </span>
            )}
            <span className={`text-sm font-semibold ${isLocked ? 'text-zinc-500' : 'text-zinc-300'}`}>
              {item.priceCredits.toLocaleString('de-DE')} {tokenLabel}
            </span>
          </div>

          {/* ── Kauf-Bereich ── */}
          <div className="mt-4">
            {walletAddress ? (
              isSoldOut ? (
                <div className="flex items-center justify-center gap-1.5 py-2.5 bg-red-900/20 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-xs font-bold">Ausverkauft</p>
                </div>
              ) : isLocked ? (
                <div className="flex items-center justify-center gap-1.5 py-2.5">
                  <FaLock size={10} className="text-zinc-600 shrink-0" />
                  <p className="text-zinc-600 text-xs">Level {item.requiredLevel} erforderlich</p>
                </div>
              ) : item.type === 'video' && (item.ownedCount ?? 0) > 0 ? (
                /* Pre-Release-Video freigeschaltet — direkt hier im Modal abspielbar */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-1 bg-amber-400/10 border border-amber-400/30 rounded-lg py-1.5 text-amber-400 text-xs font-bold">
                    <FaCheck size={9} /> Freigeschaltet
                  </div>
                  {getYoutubeEmbedUrl(item.contentUrl) ? (
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-black aspect-video">
                      <iframe
                        src={`${getYoutubeEmbedUrl(item.contentUrl)}?rel=0`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 text-zinc-300 text-xs font-semibold transition-colors">
                      <FaExternalLinkAlt size={10} /> {t('shop.watchVideo', lang)}
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* Besitz-Badge */}
                  {(item.ownedCount ?? 0) > 0 && (
                    <div className="flex items-center justify-center gap-1 bg-amber-400/10 border border-amber-400/30 rounded-lg py-1.5 text-amber-400 text-xs font-bold">
                      <FaCheck size={9} /> Du besitzt {item.ownedCount}×
                    </div>
                  )}
                  {/* Kauf-Button (immer Credits) — öffnet erst den Bestätigungsdialog */}
                  <button
                    onClick={() => onBuy(item, 'credits')}
                    disabled={buying === item.id}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.98] bg-amber-400 hover:bg-amber-300 text-black"
                  >
                    {buying === item.id
                      ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      : <><FaCoins size={12} /> {t('shop.btnBuy', lang)}</>
                    }
                  </button>
                </div>
              )
            ) : (
              <p className="text-center text-zinc-600 text-xs py-2">{t('shop.loginToBuy', lang)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Deposit-Modal ────────────────────────────────────────────────────────────

function ShopDepositModal({ walletAddress, onClose, onSuccess }: {
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const lang = useLang();
  const [mode, setMode]                 = useState<'tokens' | 'card'>('tokens');
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [loading, setLoading]           = useState(true);
  const [amount, setAmount]             = useState('');
  const [depositing, setDepositing]     = useState(false);
  const [error, setError]               = useState('');
  const [done, setDone]                 = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const addrRes = await fetch(`/api/solana/create-account?walletAddress=${walletAddress}`);
        const addrData = await addrRes.json();
        const solAddr: string | null = addrData.solanaAddress ?? null;
        if (!solAddr) { setLoading(false); return; }
        const balRes  = await fetch(`/api/solana/balance?solanaAddress=${solAddr}`);
        const balData = await balRes.json();
        setTokenBalance(Number(balData.dfaithBalance ?? 0));
      } catch { setTokenBalance(0); }
      finally   { setLoading(false); }
    })();
  }, [walletAddress]);

  const handleDeposit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (tokenBalance !== null && amt > tokenBalance) { setError(tFmt('shop.depositInsufficientTokens', lang, { n: tokenBalance.toFixed(2) })); return; }
    setDepositing(true); setError('');
    try {
      const res  = await fetch('/api/marketplace/deposit-tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('common.error', lang));
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error', lang)); }
    finally     { setDepositing(false); }
  };

  const handleCardSuccess = () => {
    setDone(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-[#161410] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <FaPlus className="text-amber-400" size={14} /> {t('shop.depositTitle', lang)}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <FaTimes size={14} />
          </button>
        </div>

        {!done && (
          <div className="flex gap-1.5 mb-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <button
              onClick={() => { setMode('tokens'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === 'tokens' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Image src="/D.FAITH.png" alt="" width={12} height={12} className="w-3 h-3 rounded-full" /> {t('shop.depositTabTokens', lang)}
            </button>
            <button
              onClick={() => { setMode('card'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === 'card' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FaCreditCard size={11} /> {t('shop.depositTabCard', lang)}
            </button>
          </div>
        )}

        {done ? (
          <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 text-sm font-semibold">
            <FaCheck size={14} /> {t('shop.depositSuccess', lang)}
          </div>
        ) : mode === 'tokens' ? (
          <>
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 mb-4 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-3">{t('mp.depositHowTitle', lang)}</p>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-amber-400 font-black shrink-0">1.</span>
                <span>{t('mp.depositStep1', lang)}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-amber-400 font-black shrink-0">2.</span>
                <span>{t('mp.depositStep2', lang)}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-amber-400 font-black shrink-0">3.</span>
                <span>{t('shop.depositStep3', lang)}</span>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4 flex justify-between items-center">
              <span className="text-zinc-500 text-xs">{t('shop.depositAvailableTokens', lang)}</span>
              {loading
                ? <span className="text-zinc-600 text-xs">{t('common.loading', lang)}</span>
                : <span className="text-amber-300 font-black text-sm">{(tokenBalance ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</span>
              }
            </div>
            <input
              type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={t('shop.depositAmountPlaceholder', lang)}
              className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-amber-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors mb-3"
            />
            {error && <p className="text-red-400 text-xs mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}
            <button
              onClick={handleDeposit}
              disabled={depositing || !amount || Number(amount) <= 0}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
            >
              {depositing
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> {t('shop.depositProcessing', lang)}</span>
                : t('shop.depositTokensButton', lang)
              }
            </button>
          </>
        ) : (
          <CreditsCardCheckout walletAddress={walletAddress} onSuccess={handleCardSuccess} lang={lang} />
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
  onDepositSuccess,
}: {
  artist: ShopArtist;
  walletAddress: string | null;
  onBack: () => void;
  creditBalance?: number | null;
  onPurchased?: () => void;
  onGoToInventory?: () => void;
  onDepositSuccess?: () => void;
}) {
  const lang = useLang();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyResult, setBuyResult] = useState<{ itemId: string; contentUrl: string; type: string; title: string; paymentMethod: string } | null>(null);
  const [buyCelebration, setBuyCelebration] = useState<{ title: string; type: ItemType; price: number; paymentMethod: string } | null>(null);
  const [buyError, setBuyError] = useState('');
  const [confirmPurchase, setConfirmPurchase] = useState<{ item: ShopItem; paymentMethod: 'credits' | 'tokens' } | null>(null);
  const [detailItem, setDetailItem] = useState<ShopItem | null>(null);
  const [userLevel, setUserLevel] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'nft'>('all');

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
        artistName: (i.artist_name as string | null) ?? null,
        title: i.title,
        description: i.description,
        type: i.type as ItemType,
        priceCredits: Number(i.price_credits),
        priceTokens: i.price_tokens !== null && i.price_tokens !== undefined ? Number(i.price_tokens) : null,
        contentUrl: i.content_url as string,
        imageUrl: i.image_url as string,
        isActive: i.is_active as boolean,
        createdAt: i.created_at as string,
        ownedCount: Number(i.owned_count ?? 0),
        requiredLevel: Number(i.required_level ?? 0),
        nftMaxSupply: i.nft_max_supply != null ? Number(i.nft_max_supply) : null,
        isNftEnabled: Boolean(i.is_nft_enabled),
        masterEditionMint: (i.master_edition_mint as string | null) ?? null,
        soldCount: Number(i.sold_count ?? 0),
      })));
    }
    setLoading(false);
  }, [artist.artistWallet, walletAddress]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filteredItems = useMemo(() => {
    if (typeFilter === 'all') return items;
    if (typeFilter === 'nft') return items.filter(i => i.type !== 'video');
    return items.filter(i => i.type === 'video');
  }, [items, typeFilter]);

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
        let errMsg = t('shop.buyFailed', lang);
        try {
          const e = await res.json();
          if (e.code === 'identity_not_verified') { setShowIdentityModal(true); return; }
          const codeKey = e.code ? PURCHASE_ERROR_KEYS[e.code as string] : undefined;
          errMsg = codeKey ? t(codeKey, lang) : (e.error ?? errMsg);
        } catch {}
        setBuyError(errMsg);
        return;
      }
      const data = await res.json();
      setBuyResult({ itemId: item.id, contentUrl: data.contentUrl, type: data.type, title: item.title, paymentMethod });
      setBuyCelebration({ title: item.title, type: item.type, price: item.priceCredits, paymentMethod });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ownedCount: (i.ownedCount ?? 0) + 1 } : i));
      onPurchased?.();
    } finally {
      setBuying(null);
    }
  };

  const requestBuy = (item: ShopItem, paymentMethod: 'credits' | 'tokens') => {
    setConfirmPurchase({ item, paymentMethod });
  };

  return (
    <div className="space-y-4">
      {/* Zurück-Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors px-4 pt-2"
      >
        <FaChevronLeft size={11} /> {t('common.allArtists', lang)}
      </button>

      {/* Artist-Header */}
      <div className="mx-4 bg-zinc-900/80 border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full shrink-0 ring-2 ring-amber-500/40 shadow-[0_0_14px_rgba(245,158,11,0.2)]">
            {artist.pictureUrl
              ? <Image src={artist.pictureUrl} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
              : <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center"><FaStar className="text-amber-400" size={20} /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">
              {artist.displayName || shortenWallet(artist.artistWallet)}
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">{loading ? '…' : `${items.length} ${items.length === 1 ? 'Item' : 'Items'} ${t('shop.inShop', lang)}`}</p>
          </div>
          {creditBalance !== null && creditBalance !== undefined && (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span className="text-zinc-500 text-[9px] uppercase tracking-widest">{t('shop.creditBalance', lang)}</span>
              <span className="flex items-center gap-1 text-amber-300 font-bold text-sm">
                {creditBalance.toFixed(2)}
                <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
                {artist.rewardToken ?? 'D.FAITH'} Credits
              </span>
              {walletAddress && (
                <button
                  onClick={() => setShowDeposit(true)}
                  className="flex items-center gap-1 text-[9px] font-bold text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 rounded-full px-2 py-0.5 transition-all"
                >
                  <FaPlus size={7} /> {t('shop.depositButton', lang)}
                </button>
              )}
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

      {/* Kauf-Bestätigung */}
      {confirmPurchase && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          onClick={() => { if (buying !== confirmPurchase.item.id) setConfirmPurchase(null); }}
        >
          <div
            className="bg-[#161410] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <FaCoins className="text-amber-400" size={14} /> {t('shop.confirmPurchaseTitle', lang)}
              </h3>
              {buying !== confirmPurchase.item.id && (
                <button onClick={() => setConfirmPurchase(null)} className="text-zinc-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
                  <FaTimes size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                {confirmPurchase.item.imageUrl && (
                  <Image src={confirmPurchase.item.imageUrl} alt="" fill className="object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{confirmPurchase.item.title}</p>
                <p className="text-zinc-500 text-xs">{TYPE_LABELS[confirmPurchase.item.type]}</p>
              </div>
            </div>

            <p className="text-zinc-400 text-sm mb-5">
              {tFmt('shop.confirmPurchaseBody', lang, {
                title: confirmPurchase.item.title,
                price: confirmPurchase.item.priceCredits.toLocaleString('de-DE'),
                token: artist.rewardToken ?? 'D.FAITH',
              })}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPurchase(null)}
                disabled={buying === confirmPurchase.item.id}
                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {t('common.cancel', lang)}
              </button>
              <button
                onClick={async () => { await handleBuy(confirmPurchase.item, confirmPurchase.paymentMethod); setConfirmPurchase(null); }}
                disabled={buying === confirmPurchase.item.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold transition-colors disabled:opacity-50"
              >
                {buying === confirmPurchase.item.id
                  ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  : <><FaCoins size={12} /> {t('shop.confirmPurchaseCta', lang)}</>
                }
              </button>
            </div>
          </div>
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
          <p className="text-zinc-400 text-xs mb-2">{tFmt('shop.addedToInventory', lang, { title: buyResult.title })}</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setBuyResult(null); onGoToInventory?.(); }}
              className="flex items-center gap-1.5 bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-600/40 rounded-xl px-3 py-1.5 text-emerald-300 text-xs font-bold transition-colors"
            >
              <FaBoxOpen size={10} /> {t('shop.toInventory', lang)}
            </button>
            {buyResult.contentUrl && (
              <a href={buyResult.contentUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-zinc-300 text-xs font-semibold transition-colors">
                <FaExternalLinkAlt size={9} /> {t('shop.openDirect', lang)}
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
              {t('shop.buySuccess', lang)}
            </p>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mb-4 mt-3">
              <p className="text-zinc-400 text-xs mb-0.5">{TYPE_LABELS[buyCelebration.type]}</p>
              <p className="text-white text-sm font-semibold line-clamp-2">{buyCelebration.title}</p>
            </div>
            <p className="text-zinc-400 text-xs mb-5">
              {buyCelebration.paymentMethod === 'tokens' ? t('shop.paidWithTokens', lang) : `💰 ${buyCelebration.price.toLocaleString('de-DE')} Credits`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setBuyCelebration(null); onGoToInventory?.(); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 rounded-2xl transition-colors text-sm"
              >
                <FaBoxOpen size={13} /> {t('shop.toInventory', lang)}
              </button>
              <button
                onClick={() => setBuyCelebration(null)}
                className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors"
              >
                {t('shop.continueShopping', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Typ-Filter */}
      {items.length > 0 && (
        <div className="px-4 flex gap-2 overflow-x-auto pb-1">
          {([
            { key: 'all',   label: t('shop.filterAll', lang), icon: null },
            { key: 'video', label: TYPE_LABELS.video, icon: <FaVideo size={10} /> },
            { key: 'nft',   label: 'NFT', icon: <FaCertificate size={10} /> },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                typeFilter === f.key
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/[0.05] text-zinc-400 hover:bg-white/[0.08]'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Item-Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="mx-4 bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
          {t('shop.noItems', lang)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mx-4 bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-8 text-center text-zinc-500 text-sm">
          {t('shop.noItemsFiltered', lang)}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filteredItems.map(item => (
            <ItemCard key={item.id} item={item} artistRewardToken={artist.rewardToken} userLevel={userLevel} onOpen={setDetailItem} />
          ))}
        </div>
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onBuy={(it, method) => { setDetailItem(null); requestBuy(it, method); }}
          buying={buying}
          walletAddress={walletAddress}
          artistRewardToken={artist.rewardToken}
          userLevel={userLevel}
        />
      )}

      {showDeposit && walletAddress && (
        <ShopDepositModal
          walletAddress={walletAddress}
          onClose={() => setShowDeposit(false)}
          onSuccess={() => { onDepositSuccess?.(); setShowDeposit(false); }}
        />
      )}

      {showIdentityModal && walletAddress && (
        <IdentityVerifyModal
          walletAddress={walletAddress}
          lang={lang}
          onClose={() => setShowIdentityModal(false)}
        />
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
  printMint: string | null;
  editionNumber: number | null;
  nftMaxSupply: number | null;
}

function InventoryItemCard({ item, onOpen }: { item: InventoryItem; onOpen: (item: InventoryItem) => void }) {
  const fallbackGradient: Record<ItemType, string> = {
    song:      'from-violet-900/60 to-zinc-900',
    video:     'from-red-900/60 to-zinc-900',
    nft:       'from-amber-900/60 to-zinc-900',
    exclusive: 'from-emerald-900/60 to-zinc-900',
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative flex flex-col rounded-xl overflow-hidden text-left bg-[#181818] hover:bg-[#282828] transition-all duration-200"
    >
      {/* Quadratisches Album-Art */}
      <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-2xl m-3 mb-0" style={{ width: 'calc(100% - 1.5rem)' }}>
        {getDisplayImageUrl(item) ? (
          <>
            <Image src={getDisplayImageUrl(item)!} alt="" fill className="object-cover scale-110 blur-xl opacity-40" />
            <Image src={getDisplayImageUrl(item)!} alt={item.title} fill className="object-contain" />
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${fallbackGradient[item.type]}`}>
            <span className="opacity-30 text-5xl"><TypeIcon type={item.type} /></span>
          </div>
        )}

        {/* Edition-Badge auf dem Bild */}
        {item.editionNumber != null && item.nftMaxSupply != null && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm border border-violet-500/30 rounded-lg px-2 py-0.5">
            <p className="text-violet-300 text-[10px] font-bold">#{item.editionNumber}/{item.nftMaxSupply}</p>
          </div>
        )}
      </div>

      {/* Textbereich (kompakt) */}
      <div className="px-3 pt-2 pb-3 flex flex-col gap-0.5">
        <p className="text-white font-bold text-sm leading-snug line-clamp-1">{item.title}</p>
        {item.artistName && (
          <p className="text-amber-300/80 text-[11px] font-semibold line-clamp-1">{item.artistName}</p>
        )}
        <ItemTypeBadge type={item.type} />
      </div>
    </button>
  );
}

// ─── Inventar-Item-Detail-Modal ────────────────────────────────────────────────

function InventoryItemDetailModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const lang = useLang();
  const [playing, setPlaying] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
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
    <div
      className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-[#161410] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Album-Art (groß) ── */}
        <div className="relative w-full aspect-square overflow-hidden">
          {getDisplayImageUrl(item) ? (
            <>
              <Image src={getDisplayImageUrl(item)!} alt="" fill className="object-cover scale-110 blur-xl opacity-40" />
              <Image src={getDisplayImageUrl(item)!} alt={item.title} fill className="object-contain" />
            </>
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${fallbackGradient[item.type]}`}>
              <span className="opacity-30 text-6xl"><TypeIcon type={item.type} /></span>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
          >
            <FaTimes size={14} />
          </button>

          {/* Play-Button — links unten, amber */}
          {item.type === 'song' && item.contentUrl && (
            <>
              <audio ref={audioRef} src={item.contentUrl} onEnded={() => setPlaying(false)} />
              <button
                onClick={togglePlay}
                className="absolute bottom-2 left-2 w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center shadow-xl transition-all duration-200"
              >
                {playing ? <FaPause size={13} className="text-black" /> : <FaPlay size={13} className="text-black ml-0.5" />}
              </button>
            </>
          )}

          {/* Edition-Badge auf dem Bild */}
          {item.editionNumber != null && item.nftMaxSupply != null && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm border border-violet-500/30 rounded-lg px-2 py-0.5">
              <p className="text-violet-300 text-[10px] font-bold">Edition #{item.editionNumber} / {item.nftMaxSupply}</p>
            </div>
          )}
        </div>

        {/* ── Textbereich ── */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-snug">{item.title}</p>
              {item.artistName && (
                <p className="text-amber-300/80 text-xs font-semibold mt-0.5">{item.artistName}</p>
              )}
            </div>
            <ItemTypeBadge type={item.type} />
          </div>
          {item.description && (
            <p className="text-zinc-400 text-xs leading-relaxed mt-2">{item.description}</p>
          )}

          {/* NFT-Attribut-Chips */}
          <div className="flex flex-wrap gap-1 mt-3">
            {[['Type', TYPE_LABELS[item.type]], ['Platform', 'D.FAITH'], ['Royalties', '5%']].map(([k, v]) => (
              <span key={k} className="bg-zinc-800/80 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[9px] text-zinc-400">
                <span className="text-zinc-600">{k}:</span> {v}
              </span>
            ))}
            {item.editionNumber != null && item.nftMaxSupply != null && (
              <span className="bg-violet-900/40 border border-violet-500/30 rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
                Edition #{item.editionNumber} / {item.nftMaxSupply}
              </span>
            )}
            {item.printMint && (
              <a
                href={`https://solscan.io/token/${item.printMint}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 bg-violet-900/30 border border-violet-500/20 rounded-md px-1.5 py-0.5 text-[9px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                <FaGem size={7} /> On-Chain
              </a>
            )}
          </div>

          {/* ── Kauf-Bereich: Download (Song) / Video / NFT ── */}
          <div className="mt-4 space-y-1.5">
            {item.type === 'song' && item.contentUrl && (
              <a href={item.contentUrl} download
                className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 text-zinc-300 text-xs font-semibold transition-colors">
                <FaDownload size={10} /> Download
              </a>
            )}
            {item.type === 'video' && item.contentUrl && (
              showVideoPlayer ? (
                getYoutubeEmbedUrl(item.contentUrl) ? (
                  <div className="rounded-lg overflow-hidden border border-red-800/30 bg-black aspect-video">
                    <iframe
                      src={`${getYoutubeEmbedUrl(item.contentUrl)}?autoplay=1&rel=0`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-red-900/20 hover:bg-red-900/30 border border-red-800/30 rounded-lg py-2.5 text-red-300 text-xs font-semibold transition-colors">
                    <FaExternalLinkAlt size={10} /> {t('shop.watchVideo', lang)}
                  </a>
                )
              ) : (
                <button onClick={() => setShowVideoPlayer(true)}
                  className="flex items-center justify-center gap-2 w-full bg-red-900/20 hover:bg-red-900/30 border border-red-800/30 rounded-lg py-2.5 text-red-300 text-xs font-semibold transition-colors">
                  <FaVideo size={11} /> {t('shop.watchVideo', lang)}
                </button>
              )
            )}
            {(item.type === 'nft' || item.type === 'exclusive') && item.contentUrl && (
              <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/30 rounded-lg py-2.5 text-amber-300 text-xs font-semibold transition-colors">
                <FaExternalLinkAlt size={10} /> {t('shop.openContent', lang)}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryPanel({ walletAddress }: { walletAddress: string }) {
  const lang = useLang();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

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
          printMint: i.print_mint ? String(i.print_mint) : null,
          editionNumber: i.edition_number != null ? Number(i.edition_number) : null,
          nftMaxSupply: i.nft_max_supply != null ? Number(i.nft_max_supply) : null,
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
        <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em]">{t('shop.myInventory', lang)}</p>
        <span className="text-zinc-600 text-xs">{items.length} Item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* API-Fehler */}
      {apiError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-red-300 text-xs">{apiError}</p>
          <button onClick={load} className="text-red-300 hover:text-red-100 text-xs font-bold shrink-0">{t('shop.retry', lang)}</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 && !apiError ? (
        <div className="bg-zinc-900/40 border border-white/[0.05] rounded-2xl p-10 text-center">
          <FaBoxOpen size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-semibold">{t('common.noData', lang)}</p>
          <p className="text-zinc-600 text-xs mt-1">{t('shop.inventoryEmpty', lang)}</p>
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
                      ? <Image src={group.picture} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover" />
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
                    {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'} {t('shop.boughtBadge', lang)}
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
                <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-amber-500/20 ml-5">
                  {group.items.map(item => <InventoryItemCard key={item.id} item={item} onOpen={setDetailItem} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {detailItem && (
        <InventoryItemDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

// ─── Mein Shop (Artist-Modus) ─────────────────────────────────────────────────

function MyShopPanel({ walletAddress, creditBalance, rewardToken }: { walletAddress: string; creditBalance: number | null; rewardToken?: string | null }) {
  const lang = useLang();
  const myTokenLabel = rewardToken ?? 'D.FAITH';
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShopItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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
  const [fMaxEditions, setFMaxEditions] = useState(100);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Artist-Profil für NFT-Preview
  type ArtistProfile = {
    display_name: string | null;
  };
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  useEffect(() => {
    if (!showForm || artistProfile) return;
    fetch(`/api/shop/artists?wallet=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setArtistProfile(d as ArtistProfile); })
      .catch(() => {});
  }, [showForm, walletAddress, artistProfile]);

  const handleUpload = async (file: File, type: 'content' | 'image') => {
    const setUploading = type === 'content' ? setUploadingContent : setUploadingImage;
    const setUrl       = type === 'content' ? setFContent : setFImage;
    setUploading(true);
    setFormError('');
    try {
      const { upload } = await import('@vercel/blob/client');
      const ext        = file.name.replace(/.*\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const safeWallet = walletAddress.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
      const pathname   = `shop/${type === 'image' ? 'images' : 'content'}/${safeWallet}/${Date.now()}.${ext}`;
      const blob = await upload(pathname, file, {
        access:          'public',
        handleUploadUrl: '/api/shop/upload',
        clientPayload:   JSON.stringify({ fileType: type, wallet: walletAddress }),
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
    const res = await fetch(`/api/shop?artistWallet=${walletAddress}&includeInactive=true`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.map((i: Record<string, unknown>) => ({
        id: i.id,
        artistWallet: i.artist_wallet,
        artistName: (i.artist_name as string | null) ?? null,
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
        nftMaxSupply: i.nft_max_supply != null ? Number(i.nft_max_supply) : null,
        isNftEnabled: Boolean(i.is_nft_enabled),
        masterEditionMint: (i.master_edition_mint as string | null) ?? null,
        soldCount: Number(i.sold_count ?? 0),
        editionCount: Number(i.edition_count ?? 0),
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
    if (!fTitle.trim()) { setFormError(lang === 'en' ? 'Title is required' : lang === 'pl' ? 'Tytuł jest wymagany' : 'Titel ist Pflicht'); return; }
    const price = parseInt(fPrice, 10);
    if (isNaN(price) || price < 0) { setFormError(t('shop.invalidPrice', lang)); return; }
    if (fType === 'video' && !fContent.trim()) { setFormError('Bitte YouTube-Link angeben.'); return; }
    setFormError('');
    setFormSuccess('');
    setSaving(true);
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
          nftMaxSupply: fMaxEditions,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? 'Fehler beim Erstellen');
        return;
      }
      const data = await res.json() as { masterEditionMint?: string };
      const titleCreated = fTitle;
      resetForm();
      loadMyItems();
      setFormSuccess(
        data.masterEditionMint
          ? `"${titleCreated}" wurde erstellt, geminted und als Creator verifiziert.`
          : `"${titleCreated}" wurde erfolgreich erstellt.`
      );
    } finally {
      setSaving(false);
    }
  };

  // Nur aus dem Shop ausblenden (reversibel) — On-Chain-NFT bleibt unangetastet
  const handleHide = async (itemId: string) => {
    setDeleting(itemId); setDeleteError('');
    try {
      await fetch('/api/shop', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, itemId }),
      });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, isActive: false } : i));
      setDeleteTarget(null);
    } finally {
      setDeleting(null);
    }
  };

  // Endgültig löschen + On-Chain-Collection verbrennen — nur möglich wenn 0 Editionen verkauft
  const handleBurnDelete = async (itemId: string) => {
    setDeleting(itemId); setDeleteError('');
    try {
      const res  = await fetch('/api/shop/burn-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, itemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('common.error', lang));
      setItems(prev => prev.filter(i => i.id !== itemId));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t('common.error', lang));
    } finally {
      setDeleting(null);
    }
  };

  const handleReactivate = async (itemId: string) => {
    setReactivating(itemId);
    try {
      const res = await fetch('/api/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, itemId, isActive: true }),
      });
      if (res.ok) setItems(prev => prev.map(i => i.id === itemId ? { ...i, isActive: true } : i));
    } finally {
      setReactivating(null);
    }
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
      const { upload } = await import('@vercel/blob/client');
      const ext        = file.name.replace(/.*\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const safeWallet = walletAddress.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
      const pathname   = `shop/${field === 'image' ? 'images' : 'content'}/${safeWallet}/${Date.now()}.${ext}`;
      const blob = await upload(pathname, file, {
        access:          'public',
        handleUploadUrl: '/api/shop/upload',
        clientPayload:   JSON.stringify({ fileType: field, wallet: walletAddress }),
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
    if (!editData.title.trim()) { setEditError(lang === 'en' ? 'Title is required' : lang === 'pl' ? 'Tytuł jest wymagany' : 'Titel ist Pflicht'); return; }
    const price = parseInt(editData.price, 10);
    if (isNaN(price) || price < 0) { setEditError(t('shop.invalidPrice', lang)); return; }
    const tokens = price; // Credits = Tokens (1:1)

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
        <p className="text-amber-300/90 text-[10px] font-black uppercase tracking-[0.28em]">{t('shop.myShop', lang)}</p>
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
            <FaPlus size={9} /> {t('shop.newItem', lang)}
          </button>
        )}
      </div>

      {/* Erfolgsmeldung */}
      {formSuccess && (
        <div className="flex items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
          <p className="text-emerald-400 text-sm">{formSuccess}</p>
          <button onClick={() => setFormSuccess('')} className="text-emerald-500/60 hover:text-emerald-300 shrink-0"><FaTimes size={12} /></button>
        </div>
      )}

      {/* Formular */}
      {showForm && (
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white text-sm font-semibold">{t('shop.newItemTitle', lang)}</p>
            <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-300"><FaTimes size={13} /></button>
          </div>

          {/* Titel */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">{t('shop.labelTitle', lang)} *</label>
            <input
              value={fTitle}
              onChange={e => setFTitle(e.target.value)}
              placeholder="z.B. Unreleased Track Vol. 1"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest">{t('shop.labelDesc', lang)}</label>
              <button
                type="button"
                onClick={() => setFDesc(
                  `Exclusive track available as a limited NFT on D.FAITH. As the holder of this edition, you directly support the artist and become part of an exclusive community of ${fMaxEditions} collectors.`
                )}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                Vorlage einfügen
              </button>
            </div>
            <textarea
              value={fDesc}
              onChange={e => setFDesc(e.target.value)}
              rows={3}
              placeholder={
                lang === 'en'
                  ? 'Describe your track — what makes it special, what the buyer receives...'
                  : lang === 'pl'
                  ? 'Opisz swój utwór — co go wyróżnia, co otrzyma kupujący...'
                  : 'Beschreibe deinen Track — was ihn besonders macht, was der Käufer erhält...'
              }
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <p className="text-zinc-600 text-[10px] mt-1">
              Die NFT-Informationen (Editionen, Royalties etc.) werden automatisch ergänzt.
            </p>
          </div>

          {/* Typ + Preise */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">{t('shop.labelType', lang)} *</label>
              <select
                value={fType}
                onChange={e => setFType(e.target.value as ItemType)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                <option value="song">Song (NFT)</option>
                <option value="video">Musikvideo (Pre-Release)</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">{t('shop.labelPriceCredits', lang)} *</label>
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
              {t('shop.labelMinLevel', lang)} <span className="text-zinc-600 normal-case">({t('shop.noLevelRequired', lang)})</span>
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
                <FaStar size={8} /> {tFmt('shop.levelRequired', lang, { n: fRequiredLevel })}
              </p>
            )}
          </div>

          {/* Content-Datei / YouTube-Link */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">
              {fType === 'video' ? 'YouTube-Link (unlisted)' : t('shop.labelContentFile', lang)} *
            </label>
            <div className="flex gap-2">
              {fType !== 'video' && (
                <label className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  uploadingContent
                    ? 'bg-zinc-700 text-zinc-500 pointer-events-none'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                }`}>
                  {uploadingContent
                    ? <><span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> {t('shop.uploading', lang)}</>
                    : <><FaMusic size={11} /> {t('shop.btnUpload', lang)}</>}
                  <input
                    type="file"
                    className="hidden"
                    accept="audio/*,video/*,.pdf,.zip"
                    disabled={uploadingContent}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'content'); e.target.value = ''; }}
                  />
                </label>
              )}
              <input
                value={fContent}
                onChange={e => setFContent(e.target.value)}
                placeholder={fType === 'video' ? 'https://youtu.be/…' : t('shop.urlPlaceholder', lang)}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            {fContent && <p className="text-emerald-400 text-[10px] mt-1 truncate">✓ {fContent}</p>}
            {fType === 'video' && (
              <p className="text-zinc-600 text-[10px] mt-1">
                Video bei YouTube als &quot;Nicht gelistet&quot; hochladen — der Link wird nur Käufern in der App angezeigt und dort direkt abgespielt.
              </p>
            )}
          </div>

          {/* Max. Editionen (nur NFTs) */}
          {fType === 'song' && (
            <div>
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Max. Editionen (NFT Print Editions)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={fMaxEditions}
                  onChange={e => setFMaxEditions(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-32 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                />
                <span className="text-zinc-500 text-[10px]">Käufer erhalten nummerierte Editionen (z.B. #1/100)</span>
              </div>
            </div>
          )}

          {/* Vorschaubild */}
          <div>
            <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">{t('shop.labelPreviewImage', lang)}</label>
            <div className="flex gap-2 items-start">
              <label className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                uploadingImage
                  ? 'bg-zinc-700 text-zinc-500 pointer-events-none'
                  : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30'
              }`}>
                {uploadingImage
                  ? <><span className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" /> {t('shop.uploading', lang)}</>
                  : <><FaStar size={10} /> {t('shop.btnImage', lang)}</> }
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
              placeholder={t('shop.imagePlaceholder', lang)}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            {fImage && (
              <Image src={fImage} alt="Vorschau" width={80} height={80} className="mt-2 w-20 h-20 rounded-xl object-cover border border-white/10" />
            )}
          </div>

          {/* NFT Preview (nur Song-NFTs) */}
          {fType === 'song' && fImage && fTitle && (
            <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4">
              <p className="text-amber-400 text-[10px] uppercase tracking-widest mb-3 font-semibold">NFT Vorschau — so sieht es auf Magic Eden aus</p>
              <div className="flex gap-4 items-start">
                <div className="shrink-0">
                  <Image src={fImage} alt="NFT Cover" width={96} height={96} className="w-24 h-24 rounded-xl object-cover border border-white/10" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold text-sm truncate">{fTitle}</p>
                  {artistProfile?.display_name && (
                    <p className="text-amber-300 text-[11px] font-semibold mt-0.5">{artistProfile.display_name}</p>
                  )}
                  <p className="text-zinc-400 text-[11px] mt-1 line-clamp-2">{fDesc || '—'}</p>

                  {/* Website-Link */}
                  <a
                    href="https://app.dawidfaith.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-amber-400/70 hover:text-amber-300 text-[10px] mt-1.5 underline underline-offset-2"
                  >
                    app.dawidfaith.de
                  </a>

                  {/* NFT Attributes */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      ['Type', 'Music'],
                      ['Artist', artistProfile?.display_name ?? '—'],
                      ['Platform', 'D.FAITH'],
                      ['Max Editions', String(fMaxEditions)],
                      ['Royalties', '5%'],
                      ['Release Year', String(new Date().getFullYear())],
                    ].map(([k, v]) => (
                      <span key={k} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-0.5 text-[10px] text-zinc-300">
                        <span className="text-zinc-500">{k}:</span> {v}
                      </span>
                    ))}
                  </div>

                  {/* Audio-Preview */}
                  {fContent && (
                    <audio
                      src={fContent}
                      controls
                      className="w-full mt-3 h-8 rounded-lg"
                      style={{ accentColor: '#f59e0b' }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {formError && (
            <p className="text-red-400 text-xs">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || uploadingContent || uploadingImage}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : t('shop.btnCreateItem', lang)}
            </button>
            <button onClick={resetForm} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
              {t('common.cancel', lang)}
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
          {t('shop.noItemsCreate', lang)}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-4">
              {editData?.id === item.id ? (
                /* ── Inline-Edit-Formular (nur Preis) ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-zinc-500 text-[10px]">Audio-Inhalt kann nicht geändert werden</p>
                    <button onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-300"><FaTimes size={13} /></button>
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Cover-Bild</label>
                    <div className="flex items-center gap-3">
                      {editData.image && (
                        <Image src={editData.image} alt="" width={48} height={48} unoptimized className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10" />
                      )}
                      <label className="flex-1 flex items-center justify-center gap-2 bg-black/40 border border-white/10 hover:border-amber-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-300 cursor-pointer transition-colors">
                        {uploadingEditImage ? (
                          <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                        ) : (
                          <FaEdit size={11} className="text-zinc-500" />
                        )}
                        {uploadingEditImage ? 'Wird hochgeladen…' : 'Bild/GIF ändern'}
                        <input
                          type="file" accept="image/*" className="hidden" disabled={uploadingEditImage}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleEditUpload(f, 'image'); }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">Titel *</label>
                    <input type="text" value={editData.title}
                      onChange={e => setEditData(d => d && { ...d, title: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">{t('shop.labelPriceCredits', lang)} *</label>
                      <input type="number" min="0" value={editData.price}
                        onChange={e => setEditData(d => d && { ...d, price: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1 block">{t('shop.labelMinLevel', lang)}</label>
                      <input type="number" min="0" value={editData.level}
                        onChange={e => setEditData(d => d && { ...d, level: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>

                  {editError && <p className="text-red-400 text-xs">{editError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleEdit} disabled={editSaving}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors">
                      {editSaving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><FaCheck size={11} /> {t('common.save', lang)}</>}
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
                      {t('common.cancel', lang)}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normale Item-Ansicht ── */
                <div className={`flex items-start justify-between gap-3 ${!item.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    {item.imageUrl && (
                      <Image src={item.imageUrl} alt="" width={48} height={48} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[item.type]}`}>
                          <TypeIcon type={item.type} />
                          {TYPE_LABELS[item.type]}
                        </span>
                        {!item.isActive && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-zinc-800 border-zinc-600 text-zinc-400">
                            Inaktiv
                          </span>
                        )}
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
                    {!item.isActive && (
                      <button
                        onClick={() => handleReactivate(item.id)}
                        disabled={reactivating === item.id}
                        className="text-zinc-500 hover:text-green-400 disabled:opacity-40 transition-colors p-1"
                        title="Reaktivieren"
                      >
                        {reactivating === item.id
                          ? <span className="w-3.5 h-3.5 border border-green-400/30 border-t-green-400 rounded-full animate-spin block" />
                          : <FaCheck size={12} />
                        }
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(item)}
                      className="text-zinc-500 hover:text-amber-400 transition-colors p-1"
                      title="Bearbeiten"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(item); setDeleteError(''); }}
                      disabled={deleting === item.id}
                      className="text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors p-1"
                      title="Löschen"
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

      {/* ── Lösch-Bestätigung ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-[#161410] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">„{deleteTarget.title}&rdquo; löschen?</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-zinc-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
                <FaTimes size={14} />
              </button>
            </div>

            {(deleteTarget.editionCount ?? 0) > 0 ? (
              <>
                <p className="text-zinc-400 text-sm">
                  Es {deleteTarget.editionCount === 1 ? 'wurde bereits 1 Edition' : `wurden bereits ${deleteTarget.editionCount} Editionen`} verkauft.
                  Das Item wird nur aus dem Shop ausgeblendet — bereits verkaufte NFTs bleiben unverändert bei den Käufern,
                  das On-Chain-NFT kann nicht mehr verbrannt werden.
                </p>
                {deleteError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">{deleteError}</p>}
                <button
                  onClick={() => handleHide(deleteTarget.id)}
                  disabled={deleting === deleteTarget.id}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black rounded-xl py-3 text-sm transition-all"
                >
                  {deleting === deleteTarget.id ? 'Wird ausgeblendet…' : 'Aus Shop ausblenden'}
                </button>
              </>
            ) : (
              <>
                <p className="text-zinc-400 text-sm">
                  Es wurde noch keine Edition verkauft. Wie möchtest du fortfahren?
                </p>
                {deleteError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">{deleteError}</p>}
                <div className="space-y-2">
                  <button
                    onClick={() => handleHide(deleteTarget.id)}
                    disabled={deleting === deleteTarget.id}
                    className="w-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm transition-all text-left px-4"
                  >
                    Nur ausblenden
                    <span className="block text-zinc-500 text-xs font-normal mt-0.5">Reversibel — später reaktivierbar, Name/Bild/Audio bleiben änderbar. On-Chain-NFT bleibt bestehen.</span>
                  </button>
                  <button
                    onClick={() => handleBurnDelete(deleteTarget.id)}
                    disabled={deleting === deleteTarget.id}
                    className="w-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 disabled:opacity-50 text-red-300 font-bold rounded-xl py-3 text-sm transition-all text-left px-4"
                  >
                    {deleting === deleteTarget.id ? 'Wird verarbeitet…' : 'Endgültig löschen + NFT verbrennen'}
                    <span className="block text-red-400/70 text-xs font-normal mt-0.5">Unwiderruflich — On-Chain-Collection wird verbrannt, Rent-SOL kommt zurück.</span>
                  </button>
                </div>
              </>
            )}
          </div>
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
  const lang = useLang();
  const [artists, setArtists] = useState<ShopArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shop/artists')
      .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e?.error || `HTTP ${r.status}`); });
        return r.json();
      })
      .then((data: Record<string, unknown>[]) => setArtists(data.map(a => ({
        artistWallet: a.artist_wallet as string,
        displayName: a.display_name as string | null,
        pictureUrl: a.picture_url as string | null,
        itemCount: a.item_count as number,
        rewardToken: a.reward_token as string | null ?? null,
      }))))
      .catch(e => setFetchError(e.message))
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
        {fetchError
          ? <span className="text-red-400">Fehler: {fetchError}</span>
          : t('shop.noArtists', lang)}
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">{t('shop.artistsLabel', lang)}</p>
      <div className="flex gap-4 overflow-x-auto pt-2 pb-2 scrollbar-none">
        {artists.map(artist => (
          <button
            key={artist.artistWallet}
            onClick={() => onSelect(artist)}
            className="flex flex-col items-center gap-2 shrink-0 w-[68px] group"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full ring-2 ring-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.25)] transition-all group-hover:scale-105">
                {artist.pictureUrl
                  ? <Image src={artist.pictureUrl} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
                  : <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <FaStar className="text-amber-400" size={18} />
                    </div>}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                <FaShoppingBag size={8} />
              </div>
              {artist.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-amber-400 text-black text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-lg">
                  {artist.itemCount}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-300 text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">
              {artist.displayName || shortenWallet(artist.artistWallet)}
            </p>
          </button>
        ))}
      </div>
      <p className="text-zinc-600 text-xs">{t('shop.tapArtistHint', lang)}</p>
    </div>
  );
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

export default function ShopTab({ initialArtistWallet }: { initialArtistWallet?: string | null }) {
  const { user, isLoaded } = useUser();
  const lang = useLang();
  const walletAddress = user?.id ?? null;

  const [mode, setMode] = useState<'supporter' | 'inventory' | 'artist'>('supporter');
  const [isArtist, setIsArtist] = useState(false);
  const [myRewardToken, setMyRewardToken] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ShopArtist | null>(null);

  // Direkt einen Artist öffnen wenn initialArtistWallet gesetzt ist
  useEffect(() => {
    if (!initialArtistWallet) return;
    fetch('/api/shop/artists')
      .then(r => r.ok ? r.json() : [])
      .then((data: Record<string, unknown>[]) => {
        const found = data.find(a =>
          (a.artist_wallet as string)?.toLowerCase() === initialArtistWallet.toLowerCase()
        );
        if (found) {
          setSelectedArtist({
            artistWallet: found.artist_wallet as string,
            displayName: found.display_name as string | null,
            pictureUrl: found.picture_url as string | null,
            itemCount: found.item_count as number,
            rewardToken: (found.reward_token as string | null) ?? null,
          });
        }
      })
      .catch(() => {});
  }, [initialArtistWallet]);
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
            <Image src="/D.FAITH.png" alt="D.FAITH" width={40} height={40} className="w-10 h-10 rounded-full object-contain shrink-0" />
            <div>
              <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
              <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                {t('shop.headerSubtitle', lang)}
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
                <FaBoxOpen size={11} /> {t('shop.tabInventory', lang)}
              </button>
              {isArtist && (
                <button
                  onClick={() => setMode('artist')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'artist' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FaPlus size={11} /> {t('shop.tabMyShop', lang)}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Nicht eingeloggt ── */}
        {!isLoaded || (!walletAddress && isLoaded) ? (
          <div className="mx-4 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-6 text-center text-zinc-400 text-sm">
            {!isLoaded ? t('common.loading', lang) : t('shop.loginRequired', lang)}
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
            onDepositSuccess={loadCredits}
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
