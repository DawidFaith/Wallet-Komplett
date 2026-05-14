'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { FaTrophy, FaStar, FaChevronDown, FaChevronUp, FaEdit, FaCheck, FaTimes, FaUsers, FaMedal, FaPlus } from 'react-icons/fa';

interface ReputationEntry {
  artistWallet: string;
  reputation: number;
  level: number;
  levelName: string;
  nextLevelRep: number | null;
  progress: number;
  artistName?: string | null;
  artistPicture?: string | null;
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
  creditReward: number;
  maxRecipients: number;
}

interface ReputationContest {
  id: string;
  artistWallet: string;
  endDate: string;
  distributed: boolean;
  createdAt: string;
  prizes: { rank: number; creditReward: number }[];
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
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 overflow-hidden">
          {entry.artistPicture
            ? <img src={entry.artistPicture} alt="" className="w-10 h-10 object-cover" />
            : <FaStar className="text-amber-400" size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {entry.artistName || shortenWallet(entry.artistWallet)}
          </p>
          <p className="text-amber-400 text-xs font-medium">
            Level {entry.level} – {entry.levelName}
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
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
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
                          {lvl.creditReward > 0 && (
                            <p className="text-amber-300 text-xs mt-0.5">+{lvl.creditReward} D.FAITH Credits</p>
                          )}
                          {lvl.prizeDescription && (
                            <p className="text-amber-300/80 text-xs truncate mt-0.5">🎁 {lvl.prizeDescription}</p>
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

// Artist: Verwaltungs-Panel
const DEFAULT_LEVELS: ReputationLevel[] = [
  { levelNumber:  1, levelName: 'Newcomer',  minReputation: 0,     prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  2, levelName: 'Follower',  minReputation: 50,    prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  3, levelName: 'Fan',       minReputation: 150,   prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  4, levelName: 'Supporter', minReputation: 350,   prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  5, levelName: 'Loyalist',  minReputation: 700,   prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  6, levelName: 'True Fan',  minReputation: 1200,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  7, levelName: 'Advocate',  minReputation: 2000,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  8, levelName: 'VIP',       minReputation: 3500,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber:  9, levelName: 'Elite',     minReputation: 6000,  prizeDescription: '', creditReward: 0, maxRecipients: 0 },
  { levelNumber: 10, levelName: 'Legend',    minReputation: 10000, prizeDescription: '', creditReward: 0, maxRecipients: 0 },
];

function ArtistPanel({ walletAddress }: { walletAddress: string }) {
  const [levels, setLevels] = useState<ReputationLevel[]>([]);
  const [editLevels, setEditLevels] = useState<ReputationLevel[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [contest, setContest] = useState<ReputationContest | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeSection, setActiveSection] = useState<'levels' | 'leaderboard'>('levels');

  // Contest-Formular
  const [showContestForm, setShowContestForm] = useState(false);
  const [contestEndDate, setContestEndDate] = useState('');
  const [contestPrizes, setContestPrizes] = useState([
    { rank: 1, creditReward: 0 },
    { rank: 2, creditReward: 0 },
    { rank: 3, creditReward: 0 },
  ]);
  const [contestSaving, setContestSaving] = useState(false);
  const [contestError, setContestError] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [distributeResult, setDistributeResult] = useState<{ rank: number; walletAddress: string; credited: number }[] | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const [lvs, lb, ct, profile] = await Promise.all([
        fetch(`/api/reputation/levels?artistWallet=${walletAddress}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/reputation/leaderboard?artistWallet=${walletAddress}&limit=50`).then(r => r.ok ? r.json() : []),
        fetch(`/api/reputation/contest?artistWallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/youtube-quests/profile?wallet=${walletAddress}`).then(r => r.ok ? r.json() : null),
      ]);
      setLevels(Array.isArray(lvs) ? lvs : []);
      setLeaderboard(Array.isArray(lb) ? lb : []);
      setContest(ct);
      setCreditBalance(profile?.credits ?? null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadData(); }, [loadData]);

  const startEdit = () => {
    setEditLevels(levels.map(l => ({ ...l })));
    setSaveError('');
    setEditing(true);
  };

  const loadDefaults = () => {
    setEditLevels(DEFAULT_LEVELS.map(l => ({ ...l })));
    setSaveError('');
    setEditing(true);
  };

  const addLevel = () => {
    const maxNum = editLevels.length > 0 ? Math.max(...editLevels.map(l => l.levelNumber)) : 0;
    const maxRep = editLevels.length > 0 ? Math.max(...editLevels.map(l => l.minReputation)) : 0;
    setEditLevels(prev => [...prev, {
      levelNumber: maxNum + 1,
      levelName: `Level ${maxNum + 1}`,
      minReputation: maxRep + 500,
      prizeDescription: '',
      creditReward: 0,
      maxRecipients: 0,
    }]);
  };

  const removeLevel = (idx: number) => {
    if (editLevels.length <= 1) return;
    setEditLevels(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((l, i) => ({ ...l, levelNumber: i + 1 }));
    });
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

  const saveContest = async () => {
    setContestSaving(true);
    setContestError('');
    try {
      const res = await fetch('/api/reputation/contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: walletAddress, endDate: contestEndDate, prizes: contestPrizes }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowContestForm(false);
        await loadData();
      } else {
        setContestError(data.error || 'Fehler beim Speichern');
      }
    } finally {
      setContestSaving(false);
    }
  };

  const distributeContest = async () => {
    if (!contest) return;
    setDistributing(true);
    try {
      const res = await fetch('/api/reputation/contest', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestId: contest.id, artistWallet: walletAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setDistributeResult(data.distributed);
        await loadData();
      }
    } finally {
      setDistributing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const contestExpired = contest && !contest.distributed && new Date(contest.endDate) <= new Date();
  const contestRunning = contest && !contest.distributed && new Date(contest.endDate) > new Date();

  return (
    <div className="px-4 space-y-4">
      {/* Credit-Balance */}
      <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="text-zinc-400 text-sm">Dein Guthaben</span>
            <p className="text-zinc-600 text-xs mt-0.5">Credits werden beim Speichern von Rewards reserviert</p>
          </div>
          <span className="text-amber-300 font-bold text-sm">{creditBalance !== null ? `${creditBalance.toFixed(2)} DFC` : '–'}</span>
        </div>
      </div>
      {/* Sub-Navigation */}
      <div className="flex bg-zinc-900/60 rounded-xl p-1 border border-white/[0.07]">
        <button
          onClick={() => setActiveSection('levels')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeSection === 'levels' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FaMedal size={13} />
          Level &amp; Rewards
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

      {/* ── Level & Rewards ── */}
      {activeSection === 'levels' && (
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <p className="text-white font-semibold text-sm">Level-Konfiguration</p>
            {!editing ? (
              <div className="flex gap-3">
                <button onClick={loadDefaults} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-300 text-xs font-medium transition-colors">
                  Standard (10)
                </button>
                <button onClick={startEdit} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors">
                  <FaEdit size={11} /> Bearbeiten
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-medium disabled:opacity-50">
                  <FaCheck size={11} /> {saving ? 'Speichern…' : 'Speichern'}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-medium">
                  <FaTimes size={11} /> Abbrechen
                </button>
              </div>
            )}
          </div>
          {saveError && <p className="text-red-400 text-xs px-4 py-2">{saveError}</p>}
          {editing && <p className="text-zinc-500 text-xs px-4 pt-3 pb-1">Level-Namen, Mindest-REP, D.FAITH Credits und Rewards anpassen.</p>}
          {!editing && <p className="text-zinc-600 text-xs px-4 pt-3 pb-1 italic">Das sind die voreingestellten Level. Klicke auf &bdquo;Bearbeiten&ldquo; um sie anzupassen.</p>}
          <div className="p-4 space-y-2">
            {(editing ? editLevels : levels).map((lvl, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-xl overflow-hidden">
                {editing ? (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500/30 flex items-center justify-center shrink-0">
                          <span className="text-amber-400 text-[10px] font-bold">{idx + 1}</span>
                        </div>
                        <span className="text-zinc-500 text-xs">Level {idx + 1}</span>
                      </div>
                      {editLevels.length > 1 && (
                        <button onClick={() => removeLevel(idx)} className="text-red-500 hover:text-red-400 p-1">
                          <FaTimes size={10} />
                        </button>
                      )}
                    </div>
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
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">D.FAITH Credits bei Level-Up</label>
                      <div className="relative">
                        <input
                          type="number" min="0"
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 pr-14"
                          value={editLevels[idx].creditReward}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], creditReward: Number(e.target.value) }; setEditLevels(u); }}
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">DFC</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">Wie viele Fans erhalten diesen Reward?</label>
                      <div className="relative">
                        <input
                          type="number" min="0"
                          className="w-full bg-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 pr-14"
                          value={editLevels[idx].maxRecipients}
                          onChange={e => { const u = [...editLevels]; u[idx] = { ...u[idx], maxRecipients: Number(e.target.value) }; setEditLevels(u); }}
                          placeholder="0 = kein Reward"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">Fans</span>
                      </div>
                      {editLevels[idx].creditReward > 0 && editLevels[idx].maxRecipients > 0 && (
                        <p className="text-amber-400 text-[10px] mt-1">
                          Kosten: {editLevels[idx].creditReward * editLevels[idx].maxRecipients} DFC (wird beim Speichern abgezogen)
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] mb-0.5 block">Reward-Beschreibung</label>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{lvl.levelName}</span>
                        <span className="text-zinc-500 text-xs">ab {lvl.minReputation} REP</span>
                        {lvl.creditReward > 0 && lvl.maxRecipients > 0 && (
                          <span className="text-amber-300 text-xs font-semibold">+{lvl.creditReward} DFC × {lvl.maxRecipients} Fans</span>
                        )}
                      </div>
                      {lvl.prizeDescription
                        ? <p className="text-amber-300/80 text-xs truncate mt-0.5">🎁 {lvl.prizeDescription}</p>
                        : <p className="text-zinc-600 text-xs mt-0.5 italic">Kein Reward definiert</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {editing && (
              <button
                onClick={addLevel}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-amber-500/40 text-amber-400 hover:border-amber-400 hover:bg-amber-500/5 text-xs font-medium transition-colors"
              >
                <FaPlus size={10} /> Level hinzufügen
              </button>
            )}
            {editing && (() => {
              const totalCost = editLevels.reduce((sum, l) => sum + (l.creditReward || 0) * (l.maxRecipients || 0), 0);
              const enough = creditBalance !== null && totalCost <= creditBalance;
              const unknown = creditBalance === null;
              if (totalCost === 0) return null;
              return (
                <div className={`mt-2 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs ${
                  unknown ? 'bg-zinc-800/60 border border-zinc-700/40' :
                  enough  ? 'bg-green-950/40 border border-green-700/30' :
                            'bg-red-950/40 border border-red-700/40'
                }`}>
                  <div>
                    <p className="text-zinc-300 font-semibold">Gesamtkosten aller Rewards</p>
                    <p className="text-zinc-500 mt-0.5">Dein Guthaben: {creditBalance !== null ? `${creditBalance.toFixed(2)} DFC` : '–'}</p>
                    <p className="text-zinc-600 text-[10px] mt-0.5">(Differenz zu bisherigen Levels wird abgezogen/erstattet)</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${enough ? 'text-green-400' : unknown ? 'text-zinc-300' : 'text-red-400'}`}>
                      {totalCost} DFC
                    </p>
                    <p className={`text-[10px] mt-0.5 ${enough ? 'text-green-500' : unknown ? 'text-zinc-500' : 'text-red-500'}`}>
                      {unknown ? 'Guthaben unbekannt' : enough ? '✓ Ausreichend' : '⚠ Nicht ausreichend'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Leaderboard + Contest ── */}
      {activeSection === 'leaderboard' && (
        <div className="space-y-4">
          {/* Contest-Panel */}
          <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
              <div>
                <p className="text-white font-semibold text-sm">Leaderboard Contest</p>
                <p className="text-zinc-500 text-xs mt-0.5">Belohnungen für die besten Fans</p>
              </div>
              {!contest && !showContestForm && (
                <button
                  onClick={() => setShowContestForm(true)}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium"
                >
                  <FaPlus size={10} /> Contest erstellen
                </button>
              )}
            </div>

            {/* Aktiver Contest */}
            {contest && !showContestForm && (
              <div className="p-4 space-y-3">
                <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                  contest.distributed ? 'bg-zinc-800/40' : contestExpired ? 'bg-amber-950/30 border border-amber-700/30' : 'bg-green-950/30 border border-green-700/30'
                }`}>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {contest.distributed ? '✅ Verteilt' : contestExpired ? '⏰ Abgelaufen – bereit zum Verteilen' : '🟢 Läuft'}
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Ende: {new Date(contest.endDate).toLocaleString('de-DE')}
                    </p>
                  </div>
                  {contestExpired && (
                    <button
                      onClick={distributeContest}
                      disabled={distributing}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {distributing ? '…' : '🎁 Verteilen'}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {contest.prizes.map(p => (
                    <div key={p.rank} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                      <span className="text-zinc-300 text-xs">
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`} Platz
                      </span>
                      <span className="text-amber-300 text-xs font-bold">{p.creditReward} DFC</span>
                    </div>
                  ))}
                </div>
                {distributeResult && (
                  <div className="bg-green-950/30 border border-green-700/30 rounded-xl p-3 space-y-1">
                    <p className="text-green-400 text-xs font-semibold mb-1">Verteilt!</p>
                    {distributeResult.map(r => (
                      <p key={r.rank} className="text-zinc-300 text-xs">
                        #{r.rank}: {shortenWallet(r.walletAddress)} → {r.credited} DFC
                      </p>
                    ))}
                  </div>
                )}
                {!contest.distributed && (
                  <button
                    onClick={() => { setShowContestForm(true); setContestError(''); }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                  >
                    Contest ersetzen
                  </button>
                )}
              </div>
            )}

            {/* Contest-Formular */}
            {showContestForm && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Enddatum &amp; Uhrzeit</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={contestEndDate}
                    onChange={e => setContestEndDate(e.target.value)}
                  />
                </div>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">Preise pro Platz</p>
                {contestPrizes.map((p, i) => (
                  <div key={p.rank} className="flex items-center gap-3">
                    <span className="text-zinc-300 text-sm w-8 shrink-0">
                      {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="number" min="0"
                        placeholder="0 DFC"
                        className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-xs border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-amber-500 pr-14"
                        value={contestPrizes[i].creditReward || ''}
                        onChange={e => {
                          const u = [...contestPrizes];
                          u[i] = { ...u[i], creditReward: Number(e.target.value) || 0 };
                          setContestPrizes(u);
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px]">DFC</span>
                    </div>
                    {contestPrizes.length > 1 && (
                      <button
                        onClick={() => setContestPrizes(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))}
                        className="text-red-500 hover:text-red-400 shrink-0"
                      >
                        <FaTimes size={11} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setContestPrizes(prev => [...prev, { rank: prev.length + 1, creditReward: 0 }])}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs"
                >
                  <FaPlus size={9} /> Weiteren Platz hinzufügen
                </button>
                {contestError && <p className="text-red-400 text-xs">{contestError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveContest}
                    disabled={contestSaving || !contestEndDate}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold py-2.5 rounded-xl transition-colors"
                  >
                    {contestSaving ? 'Speichern…' : 'Contest starten'}
                  </button>
                  <button
                    onClick={() => setShowContestForm(false)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs px-3"
                  >
                    <FaTimes size={11} />
                  </button>
                </div>
              </div>
            )}

            {!contest && !showContestForm && (
              <div className="px-4 py-6 text-center">
                <p className="text-zinc-500 text-sm">Noch kein aktiver Contest</p>
                <p className="text-zinc-600 text-xs mt-1">Starte einen Contest mit Preisen für deine Top-Fans.</p>
              </div>
            )}
          </div>

          {/* Fan-Leaderboard */}
          <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <p className="text-white font-semibold text-sm">Fan Leaderboard</p>
              <p className="text-zinc-500 text-xs mt-0.5">Top Fans nach Reputation</p>
            </div>
            {leaderboard.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <FaUsers size={28} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">Noch keine Fans mit Reputation</p>
                <p className="text-zinc-600 text-xs mt-1">Erstelle Quests, damit Fans Reputation verdienen können.</p>
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
                      {lb.rank === 1 ? '🥇' : lb.rank === 2 ? '🥈' : lb.rank === 3 ? '🥉' : lb.rank}
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
      fetch(`/api/reputation?wallet=${walletAddress}&all=true`).then(r => r.ok ? r.json() : []),
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
    <div className="w-full flex flex-col min-h-screen bg-[#0e0c0a] text-white pb-24">
      <div className="max-w-2xl mx-auto w-full">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <FaTrophy className="text-amber-400" size={22} />
          <h1 className="text-xl font-bold">Reputation</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          {mode === 'supporter' ? 'Deine Reputation bei Künstlern' : 'Dein Reputation-System als Künstler'}
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
            <p className="text-zinc-400 font-semibold">Keine Künstler gefunden</p>
            <p className="text-zinc-600 text-sm mt-2">
              Noch sind keine Künstler registriert.
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
    </div>
  );
}
