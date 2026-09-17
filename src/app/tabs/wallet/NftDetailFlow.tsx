'use client';

/**
 * Vollständige NFT-Detail-Ansicht mit Senden/Verbrennen/Einlösen — identisch
 * zur Darstellung im Solana-Wallet-Tab, aber als eigenständige, wiederverwend­
 * bare Komponente ausgelagert, damit auch andere Stellen (z.B. der Profil-Tab)
 * beim Klick auf ein NFT exakt dieselbe Ansicht + Funktionen zeigen können,
 * ohne die Logik zu duplizieren oder den Wallet-Tab selbst anzufassen.
 */
import { useState, useRef } from 'react';
import Image from 'next/image';
import {
  FaGem, FaTimes, FaPlay, FaPause, FaDownload, FaExternalLinkAlt,
  FaPaperPlane, FaCertificate,
} from 'react-icons/fa';
import { t, type Lang } from '../../utils/i18n';

export interface OwnedNft {
  mint:       string;
  name:       string;
  image:      string | null;
  collection: string | null;
  isDfaith:   boolean;
  interface:  string;
  compressed: boolean;
  attributes: { trait_type: string; value: string }[];
}

export interface ShopNftData {
  purchaseId:    string;
  printMint:     string | null;
  editionNumber: number | null;
  purchasedAt:   string;
  title:         string;
  imageUrl:      string;
  description:   string;
  contentUrl:    string | null;
  type:          string;
  nftMaxSupply:  number | null;
  artistName:    string | null;
  artistPicture: string | null;
}

/**
 * Songs sind seit der mpl-core-Umstellung ebenfalls MplCoreAsset → DB
 * (shopNft) zuerst prüfen (zuverlässig, sofort nach Kauf da) — erst danach
 * auf On-Chain-Attribute zurückfallen (Helius-Indexer kann direkt nach dem
 * Mint noch hinterherhinken und fälschlich als Collectible einordnen).
 */
export function isMusicNft(nft: OwnedNft, shopNft: ShopNftData | null): boolean {
  if (shopNft?.type) return shopNft.type === 'song';
  return nft.attributes.some(a => a.trait_type === 'Type' && a.value === 'Music')
    || nft.interface !== 'MplCoreAsset';
}

type SubView = 'detail' | 'send' | 'burn' | 'redeem';

export default function NftDetailFlow({ nft, shopNft, userId, lang = 'de', onClose, onChanged }: {
  nft:      OwnedNft;
  shopNft:  ShopNftData | null;
  userId:   string;
  lang?:    Lang;
  onClose:  () => void;
  /** Wird nach erfolgreichem Senden/Verbrennen/Einlösen aufgerufen, damit die aufrufende Seite die Liste aktualisieren kann. */
  onChanged?: (mint: string) => void;
}) {
  const [view, setView] = useState<SubView>('detail');

  const [recipient, setRecipient] = useState('');
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');

  const [burning, setBurning] = useState(false);
  const [burnErr, setBurnErr] = useState('');
  const [burnOk, setBurnOk]   = useState('');

  const [redeeming, setRedeeming] = useState(false);
  const [redeemErr, setRedeemErr] = useState('');
  const [redeemOk, setRedeemOk]   = useState('');

  const isMusic = isMusicNft(nft, shopNft);

  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!recipient.trim()) { setSendErr('Empfänger-Adresse fehlt'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/solana/send-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userId, toAddress: recipient.trim(), mintAddress: nft.mint }),
      });
      const d = await res.json().catch(() => ({ error: 'Leere Antwort vom Server' }));
      if (!res.ok) throw new Error(d.error ?? 'Transfer fehlgeschlagen');
      setSendOk('✓ NFT gesendet');
      onChanged?.(nft.mint);
      setTimeout(onClose, 1500);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSending(false);
    }
  };

  const handleBurn = async () => {
    setBurnErr(''); setBurnOk('');
    setBurning(true);
    try {
      const res = await fetch('/api/solana/burn-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userId, mintAddress: nft.mint }),
      });
      const d = await res.json().catch(() => ({ error: 'Leere Antwort vom Server' }));
      if (!res.ok) throw new Error(d.error ?? 'Burn fehlgeschlagen');
      setBurnOk('✓ NFT geburnt — SOL zurückerhalten');
      onChanged?.(nft.mint);
      setTimeout(onClose, 1500);
    } catch (e) {
      setBurnErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setBurning(false);
    }
  };

  const handleRedeem = async () => {
    setRedeemErr(''); setRedeemOk('');
    setRedeeming(true);
    try {
      const collectionMint = nft.collection ?? '';
      if (!collectionMint) throw new Error('Collection-Adresse nicht gefunden — bitte kurz warten bis Helius das NFT indexiert hat');
      const res = await fetch('/api/collectibles/redeem-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userId, mintAddress: nft.mint, collectionMint }),
      });
      const d = await res.json().catch(() => ({ error: 'Leere Antwort vom Server' })) as { success?: boolean; rarity?: string; error?: string };
      if (!res.ok || !d.success) throw new Error(d.error ?? 'Einlösen fehlgeschlagen');
      setRedeemOk(`✓ Eingelöst als ${d.rarity}-Collectible`);
      onChanged?.(nft.mint);
      setTimeout(onClose, 1800);
    } catch (e) {
      setRedeemErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setRedeeming(false);
    }
  };

  if (view === 'send') {
    return (
      <div className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full sm:max-w-md bg-[#13100a] border border-violet-800/30 rounded-t-3xl sm:rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-900/40 flex items-center justify-center">
                <FaGem size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">{nft.name}</p>
                <p className="text-violet-300/60 text-xs">NFT senden</p>
              </div>
            </div>
            <button onClick={() => setView('detail')} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/8">
              <FaTimes size={14} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-zinc-400 text-xs block mb-1.5">Empfänger (Solana-Adresse)</label>
              <input
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="Bs58-Adresse…"
                className="w-full bg-[#231e12] border border-white/[0.1] text-white rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-violet-500/50"
              />
            </div>
            {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
            {sendOk  && <p className="text-emerald-400 text-xs break-all">{sendOk}</p>}
            <button
              onClick={handleSend}
              disabled={sending || !recipient.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {sending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird gesendet…</>
                : <><FaPaperPlane size={12} /> NFT senden</>}
            </button>
            <p className="text-zinc-600 text-xs text-center">On-Chain Transfer · nicht umkehrbar</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'burn') {
    return (
      <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1a0a0a] border border-red-900/40 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/30 flex items-center justify-between">
            <div>
              <p className="text-red-400 font-bold text-sm">🔥 NFT verbrennen</p>
              <p className="text-red-300/60 text-xs">{nft.name}</p>
            </div>
            <button onClick={() => setView('detail')} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/8">
              <FaTimes size={14} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-zinc-400 text-sm">
              Das NFT wird dauerhaft vernichtet und die Rent-SOL werden zurück auf dein Wallet gutgeschrieben. <span className="text-red-400 font-semibold">Diese Aktion ist nicht umkehrbar.</span>
            </p>
            {burnErr && <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">{burnErr}</p>}
            {burnOk  && <p className="text-green-400 text-xs bg-green-900/20 rounded-lg px-3 py-2">{burnOk}</p>}
            <button
              onClick={handleBurn}
              disabled={burning}
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {burning
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : '🔥 Jetzt verbrennen'}
            </button>
            <p className="text-zinc-600 text-xs text-center">Endgültig · SOL wird zurückerstattet</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'redeem') {
    return (
      <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#0f0b1a] border border-purple-900/40 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-purple-950/30 border-b border-purple-900/30">
            <div>
              <p className="text-purple-300 font-bold text-sm">✨ NFT einlösen</p>
              <p className="text-purple-300/60 text-xs">{nft.name}</p>
            </div>
            <button onClick={() => setView('detail')} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/8">
              <FaTimes size={14} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {!redeemOk && (
              <p className="text-zinc-400 text-sm">
                Das NFT wird on-chain verbrannt und als Collectible in deinem D.FAITH-Account gespeichert.
              </p>
            )}
            {redeemErr && <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">{redeemErr}</p>}
            {redeemOk  && <p className="text-green-400 text-sm font-semibold bg-green-900/20 rounded-lg px-3 py-2 text-center">{redeemOk}</p>}
            <button
              onClick={handleRedeem}
              disabled={redeeming || !!redeemOk}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                redeemOk
                  ? 'bg-green-700/60 text-green-300 cursor-default'
                  : 'bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50'
              }`}
            >
              {redeeming
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird eingelöst…</>
                : redeemOk
                  ? '✓ Eingelöst'
                  : '✨ Jetzt einlösen'}
            </button>
            {!redeemOk && <p className="text-zinc-600 text-xs text-center">NFT wird verbrannt · Collectible wird in D.FAITH gespeichert</p>}
          </div>
        </div>
      </div>
    );
  }

  return isMusic
    ? <SongDetail nft={nft} shopNft={shopNft} onClose={onClose} onSend={() => setView('send')} onBurn={() => setView('burn')} />
    : <CollectibleDetail nft={nft} lang={lang} onClose={onClose} onSend={() => setView('send')} onRedeem={() => setView('redeem')} onBurn={() => setView('burn')} />;
}

// ─── Song NFT Detail ───────────────────────────────────────────────────────────
function SongDetail({ nft, shopNft, onClose, onSend, onBurn }: {
  nft:     OwnedNft;
  shopNft: ShopNftData | null;
  onClose: () => void;
  onSend:  () => void;
  onBurn:  () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const title       = shopNft?.title    ?? nft.name;
  const imageUrl    = shopNft?.imageUrl ?? nft.image;
  const description = shopNft?.description;
  const artistAttr  = nft.attributes.find(a => a.trait_type === 'Artist')?.value;
  const artistName  = shopNft?.artistName  ?? artistAttr;
  const contentUrl  = shopNft?.contentUrl  ?? null;
  const isSong      = shopNft?.type === 'song';
  const editionNum  = shopNft?.editionNumber ?? null;
  const maxSupply   = shopNft?.nftMaxSupply  ?? null;
  const editionLabel = editionNum != null && maxSupply != null
    ? `#${editionNum} / ${maxSupply}`
    : editionNum != null ? `#${editionNum}` : null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-[#161410] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative w-full aspect-square overflow-hidden">
          {imageUrl ? (
            <>
              <Image src={imageUrl} alt="" fill className="object-cover scale-110 blur-xl opacity-40" unoptimized />
              <Image src={imageUrl} alt={title} fill className="object-contain" unoptimized />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/60 to-zinc-900">
              <FaGem size={48} className="text-violet-500/30" />
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
          >
            <FaTimes size={14} />
          </button>

          {isSong && contentUrl && (
            <>
              <audio ref={audioRef} src={contentUrl} onEnded={() => setPlaying(false)} />
              <button
                onClick={togglePlay}
                className="absolute bottom-2 left-2 w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center shadow-xl transition-all duration-200"
              >
                {playing
                  ? <FaPause size={13} className="text-black" />
                  : <FaPlay  size={13} className="text-black ml-0.5" />}
              </button>
            </>
          )}

          {editionLabel && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm border border-violet-500/30 rounded-lg px-2 py-0.5">
              <p className="text-violet-300 text-[10px] font-bold">Edition {editionLabel}</p>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="text-white font-bold text-base leading-snug">{title}</p>
          {artistName && (
            <p className="text-amber-300/80 text-xs font-semibold mt-0.5">{artistName}</p>
          )}
          {description && (
            <p className="text-zinc-400 text-xs leading-relaxed mt-2">{description}</p>
          )}

          <div className="flex flex-wrap gap-1 mt-3">
            {[['Type', 'Music'], ['Platform', nft.isDfaith ? 'D.FAITH' : 'Extern'], ['Royalties', '5%']].map(([k, v]) => (
              <span key={k} className="bg-zinc-800/80 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[9px] text-zinc-400">
                <span className="text-zinc-600">{k}:</span> {v}
              </span>
            ))}
            {editionLabel && (
              <span className="bg-violet-900/40 border border-violet-500/30 rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
                Edition {editionLabel}
              </span>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap mt-4">
            <button onClick={onSend}
              className="bg-white/[0.07] hover:bg-white/[0.12] text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <FaPaperPlane size={9} /> Send
            </button>
            {contentUrl && (
              <a href={contentUrl} download
                className="bg-white/[0.07] hover:bg-white/[0.12] text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                <FaDownload size={9} /> Download
              </a>
            )}
            <a href={`https://solscan.io/account/${nft.mint}`} target="_blank" rel="noopener noreferrer"
              className="bg-white/[0.07] hover:bg-white/[0.12] text-zinc-500 hover:text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <FaExternalLinkAlt size={8} /> Solscan
            </a>
            {!nft.isDfaith && !nft.compressed && (
              <button onClick={onBurn}
                className="bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                🔥 Verbrennen
              </button>
            )}
            {!nft.isDfaith && nft.compressed && (
              <span className="text-zinc-600 text-[10px] px-1 py-1.5" title="Compressed NFTs können hier noch nicht verbrannt werden">
                Compressed · kein Burn möglich
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Collectible NFT Detail ─────────────────────────────────────────────────────
function CollectibleDetail({ nft, lang, onClose, onSend, onRedeem, onBurn }: {
  nft:      OwnedNft;
  lang:     Lang;
  onClose:  () => void;
  onSend:   () => void;
  onRedeem: () => void;
  onBurn:   () => void;
}) {
  const rarityRaw   = nft.attributes.find(a => a.trait_type === 'Rarity')?.value?.toLowerCase() ?? '';
  const artistAttr  = nft.attributes.find(a => a.trait_type === 'Artist')?.value;
  const repBonus    = nft.attributes.find(a => a.trait_type === 'RepBonus'    || a.trait_type === 'REP Bonus')?.value;
  const creditBonus = nft.attributes.find(a => a.trait_type === 'CreditBonus' || a.trait_type === 'Credit Bonus')?.value;
  const shardBonus  = nft.attributes.find(a => a.trait_type === 'ShardBonus'  || a.trait_type === 'Shard Bonus')?.value;
  const dropRate    = nft.attributes.find(a => a.trait_type === 'DropRate'    || a.trait_type === 'Drop Rate')?.value;

  const RARITY_STYLE: Record<string, string> = {
    common:    'text-zinc-300 bg-zinc-800/80 border-zinc-600/50',
    uncommon:  'text-green-300 bg-green-900/50 border-green-600/50',
    rare:      'text-blue-300 bg-blue-900/50 border-blue-600/50',
    epic:      'text-purple-300 bg-purple-900/50 border-purple-600/50',
    legendary: 'text-amber-300 bg-amber-900/50 border-amber-600/50',
    mythic:    'text-red-300 bg-red-900/50 border-red-600/50',
  };
  const rarityStyle = RARITY_STYLE[rarityRaw] ?? 'text-zinc-300 bg-zinc-800/80 border-zinc-600/50';
  const num = (v?: string) => parseFloat((v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
  const repVal    = num(repBonus);
  const creditVal = num(creditBonus);
  const shardVal  = num(shardBonus);
  const activeSlots  = parseInt(nft.attributes.find(a => a.trait_type === 'ActiveSlots')?.value ?? '', 10);
  const primaryBonus = nft.attributes.find(a => a.trait_type === 'PrimaryBonus')?.value ?? 'rep';
  const bonusFor: Record<string, string | null> = {
    rep:     repVal    > 0 ? `+${repVal}% REP`      : null,
    credits: creditVal > 0 ? `+${creditVal}% Credit` : null,
    shard:   shardVal  > 0 ? `+${shardVal}% Shard`  : null,
  };
  const slotOrder = [primaryBonus, ...['rep', 'credits', 'shard'].filter(b => b !== primaryBonus)];
  const bonuses = Number.isFinite(activeSlots) && activeSlots > 0
    ? slotOrder.slice(0, activeSlots).map(k => bonusFor[k]).filter(Boolean)
    : [bonusFor.rep, bonusFor.credits, bonusFor.shard].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-[#161410] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative w-full aspect-square overflow-hidden">
          {nft.image ? (
            <>
              <Image src={nft.image} alt="" fill className="object-cover scale-110 blur-xl opacity-40" unoptimized />
              <Image src={nft.image} alt={nft.name} fill className="object-contain" unoptimized />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/60 to-zinc-900">
              <FaGem size={48} className="text-violet-500/30" />
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
          >
            <FaTimes size={14} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-snug">{nft.name}</p>
              {artistAttr && <p className="text-amber-300/80 text-xs font-semibold mt-0.5">von {artistAttr}</p>}
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-white/5 border border-white/10 text-amber-300">
              <FaCertificate size={8} /> NFT
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            {rarityRaw && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rarityStyle}`}>
                {rarityRaw.charAt(0).toUpperCase() + rarityRaw.slice(1)}
              </span>
            )}
            {dropRate && <span className="text-zinc-500 text-[10px]">Drop {dropRate}</span>}
            {bonuses.length > 0 && <span className="text-zinc-400 text-[11px]">{bonuses.join(' · ')}</span>}
          </div>

          {nft.isDfaith && (
            <p className="text-zinc-500 text-[11px] leading-relaxed mt-3 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-2">
              {t('nft.collectibleInfo', lang)}
            </p>
          )}

          <div className="flex gap-1.5 flex-wrap mt-4">
            <button onClick={onSend}
              className="bg-white/[0.07] hover:bg-white/[0.12] text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <FaPaperPlane size={9} /> Send
            </button>
            {nft.isDfaith && (
              <button onClick={onRedeem}
                className="bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                ✨ Einlösen
              </button>
            )}
            <a href={`https://solscan.io/account/${nft.mint}`} target="_blank" rel="noopener noreferrer"
              className="bg-white/[0.07] hover:bg-white/[0.12] text-zinc-500 hover:text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <FaExternalLinkAlt size={8} /> Solscan
            </a>
            {!nft.isDfaith && !nft.compressed && (
              <button onClick={onBurn}
                className="bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                🔥 Verbrennen
              </button>
            )}
            {!nft.isDfaith && nft.compressed && (
              <span className="text-zinc-600 text-[10px] px-1 py-1.5" title="Compressed NFTs können hier noch nicht verbrannt werden">
                Compressed · kein Burn möglich
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
