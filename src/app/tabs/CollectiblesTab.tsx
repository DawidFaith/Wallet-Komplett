'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { FaGem, FaFire, FaChevronLeft, FaPlus, FaTimes, FaCheck, FaSync, FaImage, FaEdit } from 'react-icons/fa';
import { GiCrystalShine, GiMagicSwirl } from 'react-icons/gi';
import { upload } from '@vercel/blob/client';
import { useLang } from '../components/LangContext';

// ─── Typen ────────────────────────────────────────────────────────────────────

type CollectibleRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

type BonusType = 'rep' | 'credits' | 'shard';

interface CollectibleCollection {
  id: string;
  artistWallet: string;
  name: string;
  description: string;
  imageUrl: string;
  chanceCommon: number;
  chanceUncommon: number;
  chanceRare: number;
  chanceEpic: number;
  chanceLegendary: number;
  chanceMythic: number;
  maxRepBonusPercent: number;
  maxCreditBonusPercent?: number;
  maxShardChanceBonus?: number;
  primaryBonus: BonusType;
}

interface CollectionData {
  collection: CollectibleCollection;
  ownedByRarity: Partial<Record<CollectibleRarity, number>>;
  shards: number;
}

interface CollectibleArtist {
  artistWallet: string;
  name: string;
  picture: string | null;
}

// ─── Rarity-Config ────────────────────────────────────────────────────────────

const RARITY_CONFIG: Record<CollectibleRarity, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  textColor: string;
  repMultiplier: number;
}> = {
  common:    { label: 'Common',    color: '#9ca3af', bg: 'bg-zinc-800',     border: 'border-zinc-500',   glow: '',                                    textColor: 'text-zinc-300',   repMultiplier: 0.04 },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', bg: 'bg-green-950/60', border: 'border-green-500',  glow: 'shadow-[0_0_12px_rgba(74,222,128,0.4)]', textColor: 'text-green-400',  repMultiplier: 0.10 },
  rare:      { label: 'Rare',      color: '#60a5fa', bg: 'bg-blue-950/60',  border: 'border-blue-500',   glow: 'shadow-[0_0_14px_rgba(96,165,250,0.5)]', textColor: 'text-blue-400',   repMultiplier: 0.22 },
  epic:      { label: 'Epic',      color: '#a78bfa', bg: 'bg-purple-950/60',border: 'border-purple-500', glow: 'shadow-[0_0_16px_rgba(167,139,250,0.6)]', textColor: 'text-purple-400', repMultiplier: 0.45 },
  legendary: { label: 'Legendary', color: '#fbbf24', bg: 'bg-amber-950/60', border: 'border-amber-400',  glow: 'shadow-[0_0_20px_rgba(251,191,36,0.7)]',  textColor: 'text-amber-400',  repMultiplier: 0.75 },
  mythic:    { label: 'Mythic',    color: '#f43f5e', bg: 'bg-rose-950/60',  border: 'border-rose-400',   glow: 'shadow-[0_0_24px_rgba(244,63,94,0.8)]',   textColor: 'text-rose-400',   repMultiplier: 1.00 },
};

const RARITY_ORDER: CollectibleRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

/** Systemweit fixe Drop-Wahrscheinlichkeiten */
const FIXED_RARITY_CHANCES: Record<CollectibleRarity, number> = {
  common:    48.9,
  uncommon:  30.0,
  rare:      15.0,
  epic:       5.0,
  legendary:  1.0,
  mythic:     0.1,
};

// Bonus-Slot-Logik (spiegelt collectibles.ts wider, ohne DB)
function getBonusSlots(primary: BonusType): [BonusType, BonusType, BonusType] {
  const all: BonusType[] = ['rep', 'credits', 'shard'];
  const others = all.filter(b => b !== primary) as [BonusType, BonusType];
  return [primary, others[0], others[1]];
}
function getActiveSlotsCount(rarity: CollectibleRarity): 1 | 2 | 3 {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx >= RARITY_ORDER.indexOf('mythic')) return 3;
  if (idx >= RARITY_ORDER.indexOf('epic')) return 2;
  return 1;
}
const BONUS_LABELS: Record<BonusType, string> = { rep: 'REP', credits: 'Credits', shard: 'Shard-Chance' };
const BONUS_UNLOCK: Record<BonusType, string> = { rep: 'ab Common', credits: 'ab Epic', shard: 'ab Mythic' };

// ─── Collectible Card ─────────────────────────────────────────────────────────

function CollectibleCard({ rarity, count, imageUrl, name, maxRepBonus, maxCreditBonus, maxShardBonus, primaryBonus }: {
  rarity: CollectibleRarity;
  count: number;
  imageUrl: string;
  name: string;
  maxRepBonus: number;
  maxCreditBonus: number;
  maxShardBonus: number;
  primaryBonus: BonusType;
}) {
  const cfg = RARITY_CONFIG[rarity];
  const slots = getBonusSlots(primaryBonus);
  const activeCount = getActiveSlotsCount(rarity);

  const bonusValues: Record<BonusType, number> = {
    rep:     Math.round(maxRepBonus    * cfg.repMultiplier),
    credits: Math.round(maxCreditBonus * cfg.repMultiplier),
    shard:   Math.round(maxShardBonus  * cfg.repMultiplier),
  };

  const bonusColors: Record<BonusType, string> = {
    rep:     'text-amber-400',
    credits: 'text-green-400',
    shard:   'text-blue-400',
  };

  return (
    <div className={`relative flex flex-col items-center rounded-2xl border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} p-3 w-[140px] shrink-0`}>
      {/* Count Badge */}
      <span className={`absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full ${rarity === 'legendary' || rarity === 'mythic' ? 'bg-amber-400 text-black' : 'bg-zinc-700 text-white'} text-[11px] font-black flex items-center justify-center px-1.5 z-10`}>
        ×{count}
      </span>

      {/* Bild / Icon */}
      <div className={`w-20 h-20 rounded-xl border ${cfg.border} overflow-hidden mb-2 flex items-center justify-center`}>
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={80} height={80} className="w-full h-full object-cover" />
        ) : (
          <GiCrystalShine size={36} style={{ color: cfg.color }} />
        )}
      </div>

      {/* Rarity Label */}
      <span className={`text-[9px] font-black tracking-[0.3em] uppercase ${cfg.textColor} mb-0.5`}>
        {cfg.label}
      </span>

      {/* Name */}
      <span className="text-[11px] font-bold text-white text-center line-clamp-2 leading-tight mb-1">
        {name}
      </span>

      {/* Nur aktive Bonus-Slots anzeigen */}
      <div className="flex flex-col items-center gap-0.5 w-full">
        {slots.slice(0, activeCount).map((bonusType) => {
          const value = bonusValues[bonusType];
          return value > 0 ? (
            <span
              key={bonusType}
              className={`text-[9px] font-semibold flex items-center gap-0.5 ${bonusColors[bonusType]}/90`}
            >
              +{value}% {BONUS_LABELS[bonusType]}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

// ─── Fusion Modal ─────────────────────────────────────────────────────────────

function FusionModal({ collection, shards, onClose, onFused, walletAddress }: {
  collection: CollectibleCollection;
  shards: number;
  onClose: () => void;
  onFused: (rarity: CollectibleRarity, newShards: number) => void;
  walletAddress: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectibleRarity | null>(null);
  const [newShards, setNewShards] = useState(shards);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'reveal'>('idle');

  const canFuse = shards >= 1;

  const handleFuse = async () => {
    if (!canFuse || loading) return;
    setLoading(true);
    setError('');
    setPhase('shaking');
    try {
      const res = await fetch('/api/collectibles/fuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, collectionId: collection.id, action: 'fuse' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Fusion fehlgeschlagen');
      // Kurze Shake-Phase, dann Reveal
      setTimeout(() => {
        setResult(data.rarity as CollectibleRarity);
        const updated = shards - 1;
        setNewShards(updated);
        setPhase('reveal');
        onFused(data.rarity as CollectibleRarity, updated);
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
      setPhase('idle');
      setLoading(false);
    }
  };

  const handleRevealClose = () => {
    setResult(null);
    setPhase('idle');
    setLoading(false);
    if (newShards >= 1) {
      // Weiteres Verschmelzen möglich – Modal offen lassen, State zurücksetzen
    } else {
      onClose();
    }
  };

  const chances: Array<{ rarity: CollectibleRarity; chance: number }> = RARITY_ORDER.map(rarity => ({
    rarity,
    chance: FIXED_RARITY_CHANCES[rarity],
  }));

  const currentShards = phase === 'reveal' ? newShards : shards;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={phase === 'reveal' ? handleRevealClose : onClose}>
      <style>{`
        @keyframes fusionShake {
          0%,100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-8deg) scale(1.05); }
          30% { transform: rotate(8deg) scale(1.08); }
          45% { transform: rotate(-6deg) scale(1.06); }
          60% { transform: rotate(6deg) scale(1.1); }
          75% { transform: rotate(-4deg) scale(1.07); }
          90% { transform: rotate(4deg) scale(1.05); }
        }
        @keyframes fusionReveal {
          0%   { transform: scale(0.2) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes fusionGlow {
          0%,100% { box-shadow: 0 0 20px var(--glow-color), 0 0 40px var(--glow-color); }
          50%      { box-shadow: 0 0 40px var(--glow-color), 0 0 80px var(--glow-color), 0 0 120px var(--glow-color); }
        }
        @keyframes fusionParticle {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes fusionCelebUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(var(--ty)) scale(0.2); opacity: 0; }
        }
        .fusion-shake { animation: fusionShake 0.9s ease-in-out; }
        .fusion-reveal { animation: fusionReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .fusion-glow   { animation: fusionGlow 1.5s ease-in-out infinite; }
        .fusion-particle { animation: fusionCelebUp 1.5s ease-out forwards; }
      `}</style>

      {/* Reveal-Modal mit Konfetti */}
      {phase === 'reveal' && result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" onClick={handleRevealClose}>
          {/* Konfetti-Partikel */}
          {['✨','⭐','💎','🌟','✨','💫','⭐','🎊','💎','✨'].map((s, i) => (
            <span
              key={i}
              className="fusion-particle absolute pointer-events-none"
              style={{
                left: `${8 + i * 9}%`,
                bottom: `${18 + (i % 4) * 12}%`,
                fontSize: '1.4rem',
                animationDuration: `${1.2 + (i % 3) * 0.25}s`,
                animationDelay: `${i * 0.06}s`,
                '--tx': `${(i % 2 === 0 ? 1 : -1) * (20 + i * 8)}px`,
                '--ty': `-${120 + i * 18}px`,
              } as React.CSSProperties}
            >{s}</span>
          ))}

          {/* Modal-Karte */}
          <div
            className="fusion-reveal relative bg-zinc-900 border-2 rounded-3xl p-7 mx-4 text-center shadow-2xl max-w-xs w-full fusion-glow"
            style={{
              '--glow-color': RARITY_CONFIG[result].color,
              borderColor: RARITY_CONFIG[result].color,
            } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bild */}
            <div className="flex justify-center mb-4">
              {collection.imageUrl ? (
                <Image
                  src={collection.imageUrl}
                  alt={collection.name}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-2xl object-cover"
                  style={{ outline: `3px solid ${RARITY_CONFIG[result].color}`, outlineOffset: '2px' }}
                />
              ) : (
                <GiCrystalShine size={80} style={{ color: RARITY_CONFIG[result].color }} />
              )}
            </div>

            {/* Rarity-Label */}
            <p className="text-white/50 text-[10px] uppercase tracking-[0.3em] font-bold mb-1">Collectible erhalten!</p>
            <p className="font-black text-3xl mb-1" style={{ color: RARITY_CONFIG[result].color }}>
              {RARITY_CONFIG[result].label}
            </p>
            <p className="text-white/70 text-sm font-semibold mb-5">{collection.name}</p>

            {/* Button */}
            <button
              onClick={handleRevealClose}
              className="w-full py-3 rounded-2xl font-black text-sm text-black transition-all active:scale-95"
              style={{ backgroundColor: RARITY_CONFIG[result].color }}
            >
              {currentShards >= 1 ? 'Nochmal verschmelzen! 🔮' : 'Awesome! 🎊'}
            </button>
          </div>
        </div>
      )}

      {/* Haupt-Modal */}
      <div
        className={`bg-[#1a1814] border border-white/10 rounded-2xl p-6 w-full max-w-sm transition-opacity ${phase === 'reveal' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-lg flex items-center gap-2">
            <GiMagicSwirl className="text-amber-400" />
            Verschmelzen
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><FaTimes /></button>
        </div>

        {/* Kollektion Info + Shake-Animation */}
        <div className={`flex items-center gap-3 mb-5 p-3 bg-white/[0.04] rounded-xl ${phase === 'shaking' ? 'fusion-shake' : ''}`}>
          {collection.imageUrl ? (
            <Image src={collection.imageUrl} alt={collection.name} width={44} height={44} className="w-11 h-11 rounded-lg object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <GiCrystalShine className="text-amber-400" size={22} />
            </div>
          )}
          <div>
            <p className="font-bold text-white text-sm">{collection.name}</p>
            <p className="text-xs text-zinc-300">{currentShards} Shard{currentShards !== 1 ? 's' : ''} verfügbar</p>
          </div>
        </div>

        {/* Wahrscheinlichkeiten */}
        <div className="space-y-1.5 mb-5">
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-400 mb-2">Chancen</p>
          {chances.map(({ rarity, chance }) => {
            const cfg = RARITY_CONFIG[rarity];
            return (
              <div key={rarity} className="flex items-center gap-2">
                <span className={`text-[10px] font-black w-16 ${cfg.textColor}`}>{cfg.label}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${chance}%`, backgroundColor: cfg.color }} />
                </div>
                <span className="text-[10px] text-zinc-300 w-8 text-right">{chance}%</span>
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <button
          onClick={handleFuse}
          disabled={!canFuse || loading}
          className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
            canFuse
              ? 'bg-amber-400 hover:bg-amber-300 active:scale-95 text-black'
              : 'bg-white/5 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <><GiMagicSwirl className="animate-spin" /> Verschmelze…</>
          ) : canFuse ? (
            <><GiMagicSwirl /> 1 Shard verschmelzen</>
          ) : (
            'Keine Shards verfügbar'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Upgrade Modal ────────────────────────────────────────────────────────────

function UpgradeModal({ collection, fromRarity, count, onClose, onUpgraded, walletAddress }: {
  collection: CollectibleCollection;
  fromRarity: CollectibleRarity;
  count: number;
  onClose: () => void;
  onUpgraded: (newRarity: CollectibleRarity) => void;
  walletAddress: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectibleRarity | null>(null);
  const [error, setError] = useState('');

  const nextRarityIndex = RARITY_ORDER.indexOf(fromRarity) + 1;
  const nextRarity = RARITY_ORDER[nextRarityIndex] as CollectibleRarity;
  const canUpgrade = count >= 10;

  const handleUpgrade = async () => {
    if (!canUpgrade) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/collectibles/fuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, collectionId: collection.id, action: 'upgrade', fromRarity }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upgrade fehlgeschlagen');
      setResult(data.newRarity as CollectibleRarity);
      onUpgraded(data.newRarity as CollectibleRarity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const fromCfg = RARITY_CONFIG[fromRarity];
  const nextCfg = RARITY_CONFIG[nextRarity];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1814] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-lg flex items-center gap-2">
            <FaFire className="text-orange-400" />
            Upgrade
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><FaTimes /></button>
        </div>

        <div className="flex items-center justify-center gap-6 mb-6 p-4 bg-white/[0.03] rounded-xl">
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-black text-white">×10</span>
            <span className={`text-[11px] font-black ${fromCfg.textColor}`}>{fromCfg.label}</span>
          </div>
          <span className="text-zinc-600 font-bold text-xl">→</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-black text-white">×1</span>
            <span className={`text-[11px] font-black ${nextCfg.textColor}`}>{nextCfg.label}</span>
          </div>
        </div>

        {result && (
          <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${RARITY_CONFIG[result].border} ${RARITY_CONFIG[result].bg} ${RARITY_CONFIG[result].glow} mb-4`}>
            <GiCrystalShine size={40} style={{ color: RARITY_CONFIG[result].color }} />
            <p className={`font-black text-lg ${RARITY_CONFIG[result].textColor}`}>Upgrade erfolgreich!</p>
            <p className="text-xs text-zinc-400">{RARITY_CONFIG[result].label} erhalten</p>
          </div>
        )}

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
            <span>{fromCfg.label} Collectibles</span>
            <span>{Math.min(count, 10)} / 10</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all`}
              style={{ width: `${Math.min(count / 10, 1) * 100}%`, backgroundColor: fromCfg.color }}
            />
          </div>
        </div>

        <button
          onClick={result ? onClose : handleUpgrade}
          disabled={!canUpgrade || loading}
          className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
            result
              ? 'bg-green-500 text-black'
              : canUpgrade
                ? 'bg-orange-500 hover:bg-orange-400 text-black'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <FaSync className="animate-spin" />
          ) : result ? (
            <><FaCheck /> Fertig</>
          ) : canUpgrade ? (
            <><FaFire /> 10× {fromCfg.label} upgraden</>
          ) : (
            `Noch ${10 - count} ${fromCfg.label} fehlen`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Kollektion-Panel ─────────────────────────────────────────────────────────

function CollectionPanel({ data, walletAddress, onRefresh, isOwner = false, onShardsChanged }: {
  data: CollectionData;
  walletAddress: string;
  onRefresh: () => void;
  isOwner?: boolean;
  onShardsChanged?: (newCount: number) => void;
}) {
  const [fuseOpen, setFuseOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState<CollectibleRarity | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [localShards, setLocalShards] = useState(data.shards);

  // Shard-Zahl von außen (nach onRefresh) synchronisieren
  useEffect(() => { setLocalShards(data.shards); }, [data.shards]);

  const { collection, ownedByRarity } = data;
  const shards = localShards;
  const totalCollectibles = Object.values(ownedByRarity).reduce((s, v) => s + (v ?? 0), 0);
  const upgradableRarities = RARITY_ORDER
    .filter((r, i) => i < RARITY_ORDER.length - 1 && (ownedByRarity[r] ?? 0) >= 10);

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0 flex items-center justify-center bg-amber-400/10">
          {collection.imageUrl
            ? <Image src={collection.imageUrl} alt={collection.name} width={56} height={56} className="w-full h-full object-cover" />
            : <GiCrystalShine className="text-amber-400" size={24} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-black text-white text-sm truncate flex-1">{collection.name}</p>
            {isOwner && (
              <button
                onClick={() => setEditOpen(true)}
                className="text-zinc-500 hover:text-amber-400 transition-colors p-1 shrink-0"
                title="Kollektion bearbeiten"
              >
                <FaEdit size={13} />
              </button>
            )}
          </div>
          {collection.description && (
            <p className="text-[11px] text-zinc-300 leading-relaxed mt-0.5 line-clamp-2">{collection.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[10px] text-amber-400/80 font-bold">
              {totalCollectibles} Collectible{totalCollectibles !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-zinc-400">·</span>
            <span className="text-[10px] text-zinc-300">{shards} Shard{shards !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Alle 6 Rarity-Karten: owned farbig, unowned gesperrt/grau */}
      <div className="mb-4">
        <p className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-400 mb-3">Deine Karten</p>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {RARITY_ORDER.map((rarity) => {
            const count = ownedByRarity[rarity] ?? 0;
            if (count > 0) {
              return (
                <CollectibleCard
                  key={rarity}
                  rarity={rarity}
                  count={count}
                  imageUrl={collection.imageUrl}
                  name={collection.name}
                  maxRepBonus={collection.maxRepBonusPercent}
                  maxCreditBonus={collection.maxCreditBonusPercent ?? 0}
                  maxShardBonus={collection.maxShardChanceBonus ?? 0}
                  primaryBonus={collection.primaryBonus ?? 'rep'}
                />
              );
            }
            // Nicht besessen → ausgegraut anzeigen
            const cfg = RARITY_CONFIG[rarity];
            return (
              <div key={rarity} className="relative flex flex-col items-center rounded-2xl border-2 border-zinc-800 bg-zinc-900/30 p-3 w-[140px] shrink-0 opacity-40">
                <div className="w-20 h-20 rounded-xl border border-zinc-800 overflow-hidden mb-2 flex items-center justify-center bg-zinc-800/40">
                  {collection.imageUrl
                    ? <Image src={collection.imageUrl} alt={collection.name} width={80} height={80} className="w-full h-full object-cover grayscale" />
                    : <GiCrystalShine size={36} className="text-zinc-600" />}
                </div>
                <span className={`text-[9px] font-black tracking-[0.3em] uppercase ${cfg.textColor} mb-0.5`}>{cfg.label}</span>
                <span className="text-[11px] font-bold text-zinc-500 text-center line-clamp-2 leading-tight">0×</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFuseOpen(true)}
          disabled={shards < 1}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-colors ${
            shards >= 1
              ? 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30'
              : 'bg-white/[0.03] text-zinc-400 border border-white/[0.08] cursor-not-allowed'
          }`}
        >
          <GiMagicSwirl size={12} />
          Verschmelzen ({shards} Shard{shards !== 1 ? 's' : ''})
        </button>

        {/* Zusammenfassen: Dropdown + Button */}
        {RARITY_ORDER.slice(0, -1).some((r) => (ownedByRarity[r] ?? 0) > 0) && (() => {
          const upgradableOptions = RARITY_ORDER.slice(0, -1).filter((r) => (ownedByRarity[r] ?? 0) > 0);
          const [selectedRarity, setSelectedRarity] = React.useState<CollectibleRarity>(
            upgradableOptions.reduce((best, r) =>
              (ownedByRarity[r] ?? 0) > (ownedByRarity[best] ?? 0) ? r : best
            )
          );
          const count = ownedByRarity[selectedRarity] ?? 0;
          const canUpgrade = count >= 10;
          const nextRarity = RARITY_ORDER[RARITY_ORDER.indexOf(selectedRarity) + 1];
          return (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value as CollectibleRarity)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-semibold rounded-xl px-2 py-2 outline-none focus:border-orange-500/50"
              >
                {upgradableOptions.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_CONFIG[r].label} ({ownedByRarity[r] ?? 0}/10)
                  </option>
                ))}
              </select>
              <button
                onClick={() => canUpgrade && setUpgradeOpen(selectedRarity)}
                disabled={!canUpgrade}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-colors ${
                  canUpgrade
                    ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-white/[0.03] text-zinc-400 border border-white/[0.08] cursor-not-allowed'
                }`}
              >
                <FaFire size={10} />
                → {RARITY_CONFIG[nextRarity].label}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Fusion Modal */}
      {fuseOpen && (
        <FusionModal
          collection={collection}
          shards={shards}
          walletAddress={walletAddress}
          onClose={() => setFuseOpen(false)}
          onFused={(_rarity, newShardsCount) => { setLocalShards(newShardsCount); onShardsChanged?.(newShardsCount); onRefresh(); }}
        />
      )}

      {/* Upgrade Modal */}
      {upgradeOpen && (
        <UpgradeModal
          collection={collection}
          fromRarity={upgradeOpen}
          count={ownedByRarity[upgradeOpen] ?? 0}
          walletAddress={walletAddress}
          onClose={() => setUpgradeOpen(null)}
          onUpgraded={() => { setUpgradeOpen(null); onRefresh(); }}
        />
      )}

      {/* Edit Modal */}
      {editOpen && isOwner && (
        <EditCollectionForm
          collection={collection}
          artistWallet={walletAddress}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Kollektion bearbeiten (Artist) ──────────────────────────────────────────

function EditCollectionForm({ collection, artistWallet, onClose, onSaved }: {
  collection: CollectibleCollection;
  artistWallet: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name:                collection.name,
    description:         collection.description ?? '',
    imageUrl:            collection.imageUrl ?? '',
    maxRepBonusPercent:  collection.maxRepBonusPercent,
    maxShardChanceBonus: collection.maxShardChanceBonus ?? 0,
    maxCreditBonusPercent: collection.maxCreditBonusPercent ?? 0,
    primaryBonus:        (collection.primaryBonus ?? 'rep') as BonusType,
  });

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError('');
    try {
      const blob = await upload(`collectibles/${artistWallet}/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/collectibles/upload',
        clientPayload: JSON.stringify({ wallet: artistWallet }),
      });
      setForm((f) => ({ ...f, imageUrl: blob.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/collectibles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: collection.id, artistWallet, ...form }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Fehler beim Speichern');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1814] border border-amber-400/20 rounded-t-3xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-black text-white text-sm flex items-center gap-2"><FaEdit className="text-amber-400" /> Kollektion bearbeiten</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><FaTimes size={14} /></button>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-400/30" />
          </div>
          {/* Beschreibung */}
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-400/30 resize-none" />
          </div>

          {/* Bild */}
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Bild</label>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-lg text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <FaImage size={11} /> {uploadingImage ? 'Lädt...' : 'Neues Bild'}
              </button>
              {form.imageUrl && (
                <Image src={form.imageUrl} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-cover border border-white/10" />
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
              />
            </div>
          </div>

          {/* Primärer Bonus */}
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Primärer Bonus (Slot 1)</label>
            <div className="flex gap-2">
              {(['rep', 'credits', 'shard'] as BonusType[]).map((b) => (
                <button key={b} type="button"
                  onClick={() => setForm({ ...form, primaryBonus: b })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${form.primaryBonus === b ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:border-white/20'}`}>
                  {b === 'rep' ? 'Rep' : b === 'credits' ? 'Credits' : 'Shard'}
                </button>
              ))}
            </div>
          </div>

          {/* Wahrscheinlichkeiten werden systemweit fix bestimmt */}

          {/* Bonus-Maximalwerte */}
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Maximale Boni (bei Mythic)</label>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <p className="text-[9px] text-zinc-600 mb-0.5">Rep % (max)</p>
                <input type="number" min={0} value={form.maxRepBonusPercent}
                  onChange={(e) => setForm({ ...form, maxRepBonusPercent: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-400/30" />
              </div>
              <div>
                <p className="text-[9px] text-zinc-600 mb-0.5">Credits % (max)</p>
                <input type="number" min={0} value={form.maxCreditBonusPercent}
                  onChange={(e) => setForm({ ...form, maxCreditBonusPercent: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-400/30" />
              </div>
              <div>
                <p className="text-[9px] text-zinc-600 mb-0.5">Shard-Chance (max)</p>
                <input type="number" min={0} value={form.maxShardChanceBonus}
                  onChange={(e) => setForm({ ...form, maxShardChanceBonus: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-400/30" />
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-zinc-400 text-sm font-semibold hover:bg-white/[0.08] transition-colors">
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              {loading ? <FaSync className="animate-spin" size={12} /> : <FaCheck size={12} />} Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Künstler-Erstell-Panel (Artist) ─────────────────────────────────────────

function CreateCollectionForm({ artistWallet, onCreated }: { artistWallet: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', description: '', imageUrl: '',
    maxRepBonusPercent: 20, maxShardChanceBonus: 5, maxCreditBonusPercent: 10,
    primaryBonus: 'rep' as BonusType,
  });

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError('');
    try {
      const blob = await upload(`collectibles/${artistWallet}/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/collectibles/upload',
        clientPayload: JSON.stringify({ wallet: artistWallet }),
      });
      setForm((f) => ({ ...f, imageUrl: blob.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/collectibles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet, ...form }),
      });
      const data = await res.json();
      if (!data.id) throw new Error(data.error || 'Fehler');
      setOpen(false);
      setForm({ name: '', description: '', imageUrl: '', maxRepBonusPercent: 20, maxShardChanceBonus: 5, maxCreditBonusPercent: 10, primaryBonus: 'rep' });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 w-full p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-dashed border-white/10 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-semibold mb-4"
    >
      <FaPlus size={12} /> Neue Kollektion erstellen
    </button>
  );

  return (
    <div className="bg-white/[0.03] border border-amber-400/20 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-black text-white text-sm">Neue Kollektion</p>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white"><FaTimes size={14} /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Dawid Faith Season 1"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-400/30" />
        </div>
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Beschreibung</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Kurze Beschreibung..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-400/30 resize-none" />
        </div>

        {/* Bild-Upload */}
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Kollektion-Bild</label>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {uploadingImage ? <FaSync className="animate-spin" size={11} /> : <FaImage size={11} />}
              {uploadingImage ? 'Lädt...' : 'Bild hochladen'}
            </button>
            {form.imageUrl && (
              <div className="flex items-center gap-2">
                <Image src={form.imageUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                <button onClick={() => setForm({ ...form, imageUrl: '' })} className="text-zinc-600 hover:text-red-400"><FaTimes size={10} /></button>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
            />
          </div>
        </div>

        {/* Wahrscheinlichkeiten werden systemweit fix bestimmt */}

        {/* Hauptbonus (Primär-Slot) */}
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-2">
            Hauptbonus (aktiv ab Common)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['rep', 'credits', 'shard'] as BonusType[]).map((b) => {
              const labels: Record<BonusType, string> = { rep: 'Reputation', credits: 'Credits', shard: 'Shard-Chance' };
              const active = form.primaryBonus === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setForm({ ...form, primaryBonus: b })}
                  className={`py-2 rounded-lg text-[10px] font-black border transition-colors ${
                    active
                      ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {labels[b]}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-zinc-700 mt-1.5">
            {(() => {
              const slots = getBonusSlots(form.primaryBonus);
              return `${BONUS_LABELS[slots[0]]} (Common+) → ${BONUS_LABELS[slots[1]]} (Epic+) → ${BONUS_LABELS[slots[2]]} (Mythic)`;
            })()}
          </p>
        </div>

        {/* Bonuswerte */}
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-2">Max-Boni (bei Mythic-Collectible)</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-zinc-600 block mb-1">REP %</label>
              <input type="number" min={0} max={100} value={form.maxRepBonusPercent}
                onChange={(e) => setForm({ ...form, maxRepBonusPercent: Number(e.target.value) })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-sm text-white outline-none text-center" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-600 block mb-1">Credits %</label>
              <input type="number" min={0} max={100} value={form.maxCreditBonusPercent}
                onChange={(e) => setForm({ ...form, maxCreditBonusPercent: Number(e.target.value) })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-sm text-white outline-none text-center" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-600 block mb-1">Shard %</label>
              <input type="number" min={0} max={80} value={form.maxShardChanceBonus}
                onChange={(e) => setForm({ ...form, maxShardChanceBonus: Number(e.target.value) })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-sm text-white outline-none text-center" />
            </div>
          </div>
          <p className="text-[9px] text-zinc-700 mt-1.5">Common erhält z.B. 4% davon, Mythic 100%</p>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || !form.name.trim()}
          className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-sm rounded-xl transition-colors"
        >
          {loading ? 'Erstelle...' : 'Kollektion erstellen'}
        </button>
      </div>
    </div>
  );
}

// ─── Haupt-Tab ────────────────────────────────────────────────────────────────

export default function CollectiblesTab() {
  const { user } = useUser();
  const walletAddress = user?.id ?? '';

  // Top-Level Tabs: supporter | artist
  const [mainTab, setMainTab] = useState<'supporter' | 'artist'>('supporter');
  // Supporter: overview | artist-detail
  const [view, setView] = useState<'overview' | 'artistDetail'>('overview');
  const [selectedArtist, setSelectedArtist] = useState<CollectibleArtist | null>(null);
  const [artists, setArtists] = useState<CollectibleArtist[]>([]);
  const [artistCollections, setArtistCollections] = useState<CollectionData[]>([]);
  const [myShards, setMyShards] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isArtist, setIsArtist] = useState(false);
  // Artist-Tab: eigene Kollektionen
  const [myCollections, setMyCollections] = useState<CollectionData[]>([]);
  const [myCollLoading, setMyCollLoading] = useState(false);

  const loadArtists = useCallback(async () => {
    setLoading(true);
    try {
      const [artistsRes, shardsRes] = await Promise.all([
        fetch('/api/admin/artists'),
        walletAddress ? fetch(`/api/collectibles?wallet=${walletAddress}`) : Promise.resolve(null),
      ]);
      const artistsData = await artistsRes.json();
      const allArtists: CollectibleArtist[] = (artistsData.artists ?? []).map((a: any) => ({
        artistWallet: a.walletAddress,
        name: a.name,
        picture: a.picture ?? null,
      }));
      setArtists(allArtists);

      if (walletAddress) {
        const isArt = allArtists.some((a) => a.artistWallet.toLowerCase() === walletAddress.toLowerCase());
        setIsArtist(isArt);
      }
      if (shardsRes) {
        const sd = await shardsRes.json();
        const shardMap: Record<string, number> = {};
        for (const s of (sd.shards ?? [])) shardMap[s.artistWallet] = s.count;
        setMyShards(shardMap);
      }
    } catch (_) {}
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { loadArtists(); }, [loadArtists]);

  const loadArtistCollections = useCallback(async (artistWallet: string) => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/collectibles?artistWallet=${artistWallet}&wallet=${walletAddress}`);
      const data = await res.json();
      setArtistCollections(data.data ?? []);
    } catch (_) {}
    setLoading(false);
  }, [walletAddress]);

  const loadMyCollections = useCallback(async () => {
    if (!walletAddress || !isArtist) return;
    setMyCollLoading(true);
    try {
      const res = await fetch(`/api/collectibles?artistWallet=${walletAddress}&wallet=${walletAddress}`);
      const data = await res.json();
      setMyCollections(data.data ?? []);
    } catch (_) {}
    setMyCollLoading(false);
  }, [walletAddress, isArtist]);

  useEffect(() => {
    if (mainTab === 'artist' && isArtist) loadMyCollections();
  }, [mainTab, isArtist, loadMyCollections]);

  const handleSelectArtist = (artist: CollectibleArtist) => {
    setSelectedArtist(artist);
    setView('artistDetail');
    loadArtistCollections(artist.artistWallet);
  };

  const totalMyShards = Object.values(myShards).reduce((s, n) => s + n, 0);

  if (!walletAddress) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-8 text-center">
        <GiCrystalShine className="text-zinc-700 mx-auto mb-3" size={40} />
        <p className="text-zinc-500 text-sm">Bitte einloggen um Collectibles zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">

      {/* ── D.FAITH Header ───────────────────────────────────────────────────── */}
      {view !== 'artistDetail' && (
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 pt-1">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={40} height={40} className="w-10 h-10 rounded-full object-contain shrink-0" />
            <div>
              <h1 className="text-white font-bold text-xl tracking-wide">D.FAITH Ecosystem</h1>
              <p className="text-zinc-300 text-[10px] tracking-widest uppercase font-semibold mt-0.5">
                Collectibles · Shards
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Künstler-Detail Header ────────────────────────────────────────────── */}
      {view === 'artistDetail' && (
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <button onClick={() => setView('overview')} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
            <FaChevronLeft size={11} /> Zurück
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base truncate">{selectedArtist?.name}</p>
            <p className="text-zinc-500 text-xs">Collectibles</p>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-1.5">
            <GiCrystalShine className="text-amber-400" size={14} />
            <span className="text-amber-300 font-black text-sm">
              {selectedArtist ? (myShards[selectedArtist.artistWallet] ?? 0) : 0}
            </span>
            <span className="text-amber-400/60 text-xs">Shards</span>
          </div>
        </div>
      )}

      {/* ── Tab-Auswahl: Supporter | Künstler ────────────────────────────────── */}
      {view === 'overview' && (
        <div className="mx-4 mb-2 flex bg-zinc-900/70 rounded-xl p-1 border border-white/[0.07]">
          <button
            onClick={() => setMainTab('supporter')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              mainTab === 'supporter' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FaGem size={11} /> Supporter
          </button>
          <button
            onClick={() => setMainTab('artist')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              mainTab === 'artist' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GiCrystalShine size={11} /> Künstler
          </button>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────────── */}
      {loading && view !== 'artistDetail' ? (
        <div className="flex justify-center py-12">
          <span className="w-7 h-7 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : (

        /* ── SUPPORTER TAB ─────────────────────────────────────────────────── */
        mainTab === 'supporter' || view === 'artistDetail' ? (
          view === 'overview' ? (
            <div className="px-4 space-y-4">
              {/* Künstler-Icons – sortiert nach Shard-Guthaben */}
              {artists.length === 0 ? (
                <div className="text-center py-16">
                  <GiCrystalShine className="text-zinc-800 mx-auto mb-3" size={48} />
                  <p className="text-zinc-600 text-sm">Noch keine Kollektionen verfügbar.</p>
                  <p className="text-zinc-700 text-xs mt-1">Schließe Quest-Bundles ab um Shards zu erhalten!</p>
                </div>
              ) : (
                <>
                  <p className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-600">Künstler</p>
                  <div className="flex gap-4 overflow-x-auto pt-1 pb-2 scrollbar-none">
                    {[...artists].sort((a, b) => (myShards[b.artistWallet] ?? 0) - (myShards[a.artistWallet] ?? 0)).map((artist) => {
                      const shardCount = myShards[artist.artistWallet] ?? 0;
                      return (
                        <button
                          key={artist.artistWallet}
                          onClick={() => handleSelectArtist(artist)}
                          className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
                        >
                          <div className="relative">
                            <div className="w-14 h-14 rounded-full ring-2 ring-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all group-hover:scale-105 overflow-hidden">
                              {artist.picture
                                ? <Image src={artist.picture} alt={artist.name} width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
                                : <div className="w-14 h-14 rounded-full bg-amber-400/20 flex items-center justify-center">
                                    <FaGem className="text-amber-400" size={18} />
                                  </div>
                              }
                            </div>
                          </div>
                          <p className="text-xs text-zinc-300 text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">
                            {artist.name}
                          </p>
                          {/* Shard-Anzahl unter dem Namen */}
                          <div className="flex items-center gap-1">
                            <GiCrystalShine className={shardCount > 0 ? 'text-amber-400' : 'text-zinc-700'} size={10} />
                            <span className={`text-[10px] font-black ${shardCount > 0 ? 'text-amber-300' : 'text-zinc-600'}`}>
                              {shardCount}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Artist-Detail (Supporter) */
            <div className="px-4 space-y-3">
              {loading && artistCollections.length === 0 ? (
                <div className="flex justify-center py-12">
                  <span className="w-7 h-7 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : artistCollections.length === 0 ? (
                <div className="text-center py-12">
                  <GiCrystalShine className="text-zinc-800 mx-auto mb-3" size={40} />
                  <p className="text-zinc-600 text-sm">Noch keine Kollektion verfügbar.</p>
                  <p className="text-zinc-700 text-xs mt-1">Schließe Quest-Bundles ab um Shards zu sammeln!</p>
                </div>
              ) : (
                <>
                  {/* ── Aktive Boni-Übersicht ───────────────────────────────── */}
                  {(() => {
                    // Tatsächliche Boni berechnen: höchste Rarity je Kollektion bestimmt den Multiplikator
                    let totalRep = 0, totalCredits = 0, totalShard = 0;
                    for (const d of artistCollections) {
                      const { collection, ownedByRarity } = d;
                      // Höchste besessene Rarity finden
                      const ownedRarities = RARITY_ORDER.filter(r => (ownedByRarity[r] ?? 0) > 0);
                      if (ownedRarities.length === 0) continue;
                      const bestRarity = ownedRarities[ownedRarities.length - 1];
                      const mult = RARITY_CONFIG[bestRarity].repMultiplier;
                      const slots = getBonusSlots(collection.primaryBonus ?? 'rep');
                      const activeCount = getActiveSlotsCount(bestRarity);
                      // Nur aktive Slots (je nach Rarity) zählen
                      for (let i = 0; i < activeCount; i++) {
                        const bonusType = slots[i];
                        if (bonusType === 'rep')     totalRep     += Math.round((collection.maxRepBonusPercent ?? 0)    * mult);
                        if (bonusType === 'credits') totalCredits += Math.round((collection.maxCreditBonusPercent ?? 0) * mult);
                        if (bonusType === 'shard')   totalShard   += Math.round((collection.maxShardChanceBonus ?? 0)   * mult);
                      }
                    }
                    if (totalRep === 0 && totalCredits === 0 && totalShard === 0) return null;
                    return (
                      <div className="bg-white/[0.03] border border-amber-400/20 rounded-2xl p-4">
                        <p className="text-[9px] font-black tracking-[0.3em] uppercase text-amber-400/50 mb-3">✨ Deine aktiven Boni</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <p className={`font-black text-2xl ${totalCredits > 0 ? 'text-amber-300' : 'text-zinc-700'}`}>+{totalCredits}%</p>
                            <p className="text-zinc-500 text-[10px] mt-0.5">Credits</p>
                          </div>
                          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <p className={`font-black text-2xl ${totalShard > 0 ? 'text-blue-300' : 'text-zinc-700'}`}>+{totalShard}%</p>
                            <p className="text-zinc-500 text-[10px] mt-0.5">Shard-Chance</p>
                          </div>
                          <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <p className={`font-black text-2xl ${totalRep > 0 ? 'text-purple-300' : 'text-zinc-700'}`}>+{totalRep}%</p>
                            <p className="text-zinc-500 text-[10px] mt-0.5">Reputation</p>
                          </div>
                        </div>
                        <p className="text-zinc-300 text-[10px] mt-2.5 leading-relaxed">
                          Basiert auf deinen besten Collectibles je Kollektion. Wird automatisch auf Quest-Rewards angerechnet.
                        </p>
                      </div>
                    );
                  })()}

                  {artistCollections.map((data) => (
                    <CollectionPanel
                      key={data.collection.id}
                      data={data}
                      walletAddress={walletAddress}
                      onRefresh={() => selectedArtist && loadArtistCollections(selectedArtist.artistWallet)}
                      onShardsChanged={(n) => selectedArtist && setMyShards((prev) => ({ ...prev, [selectedArtist.artistWallet]: n }))}
                    />
                  ))}
                </>
              )}
            </div>
          )
        ) : (

          /* ── KÜNSTLER TAB ────────────────────────────────────────────────── */
          <div className="px-4 space-y-4">
            {!isArtist ? (
              <div className="text-center py-16">
                <GiCrystalShine className="text-zinc-800 mx-auto mb-3" size={48} />
                <p className="text-zinc-500 text-sm">Nur verifizierte Künstler können Kollektionen erstellen.</p>
              </div>
            ) : (
              <>
                <CreateCollectionForm
                  artistWallet={walletAddress}
                  onCreated={() => { loadArtists(); loadMyCollections(); }}
                />
                {myCollLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  </div>
                ) : myCollections.length === 0 ? (
                  <div className="text-center py-8">
                    <GiCrystalShine className="text-zinc-800 mx-auto mb-2" size={32} />
                    <p className="text-zinc-600 text-xs">Noch keine Kollektionen erstellt.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-600">Meine Kollektionen</p>
                    {myCollections.map((data) => (
                      <CollectionPanel
                        key={data.collection.id}
                        data={data}
                        walletAddress={walletAddress}
                        onRefresh={loadMyCollections}
                        isOwner={true}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )
      )}
      </div>
    </div>
  );
}
