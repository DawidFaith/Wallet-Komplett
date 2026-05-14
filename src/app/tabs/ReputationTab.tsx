'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { FaTrophy, FaStar, FaChevronDown, FaChevronUp, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';

interface ReputationEntry {
  artistWallet: string;
  reputation: number;
  level: number;
  levelName: string;
  nextLevelRep: number | null;
  progress: number;
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName: string | null;
  reputation: number;
  level: number;
  levelName: string;
}

interface ReputationLevel {
  levelNumber: number;
  levelName: string;
  minReputation: number;
  prizeDescription: string;
}

interface ArtistProfile {
  walletAddress: string;
  displayName: string | null;
  artistType: string | null;
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, progress)}%` }}
      />
    </div>
  );
}

function ArtistReputationCard({
  entry,
  isArtist,
  walletAddress,
}: {
  entry: ReputationEntry;
  isArtist: boolean;
  walletAddress: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [levels, setLevels] = useState<ReputationLevel[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);

  // Editing state (only for the artist themselves)
  const [editing, setEditing] = useState(false);
  const [editLevels, setEditLevels] = useState<ReputationLevel[]>([]);
  const [saving, setSaving] = useState(false);

  const isOwnArtist = isArtist && walletAddress === entry.artistWallet;

  const loadDetails = useCallback(async () => {
    if (!expanded) return;
    setLoadingLb(true);
    try {
      const [lbRes, lvRes] = await Promise.all([
        fetch(`/api/reputation/leaderboard?artistWallet=${entry.artistWallet}&limit=10`),
        fetch(`/api/reputation/levels?artistWallet=${entry.artistWallet}`),
      ]);
      if (lbRes.ok) setLeaderboard(await lbRes.json());
      if (lvRes.ok) setLevels(await lvRes.json());
    } finally {
      setLoadingLb(false);
    }
  }, [expanded, entry.artistWallet]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  // Load artist display name
  useEffect(() => {
    fetch(`/api/reputation/levels?artistWallet=${entry.artistWallet}`)
      .then(r => r.json())
      .catch(() => null);
  }, [entry.artistWallet]);

  const startEdit = () => {
    setEditLevels(levels.map(l => ({ ...l })));
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/reputation/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: entry.artistWallet, levels: editLevels }),
      });
      if (res.ok) {
        setLevels(editLevels);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const shortenWallet = (w: string) =>
    w.length > 16 ? `${w.slice(0, 8)}…${w.slice(-6)}` : w;

  return (
    <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <FaStar className="text-amber-400" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {shortenWallet(entry.artistWallet)}
          </p>
          <p className="text-amber-400 text-xs font-medium">
            Level {entry.level} – {entry.levelName}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-bold">{entry.reputation.toLocaleString()} REP</p>
          {entry.nextLevelRep && (
            <p className="text-zinc-500 text-xs">
              {entry.nextLevelRep - entry.reputation} bis Level {entry.level + 1}
            </p>
          )}
        </div>
        <div className="ml-2 text-zinc-500 shrink-0">
          {expanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <ProgressBar progress={entry.progress} />
        <div className="flex justify-between mt-1">
          <span className="text-zinc-600 text-[10px]">Level {entry.level}</span>
          <span className="text-zinc-600 text-[10px]">{entry.progress.toFixed(0)}%</span>
          {entry.nextLevelRep ? (
            <span className="text-zinc-600 text-[10px]">Level {entry.level + 1}</span>
          ) : (
            <span className="text-amber-500 text-[10px]">MAX</span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.07] p-4 space-y-5">
          {loadingLb ? (
            <p className="text-zinc-500 text-sm text-center py-4">Lade…</p>
          ) : (
            <>
              {/* Levels & Prizes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Level & Preise</p>
                  {isOwnArtist && !editing && (
                    <button onClick={startEdit} className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1">
                      <FaEdit size={10} /> Bearbeiten
                    </button>
                  )}
                  {editing && (
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1">
                        <FaCheck size={10} /> {saving ? 'Speichern…' : 'Speichern'}
                      </button>
                      <button onClick={() => setEditing(false)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                        <FaTimes size={10} /> Abbrechen
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(editing ? editLevels : levels).map((lvl, idx) => (
                    <div
                      key={lvl.levelNumber}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${
                        entry.level === lvl.levelNumber
                          ? 'bg-amber-500/15 border border-amber-500/30'
                          : 'bg-zinc-800/50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <span className="text-amber-400 text-[10px] font-bold">{lvl.levelNumber}</span>
                      </div>
                      {editing ? (
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            className="bg-zinc-700 text-white rounded px-2 py-1 text-xs"
                            value={editLevels[idx].levelName}
                            onChange={e => {
                              const updated = [...editLevels];
                              updated[idx] = { ...updated[idx], levelName: e.target.value };
                              setEditLevels(updated);
                            }}
                            placeholder="Level-Name"
                          />
                          <input
                            className="bg-zinc-700 text-white rounded px-2 py-1 text-xs"
                            value={editLevels[idx].prizeDescription}
                            onChange={e => {
                              const updated = [...editLevels];
                              updated[idx] = { ...updated[idx], prizeDescription: e.target.value };
                              setEditLevels(updated);
                            }}
                            placeholder="Preis / Beschreibung"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className="text-white font-medium">{lvl.levelName}</span>
                          <span className="text-zinc-500 text-xs ml-2">ab {lvl.minReputation} REP</span>
                          {lvl.prizeDescription && (
                            <p className="text-amber-300/80 text-xs truncate mt-0.5">🎁 {lvl.prizeDescription}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard */}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">
                  Top Fans
                </p>
                {leaderboard.length === 0 ? (
                  <p className="text-zinc-600 text-xs text-center py-3">Noch keine Daten</p>
                ) : (
                  <div className="space-y-1.5">
                    {leaderboard.map(lb => (
                      <div key={lb.walletAddress} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${
                        lb.walletAddress === walletAddress ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-zinc-800/50'
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                          lb.rank === 1 ? 'bg-amber-400 text-black' :
                          lb.rank === 2 ? 'bg-zinc-400 text-black' :
                          lb.rank === 3 ? 'bg-amber-700 text-white' :
                          'bg-zinc-700 text-zinc-300'
                        }`}>
                          {lb.rank === 1 ? '🥇' : lb.rank === 2 ? '🥈' : lb.rank === 3 ? '🥉' : lb.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">
                            {lb.displayName || shortenWallet(lb.walletAddress)}
                            {lb.walletAddress === walletAddress && (
                              <span className="text-amber-400 ml-1 text-[10px]">(Du)</span>
                            )}
                          </p>
                          <p className="text-zinc-500 text-[10px]">{lb.levelName}</p>
                        </div>
                        <span className="text-amber-300 text-xs font-bold shrink-0">
                          {lb.reputation.toLocaleString()} REP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReputationTab() {
  const { user } = useUser();
  const walletAddress = user?.id ?? '';
  const isArtist = !!(user?.publicMetadata as Record<string, unknown> | undefined)?.isArtist;

  const [reputations, setReputations] = useState<ReputationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetch(`/api/reputation?wallet=${walletAddress}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setReputations(Array.isArray(data) ? data : []))
      .catch(() => setReputations([]))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  // Also show own artist entry if the user is an artist
  const ownArtistIncluded = reputations.some(r => r.artistWallet === walletAddress);

  const allEntries: ReputationEntry[] = isArtist && !ownArtistIncluded
    ? [{ artistWallet: walletAddress, reputation: 0, level: 1, levelName: 'Newcomer', nextLevelRep: 100, progress: 0 }, ...reputations]
    : reputations;

  return (
    <div className="flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <FaTrophy className="text-amber-400" size={22} />
          <h1 className="text-xl font-bold">Reputation</h1>
        </div>
        <p className="text-zinc-500 text-sm">Deine Reputation bei Künstlern</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allEntries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <FaStar size={40} className="text-zinc-700 mb-4" />
          <p className="text-zinc-400 font-semibold">Noch keine Reputation</p>
          <p className="text-zinc-600 text-sm mt-2">
            Schließe Quests ab, um Reputation bei Künstlern zu verdienen.
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {allEntries.map(entry => (
            <ArtistReputationCard
              key={entry.artistWallet}
              entry={entry}
              isArtist={isArtist}
              walletAddress={walletAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
