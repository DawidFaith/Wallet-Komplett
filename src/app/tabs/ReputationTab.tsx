'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { FaTrophy, FaStar, FaChevronDown, FaChevronUp, FaEdit, FaCheck, FaTimes, FaUsers, FaMedal } from 'react-icons/fa';

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

const shortenWallet = (w: string) =>
  w.length > 16 ? `${w.slice(0, 8)}\u2026${w.slice(-6)}` : w;

// Supporter: Karte pro Artist
function SupporterArtistCard({
  entry,
  walletAddress,
}: {
  entry: ReputationEntry;
  walletAddress: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [levels, setLevels] = useState<ReputationLevel[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!expanded) return;
    setLoading(true);
    try {
      const [lbRes, lvRes] = await Promise.all([
        fetch(`/api/reputation/leaderboard?artistWallet=${entry.artistWallet}&limit=10`),
        fetch(`/api/reputation/levels?artistWallet=${entry.artistWallet}`),
      ]);
      if (lbRes.ok) setLeaderboard(await lbRes.json());
      if (lvRes.ok) setLevels(await lvRes.json());
    } finally {
      setLoading(false);
    }
  }, [expanded, entry.artistWallet]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  return (
    <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
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
            Level {entry.level} \u2013 {entry.levelName}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-bold">{entry.reputation.toLocaleString()} REP</p>
          {entry.nextLevelRep && (
            <p className="text-zinc-500 text-xs">
              {entry.nextLevelRep - entry.reputation} bis Lv.{entry.level + 1}
            </p>
          )}
        </div>
        <div className="ml-2 text-zinc-500 shrink-0">
          {expanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </div>
      </button>

      <div className="px-4 pb-3">
        <ProgressBar progress={entry.progress} />
        <div className="flex justify-between mt-1">
          <span className="text-zinc-600 text-[10px]">Lv.{entry.level}</span>
          <span className="text-zinc-600 text-[10px]">{entry.progress.toFixed(0)}%</span>
          {entry.nextLevelRep
            ? <span className="text-zinc-600 text-[10px]">Lv.{entry.level + 1}</span>
            : <span className="text-amber-500 text-[10px]">MAX</span>}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.07] p-4 space-y-5">
          {loading ? (
            <p className="text-zinc-500 text-sm text-center py-4">Lade\u2026</p>
          ) : (
            <>
              {levels.length > 0 && (
                <div>
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Level & Rewards</p>
                  <div className="space-y-1.5">
                    {levels.map(lvl => (
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
                        <div className="flex-1 min-w-0">
                          <span className="text-white font-medium">{lvl.levelName}</span>
                          <span className="text-zinc-500 text-xs ml-2">ab {lvl.minReputation} REP</span>
                          {lvl.prizeDescription && (
                            <p className="text-amber-300/80 text-xs truncate mt-0.5">\U0001f381 {lvl.prizeDescription}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Top Fans</p>
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
                          {lb.rank === 1 ? '\U0001f947' : lb.rank === 2 ? '\U0001f948' : lb.rank === 3 ? '\U0001f949' : lb.rank}
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

// Artist: Verwaltungs-Panel
function ArtistPanel({ walletAddress }: { walletAddress: string }) {
  const [levels, setLevels] = useState<ReputationLevel[]>([]);
  const [editLevels, setEditLevels] = useState<ReputationLevel[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeSection, setActiveSection] = useState<'levels' | 'leaderboard'>('levels');

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/reputation/levels?artistWallet=${walletAddress}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/reputation/leaderboard?artistWallet=${walletAddress}&limit=50`).then(r => r.ok ? r.json() : []),
    ]).then(([lvs, lb]) => {
      setLevels(Array.isArray(lvs) ? lvs : []);
      setLeaderboard(Array.isArray(lb) ? lb : []);
    }).finally(() => setLoading(false));
  }, [walletAddress]);

  const startEdit = () => {
    setEditLevels(levels.map(l => ({ ...l })));
    setSaveError('');
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/reputation/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: walletAddress, levels: editLevels }),
      });
      if (res.ok) {
        setLevels(editLevels);
        setEditing(false);
      } else {
        const d = await res.json();
        setSaveError(d.error || 'Fehler beim Speichern');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      <div className="flex bg-zinc-900/60 rounded-xl p-1 border border-white/[0.07]">
        <button
          onClick={() => setActiveSection('levels')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeSection === 'levels' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaMedal size={13} />
          Level & Rewards
        </button>
        <button
          onClick={() => setActiveSection('leaderboard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeSection === 'leaderboard' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaUsers size={13} />
          Leaderboard
          {leaderboard.length > 0 && (
            <span className="bg-white/20 text-xs rounded-full px-1.5 py-0.5 leading-none">
              {leaderboard.length}
            </span>
          )}
        </button>
      </div>

      {activeSection === 'levels' && (
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <p className="text-white font-semibold text-sm">Level-Konfiguration</p>
            {!editing ? (
              <button onClick={startEdit} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors">
                <FaEdit size={11} /> Bearbeiten
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-medium disabled:opacity-50">
                  <FaCheck size={11} /> {saving ? 'Speichern\u2026' : 'Speichern'}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-medium">
                  <FaTimes size={11} /> Abbrechen
                </button>
              </div>
            )}
          </div>
          {saveError && <p className="text-red-400 text-xs px-4 py-2">{saveError}</p>}
          {editing && <p className="text-zinc-500 text-xs px-4 pt-3 pb-1">Passe Level-Namen, Mindest-REP und Rewards an.</p>}
          <div className="p-4 space-y-2">
            {(editing ? editLevels : levels).map((lvl, idx) => (
              <div key={lvl.levelNumber} className="bg-zinc-800/50 rounded-xl overflow-hidden">
                {editing ? (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-amber-500/30 flex items-center justify-center shrink-0">
                        <span className="text-amber-400 text-[10px] font-bold">{lvl.levelNumber}</span>
                      </div>
                      <span className="text-zinc-500 text-xs">Level {lvl.levelNumber}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-zinc-500 text-[10px] mb-0.5 block">Level-Name</label>
                        <input
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          value={editLevels[idx].levelName}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], levelName: e.target.value }; setEditLevels(u); }}
                          placeholder="z.B. Newcomer"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-[10px] mb-0.5 block">Mindest-REP</label>
                        <input
                          type="number" min="0"
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          value={editLevels[idx].minReputation}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], minReputation: Number(e.target.value) }; setEditLevels(u); }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">Reward / Beschreibung</label>
                      <input
                        className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        value={editLevels[idx].prizeDescription}
                        onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], prizeDescription: e.target.value }; setEditLevels(u); }}
                        placeholder="z.B. Exklusiver Discord-Zugang"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-amber-400 text-xs font-bold">{lvl.levelNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">{lvl.levelName}</span>
                        <span className="text-zinc-500 text-xs">ab {lvl.minReputation} REP</span>
                      </div>
                      {lvl.prizeDescription
                        ? <p className="text-amber-300/80 text-xs truncate mt-0.5">\U0001f381 {lvl.prizeDescription}</p>
                        : <p className="text-zinc-600 text-xs mt-0.5 italic">Kein Reward definiert</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'leaderboard' && (
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <p className="text-white font-semibold text-sm">Fan Leaderboard</p>
            <p className="text-zinc-500 text-xs mt-0.5">Top Fans nach Reputation</p>
          </div>
          {leaderboard.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FaUsers size={28} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Noch keine Fans mit Reputation</p>
              <p className="text-zinc-600 text-xs mt-1">Erstelle Quests, damit Fans Reputation verdienen k\u00f6nnen.</p>
            </div>
          ) : (
            <div className="p-4 space-y-1.5">
              {leaderboard.map(lb => (
                <div key={lb.walletAddress} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    lb.rank === 1 ? 'bg-amber-400 text-black' :
                    lb.rank === 2 ? 'bg-zinc-400 text-black' :
                    lb.rank === 3 ? 'bg-amber-700 text-white' :
                    'bg-zinc-700 text-zinc-300'
                  }`}>
                    {lb.rank === 1 ? '\U0001f947' : lb.rank === 2 ? '\U0001f948' : lb.rank === 3 ? '\U0001f949' : lb.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {lb.displayName || shortenWallet(lb.walletAddress)}
                    </p>
                    <p className="text-zinc-500 text-xs">{lb.levelName}</p>
                  </div>
                  <span className="text-amber-300 text-sm font-bold shrink-0">
                    {lb.reputation.toLocaleString()} REP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Tab
export default function ReputationTab() {
  const { user } = useUser();
  const walletAddress = user?.id ?? '';

  const [mode, setMode] = useState<'supporter' | 'artist'>('supporter');
  const [reputations, setReputations] = useState<ReputationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArtist, setIsArtist] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/reputation?wallet=${walletAddress}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([repData, profileData]) => {
        setReputations(Array.isArray(repData) ? repData : []);
        setIsArtist(!!(profileData?.profile?.isArtist));
      })
      .catch(() => setReputations([]))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const supporterEntries = reputations.filter(r => r.artistWallet !== walletAddress);

  return (
    <div className="flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <FaTrophy className="text-amber-400" size={22} />
          <h1 className="text-xl font-bold">Reputation</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          {mode === 'supporter' ? 'Deine Reputation bei K\u00fcnstlern' : 'Dein Reputation-System als K\u00fcnstler'}
        </p>
      </div>

      {isArtist && (
        <div className="px-4 mb-4">
          <div className="flex bg-zinc-900/70 rounded-xl p-1 border border-white/[0.07]">
            <button
              onClick={() => setMode('supporter')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'supporter' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FaStar size={13} />
              Supporter
            </button>
            <button
              onClick={() => setMode('artist')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'artist' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FaTrophy size={13} />
              Artist
            </button>
          </div>
        </div>
      )}

      {mode === 'supporter' && (
        loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : supporterEntries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <FaStar size={40} className="text-zinc-700 mb-4" />
            <p className="text-zinc-400 font-semibold">Noch keine Reputation</p>
            <p className="text-zinc-600 text-sm mt-2">
              Schlie\u00dfe Quests ab, um Reputation bei K\u00fcnstlern zu verdienen.
            </p>
          </div>
        ) : (
          <div className="px-4 space-y-3">
            {supporterEntries.map(entry => (
              <SupporterArtistCard key={entry.artistWallet} entry={entry} walletAddress={walletAddress} />
            ))}
          </div>
        )
      )}

      {mode === 'artist' && isArtist && (
        <ArtistPanel walletAddress={walletAddress} />
      )}
    </div>
  );
}
