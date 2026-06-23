'use client';
import { useEffect, useState } from 'react';
import { useWallet } from '../components/WalletContext';
import Image from 'next/image';
import { FaGem, FaExternalLinkAlt } from 'react-icons/fa';

interface OwnedNft {
  purchaseId:        string;
  itemId:            string;
  printMint:         string | null;
  editionNumber:     number | null;
  purchasedAt:       string;
  title:             string;
  imageUrl:          string;
  description:       string;
  nftMaxSupply:      number | null;
  masterEditionMint: string | null;
  artistName:        string | null;
}

export default function NftCollectionTab() {
  const { walletAddress } = useWallet();
  const [nfts, setNfts]     = useState<OwnedNft[]>([]);
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
            {nfts.length > 0 ? `${nfts.length} Edition${nfts.length !== 1 ? 'en' : ''}` : 'Deine Sammlung'}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-zinc-800/60" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-zinc-800/80 rounded-full w-3/4" />
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
        <div className="grid grid-cols-2 gap-3">
          {nfts.map(nft => (
            <NftCard key={nft.purchaseId} nft={nft} />
          ))}
        </div>
      )}
    </div>
  );
}

function NftCard({ nft }: { nft: OwnedNft }) {
  const editionLabel = nft.editionNumber != null && nft.nftMaxSupply != null
    ? `#${nft.editionNumber} / ${nft.nftMaxSupply}`
    : nft.editionNumber != null
      ? `Edition #${nft.editionNumber}`
      : null;

  return (
    <div className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl overflow-hidden hover:border-violet-500/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(139,92,246,0.08)]">
      {/* Cover */}
      <div className="relative aspect-square bg-zinc-900 overflow-hidden">
        {nft.imageUrl ? (
          <Image
            src={nft.imageUrl}
            alt={nft.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FaGem size={32} className="text-violet-500/30" />
          </div>
        )}

        {/* Edition badge */}
        {editionLabel && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm border border-violet-500/30 rounded-lg px-2 py-0.5">
            <p className="text-violet-300 text-[10px] font-bold">{editionLabel}</p>
          </div>
        )}

        {/* NFT gem indicator */}
        <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm border border-violet-500/30 rounded-lg flex items-center justify-center">
          <FaGem size={10} className="text-violet-400" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-white text-sm font-bold leading-tight line-clamp-1">{nft.title}</p>
        {nft.artistName && (
          <p className="text-amber-300/80 text-[11px] font-semibold">{nft.artistName}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-zinc-600 text-[10px]">
            {new Date(nft.purchasedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
          {nft.printMint && (
            <a
              href={`https://solscan.io/token/${nft.printMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors text-[10px]"
            >
              Solscan <FaExternalLinkAlt size={8} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
