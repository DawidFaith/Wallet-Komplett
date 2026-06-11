'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { FaGem, FaFire, FaChevronLeft, FaPlus, FaTimes, FaCheck, FaSync } from 'react-icons/fa';
import { GiCrystalShine, GiMagicSwirl } from 'react-icons/gi';
import { useLang } from '../components/LangContext';

// ─── Typen ────────────────────────────────────────────────────────────────────

type CollectibleRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
  common:    { label: 'Common',    color: '#9ca3af', bg: 'bg-zinc-800',     border: 'border-zinc-500',   glow: '',                                    textColor: 'text-zinc-300',   repMultiplier: 0.05 },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', bg: 'bg-green-950/60', border: 'border-green-500',  glow: 'shadow-[0_0_12px_rgba(74,222,128,0.4)]', textColor: 'text-green-400',  repMultiplier: 0.12 },
  rare:      { label: 'Rare',      color: '#60a5fa', bg: 'bg-blue-950/60',  border: 'border-blue-500',   glow: 'shadow-[0_0_14px_rgba(96,165,250,0.5)]', textColor: 'text-blue-400',   repMultiplier: 0.25 },
  epic:      { label: 'Epic',      color: '#a78bfa', bg: 'bg-purple-950/60',border: 'border-purple-500', glow: 'shadow-[0_0_16px_rgba(167,139,250,0.6)]', textColor: 'text-purple-400', repMultiplier: 0.50 },
  legendary: { label: 'Legendary', color: '#fbbf24', bg: 'bg-amber-950/60', border: 'border-amber-400',  glow: 'shadow-[0_0_20px_rgba(251,191,36,0.7)]',  textColor: 'text-amber-400',  repMultiplier: 0.75 },
  mythic:    { label: 'Mythic',    color: '#f43f5e', bg: 'bg-rose-950/60',  border: 'border-rose-400',   glow: 'shadow-[0_0_24px_rgba(244,63,94,0.8)]',   textColor: 'text-rose-400',   repMultiplier: 1.0  },
};

const RARITY_ORDER: CollectibleRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// ─── Collectible Card ─────────────────────────────────────────────────────────

function CollectibleCard({ rarity, count, imageUrl, name, maxRepBonus }: {
  rarity: CollectibleRarity;
  count: number;
  imageUrl: string;
  name: string;
  maxRepBonus: number;
}) {
  const cfg = RARITY_CONFIG[rarity];
  const repBonus = Math.round(maxRepBonus * cfg.repMultiplier);

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

      {/* Rep Bonus */}
      {repBonus > 0 && (
        <span className="text-[9px] text-amber-400/80 font-semibold">+{repBonus}% REP</span>
      )}
    </div>
  );
}

// ─── Fusion Modal ─────────────────────────────────────────────────────────────

function FusionModal({ collection, shards, onClose, onFused, walletAddress }: {
  collection: CollectibleCollection;
  shards: number;
  onClose: () => void;
  onFused: (rarity: CollectibleRarity) => void;
  walletAddress: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectibleRarity | null>(null);
  const [error, setError] = useState('');

  const canFuse = shards >= 10;

  const handleFuse = async () => {
    if (!canFuse) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/collectibles/fuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, collectionId: collection.id, action: 'fuse' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Fusion fehlgeschlagen');
      setResult(data.rarity as CollectibleRarity);
      onFused(data.rarity as CollectibleRarity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const chances: Array<{ rarity: CollectibleRarity; chance: number }> = [
    { rarity: 'common',    chance: collection.chanceCommon },
    { rarity: 'uncommon',  chance: collection.chanceUncommon },
    { rarity: 'rare',      chance: collection.chanceRare },
    { rarity: 'epic',      chance: collection.chanceEpic },
    { rarity: 'legendary', chance: collection.chanceLegendary },
    { rarity: 'mythic',    chance: collection.chanceMythic },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1814] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-lg flex items-center gap-2">
            <GiMagicSwirl className="text-amber-400" />
            Verschmelzen
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><FaTimes /></button>
        </div>

        {/* Kollektion Info */}
        <div className="flex items-center gap-3 mb-5 p-3 bg-white/[0.04] rounded-xl">
          {collection.imageUrl ? (
            <Image src={collection.imageUrl} alt={collection.name} width={44} height={44} className="w-11 h-11 rounded-lg object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <GiCrystalShine className="text-amber-400" size={22} />
            </div>
          )}
          <div>
            <p className="font-bold text-white text-sm">{collection.name}</p>
            <p className="text-xs text-zinc-500">{shards} / 10 Shards</p>
          </div>
        </div>

        {/* Wahrscheinlichkeiten */}
        <div className="space-y-1.5 mb-5">
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-600 mb-2">Chancen</p>
          {chances.map(({ rarity, chance }) => {
            const cfg = RARITY_CONFIG[rarity];
            return (
              <div key={rarity} className="flex items-center gap-2">
                <span className={`text-[10px] font-black w-16 ${cfg.textColor}`}>{cfg.label}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${chance}%`, backgroundColor: cfg.color }} />
                </div>
                <span className="text-[10px] text-zinc-500 w-8 text-right">{chance}%</span>
              </div>
            );
          })}
        </div>

        {/* Ergebnis */}
        {result && (
          <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${RARITY_CONFIG[result].border} ${RARITY_CONFIG[result].bg} ${RARITY_CONFIG[result].glow} mb-4`}>
            <GiCrystalShine size={40} style={{ color: RARITY_CONFIG[result].color }} />
            <p className={`font-black text-lg ${RARITY_CONFIG[result].textColor}`}>{RARITY_CONFIG[result].label}!</p>
            <p className="text-xs text-zinc-400">Du hast ein neues Collectible erhalten</p>
          </div>
        )}

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        {/* Shard Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
            <span>Shards</span>
            <span>{Math.min(shards, 10)} / 10</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${Math.min(shards / 10, 1) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={result ? onClose : handleFuse}
          disabled={!canFuse || loading}
          className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
            result
              ? 'bg-green-500 text-black'
              : canFuse
                ? 'bg-amber-400 hover:bg-amber-300 text-black'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <FaSync className="animate-spin" />
          ) : result ? (
            <><FaCheck /> Fertig</>
          ) : canFuse ? (
            <><GiMagicSwirl /> 10 Shards verschmelzen</>
          ) : (
            `Noch ${10 - shards} Shards fehlen`
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
          <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
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

function CollectionPanel({ data, walletAddress, onRefresh }: {
  data: CollectionData;
  walletAddress: string;
  onRefresh: () => void;
}) {
  const [fuseOpen, setFuseOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState<CollectibleRarity | null>(null);

  const { collection, ownedByRarity, shards } = data;
  const totalCollectibles = Object.values(ownedByRarity).reduce((s, v) => s + (v ?? 0), 0);

  const ownedRarities = RARITY_ORDER.filter((r) => (ownedByRarity[r] ?? 0) > 0);
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
          <p className="font-black text-white text-sm truncate">{collection.name}</p>
          {collection.description && (
            <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5 line-clamp-2">{collection.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[10px] text-amber-400/80 font-bold">
              {totalCollectibles} Collectible{totalCollectibles !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500">{shards} Shard{shards !== 1 ? 's' : ''}</span>
            {collection.maxRepBonusPercent > 0 && (
              <>
                <span className="text-[10px] text-zinc-600">·</span>
                <span className="text-[10px] text-green-400/80">bis +{collection.maxRepBonusPercent}% REP</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Owned Collectibles */}
      {ownedRarities.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-600 mb-3">Deine Collectibles</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {ownedRarities.map((rarity) => (
              <CollectibleCard
                key={rarity}
                rarity={rarity}
                count={ownedByRarity[rarity] ?? 0}
                imageUrl={collection.imageUrl}
                name={collection.name}
                maxRepBonus={collection.maxRepBonusPercent}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFuseOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-colors ${
            shards >= 10
              ? 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30'
              : 'bg-white/[0.03] text-zinc-600 border border-white/[0.05] cursor-not-allowed'
          }`}
        >
          <GiMagicSwirl size={12} />
          Verschmelzen ({shards}/10 Shards)
        </button>

        {upgradableRarities.map((rarity) => (
          <button
            key={rarity}
            onClick={() => setUpgradeOpen(rarity)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-colors bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30`}
          >
            <FaFire size={10} />
            10× {RARITY_CONFIG[rarity].label} upgraden
          </button>
        ))}
      </div>

      {/* Fusion Modal */}
      {fuseOpen && (
        <FusionModal
          collection={collection}
          shards={shards}
          walletAddress={walletAddress}
          onClose={() => setFuseOpen(false)}
          onFused={() => { setFuseOpen(false); onRefresh(); }}
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
    </div>
  );
}

// ─── Künstler-Erstell-Panel (Artist) ─────────────────────────────────────────

function CreateCollectionForm({ artistWallet, onCreated }: { artistWallet: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', imageUrl: '',
    chanceCommon: 50, chanceUncommon: 25, chanceRare: 15,
    chanceEpic: 7, chanceLegendary: 2, chanceMythic: 1,
    maxRepBonusPercent: 20, maxShardChanceBonus: 5,
  });

  const total = form.chanceCommon + form.chanceUncommon + form.chanceRare + form.chanceEpic + form.chanceLegendary + form.chanceMythic;

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    if (total !== 100) { setError(`Wahrscheinlichkeiten müssen 100 ergeben (aktuell: ${total})`); return; }
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
      setForm({ name: '', description: '', imageUrl: '', chanceCommon: 50, chanceUncommon: 25, chanceRare: 15, chanceEpic: 7, chanceLegendary: 2, chanceMythic: 1, maxRepBonusPercent: 20, maxShardChanceBonus: 5 });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-dashed border-white/10 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-semibold mb-4"
      >
        <FaPlus size={12} /> Neue Kollektion erstellen
      </button>
    );
  }

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
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Bild-URL</label>
          <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-400/30" />
        </div>

        {/* Wahrscheinlichkeiten */}
        <div>
          <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-2">
            Fusion-Wahrscheinlichkeiten ({total}/100)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'chanceCommon', rarity: 'common' as CollectibleRarity },
              { key: 'chanceUncommon', rarity: 'uncommon' as CollectibleRarity },
              { key: 'chanceRare', rarity: 'rare' as CollectibleRarity },
              { key: 'chanceEpic', rarity: 'epic' as CollectibleRarity },
              { key: 'chanceLegendary', rarity: 'legendary' as CollectibleRarity },
              { key: 'chanceMythic', rarity: 'mythic' as CollectibleRarity },
            ] as const).map(({ key, rarity }) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold w-16 ${RARITY_CONFIG[rarity].textColor}`}>{RARITY_CONFIG[rarity].label}</span>
                <input
                  type="number" min={0} max={100}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  className="w-14 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none text-center"
                />
                <span className="text-[10px] text-zinc-600">%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bonuswerte */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Max REP-Bonus %</label>
            <input type="number" min={0} max={100} value={form.maxRepBonusPercent}
              onChange={(e) => setForm({ ...form, maxRepBonusPercent: Number(e.target.value) })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest uppercase text-zinc-600 block mb-1">Shard-Chance Bonus %</label>
            <input type="number" min={0} max={80} value={form.maxShardChanceBonus}
              onChange={(e) => setForm({ ...form, maxShardChanceBonus: Number(e.target.value) })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none" />
          </div>
        </div>

        {total !== 100 && <p className="text-amber-400 text-xs">Summe muss 100 ergeben (aktuell: {total})</p>}
        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || total !== 100 || !form.name.trim()}
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
  const lang = useLang();

  const [view, setView] = useState<'overview' | 'artist'>('overview');
  const [selectedArtist, setSelectedArtist] = useState<CollectibleArtist | null>(null);
  const [artists, setArtists] = useState<CollectibleArtist[]>([]);
  const [artistCollections, setArtistCollections] = useState<CollectionData[]>([]);
  const [myShards, setMyShards] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isArtist, setIsArtist] = useState(false);

  // Überprüfe ob User ein Artist ist
  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/artist?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((d) => setIsArtist(!!d.isArtist))
      .catch(() => {});
  }, [walletAddress]);

  // Alle Künstler mit Kollektionen laden
  const loadArtists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collectibles?all=1');
      const data = await res.json();
      // Einzigartige Künstler extrahieren
      const artistMap = new Map<string, CollectibleArtist>();
      for (const col of (data.collections ?? [])) {
        if (!artistMap.has(col.artistWallet)) {
          artistMap.set(col.artistWallet, {
            artistWallet: col.artistWallet,
            name: col.artistWallet,
            picture: null,
          });
        }
      }
      // Namen + Bilder nachladen
      const artistList = Array.from(artistMap.values());
      const enriched = await Promise.all(artistList.map(async (a) => {
        try {
          const r = await fetch(`/api/admin/artists?wallet=${a.artistWallet}`);
          const d = await r.json();
          const found = d.artists?.[0];
          return found ? { ...a, name: found.name, picture: found.picture } : a;
        } catch { return a; }
      }));
      setArtists(enriched);

      // Eigene Shards laden
      if (walletAddress) {
        const sr = await fetch(`/api/collectibles?wallet=${walletAddress}`);
        const sd = await sr.json();
        const shardMap: Record<string, number> = {};
        for (const s of (sd.shards ?? [])) shardMap[s.artistWallet] = s.count;
        setMyShards(shardMap);
      }
    } catch (_) {}
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { loadArtists(); }, [loadArtists]);

  // Künstler-Kollektionen laden
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

  const handleSelectArtist = (artist: CollectibleArtist) => {
    setSelectedArtist(artist);
    setView('artist');
    loadArtistCollections(artist.artistWallet);
  };

  if (!walletAddress) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-8 text-center">
        <GiCrystalShine className="text-zinc-700 mx-auto mb-3" size={40} />
        <p className="text-zinc-500 text-sm">Bitte einloggen um Collectibles zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 pb-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {view === 'artist' && (
          <button onClick={() => setView('overview')} className="text-zinc-400 hover:text-white">
            <FaChevronLeft size={16} />
          </button>
        )}
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <GiCrystalShine className="text-amber-400" />
            Collectibles
          </h2>
          {view === 'artist' && selectedArtist && (
            <p className="text-xs text-zinc-500">{selectedArtist.name}</p>
          )}
        </div>
      </div>

      {/* Artist-Kollektion erstellen (nur für Artists) */}
      {view === 'artist' && isArtist && selectedArtist?.artistWallet === walletAddress && (
        <CreateCollectionForm
          artistWallet={walletAddress}
          onCreated={() => loadArtistCollections(walletAddress)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-7 h-7 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : view === 'overview' ? (
        <>
          {/* Meine Shards Info */}
          {Object.keys(myShards).length > 0 && (
            <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-3 mb-5">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-amber-400/60 mb-2">Deine Shards</p>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(myShards).map(([artistWallet, count]) => {
                  const artist = artists.find((a) => a.artistWallet === artistWallet);
                  return (
                    <div key={artistWallet} className="flex items-center gap-1.5">
                      <GiCrystalShine className="text-amber-400" size={12} />
                      <span className="text-xs font-bold text-white">{count}</span>
                      <span className="text-xs text-zinc-500">{artist?.name ?? '…'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Künstler-Liste */}
          {artists.length === 0 ? (
            <div className="text-center py-16">
              <GiCrystalShine className="text-zinc-800 mx-auto mb-3" size={48} />
              <p className="text-zinc-600 text-sm">Noch keine Kollektionen verfügbar.</p>
              <p className="text-zinc-700 text-xs mt-1">Schließe Quest-Bundles ab um Shards zu erhalten!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-600">Kollektionen nach Künstler</p>
              {artists.map((artist) => (
                <button
                  key={artist.artistWallet}
                  onClick={() => handleSelectArtist(artist)}
                  className="w-full flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0 flex items-center justify-center bg-zinc-800">
                    {artist.picture
                      ? <Image src={artist.picture} alt={artist.name} width={40} height={40} className="w-full h-full object-cover" />
                      : <FaGem className="text-zinc-600" size={14} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{artist.name}</p>
                    {(myShards[artist.artistWallet] ?? 0) > 0 && (
                      <p className="text-[10px] text-amber-400">
                        <GiCrystalShine className="inline mr-1" size={9} />
                        {myShards[artist.artistWallet]} Shard{myShards[artist.artistWallet] !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-zinc-600 text-xs">›</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Künstler-Detail */
        <>
          {/* Artist kann eigene Kollektion erstellen */}
          {isArtist && selectedArtist?.artistWallet === walletAddress && (
            <CreateCollectionForm
              artistWallet={walletAddress}
              onCreated={() => loadArtistCollections(walletAddress)}
            />
          )}

          {artistCollections.length === 0 ? (
            <div className="text-center py-12">
              <GiCrystalShine className="text-zinc-800 mx-auto mb-3" size={40} />
              <p className="text-zinc-600 text-sm">Noch keine Kollektion verfügbar.</p>
            </div>
          ) : (
            artistCollections.map((data) => (
              <CollectionPanel
                key={data.collection.id}
                data={data}
                walletAddress={walletAddress}
                onRefresh={() => selectedArtist && loadArtistCollections(selectedArtist.artistWallet)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
