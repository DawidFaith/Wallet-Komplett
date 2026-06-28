'use client';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import {
  FaGem, FaExternalLinkAlt, FaPlay, FaPause,
  FaDownload, FaMusic, FaStar,
} from 'react-icons/fa';

interface OwnedNft {
  purchaseId:        string;
  itemId:            string;
  printMint:         string | null;
  editionNumber:     number | null;
  purchasedAt:       string;
  title:             string;
  imageUrl:          string;
  description:       string;
  contentUrl:        string | null;
  type:              string;
  nftMaxSupply:      number | null;
  masterEditionMint: string | null;
  artistName:        string | null;
  artistPicture:     string | null;
}

export default function NftCollectionTab() {
  const { user } = useUser();
  const walletAddress = user?.id ?? null;
  const [nfts, setNfts]       = useState<OwnedNft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/nfts?wallet=${walletAddress}`)
      .then(r => r.json())
      .then((data: OwnedNft[]) => setNfts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
          <FaGem size={15} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base leading-tight">Meine NFTs</h2>
          <p className="text-zinc-500 text-[11px]">
            {nfts.length > 0
              ? `${nfts.length} Edition${nfts.length !== 1 ? 'en' : ''}`
              : 'Deine Sammlung'}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[16/7] bg-zinc-800/60" />
              <div className="p-4 space-y-2">
                <div className="h-3.5 bg-zinc-800/80 rounded-full w-2/3" />
                <div className="h-2.5 bg-zinc-800/60 rounded-full w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : nfts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
            <FaGem size={28} className="text-violet-500/40" />
          </div>
          <div className="text-center">
            <p className="text-zinc-400 font-semibold text-sm">Noch keine NFTs</p>
            <p className="text-zinc-600 text-xs mt-1">Kaufe Songs im Shop um deine Sammlung zu starten</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {nfts.map(nft => (
            <NftCard key={nft.purchaseId} nft={nft} />
          ))}
        </div>
      )}
    </div>
  );
}

function NftCard({ nft }: { nft: OwnedNft }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const editionLabel = nft.editionNumber != null && nft.nftMaxSupply != null
    ? `#${nft.editionNumber} / ${nft.nftMaxSupply}`
    : nft.editionNumber != null
      ? `Edition #${nft.editionNumber}`
      : null;

  const isSong = nft.type === 'song';

  return (
    <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
      {/* Cover */}
      <div className="relative aspect-[16/7] overflow-hidden bg-zinc-800">
        {nft.imageUrl ? (
          <>
            <Image src={nft.imageUrl} alt="" fill className="object-cover scale-110 blur-xl opacity-60" />
            <Image src={nft.imageUrl} alt={nft.title} fill className="object-contain" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/60 to-zinc-900">
            <FaGem size={32} className="text-violet-500/30" />
          </div>
        )}

        {/* Type badge */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md bg-violet-900/70 border-violet-500/40 text-violet-300">
          <FaGem size={8} /> NFT
        </span>

        {/* Edition badge */}
        {editionLabel && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm border border-violet-500/30 text-violet-300">
            {editionLabel}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Title + Artist */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-bold text-base leading-snug truncate">{nft.title}</p>
            {nft.description && (
              <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 mt-0.5">{nft.description}</p>
            )}
          </div>
          {nft.artistName && (
            <div className="flex items-center gap-1.5 shrink-0">
              {nft.artistPicture ? (
                <Image src={nft.artistPicture} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover ring-1 ring-amber-500/40" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <FaStar size={9} className="text-amber-400" />
                </div>
              )}
              <span className="text-amber-300/80 text-xs font-semibold truncate max-w-[90px]">{nft.artistName}</span>
            </div>
          )}
        </div>

        {/* MP3 Player (nur für Songs) */}
        {isSong && nft.contentUrl && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
              <audio
                ref={audioRef}
                src={nft.contentUrl}
                onEnded={() => setPlaying(false)}
              />
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center shrink-0 hover:bg-violet-400 transition-colors"
              >
                {playing
                  ? <FaPause size={10} className="text-white" />
                  : <FaPlay size={10} className="text-white ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 text-xs font-semibold truncate">{nft.title}</p>
                <p className="text-zinc-500 text-[10px] flex items-center gap-1">
                  <FaMusic size={8} /> NFT Edition — Vollständiger Song
                </p>
              </div>
            </div>
            <a
              href={nft.contentUrl}
              download
              className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-zinc-300 text-xs font-semibold transition-colors"
            >
              <FaDownload size={10} /> Download
            </a>
          </div>
        )}

        {/* Kauf-Datum + Solscan */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-zinc-600 text-[10px]">
            Gekauft am {new Date(nft.purchasedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
          {nft.printMint && (
            <a
              href={`https://solscan.io/token/${nft.printMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors text-[10px]"
            >
              On-Chain ansehen <FaExternalLinkAlt size={8} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
