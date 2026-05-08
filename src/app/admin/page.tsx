'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FaYoutube, FaInstagram, FaTiktok, FaFacebook,
  FaCheck, FaTimes, FaSearch, FaShieldAlt, FaCoins, FaStar, FaSync,
} from 'react-icons/fa';

interface AdminUser {
  walletAddress: string;
  displayName: string | null;
  isArtist: boolean;
  rewardToken: string | null;
  instagramHandle: string | null;
  instagramVerified: boolean;
  tiktokHandle: string | null;
  tiktokVerified: boolean;
  facebookHandle: string | null;
  facebookVerified: boolean;
  youtubeChannelId: string | null;
  youtubeChannelName: string | null;
  youtubeVerified: boolean;
  credits: number;
  xp: number;
  level: number;
  updatedAt: string;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [inputSecret, setInputSecret] = useState('');
  const [authError, setAuthError] = useState('');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterArtist, setFilterArtist] = useState<'all' | 'artist' | 'fan'>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingRewardToken, setEditingRewardToken] = useState<string | null>(null);
  const [rewardTokenInput, setRewardTokenInput] = useState('');
  const [savingRewardToken, setSavingRewardToken] = useState<string | null>(null);

  // Passwort aus sessionStorage laden
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret');
    if (stored) setSecret(stored);
  }, []);

  const fetchUsers = useCallback(async (s: string) => {
    if (!s) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-admin-secret': s },
      });
      if (res.status === 401) {
        setError('Falsches Passwort');
        setSecret('');
        sessionStorage.removeItem('admin_secret');
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (secret) fetchUsers(secret);
  }, [secret, fetchUsers]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSecret.trim()) return;
    setAuthError('');
    sessionStorage.setItem('admin_secret', inputSecret.trim());
    setSecret(inputSecret.trim());
  };

  const handleToggleArtist = async (walletAddress: string, currentIsArtist: boolean) => {
    setToggling(walletAddress);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ walletAddress, isArtist: !currentIsArtist }),
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) =>
        prev.map((u) =>
          u.walletAddress === walletAddress ? { ...u, isArtist: !currentIsArtist } : u,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setToggling(null);
    }
  };

  const handleSaveRewardToken = async (walletAddress: string) => {
    setSavingRewardToken(walletAddress);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress, rewardToken: rewardTokenInput.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) =>
        prev.map((u) =>
          u.walletAddress === walletAddress ? { ...u, rewardToken: rewardTokenInput.trim() || null } : u,
        ),
      );
      setEditingRewardToken(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSavingRewardToken(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.walletAddress.toLowerCase().includes(q) ||
      (u.displayName ?? '').toLowerCase().includes(q) ||
      (u.youtubeChannelName ?? '').toLowerCase().includes(q) ||
      (u.instagramHandle ?? '').toLowerCase().includes(q) ||
      (u.tiktokHandle ?? '').toLowerCase().includes(q) ||
      (u.facebookHandle ?? '').toLowerCase().includes(q);

    const matchFilter =
      filterArtist === 'all' ||
      (filterArtist === 'artist' && u.isArtist) ||
      (filterArtist === 'fan' && !u.isArtist);

    return matchSearch && matchFilter;
  });

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!secret) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center">
              <FaShieldAlt size={22} className="text-red-400" />
            </div>
            <h1 className="text-white text-xl font-bold">Admin Panel</h1>
            <p className="text-zinc-500 text-sm text-center">Nur für autorisierte Admins</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={inputSecret}
              onChange={(e) => setInputSecret(e.target.value)}
              placeholder="Admin Passwort"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 transition-colors"
              autoFocus
            />
            {authError && <p className="text-red-400 text-xs">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin Panel ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center">
            <FaShieldAlt size={14} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Admin Panel</h1>
            <p className="text-zinc-500 text-xs">{users.length} Accounts geladen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers(secret)}
            disabled={loading}
            className="flex items-center gap-2 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <FaSync size={11} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_secret');
              setSecret('');
              setUsers([]);
            }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl transition-colors text-zinc-400"
          >
            Abmelden
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-800/50 text-red-300 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <FaSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Wallet, Name, Handle suchen…"
            className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'artist', 'fan'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterArtist(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filterArtist === f
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'artist' ? 'Artists' : 'Fans'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-500 text-xs mb-0.5">Gesamt</p>
          <p className="text-white font-bold text-xl">{users.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-500 text-xs mb-0.5">Artists</p>
          <p className="text-red-400 font-bold text-xl">{users.filter((u) => u.isArtist).length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-500 text-xs mb-0.5">Fans</p>
          <p className="text-blue-400 font-bold text-xl">{users.filter((u) => !u.isArtist).length}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-zinc-600 text-center py-12 text-sm">Keine Accounts gefunden</p>
          )}
          {filtered.map((user) => (
            <UserRow
              key={user.walletAddress}
              user={user}
              toggling={toggling === user.walletAddress}
              onToggle={() => handleToggleArtist(user.walletAddress, user.isArtist)}
              editingRewardToken={editingRewardToken === user.walletAddress}
              rewardTokenInput={rewardTokenInput}
              onEditRewardToken={() => { setEditingRewardToken(user.walletAddress); setRewardTokenInput(user.rewardToken ?? 'D.FAITH'); }}
              onRewardTokenInputChange={setRewardTokenInput}
              onSaveRewardToken={() => handleSaveRewardToken(user.walletAddress)}
              onCancelRewardToken={() => setEditingRewardToken(null)}
              savingRewardToken={savingRewardToken === user.walletAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── UserRow ──────────────────────────────────────────────────────────────────

function UserRow({
  user,
  toggling,
  onToggle,
  editingRewardToken,
  rewardTokenInput,
  onEditRewardToken,
  onRewardTokenInputChange,
  onSaveRewardToken,
  onCancelRewardToken,
  savingRewardToken,
}: {
  user: AdminUser;
  toggling: boolean;
  onToggle: () => void;
  editingRewardToken: boolean;
  rewardTokenInput: string;
  onEditRewardToken: () => void;
  onRewardTokenInputChange: (v: string) => void;
  onSaveRewardToken: () => void;
  onCancelRewardToken: () => void;
  savingRewardToken: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyWallet = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const name =
    user.displayName ??
    user.youtubeChannelName ??
    user.instagramHandle ??
    user.tiktokHandle ??
    user.facebookHandle ??
    null;

  return (
    <div
      className={`bg-zinc-900 border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
        user.isArtist ? 'border-red-800/40' : 'border-zinc-800'
      }`}
    >
      {/* Left: role badge + name + wallet */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Role badge */}
        <div
          className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold ${
            user.isArtist
              ? 'bg-red-900/40 text-red-400 border border-red-800/40'
              : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
          }`}
        >
          {user.isArtist ? 'Artist' : 'Fan'}
        </div>

        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {name ?? shortenAddress(user.walletAddress)}
          </p>
          <button
            onClick={copyWallet}
            className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors font-mono"
            title="Kopieren"
          >
            {copied ? '✓ Kopiert' : shortenAddress(user.walletAddress)}
          </button>
        </div>
      </div>

      {/* Middle: platform badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {user.youtubeVerified && (
          <span className="flex items-center gap-1 text-xs bg-red-900/20 text-red-300 px-2 py-0.5 rounded-lg border border-red-800/30">
            <FaYoutube size={10} />
            {user.youtubeChannelName ? user.youtubeChannelName.slice(0, 12) : 'YT'}
          </span>
        )}
        {user.instagramHandle && (
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border ${user.instagramVerified ? 'bg-pink-900/20 text-pink-300 border-pink-800/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
            <FaInstagram size={10} />
            @{user.instagramHandle.slice(0, 12)}
            {user.instagramVerified && <FaCheck size={8} className="text-green-400" />}
          </span>
        )}
        {user.tiktokHandle && (
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border ${user.tiktokVerified ? 'bg-zinc-700/40 text-zinc-300 border-zinc-600' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
            <FaTiktok size={10} />
            @{user.tiktokHandle.slice(0, 12)}
            {user.tiktokVerified && <FaCheck size={8} className="text-green-400" />}
          </span>
        )}
        {user.facebookHandle && (
          <span className="flex items-center gap-1 text-xs bg-blue-900/20 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-800/30">
            <FaFacebook size={10} />
            {user.facebookHandle.slice(0, 12)}
          </span>
        )}
        {!user.youtubeVerified && !user.instagramHandle && !user.tiktokHandle && !user.facebookHandle && (
          <span className="text-zinc-700 text-xs italic">Keine Plattform</span>
        )}
      </div>

      {/* Middle: stats */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <FaCoins size={9} className="text-yellow-500" />
          {user.credits.toFixed(0)}
        </span>
        <span className="flex items-center gap-1">
          <FaStar size={9} className="text-yellow-500" />
          Lvl {user.level}
        </span>
      </div>

      {/* Right: Artist toggle */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            user.isArtist
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
          } disabled:opacity-50`}
        >
          {toggling ? (
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : user.isArtist ? (
            <><FaTimes size={10} /> Artist entfernen</>
          ) : (
            <><FaCheck size={10} /> Als Artist setzen</>
          )}
        </button>
        {user.isArtist && (
          editingRewardToken ? (
            <div className="flex items-center gap-1">
              <input
                value={rewardTokenInput}
                onChange={(e) => onRewardTokenInputChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-600 text-white text-xs rounded-lg px-2 py-1 w-24 outline-none focus:border-yellow-500"
                placeholder="D.FAITH"
                autoFocus
              />
              <button onClick={onSaveRewardToken} disabled={savingRewardToken} className="text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-2 py-1 rounded-lg disabled:opacity-50">
                {savingRewardToken ? '…' : 'OK'}
              </button>
              <button onClick={onCancelRewardToken} className="text-zinc-500 hover:text-white text-xs px-1">✕</button>
            </div>
          ) : (
            <button onClick={onEditRewardToken} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-yellow-400 transition-colors">
              <FaCoins size={9} /> {user.rewardToken ?? 'D.FAITH'}
            </button>
          )
        )}
      </div>
    </div>
  );
}
