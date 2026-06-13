'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  FaYoutube, FaInstagram, FaTiktok, FaFacebook,
  FaCheck, FaTimes, FaSearch, FaShieldAlt, FaCoins, FaStar, FaSync, FaPaperPlane,
  FaShoppingBag, FaEdit,
} from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';
import { GiCrystalShine } from 'react-icons/gi';

interface AdminUser {
  walletAddress: string;
  displayName: string | null;
  isArtist: boolean;
  rewardToken: string | null;
  tokenMintAddress: string | null;
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
  solanaAddress: string | null;
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingRewardToken, setEditingRewardToken] = useState<string | null>(null);
  const [rewardTokenInput, setRewardTokenInput] = useState('');
  const [savingRewardToken, setSavingRewardToken] = useState<string | null>(null);
  const [editingTokenMint, setEditingTokenMint] = useState<string | null>(null);
  const [tokenMintInput, setTokenMintInput] = useState('');
  const [savingTokenMint, setSavingTokenMint] = useState<string | null>(null);
  const [editingSolana, setEditingSolana] = useState<string | null>(null);
  const [solanaInput, setSolanaInput] = useState('');
  const [savingSolana, setSavingSolana] = useState<string | null>(null);

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
    const newName = rewardTokenInput.trim();
    const user = users.find(u => u.walletAddress === walletAddress);
    // Wenn custom Name (≠ D.FAITH / leer), muss Token-Mint-Adresse gesetzt sein
    if (newName && newName !== 'D.FAITH' && !user?.tokenMintAddress && !tokenMintInput.trim()) {
      setError('Token-Mint-Adresse muss gleichzeitig gesetzt sein (grünes Feld).');
      return;
    }
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

  const handleSaveTokenMint = async (walletAddress: string) => {
    const newMint = tokenMintInput.trim();
    const user = users.find(u => u.walletAddress === walletAddress);
    // Wenn Mint gesetzt, muss auch ein custom Token-Name gesetzt sein
    if (newMint && (!user?.rewardToken || user.rewardToken === 'D.FAITH') && !rewardTokenInput.trim()) {
      setError('Token-Name (gelbes Feld) muss gleichzeitig gesetzt sein.');
      return;
    }
    setSavingTokenMint(walletAddress);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress, tokenMintAddress: tokenMintInput.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) =>
        prev.map((u) =>
          u.walletAddress === walletAddress ? { ...u, tokenMintAddress: tokenMintInput.trim() || null } : u,
        ),
      );
      setEditingTokenMint(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSavingTokenMint(null);
    }
  };

  const handleDeleteUser = async (walletAddress: string) => {
    if (!confirm(`Account unwiderruflich löschen?\n\n${walletAddress}\n\nDies löscht Profil, Solana-Wallet, Reputation und Referrals.`)) return;
    setDeleting(walletAddress);
    try {
      const res = await fetch(`/api/admin/users?walletAddress=${encodeURIComponent(walletAddress)}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': secret },
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers(prev => prev.filter(u => u.walletAddress !== walletAddress));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen');
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveSolana = async (walletAddress: string) => {
    setSavingSolana(walletAddress);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress, solanaAddress: solanaInput.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) =>
        prev.map((u) =>
          u.walletAddress === walletAddress ? { ...u, solanaAddress: solanaInput.trim() || null } : u,
        ),
      );
      setEditingSolana(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSavingSolana(null);
    }
  };

  const fetchTesters = useCallback(async (_s: string) => {
    // Instagram-Tester-System entfernt
  }, []);
  useEffect(() => { if (secret) fetchTesters(secret); }, [secret, fetchTesters]);

  const handleToggleStoryQuest = async (_handle: string, _isApproved: boolean) => {
    // Tester-System entfernt
  };

  const handleToggleInviteAccepted = async (_handle: string, _currentlyAccepted: boolean) => {
    // Tester-System entfernt
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

  const [activeTab, setActiveTab] = useState<'users' | 'token' | 'credits' | 'shop' | 'platform' | 'collectibles' | 'referral'>('users');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState('');
  const [resetting, setResetting] = useState(false);
  const [repResetArtist, setRepResetArtist] = useState('');
  const [repResetting, setRepResetting] = useState(false);
  const [repResetMsg, setRepResetMsg] = useState('');

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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-0">
        {(['users', 'credits', 'token', 'shop', 'platform', 'collectibles', 'referral'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-red-500 bg-zinc-900'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab === 'users' ? 'Benutzer' : tab === 'credits' ? 'Credits' : tab === 'token' ? 'Token' : tab === 'shop' ? 'Shop' : tab === 'platform' ? '⚡ Platform' : tab === 'collectibles' ? '💎 Collectibles' : '🔗 Referral'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-800/50 text-red-300 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Benutzer Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <>
          {/* Backfill Banner */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex-1 text-xs text-zinc-400">
              {backfillMsg || 'Fehlende user_profiles aus solana_accounts nachfüllen (einmalig ausführen)'}
            </div>
            <button
              onClick={async () => {
                setBackfilling(true);
                setBackfillMsg('');
                try {
                  const res = await fetch('/api/admin/migrate', {
                    method: 'POST',
                    headers: { 'x-admin-secret': secret },
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setBackfillMsg(data.message);
                  fetchUsers(secret);
                } catch (e) {
                  setBackfillMsg(e instanceof Error ? e.message : 'Fehler');
                } finally {
                  setBackfilling(false);
                }
              }}
              disabled={backfilling}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-50 transition-colors"
            >
              {backfilling ? '…' : 'Backfill'}
            </button>
            <button
              onClick={async () => {
                if (!confirm('ALLE Daten unwiderruflich löschen?')) return;
                setResetting(true);
                setBackfillMsg('');
                try {
                  const res = await fetch('/api/admin/reset', {
                    method: 'POST',
                    headers: { 'x-admin-secret': secret },
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setBackfillMsg(data.message);
                  setUsers([]);
                } catch (e) {
                  setBackfillMsg(e instanceof Error ? e.message : 'Fehler');
                } finally {
                  setResetting(false);
                }
              }}
              disabled={resetting}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/60 hover:bg-red-800 text-red-300 disabled:opacity-50 transition-colors border border-red-800/40"
            >
              {resetting ? '…' : 'Full Reset'}
            </button>
          </div>

          {/* Reputation Reset */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 mb-2">Reputation eines Künstlers bei allen Fans auf 0 zurücksetzen</p>
              <select
                value={repResetArtist}
                onChange={(e) => { setRepResetArtist(e.target.value); setRepResetMsg(''); }}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-xs outline-none focus:border-red-500 transition-colors"
              >
                <option value="">— Künstler auswählen —</option>
                {users.filter(u => u.isArtist).map(u => (
                  <option key={u.walletAddress} value={u.walletAddress}>
                    {u.displayName || u.walletAddress.slice(0, 10) + '…'}
                  </option>
                ))}
              </select>
              {repResetMsg && <p className="text-xs mt-1.5 text-amber-400">{repResetMsg}</p>}
            </div>
            <button
              onClick={async () => {
                if (!repResetArtist) return;
                const artist = users.find(u => u.walletAddress === repResetArtist);
                if (!confirm(`Reputation von ALLEN Fans bei "${artist?.displayName || repResetArtist}" auf 0 zurücksetzen?`)) return;
                setRepResetting(true);
                setRepResetMsg('');
                try {
                  const res = await fetch('/api/admin/reset-reputation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                    body: JSON.stringify({ artistWallet: repResetArtist }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setRepResetMsg(`✓ ${data.deleted} Einträge gelöscht`);
                  setRepResetArtist('');
                } catch (e) {
                  setRepResetMsg(e instanceof Error ? e.message : 'Fehler');
                } finally {
                  setRepResetting(false);
                }
              }}
              disabled={repResetting || !repResetArtist}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-900/60 hover:bg-orange-800 text-orange-300 disabled:opacity-40 transition-colors border border-orange-800/40"
            >
              {repResetting ? '…' : 'Reputation Reset'}
            </button>
          </div>

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
                  {f === 'all' ? 'Alle' : f === 'artist' ? 'Künstler' : 'Fans'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-zinc-500 text-xs mb-0.5">Gesamt</p>
              <p className="text-white font-bold text-xl">{users.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-zinc-500 text-xs mb-0.5">Künstler</p>
              <p className="text-red-400 font-bold text-xl">{users.filter((u) => u.isArtist).length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-zinc-500 text-xs mb-0.5">Fans</p>
              <p className="text-blue-400 font-bold text-xl">{users.filter((u) => !u.isArtist).length}</p>
            </div>
          </div>
          {/* Plattform-Nutzer */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: 'YouTube', icon: <FaYoutube size={11} className="text-red-400" />, count: users.filter(u => u.youtubeChannelId).length },
              { label: 'Instagram', icon: <FaInstagram size={11} className="text-pink-400" />, count: users.filter(u => u.instagramVerified).length },
              { label: 'TikTok', icon: <FaTiktok size={11} className="text-cyan-400" />, count: users.filter(u => u.tiktokVerified).length },
              { label: 'Facebook', icon: <FaFacebook size={11} className="text-blue-500" />, count: users.filter(u => u.facebookVerified).length },
            ].map(({ label, icon, count }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
                {icon}
                <div>
                  <p className="text-white font-bold text-sm leading-none">{count}</p>
                  <p className="text-zinc-600 text-[10px] mt-0.5">{label}</p>
                </div>
              </div>
            ))}
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
                  editingTokenMint={editingTokenMint === user.walletAddress}
                  tokenMintInput={tokenMintInput}
                  onEditTokenMint={() => { setEditingTokenMint(user.walletAddress); setTokenMintInput(user.tokenMintAddress ?? ''); }}
                  onTokenMintInputChange={setTokenMintInput}
                  onSaveTokenMint={() => handleSaveTokenMint(user.walletAddress)}
                  onCancelTokenMint={() => setEditingTokenMint(null)}
                  savingTokenMint={savingTokenMint === user.walletAddress}
                  editingSolana={editingSolana === user.walletAddress}
                  solanaInput={solanaInput}
                  onEditSolana={() => { setEditingSolana(user.walletAddress); setSolanaInput(user.solanaAddress ?? ''); }}
                  onSolanaInputChange={setSolanaInput}
                  onSaveSolana={() => handleSaveSolana(user.walletAddress)}
                  onCancelSolana={() => setEditingSolana(null)}
                  savingSolana={savingSolana === user.walletAddress}
                  isStoryQuestTester={false}
                  isInviteAccepted={false}
                  togglingStoryQuest={false}
                  onToggleStoryQuest={() => {}}
                  onToggleInviteAccepted={() => {}}
                  deleting={deleting === user.walletAddress}
                  onDelete={() => handleDeleteUser(user.walletAddress)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Credits Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'credits' && (
        <GrantCreditsSection secret={secret} users={users} />
      )}

      {/* ── Token Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'token' && (
        <>
          <SolanaTreasurySection secret={secret} />
          <SolanaMintSection secret={secret} />
          <SolanaUpdateMetadataSection secret={secret} />
          <SolanaDisableMintingSection secret={secret} />
          <SolanaDBMigrationSection secret={secret} />
        </>
      )}

      {/* ── Shop Tab ──────────────────────────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <ShopManageSection secret={secret} artists={users.filter(u => u.isArtist)} />
      )}

      {/* ── Platform Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'platform' && (
        <PlatformSection secret={secret} />
      )}

      {/* ── Collectibles Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'collectibles' && (
        <CollectiblesAdminSection secret={secret} users={users} />
      )}

      {/* ── Referral Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'referral' && (
        <ReferralSection secret={secret} users={users} />
      )}
    </div>
  );
}

// ─── SolanaTreasurySection ────────────────────────────────────────────────────

function SolanaTreasurySection({ secret }: { secret: string }) {
  const [address, setAddress]   = useState('');
  const [sol, setSol]           = useState<number | null>(null);
  const [dfaith, setDfaith]     = useState<number | null>(null);
  const [loading, setLoading]   = useState(false);
  const [sendTo, setSendTo]     = useState('');
  const [sendAmt, setSendAmt]   = useState('');
  const [sending, setSending]   = useState(false);
  const [sendOk, setSendOk]     = useState('');
  const [sendErr, setSendErr]   = useState('');

  const loadBalance = useCallback(async () => {
    setLoading(true); setSendOk(''); setSendErr('');
    try {
      const res = await fetch(`/api/admin/solana-balance?secret=${encodeURIComponent(secret)}`);
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAddress(d.address ?? '');
      setSol(d.solBalance ?? null);
      setDfaith(d.dfaithBalance ?? null);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!sendTo.trim()) { setSendErr('Ziel-Adresse eingeben'); return; }
    const amt = parseFloat(sendAmt);
    if (!isFinite(amt) || amt <= 0) { setSendErr('Ungültiger Betrag'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/admin/solana-send-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, toAddress: sendTo.trim(), amount: amt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSendOk(`✓ D.FAITH gesendet! TX: ${d.signature}`);
      setSendTo(''); setSendAmt('');
      setTimeout(loadBalance, 4000);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-8 bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-900/30 border border-purple-800/50 flex items-center justify-center">
            <SiSolana size={16} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Solana Treasury Wallet</h2>
            <p className="text-zinc-500 text-xs font-mono break-all">{address || '—'}</p>
          </div>
        </div>
        <button onClick={loadBalance} disabled={loading}
          className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40">
          <FaSync size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-500 text-xs mb-1">SOL</p>
          <p className="text-white text-2xl font-bold">{loading ? '…' : sol !== null ? sol.toFixed(4) : '—'}</p>
        </div>
        <div className="bg-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-500 text-xs mb-1">D.FAITH</p>
          <p className="text-white text-2xl font-bold">{loading ? '…' : dfaith !== null ? dfaith.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FaPaperPlane size={11} className="text-zinc-400" />
          <h3 className="text-white text-sm font-semibold">D.FAITH senden (vom Treasury)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="Empfänger Solana-Adresse"
            className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-purple-500 w-full" />
          <div className="flex gap-2">
            <input type="number" step="any" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
              placeholder="Betrag D.FAITH"
              className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500 flex-1 min-w-0" />
            {dfaith !== null && (
              <button onClick={() => setSendAmt(String(dfaith))}
                className="text-zinc-400 hover:text-white text-xs px-2 shrink-0">MAX</button>
            )}
          </div>
        </div>
        {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
        {sendOk  && <p className="text-green-400 text-xs break-all">{sendOk}</p>}
        <button onClick={handleSend} disabled={sending || !sendTo.trim() || !sendAmt.trim()}
          className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
          {sending
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Wird gesendet…</>
            : <><FaPaperPlane size={11}/> D.FAITH senden</>}
        </button>
      </div>
    </div>
  );
}

// ─── SolanaMintSection ────────────────────────────────────────────────────────

function SolanaMintSection({ secret }: { secret: string }) {
  const [name, setName]               = useState('D.FAITH');
  const [symbol, setSymbol]           = useState('DFAITH');
  const [totalSupply, setTotalSupply] = useState('1000000000');
  const [decimals, setDecimals]       = useState('6');
  const [description, setDescription] = useState('The official D.FAITH fan token by Dawid Faith');
  const [website, setWebsite]         = useState('');
  const [twitter, setTwitter]         = useState('');
  const [instagram, setInstagram]     = useState('');
  const [youtube, setYoutube]         = useState('');
  const [telegram, setTelegram]       = useState('');
  const [discord, setDiscord]         = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [imagePreview, setImagePreview]   = useState('');
  const [disableMinting, setDisableMinting] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<{ mintAddress: string; explorerUrl: string; metadataUri?: string; mintingDisabled?: boolean } | null>(null);
  const [error, setError]             = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1] ?? '');
    };
    reader.readAsDataURL(file);
  };

  const handleMint = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/admin/solana-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          name: name.trim(),
          symbol: symbol.trim(),
          totalSupply: parseInt(totalSupply),
          decimals: parseInt(decimals),
          description: description.trim(),
          imageBase64: imageBase64 || undefined,
          imageMimeType,
          website:   website.trim()   || undefined,
          twitter:   twitter.trim()   || undefined,
          instagram: instagram.trim() || undefined,
          youtube:   youtube.trim()   || undefined,
          telegram:  telegram.trim()  || undefined,
          discord:   discord.trim()   || undefined,
          disableMinting,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-purple-900/30 border border-purple-800/50 flex items-center justify-center">
          <SiSolana size={16} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">SPL Token Minten (Solana)</h2>
          <p className="text-zinc-500 text-xs">Erstellt einen neuen SPL Token auf Solana Mainnet</p>
        </div>
      </div>

      {result ? (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 space-y-2">
          <p className="text-green-400 font-semibold text-sm">✓ Token erfolgreich erstellt!</p>
          {result.mintingDisabled && (
            <p className="text-orange-400 text-xs font-semibold">🔒 Minting wurde permanent deaktiviert — keine weiteren Token können erstellt werden.</p>
          )}
          <div>
            <p className="text-zinc-400 text-xs">Mint-Adresse (in .env.local eintragen):</p>
            <code className="text-yellow-300 text-sm font-mono break-all">{result.mintAddress}</code>
          </div>
          <p className="text-zinc-500 text-xs">→ <code className="text-zinc-300">NEXT_PUBLIC_SOLANA_DFAITH_TOKEN={result.mintAddress}</code></p>
          {result.metadataUri && (
            <p className="text-zinc-500 text-xs">Metadata: <code className="text-zinc-300 break-all">{result.metadataUri}</code></p>
          )}
          <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 text-xs underline block mt-1">
            Solscan Explorer öffnen →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Token Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Symbol</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Total Supply</label>
            <input type="number" value={totalSupply} onChange={e => setTotalSupply(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
            <p className="text-zinc-600 text-xs mt-0.5">{parseInt(totalSupply || '0').toLocaleString()} Token</p>
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Decimals</label>
            <input type="number" min="0" max="9" value={decimals} onChange={e => setDecimals(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
            <p className="text-zinc-600 text-xs mt-0.5">Standard: 6 (wie USDC)</p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Beschreibung</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="The official D.FAITH fan token by Dawid Faith"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Token-Bild (wird auf Pinata IPFS hochgeladen)</label>
            <div className="flex items-center gap-3">
              {imagePreview && (
                <Image src={imagePreview} alt="Vorschau" width={56} height={56} className="w-14 h-14 rounded-xl object-cover border border-zinc-700 shrink-0" unoptimized />
              )}
              <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 border-dashed hover:border-purple-500 text-zinc-400 hover:text-purple-300 rounded-xl px-4 py-3 text-sm text-center transition-colors">
                {imagePreview ? 'Anderes Bild wählen' : 'Bild auswählen (PNG, JPG, SVG)'}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {imagePreview && (
                <button onClick={() => { setImagePreview(''); setImageBase64(''); }}
                  className="text-zinc-500 hover:text-red-400 text-xs px-2 shrink-0">✕</button>
              )}
            </div>
            {imageBase64 && <p className="text-zinc-600 text-xs mt-1">Bild + Metaplex JSON werden beim Mint auf Pinata IPFS hochgeladen</p>}
          </div>
          {/* Social Links */}
          <div className="sm:col-span-2 border-t border-zinc-800 pt-3">
            <p className="text-zinc-500 text-xs mb-2">Social Links (optional — erscheinen in Phantom &amp; Explorern)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[{label:'Website', val:website, set:setWebsite, ph:'https://dawidfaith.de'},
                {label:'Twitter / X', val:twitter, set:setTwitter, ph:'https://twitter.com/dawidfaith'},
                {label:'Instagram', val:instagram, set:setInstagram, ph:'https://instagram.com/dawidfaith'},
                {label:'YouTube', val:youtube, set:setYoutube, ph:'https://youtube.com/@dawidfaith'},
                {label:'Telegram', val:telegram, set:setTelegram, ph:'https://t.me/dawidfaith'},
                {label:'Discord', val:discord, set:setDiscord, ph:'https://discord.gg/...'},
              ].map(({label, val, set, ph}) => (
                <div key={label}>
                  <label className="text-zinc-500 text-xs block mb-0.5">{label}</label>
                  <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:border-purple-500" />
                </div>
              ))}
            </div>
          </div>
          {/* Minting deaktivieren */}
          <div className="sm:col-span-2 border-t border-zinc-800 pt-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={disableMinting}
                onChange={e => setDisableMinting(e.target.checked)}
                className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
              />
              <span className="text-sm">
                <span className="text-red-400 font-semibold">Minting nach Erstellung permanent deaktivieren</span>
                <span className="block text-zinc-500 text-xs mt-0.5">Unwiderruflich! Nach dem Aktivieren können keine weiteren Token mehr erzeugt werden. Die Mint Authority wird auf null gesetzt.</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-red-300 text-sm break-all">{error}</div>
      )}

      {!result && (
        <button onClick={handleMint} disabled={loading || !name.trim() || !symbol.trim()}
          className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{imageBase64 ? 'IPFS + Token wird erstellt…' : 'Token wird erstellt…'}</>
            : <><SiSolana size={14} /> D.FAITH Token auf Solana erstellen</>}
        </button>
      )}
      {result && (
        <button onClick={() => setResult(null)}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-xl text-sm">
          Neuen Token erstellen
        </button>
      )}
    </div>
  );
}

// ─── SolanaDisableMintingSection ──────────────────────────────────────────────

function SolanaDisableMintingSection({ secret }: { secret: string }) {
  const [mintAddress, setMintAddress] = useState(process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleDisable = async () => {
    if (!mintAddress.trim()) return;
    setLoading(true); setError(''); setSuccess(false);
    try {
      const res = await fetch('/api/admin/solana-update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, mintAddress: mintAddress.trim(), disableMinting: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-zinc-900 border border-red-900/40 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center">
          <span className="text-red-400 text-base">🔒</span>
        </div>
        <div>
          <h2 className="text-white font-bold text-sm">Minting permanent deaktivieren</h2>
          <p className="text-red-400/70 text-xs">Unwiderruflich — danach können keine weiteren Token erzeugt werden</p>
        </div>
      </div>

      {success ? (
        <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl px-4 py-3 text-orange-300 text-sm font-semibold">
          🔒 Minting erfolgreich deaktiviert. Die Mint Authority ist jetzt null.
        </div>
      ) : (
        <>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Token Mint-Adresse</label>
            <input
              value={mintAddress}
              onChange={e => setMintAddress(e.target.value)}
              placeholder="z.B. 9jB95PZQ2eYs83upTpDv7gqMvuMVtB55QRATZajnmki6"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-red-500"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={() => {
              if (!confirm('Minting wirklich PERMANENT deaktivieren? Das kann nicht rückgängig gemacht werden!')) return;
              handleDisable();
            }}
            disabled={loading || !mintAddress.trim()}
            className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
          >
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird deaktiviert…</>
              : '🔒 Minting jetzt permanent deaktivieren'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── SolanaDBMigrationSection ─────────────────────────────────────────────────

function SolanaDBMigrationSection({ secret }: { secret: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState('');
  const [error, setError]     = useState('');

  const handleMigrate = async () => {
    setLoading(true); setResult(''); setError('');
    try {
      const res = await fetch('/api/admin/migrate-solana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResult(d.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-zinc-900 border border-zinc-700/50 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center">
          <SiSolana size={14} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-sm">Solana DB Migration</h2>
          <p className="text-zinc-500 text-xs">solana_accounts Tabelle anlegen (einmalig)</p>
        </div>
      </div>
      {result && <p className="text-green-400 text-xs">{result}</p>}
      {error  && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={handleMigrate} disabled={loading}
        className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
        {loading
          ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Migration läuft…</>
          : 'solana_accounts Tabelle erstellen'}
      </button>
    </div>
  );
}

// ─── SolanaUpdateMetadataSection ───────────────────────────────────────

function SolanaUpdateMetadataSection({ secret }: { secret: string }) {
  const [mintAddress, setMintAddress] = useState(process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '');
  const [name, setName]               = useState('D.FAITH');
  const [symbol, setSymbol]           = useState('DFAITH');
  const [description, setDescription] = useState('The official D.FAITH fan token by Dawid Faith');
  const [website, setWebsite]         = useState('');
  const [twitter, setTwitter]         = useState('');
  const [instagram, setInstagram]     = useState('');
  const [youtube, setYoutube]         = useState('');
  const [telegram, setTelegram]       = useState('');
  const [discord, setDiscord]         = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [imagePreview, setImagePreview]   = useState('');
  const [disableMinting, setDisableMinting] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<{ metadataUri: string; explorerUrl: string; mintingDisabled?: boolean } | null>(null);
  const [error, setError]             = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1] ?? '');
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/admin/solana-update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          mintAddress: mintAddress.trim(),
          name: name.trim(),
          symbol: symbol.trim(),
          description: description.trim(),
          imageBase64: imageBase64 || undefined,
          imageMimeType,
          website:   website.trim()   || undefined,
          twitter:   twitter.trim()   || undefined,
          instagram: instagram.trim() || undefined,
          youtube:   youtube.trim()   || undefined,
          telegram:  telegram.trim()  || undefined,
          discord:   discord.trim()   || undefined,
          disableMinting,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center">
          <SiSolana size={16} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Token Metadata setzen / aktualisieren</h2>
          <p className="text-zinc-500 text-xs">Für bestehende Tokens — setzt Bild + Name on-chain via Metaplex</p>
        </div>
      </div>

      {result ? (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 space-y-2">
          <p className="text-green-400 font-semibold text-sm">✓ Metadata erfolgreich gesetzt!</p>
          {result.mintingDisabled && (
            <p className="text-orange-400 text-xs font-semibold">🔒 Minting wurde permanent deaktiviert — keine weiteren Token können erstellt werden.</p>
          )}
          <p className="text-zinc-500 text-xs">Metadata URI: <code className="text-zinc-300 break-all">{result.metadataUri}</code></p>
          <p className="text-zinc-500 text-xs">Phantom zeigt das Bild nach ca. 1–5 Minuten.</p>
          <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs underline block mt-1">
            Solscan Explorer öffnen →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Token Mint-Adresse</label>
            <input value={mintAddress} onChange={e => setMintAddress(e.target.value)}
              placeholder="z.B. 9jB95PZQ2eYs83upTpDv7gqMvuMVtB55QRATZajnmki6"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Token Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Symbol</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Beschreibung</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Token-Bild (wird auf Pinata IPFS hochgeladen)</label>
            <div className="flex items-center gap-3">
              {imagePreview && (
                <Image src={imagePreview} alt="Vorschau" width={56} height={56} className="w-14 h-14 rounded-xl object-cover border border-zinc-700 shrink-0" unoptimized />
              )}
              <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 border-dashed hover:border-blue-500 text-zinc-400 hover:text-blue-300 rounded-xl px-4 py-3 text-sm text-center transition-colors">
                {imagePreview ? 'Anderes Bild wählen' : 'Bild auswählen (PNG, JPG, SVG)'}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {imagePreview && (
                <button onClick={() => { setImagePreview(''); setImageBase64(''); }}
                  className="text-zinc-500 hover:text-red-400 text-xs px-2 shrink-0">✕</button>
              )}
            </div>
          </div>
          {/* Social Links */}
          <div className="sm:col-span-2 border-t border-zinc-800 pt-3">
            <p className="text-zinc-500 text-xs mb-2">Social Links (optional — erscheinen in Phantom &amp; Explorern)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[{label:'Website', val:website, set:setWebsite, ph:'https://dawidfaith.de'},
                {label:'Twitter / X', val:twitter, set:setTwitter, ph:'https://twitter.com/dawidfaith'},
                {label:'Instagram', val:instagram, set:setInstagram, ph:'https://instagram.com/dawidfaith'},
                {label:'YouTube', val:youtube, set:setYoutube, ph:'https://youtube.com/@dawidfaith'},
                {label:'Telegram', val:telegram, set:setTelegram, ph:'https://t.me/dawidfaith'},
                {label:'Discord', val:discord, set:setDiscord, ph:'https://discord.gg/...'},
              ].map(({label, val, set, ph}) => (
                <div key={label}>
                  <label className="text-zinc-500 text-xs block mb-0.5">{label}</label>
                  <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
                </div>
              ))}
            </div>
          </div>
          {/* Minting deaktivieren */}
          <div className="sm:col-span-2 border-t border-zinc-800 pt-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={disableMinting}
                onChange={e => setDisableMinting(e.target.checked)}
                className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
              />
              <span className="text-sm">
                <span className="text-red-400 font-semibold">Minting permanent deaktivieren</span>
                <span className="block text-zinc-500 text-xs mt-0.5">Unwiderruflich! Nach dem Aktivieren können keine weiteren Token mehr erzeugt werden. Die Mint Authority wird auf null gesetzt.</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-red-300 text-sm break-all">{error}</div>
      )}

      {!result && (
        <button
          onClick={handleUpdate}
          disabled={loading || !mintAddress.trim() || (!disableMinting && (!name.trim() || !imageBase64))}
          className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{imageBase64 ? 'IPFS + Metadata wird gesetzt…' : disableMinting ? 'Minting wird deaktiviert…' : 'Metadata wird gesetzt…'}</>
            : <><SiSolana size={14} /> {disableMinting && !imageBase64 && !name.trim() ? 'Minting permanent deaktivieren' : 'Metadata on-chain setzen'}</>
          }
        </button>
      )}
      {result && (
        <button onClick={() => setResult(null)}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-xl text-sm">
          Erneut aktualisieren
        </button>
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
  editingTokenMint,
  tokenMintInput,
  onEditTokenMint,
  onTokenMintInputChange,
  onSaveTokenMint,
  onCancelTokenMint,
  savingTokenMint,
  editingSolana,
  solanaInput,
  onEditSolana,
  onSolanaInputChange,
  onSaveSolana,
  onCancelSolana,
  savingSolana,
  isStoryQuestTester,
  isInviteAccepted,
  togglingStoryQuest,
  onToggleStoryQuest,
  onToggleInviteAccepted,
  deleting,
  onDelete,
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
  editingTokenMint: boolean;
  tokenMintInput: string;
  onEditTokenMint: () => void;
  onTokenMintInputChange: (v: string) => void;
  onSaveTokenMint: () => void;
  onCancelTokenMint: () => void;
  savingTokenMint: boolean;
  editingSolana: boolean;
  solanaInput: string;
  onEditSolana: () => void;
  onSolanaInputChange: (v: string) => void;
  onSaveSolana: () => void;
  onCancelSolana: () => void;
  savingSolana: boolean;
  isStoryQuestTester: boolean;
  isInviteAccepted: boolean;
  togglingStoryQuest: boolean;
  onToggleStoryQuest: () => void;
  onToggleInviteAccepted: () => void;
  deleting: boolean;
  onDelete: () => void;
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
          {user.isArtist ? 'Künstler' : 'Fan'}
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
            <><FaTimes size={10} /> Künstler entfernen</>
          ) : (
            <><FaCheck size={10} /> Als Künstler setzen</>
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
        {user.isArtist && (
          editingTokenMint ? (
            <div className="flex items-center gap-1">
              <input
                value={tokenMintInput}
                onChange={(e) => onTokenMintInputChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-600 text-white text-xs rounded-lg px-2 py-1 w-44 outline-none focus:border-green-500 font-mono"
                placeholder="Token Mint Adresse…"
                autoFocus
              />
              <button onClick={onSaveTokenMint} disabled={savingTokenMint} className="text-xs bg-green-600 hover:bg-green-500 text-white font-bold px-2 py-1 rounded-lg disabled:opacity-50">
                {savingTokenMint ? '…' : 'OK'}
              </button>
              <button onClick={onCancelTokenMint} className="text-zinc-500 hover:text-white text-xs px-1">✕</button>
            </div>
          ) : (
            <button onClick={onEditTokenMint} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-green-400 transition-colors font-mono truncate max-w-[200px]">
              <SiSolana size={9} className="text-green-500 shrink-0" />
              {user.tokenMintAddress
                ? user.tokenMintAddress.slice(0, 6) + '…' + user.tokenMintAddress.slice(-4)
                : '— Token Mint'}
            </button>
          )
        )}
        {/* Solana Wallet */}
        <div className="flex items-center gap-1 mt-1">
          <SiSolana size={10} className="text-purple-400 shrink-0" />
          {editingSolana ? (
            <div className="flex items-center gap-1">
              <input
                value={solanaInput}
                onChange={(e) => onSolanaInputChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-600 text-white text-xs rounded-lg px-2 py-1 w-40 outline-none focus:border-purple-500 font-mono"
                placeholder="Solana-Adresse"
                autoFocus
              />
              <button onClick={onSaveSolana} disabled={savingSolana} className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-2 py-1 rounded-lg disabled:opacity-50">
                {savingSolana ? '…' : 'OK'}
              </button>
              <button onClick={onCancelSolana} className="text-zinc-500 hover:text-white text-xs px-1">✕</button>
            </div>
          ) : (
            <button onClick={onEditSolana} className="text-xs text-zinc-500 hover:text-purple-400 transition-colors font-mono truncate max-w-[200px]">
              {user.solanaAddress ? user.solanaAddress.slice(0, 8) + '…' + user.solanaAddress.slice(-6) : '— keine Wallet'}
            </button>
          )}

        </div>
        {/* Löschen-Button */}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="mt-1 flex items-center gap-1 text-xs text-red-700 hover:text-red-400 transition-colors disabled:opacity-50"
          title="Account löschen"
        >
          {deleting
            ? <span className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" />
            : <FaTimes size={9} />}
          {deleting ? 'Lösche…' : 'Account löschen'}
        </button>
      </div>
    </div>
  );
}

// ─── GrantCreditsSection ──────────────────────────────────────────────────────

function GrantCreditsSection({ secret, users }: { secret: string; users: AdminUser[] }) {
  const [walletInput, setWalletInput] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [granting, setGranting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [log, setLog] = useState<{ wallet: string; name: string | null; amount: number; ts: number }[]>([]);

  // Dropdown-Vorschläge aus User-Liste
  const [showSuggestions, setShowSuggestions] = useState(false);
  const query = walletInput.trim().toLowerCase();
  const suggestions = query.length === 0
    ? users.slice(0, 20)  // alle bis 20 wenn leer
    : users.filter((u) =>
        u.walletAddress.toLowerCase().includes(query) ||
        (u.displayName ?? '').toLowerCase().includes(query) ||
        (u.youtubeChannelName ?? '').toLowerCase().includes(query) ||
        (u.instagramHandle ?? '').toLowerCase().includes(query) ||
        (u.tiktokHandle ?? '').toLowerCase().includes(query) ||
        (u.facebookHandle ?? '').toLowerCase().includes(query),
      ).slice(0, 10);

  const handleGrant = async () => {
    setSuccessMsg(''); setErrorMsg('');
    const addr = walletInput.trim();
    const amt = parseFloat(amount);
    if (!addr) { setErrorMsg('Wallet-Adresse eingeben'); return; }
    if (!isFinite(amt) || amt <= 0) { setErrorMsg('Ungültiger Betrag'); return; }
    setGranting(true);
    try {
      const res = await fetch('/api/admin/credit-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress: addr, amount: amt, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      const userName = users.find((u) => u.walletAddress.toLowerCase() === addr.toLowerCase())?.displayName ?? null;
      setSuccessMsg(`✓ ${amt.toLocaleString()} Credits gutgeschrieben → D.FAITH-Guthaben: ${data.newBalance?.toLocaleString() ?? '?'} (DB: creator_balances=${data.creatorBalance?.toLocaleString() ?? '?'})`);
      setLog((prev) => [{ wallet: addr, name: userName, amount: amt, ts: Date.now() }, ...prev.slice(0, 9)]);
      setAmount('');
      setNote('');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-yellow-800/40 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-yellow-900/30 border border-yellow-800/50 flex items-center justify-center">
            <FaCoins size={14} className="text-yellow-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">D.FAITH Credits vergeben</h2>
            <p className="text-zinc-500 text-xs">Manuell Credits einem Künstler-Wallet gutschreiben</p>
          </div>
        </div>

        {/* Wallet-Suche */}
        <div className="relative">
          <label className="text-zinc-400 text-xs block mb-1.5">Wallet-Adresse oder Name</label>
          <input
            value={walletInput}
            onChange={(e) => { setWalletInput(e.target.value); setShowSuggestions(true); setSuccessMsg(''); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Adresse eingeben oder Name suchen…"
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-yellow-500 transition-colors"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl max-h-72 overflow-y-auto">
              {query.length === 0 && (
                <p className="text-zinc-500 text-[10px] px-3 pt-2 pb-1">Alle Benutzer ({users.length})</p>
              )}
              {suggestions.map((u) => {
                const handles = [
                  u.instagramHandle && `@${u.instagramHandle}`,
                  u.tiktokHandle && `@${u.tiktokHandle}`,
                  u.facebookHandle && u.facebookHandle,
                  u.youtubeChannelName && u.youtubeChannelName,
                ].filter(Boolean).join(' · ');
                const displayLabel = u.displayName ?? u.youtubeChannelName ?? u.instagramHandle ?? u.tiktokHandle ?? u.facebookHandle ?? u.walletAddress.slice(0, 10) + '…';
                return (
                  <button
                    key={u.walletAddress}
                    onMouseDown={() => { setWalletInput(u.walletAddress); setShowSuggestions(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-zinc-700 transition-colors flex items-center gap-3 border-b border-zinc-700/50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white text-sm font-medium truncate">{displayLabel}</p>
                        {u.isArtist && <span className="text-[9px] font-bold text-red-400 bg-red-900/30 px-1 py-0.5 rounded shrink-0">KÜNSTLER</span>}
                      </div>
                      {handles && <p className="text-zinc-500 text-[10px] truncate mt-0.5">{handles}</p>}
                      <p className="text-zinc-600 text-[10px] font-mono truncate">{u.walletAddress.slice(0, 12)}…{u.walletAddress.slice(-6)}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      {u.credits > 0 && <p className="text-yellow-500 text-xs">{u.credits.toLocaleString()} Cr.</p>}
                      <p className="text-zinc-600 text-[10px]">Lv.{u.level}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Betrag */}
        <div>
          <label className="text-zinc-400 text-xs block mb-1.5">Betrag (D.FAITH Credits)</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {[100, 500, 1000, 5000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  amount === String(v)
                    ? 'bg-yellow-600 text-white'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>
          <input
            type="number"
            step="any"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Eigenen Betrag eingeben"
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        {/* Notiz */}
        <div>
          <label className="text-zinc-400 text-xs block mb-1.5">Notiz (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z.B. Kampagne März, Bonus, Partnerschaft…"
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
        {successMsg && <p className="text-green-400 text-sm">{successMsg}</p>}

        <button
          onClick={handleGrant}
          disabled={granting || !walletInput.trim() || !amount.trim()}
          className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
        >
          {granting
            ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"/>Wird gutgeschrieben…</>
            : <><FaCoins size={12}/> {amount ? `${parseFloat(amount || '0').toLocaleString()} Credits vergeben` : 'Credits vergeben'}</>}
        </button>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">Vergabe-Protokoll (diese Session)</h3>
          <div className="space-y-2">
            {log.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <span className="text-white font-medium">{entry.name ?? entry.wallet.slice(0, 10) + '…'}</span>
                  <span className="text-zinc-500 text-xs ml-2 font-mono">{entry.wallet.slice(0, 6)}…{entry.wallet.slice(-4)}</span>
                </div>
                <span className="text-yellow-400 font-bold shrink-0 ml-3">+{entry.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Übersicht Artists mit Credits */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">Alle Künstler – Credit-Guthaben</h3>
        {users.filter((u) => u.isArtist).length === 0 ? (
          <p className="text-zinc-600 text-sm">Keine Künstler geladen</p>
        ) : (
          <div className="space-y-2">
            {users
              .filter((u) => u.isArtist)
              .sort((a, b) => b.credits - a.credits)
              .map((u) => (
                <div key={u.walletAddress} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{u.displayName ?? u.youtubeChannelName ?? 'Unbekannt'}</p>
                    <p className="text-zinc-500 text-xs font-mono">{u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-6)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${u.credits > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                      {u.credits.toLocaleString()}
                    </span>
                    <button
                      onClick={() => setWalletInput(u.walletAddress)}
                      className="text-xs text-zinc-500 hover:text-yellow-400 transition-colors"
                      title="Wallet übernehmen"
                    >
                      <FaCoins size={10} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PlatformSection ─────────────────────────────────────────────────────────

function PlatformSection({ secret }: { secret: string }) {
  const [status, setStatus] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [quests, setQuests] = React.useState<Array<Record<string, unknown>>>([]);
  const [questsLoading, setQuestsLoading] = React.useState(false);
  const [questMsg, setQuestMsg] = React.useState('');

  // ── Bild-Upload State ──────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadMsg, setUploadMsg] = React.useState('');
  const loadStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-setup', {
        headers: { 'x-admin-secret': secret },
      });
      const data = await res.json();
      setStatus(data);
    } catch { setStatus(null); }
  }, [secret]);

  const loadQuests = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-quests', {
        headers: { 'x-admin-secret': secret },
      });
      const data = await res.json();
      setQuests(data.quests ?? []);
    } catch { setQuests([]); }
  }, [secret]);

  React.useEffect(() => { loadStatus(); loadQuests(); }, [loadStatus, loadQuests]);

  // ── Bild-Upload Handler ────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setUploadMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const form = new FormData();
      form.append('image', imageFile);
      const res = await fetch('/api/admin/platform-setup', {
        method: 'PATCH',
        headers: { 'x-admin-secret': secret },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg('✅ Bild erfolgreich hochgeladen!');
        setImageFile(null);
        await loadStatus();
      } else {
        setUploadMsg(`❌ ${data.error}`);
      }
    } catch { setUploadMsg('❌ Netzwerkfehler'); }
    finally { setUploading(false); }
  };

  const runSetup = async () => {
    setLoading(true); setMsg('');
    try {
      const res = await fetch('/api/admin/platform-setup', {
        method: 'POST',
        headers: { 'x-admin-secret': secret },
      });
      const data = await res.json();
      setMsg(res.ok ? '✅ Platform-User erfolgreich eingerichtet!' : `❌ ${data.error}`);
      if (res.ok) { await loadStatus(); await loadQuests(); }
    } catch { setMsg('❌ Netzwerkfehler'); }
    finally { setLoading(false); }
  };

  const createQuests = async () => {
    setQuestsLoading(true); setQuestMsg('');
    try {
      const res = await fetch('/api/admin/platform-quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ rewardAmount: 150, maxCompletions: 50 }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuestMsg(`✅ ${data.created} Quests erstellt, ${data.skipped} übersprungen`);
        await loadQuests();
      } else {
        setQuestMsg(`❌ ${data.error}`);
      }
    } catch { setQuestMsg('❌ Netzwerkfehler'); }
    finally { setQuestsLoading(false); }
  };

  const isSetup = status && (status as { exists?: boolean }).exists;
  const metaOk = status && (status as { metaTokenOk?: boolean }).metaTokenOk;
  const igId = status && (status as { igAccountId?: string }).igAccountId;
  const profile = status && (status as { profile?: Record<string, unknown> }).profile;

  return (
    <div className="space-y-6">
      {/* ── Profilbild hochladen ──────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
        <h2 className="text-lg font-bold text-white mb-1">🖼️ Profilbild für Platform-Konto</h2>
        <p className="text-zinc-500 text-sm mb-4">Dieses Bild erscheint als Icon beim Platform-Konto in der Künstler-Liste.</p>

        <div className="flex items-start gap-4">
          {/* Vorschau */}
          <div className="shrink-0">
            {(() => {
              const currentPic = profile
                ? String((profile as { instagram_picture?: string }).instagram_picture ?? '')
                : '';
              const src = imagePreview || (currentPic || null);
              return src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="Profilbild" className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/50" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                  <span className="text-zinc-500 text-3xl">👤</span>
                </div>
              );
            })()}
          </div>

          {/* Upload */}
          <div className="flex-1 space-y-3">
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 hover:border-amber-500/60 rounded-xl cursor-pointer transition-colors bg-zinc-800/50 hover:bg-zinc-800">
              <span className="text-zinc-400 text-sm">
                {imageFile ? imageFile.name : 'Bild auswählen (JPG, PNG, WebP)'}
              </span>
              <span className="text-zinc-600 text-xs mt-1">Max. 5 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>

            {uploadMsg && (
              <p className={`text-sm ${uploadMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {uploadMsg}
              </p>
            )}

            <button
              onClick={handleImageUpload}
              disabled={!imageFile || uploading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              {uploading
                ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Wird hochgeladen…</>
                : '⬆️ Bild hochladen'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Platform-User Status ─────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
        <h2 className="text-lg font-bold text-white mb-4">⚡ Platform-User: dfaith_ecosystem</h2>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`rounded-xl p-3 border ${isSetup ? 'bg-green-950 border-green-700' : 'bg-zinc-800 border-zinc-700'}`}>
            <p className="text-xs text-zinc-400">Platform-Artist</p>
            <p className={`font-bold ${isSetup ? 'text-green-400' : 'text-red-400'}`}>{isSetup ? '✅ Eingerichtet' : '❌ Fehlt'}</p>
          </div>
          <div className={`rounded-xl p-3 border ${metaOk ? 'bg-green-950 border-green-700' : 'bg-zinc-800 border-zinc-700'}`}>
            <p className="text-xs text-zinc-400">Meta API Token</p>
            <p className={`font-bold ${metaOk ? 'text-green-400' : 'text-red-400'}`}>{metaOk ? '✅ Aktiv' : '❌ Inaktiv'}</p>
          </div>
          <div className={`rounded-xl p-3 border ${igId ? 'bg-green-950 border-green-700' : 'bg-zinc-800 border-zinc-700'}`}>
            <p className="text-xs text-zinc-400">IG Business Account</p>
            <p className={`font-bold text-sm ${igId ? 'text-green-400' : 'text-zinc-500'}`}>{igId ? String(igId) : '–'}</p>
          </div>
          <div className="rounded-xl p-3 border bg-zinc-800 border-zinc-700">
            <p className="text-xs text-zinc-400">IG Handle</p>
            <p className="font-bold text-pink-400">
              {profile ? String((profile as { instagram_handle?: string }).instagram_handle ?? '–') : '–'}
            </p>
          </div>
        </div>

        <button
          onClick={runSetup}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Einrichten…' : isSetup ? '🔄 Platform-User aktualisieren' : '🚀 Platform-User einrichten'}
        </button>
        {msg && <p className="mt-3 text-sm text-center">{msg}</p>}
      </div>

      {/* ── Platform-Quests ──────────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
        <h2 className="text-lg font-bold text-white mb-1">📱 Platform-Quests (Instagram)</h2>
        <p className="text-zinc-500 text-sm mb-4">Erstellt automatisch bis zu 5 Comment-Quests aus den neuesten @dfaith_ecosystem Posts.</p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={createQuests}
            disabled={questsLoading || !isSetup}
            className="flex-1 bg-pink-700 hover:bg-pink-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {questsLoading ? 'Erstelle…' : '✨ 5 Platform-Quests erstellen'}
          </button>
          <button onClick={loadQuests} className="bg-zinc-700 hover:bg-zinc-600 px-4 rounded-xl transition-colors">🔄</button>
        </div>
        {questMsg && <p className="mb-3 text-sm text-center">{questMsg}</p>}

        {quests.length > 0 ? (
          <div className="space-y-2">
            {quests.map((q) => (
              <div key={String(q.id)} className="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
                {Boolean(q.video_thumbnail) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(q.video_thumbnail)} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{String(q.video_title ?? '–')}</p>
                  <p className="text-zinc-400 text-xs">{String(q.completions ?? 0)}/{String(q.max_completions ?? 0)} Abschlüsse · {String(q.reward_amount ?? 0)} Credits</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${q.is_active ? 'bg-green-900 text-green-300' : 'bg-zinc-700 text-zinc-400'}`}>
                  {q.is_active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-sm text-center py-4">Noch keine Platform-Quests vorhanden.</p>
        )}
      </div>
    </div>
  );
}

// ─── ReferralSection ──────────────────────────────────────────────────────────

interface ReferralConfig {
  reward_per_referral: number;
  max_referrals_paid: number;
  trigger_level: number;
  is_active: boolean;
  updated_at: string;
}

interface ReferralStats {
  total_referrals: number;
  paid_referrals: number;
  total_paid_out: number;
  pending_trigger: number;
}

interface ReferralEntry {
  id: number;
  referrer_wallet: string;
  referred_wallet: string;
  created_at: string;
  triggered_at: string | null;
  reward_paid: boolean;
  reward_amount: number | null;
}

function ReferralSection({ secret, users }: { secret: string; users: AdminUser[] }) {
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [entries, setEntries] = useState<ReferralEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // ── Reputation vergeben ──
  const [repWallet, setRepWallet] = useState('');
  const [repArtistWallet, setRepArtistWallet] = useState('');
  const [repAmount, setRepAmount] = useState('100');
  const [repGranting, setRepGranting] = useState(false);
  const [repMsg, setRepMsg] = useState('');
  const [repShowSuggestions, setRepShowSuggestions] = useState(false);
  const [repArtistShowSuggestions, setRepArtistShowSuggestions] = useState(false);
  const repSuggestions = (repWallet.trim().length === 0 ? users.slice(0, 20) : users.filter(u =>
    u.walletAddress.toLowerCase().includes(repWallet.trim().toLowerCase()) || (u.displayName ?? '').toLowerCase().includes(repWallet.trim().toLowerCase())
  )).slice(0, 8);
  const repArtistSuggestions = (repArtistWallet.trim().length === 0 ? users.filter(u => u.isArtist).slice(0, 20) : users.filter(u =>
    u.isArtist && (u.walletAddress.toLowerCase().includes(repArtistWallet.trim().toLowerCase()) || (u.displayName ?? '').toLowerCase().includes(repArtistWallet.trim().toLowerCase()))
  )).slice(0, 8);

  const handleGrantReputation = async () => {
    setRepMsg('');
    if (!repWallet.trim() || !repArtistWallet.trim()) { setRepMsg('Beide Felder ausfüllen'); return; }
    const amt = Number(repAmount);
    if (!isFinite(amt) || amt <= 0) { setRepMsg('Ungültiger Betrag'); return; }
    setRepGranting(true);
    try {
      const r = await fetch('/api/admin/grant-reputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress: repWallet.trim(), artistWallet: repArtistWallet.trim(), amount: amt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Fehler');
      const triggered = d.referralTriggered ? ' ✅ Referral-Trigger ausgelöst!' : '';
      setRepMsg(`✓ +${amt} REP → jetzt ${d.reputation} REP (Level ${d.level} – ${d.levelName})${triggered}`);
      await loadEntries();
    } catch (e) {
      setRepMsg(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRepGranting(false);
    }
  };

  const [reward, setReward] = useState('');
  const [maxPaid, setMaxPaid] = useState('');
  const [triggerLevel, setTriggerLevel] = useState('');
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/referral-config?stats=1', {
        headers: { 'x-admin-secret': secret },
      });
      const d = await r.json();
      if (d.config) {
        setConfig(d.config);
        setReward(String(d.config.reward_per_referral));
        setMaxPaid(String(d.config.max_referrals_paid));
        setTriggerLevel(String(d.config.trigger_level));
        setIsActive(Boolean(d.config.is_active));
      }
      if (d.stats) setStats(d.stats);
    } catch {
      setMsg('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const r = await fetch('/api/admin/referrals', { headers: { 'x-admin-secret': secret } });
      const d = await r.json();
      setEntries(Array.isArray(d.referrals) ? d.referrals : []);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [secret]);

  useEffect(() => { load(); loadEntries(); }, [load, loadEntries]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch('/api/admin/referral-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({
          rewardPerReferral: parseFloat(reward),
          maxReferralsPaid: parseInt(maxPaid, 10),
          triggerLevel: parseInt(triggerLevel, 10),
          isActive,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json().catch(() => null);
      const savedLevel = d?.saved?.trigger_level;
      const savedReward = d?.saved?.reward_per_referral;
      setMsg(
        savedLevel != null
          ? `Gespeichert ✓ (DB: Trigger-Level ${savedLevel}, Reward ${savedReward})`
          : 'Gespeichert ✓',
      );
      await load();
    } catch (e) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-1">🔗 Referral-Konfiguration</h2>
        <p className="text-zinc-400 text-sm mb-6">Nutzer erhalten einen Referral-Link. Wenn der Eingeladene Level {config?.trigger_level ?? 10} erreicht, bekommt der Referrer einen Credits-Bonus.</p>

        {loading ? (
          <div className="text-zinc-500 text-sm">Lade…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">Reward pro Referral (D.FAITH Credits)</label>
              <input
                type="number" min="0" step="0.01"
                value={reward}
                onChange={e => setReward(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">Max. bezahlte Referrals pro Referrer</label>
              <input
                type="number" min="1" step="1"
                value={maxPaid}
                onChange={e => setMaxPaid(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">Trigger-Level (Eingeladener erreicht…)</label>
              <input
                type="number" min="1" max="100" step="1"
                value={triggerLevel}
                onChange={e => setTriggerLevel(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm w-full"
              />
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${
                  isActive ? 'bg-emerald-500' : 'bg-zinc-600'
                }`}>
                <span className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className={`text-sm font-semibold ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {isActive ? 'Aktiv' : 'Deaktiviert'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={save}
            disabled={saving || loading}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
          {msg && <span className={`text-sm ${msg.startsWith('Fehler') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</span>}
        </div>
      </div>

      {/* Statistiken */}
      {stats && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-white font-bold text-base mb-4">📊 Referral-Statistiken</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.total_referrals}</p>
              <p className="text-zinc-400 text-xs mt-1">Gesamt Referrals</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.paid_referrals}</p>
              <p className="text-zinc-400 text-xs mt-1">Bezahlte Rewards</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{Number(stats.total_paid_out).toFixed(2)}</p>
              <p className="text-zinc-400 text-xs mt-1">Credits ausgezahlt</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.pending_trigger}</p>
              <p className="text-zinc-400 text-xs mt-1">Offen (Trigger ausgelöst)</p>
            </div>
          </div>
        </div>
      )}

      {/* Referral-Einträge Tabelle */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base">🗂 Alle Referral-Einträge ({entries.length})</h3>
          <button onClick={loadEntries} disabled={entriesLoading}
            className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1 transition-colors">
            {entriesLoading ? 'Lädt…' : '↺ Aktualisieren'}
          </button>
        </div>
        {entriesLoading ? (
          <div className="text-zinc-500 text-sm">Lade…</div>
        ) : entries.length === 0 ? (
          <div className="text-zinc-500 text-sm italic">Keine Einträge vorhanden</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Referrer (Einlader)</th>
                  <th className="pb-2 pr-3">Referred (Eingeladen)</th>
                  <th className="pb-2 pr-3">Erstellt</th>
                  <th className="pb-2 pr-3">Triggered</th>
                  <th className="pb-2">Bezahlt</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-1.5 pr-3 text-zinc-500">{e.id}</td>
                    <td className="py-1.5 pr-3 font-mono text-amber-300 max-w-[160px] truncate" title={e.referrer_wallet}>{e.referrer_wallet}</td>
                    <td className="py-1.5 pr-3 font-mono text-sky-300 max-w-[160px] truncate" title={e.referred_wallet}>{e.referred_wallet}</td>
                    <td className="py-1.5 pr-3 text-zinc-400">{new Date(e.created_at).toLocaleDateString('de-DE')}</td>
                    <td className="py-1.5 pr-3">{e.triggered_at ? <span className="text-emerald-400">{new Date(e.triggered_at).toLocaleDateString('de-DE')}</span> : <span className="text-zinc-600">–</span>}</td>
                    <td className="py-1.5">{e.reward_paid ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-zinc-600">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Reputation manuell vergeben ── */}
      <div className="bg-zinc-900 border border-violet-800/40 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-bold text-base">🎯 Reputation vergeben (Test)</h3>
        <p className="text-zinc-400 text-xs">Vergib manuell Reputation an einen User bei einem Artist — löst bei Erreichen des Trigger-Levels den Referral-Reward aus.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* User-Wallet */}
          <div className="relative">
            <label className="text-zinc-400 text-xs block mb-1">User (Eingeladener)</label>
            <input
              value={repWallet}
              onChange={e => { setRepWallet(e.target.value); setRepShowSuggestions(true); }}
              onFocus={() => setRepShowSuggestions(true)}
              onBlur={() => setTimeout(() => setRepShowSuggestions(false), 150)}
              placeholder="Wallet-Adresse oder Name…"
              className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-xs w-full"
            />
            {repShowSuggestions && repSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                {repSuggestions.map(u => (
                  <button key={u.walletAddress} onMouseDown={() => { setRepWallet(u.walletAddress); setRepShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 text-zinc-200 flex items-center gap-2">
                    <span className="font-semibold truncate">{u.displayName ?? u.walletAddress.slice(0, 14) + '…'}</span>
                    <span className="text-zinc-500 truncate">{u.walletAddress.slice(0, 12)}…</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Artist-Wallet */}
          <div className="relative">
            <label className="text-zinc-400 text-xs block mb-1">Artist</label>
            <input
              value={repArtistWallet}
              onChange={e => { setRepArtistWallet(e.target.value); setRepArtistShowSuggestions(true); }}
              onFocus={() => setRepArtistShowSuggestions(true)}
              onBlur={() => setTimeout(() => setRepArtistShowSuggestions(false), 150)}
              placeholder="Artist-Wallet oder Name…"
              className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-xs w-full"
            />
            {repArtistShowSuggestions && repArtistSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                {repArtistSuggestions.map(u => (
                  <button key={u.walletAddress} onMouseDown={() => { setRepArtistWallet(u.walletAddress); setRepArtistShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 text-zinc-200 flex items-center gap-2">
                    <span className="font-semibold truncate">{u.displayName ?? u.walletAddress.slice(0, 14) + '…'}</span>
                    <span className="text-zinc-500 truncate">{u.walletAddress.slice(0, 12)}…</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Betrag */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Reputation-Punkte</label>
            <input
              type="number" min="1" step="1"
              value={repAmount}
              onChange={e => setRepAmount(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-xs w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGrantReputation}
            disabled={repGranting}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
            {repGranting ? 'Vergebe…' : '+ Reputation vergeben'}
          </button>
          {repMsg && <span className={`text-xs ${repMsg.startsWith('Fehler') ? 'text-red-400' : 'text-emerald-400'}`}>{repMsg}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── ShopManageSection ─────────────────────────────────────────────────────────

interface ShopItemAdmin {
  id: string;
  title: string;
  description: string;
  type: string;
  price_credits: number;
  price_tokens: number | null;
  is_active: boolean;
  created_at: string;
}

function ShopManageSection({
  secret,
  artists,
}: {
  secret: string;
  artists: AdminUser[];
}) {
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [items, setItems] = useState<ShopItemAdmin[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState('');

  // inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState('');
  const [editTokens, setEditTokens] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadItems = useCallback(async (wallet: string) => {
    if (!wallet) return;
    setLoadingItems(true);
    setItemsError('');
    setItems([]);
    try {
      const res = await fetch(
        `/api/admin/shop-items?artistWallet=${encodeURIComponent(wallet)}`,
        { headers: { 'x-admin-secret': secret } },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data as ShopItemAdmin[]);
    } catch (e) {
      setItemsError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoadingItems(false);
    }
  }, [secret]);

  const handleArtistSelect = (wallet: string) => {
    setSelectedWallet(wallet);
    setEditingId(null);
    setSaveMsg('');
    loadItems(wallet);
  };

  const startEdit = (item: ShopItemAdmin) => {
    setEditingId(item.id);
    setEditCredits(String(item.price_credits));
    setEditTokens(item.price_tokens != null ? String(item.price_tokens) : '');
    setSaveMsg('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveMsg('');
  };

  const savePrice = async (itemId: string) => {
    const credits = parseInt(editCredits, 10);
    if (isNaN(credits) || credits < 0) {
      setSaveMsg('Ungültiger Preis (Credits)');
      return;
    }
    const tokensRaw = editTokens.trim();
    const tokens = tokensRaw === '' ? null : parseFloat(tokensRaw);
    if (tokensRaw !== '' && (isNaN(tokens!) || tokens! < 0)) {
      setSaveMsg('Ungültiger Preis (Tokens)');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/admin/shop-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ itemId, priceCredits: credits, priceTokens: tokens }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItems(prev =>
        prev.map(i =>
          i.id === itemId
            ? { ...i, price_credits: credits, price_tokens: tokens }
            : i,
        ),
      );
      setEditingId(null);
      setSaveMsg('✓ Preis gespeichert');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const TYPE_LABELS: Record<string, string> = {
    song: 'Song', video: 'Video', nft: 'NFT', exclusive: 'Exklusiv',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
          <FaShoppingBag size={16} className="text-amber-400" /> Shop-Items verwalten
        </h2>
        <p className="text-zinc-500 text-xs">Preise bestehender Shop-Items bearbeiten.</p>
      </div>

      {/* Artist auswählen */}
      <div>
        <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
          Künstler auswählen
        </label>
        {artists.length === 0 ? (
          <p className="text-zinc-600 text-sm">Noch keine Künstler vorhanden.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {artists.map(a => (
              <button
                key={a.walletAddress}
                onClick={() => handleArtistSelect(a.walletAddress)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  selectedWallet === a.walletAddress
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-500/50 hover:text-white'
                }`}
              >
                {a.displayName || a.youtubeChannelName || a.instagramHandle || a.tiktokHandle || a.facebookHandle || shortenAddress(a.walletAddress)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      {selectedWallet && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-zinc-300 text-sm font-semibold">
              Shop-Items
              <span className="ml-2 text-zinc-500 font-normal">({items.length})</span>
            </h3>
            {saveMsg && (
              <span className={`text-xs font-semibold ${saveMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {saveMsg}
              </span>
            )}
          </div>

          {loadingItems && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}
          {itemsError && (
            <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
              {itemsError}
            </div>
          )}
          {!loadingItems && !itemsError && items.length === 0 && (
            <div className="text-zinc-600 text-sm text-center py-8 bg-zinc-900 rounded-xl border border-zinc-800">
              Dieser Artist hat noch keine Shop-Items.
            </div>
          )}

          {items.map(item => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm truncate">{item.title}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 shrink-0">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                    {!item.is_active && (
                      <span className="text-[10px] bg-red-900/40 text-red-400 rounded-full px-2 py-0.5 shrink-0">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{item.description}</p>
                  )}
                </div>

                {editingId !== item.id && (
                  <button
                    onClick={() => startEdit(item)}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg"
                  >
                    <FaEdit size={10} /> Preis
                  </button>
                )}
              </div>

              {editingId === item.id ? (
                <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-zinc-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] uppercase tracking-wider">Credits</label>
                    <input
                      type="number"
                      min="0"
                      value={editCredits}
                      onChange={e => setEditCredits(e.target.value)}
                      className="bg-zinc-800 border border-zinc-600 focus:border-amber-400 text-white text-sm rounded-lg px-3 py-1.5 w-28 outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] uppercase tracking-wider">Tokens (opt.)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={editTokens}
                      onChange={e => setEditTokens(e.target.value)}
                      placeholder="leer = keiner"
                      className="bg-zinc-800 border border-zinc-600 focus:border-amber-400 text-white text-sm rounded-lg px-3 py-1.5 w-32 outline-none transition-colors placeholder-zinc-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <button
                      onClick={() => savePrice(item.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {saving ? '…' : <><FaCheck size={10} /> Speichern</>}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-colors"
                    >
                      <FaTimes size={10} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <FaCoins size={9} className="text-yellow-500" />
                    {item.price_credits} Credits
                  </span>
                  {item.price_tokens != null && (
                    <span className="flex items-center gap-1">
                      <FaStar size={9} className="text-amber-400" />
                      {item.price_tokens} Tokens
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Instagram Testers Section ────────────────────────────────────────────────

interface TesterRequest {
  id: string;
  instagramHandle: string;
  email: string;
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt: string | null;
}

interface TesterEntry {
  instagramHandle: string;
  notes: string;
  addedAt: string;
}

function InstagramTestersSection({ secret }: { secret: string }) {
  const [requests, setRequests] = useState<TesterRequest[]>([]);
  const [testers, setTesters] = useState<TesterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [manualHandle, setManualHandle] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/instagram-testers', {
        headers: { 'x-admin-secret': secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data.requests ?? []);
      setTesters(data.testers ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setActing(id);
    setMsg('');
    try {
      const res = await fetch('/api/admin/instagram-testers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`✅ @${data.handle} eingetragen + User-E-Mail gesendet`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      await fetch('/api/admin/instagram-testers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      load();
    } finally {
      setActing(null);
    }
  };

  const handleRemove = async (handle: string) => {
    if (!confirm(`@${handle} aus Whitelist entfernen?`)) return;
    await fetch(`/api/admin/instagram-testers?handle=${encodeURIComponent(handle)}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': secret },
    });
    load();
  };

  const handleManualAdd = async () => {
    const h = manualHandle.trim().replace(/^@/, '');
    if (!h) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/instagram-testers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ handle: h, notes: manualNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setManualHandle('');
      setManualNotes('');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setAdding(false);
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {msg && (
        <div className="bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-3 rounded-xl">
          {msg}
        </div>
      )}

      {/* ── Offene Anfragen ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white flex items-center gap-2">
            📥 Offene Anfragen
            {pending.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
            )}
          </h3>
          <button onClick={load} disabled={loading} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            {loading ? '…' : '↻ Aktualisieren'}
          </button>
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">Keine offenen Anfragen</p>
        ) : (
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white text-sm">@{r.instagramHandle}</p>
                    <p className="text-xs text-zinc-400">{r.email}</p>
                    <p className="text-xs text-zinc-600 font-mono">{r.walletAddress.slice(0, 20)}…</p>
                    <p className="text-xs text-zinc-600 mt-1">{new Date(r.createdAt).toLocaleString('de-DE')}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={acting === r.id}
                      className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {acting === r.id ? '…' : '✓ Eingetragen'}
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      disabled={acting === r.id}
                      className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
                <div className="text-xs text-yellow-400/80 bg-yellow-900/20 rounded-lg px-2 py-1.5">
                  ⚠️ Zuerst @{r.instagramHandle} in der{' '}
                  <a href="https://developers.facebook.com/apps/1466293431472871/roles/test-users/" target="_blank" rel="noopener noreferrer" className="underline">
                    Meta Developer Console → Roles → Instagram Testers
                  </a>{' '}
                  eintragen, dann erst hier auf &quot;Eingetragen&quot; klicken.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manuelle Eintragung ── */}
      <div>
        <h3 className="font-bold text-white mb-3">➕ Manuell hinzufügen</h3>
        <div className="flex gap-2">
          <input
            value={manualHandle}
            onChange={e => setManualHandle(e.target.value)}
            placeholder="@instagram_handle"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
          />
          <input
            value={manualNotes}
            onChange={e => setManualNotes(e.target.value)}
            placeholder="Notiz (optional)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
          />
          <button
            onClick={handleManualAdd}
            disabled={adding || !manualHandle.trim()}
            className="px-4 py-2 bg-pink-700 hover:bg-pink-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {adding ? '…' : 'Hinzufügen'}
          </button>
        </div>
      </div>

      {/* ── Aktive Whitelist ── */}
      <div>
        <h3 className="font-bold text-white mb-3">✅ Aktive Whitelist ({testers.length})</h3>
        {testers.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">Keine Tester eingetragen</p>
        ) : (
          <div className="space-y-2">
            {testers.map(t => (
              <div key={t.instagramHandle} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
                <div>
                  <span className="text-sm font-semibold text-white">@{t.instagramHandle}</span>
                  {t.notes && <span className="ml-2 text-xs text-zinc-500">{t.notes}</span>}
                  <span className="ml-2 text-xs text-zinc-600">{new Date(t.addedAt).toLocaleDateString('de-DE')}</span>
                </div>
                <button
                  onClick={() => handleRemove(t.instagramHandle)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Verarbeitete Anfragen ── */}
      {processed.length > 0 && (
        <div>
          <h3 className="font-bold text-zinc-500 mb-2 text-sm">Verarbeitete Anfragen</h3>
          <div className="space-y-1">
            {processed.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-xs text-zinc-600 px-2">
                <span className={r.status === 'approved' ? 'text-green-600' : 'text-red-600'}>
                  {r.status === 'approved' ? '✓' : '✗'}
                </span>
                <span>@{r.instagramHandle}</span>
                <span>{r.email}</span>
                <span>{new Date(r.createdAt).toLocaleDateString('de-DE')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CollectiblesAdminSection ─────────────────────────────────────────────────

type CollectionInfo = {
  id: string;
  artistWallet: string;
  name: string;
  primaryBonus: string;
};

const ADMIN_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
type AdminRarity = typeof ADMIN_RARITIES[number];

function CollectiblesAdminSection({ secret, users }: { secret: string; users: AdminUser[] }) {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  useEffect(() => {
    if (!secret) return;
    setLoadingCollections(true);
    fetch('/api/admin/collectibles', { headers: { 'x-admin-secret': secret } })
      .then(r => r.json())
      .then(d => setCollections(d.collections ?? []))
      .catch(() => {})
      .finally(() => setLoadingCollections(false));
  }, [secret]);

  // Shards
  const [shardWallet, setShardWallet] = useState('');
  const [shardArtistWallet, setShardArtistWallet] = useState('');
  const [shardAmount, setShardAmount] = useState(10);
  const [shardLoading, setShardLoading] = useState(false);
  const [shardMsg, setShardMsg] = useState('');
  const [shardSearch, setShardSearch] = useState('');
  const [shardArtistSearch, setShardArtistSearch] = useState('');

  const shardFilteredUsers = users.filter(u =>
    !shardSearch || u.walletAddress.toLowerCase().includes(shardSearch.toLowerCase()) ||
    (u.displayName ?? '').toLowerCase().includes(shardSearch.toLowerCase())
  );
  const artistUsers = users.filter(u => u.isArtist);
  const shardFilteredArtists = artistUsers.filter(u =>
    !shardArtistSearch || u.walletAddress.toLowerCase().includes(shardArtistSearch.toLowerCase()) ||
    (u.displayName ?? '').toLowerCase().includes(shardArtistSearch.toLowerCase())
  );

  const handleGiveShards = async () => {
    if (!shardWallet || !shardArtistWallet || shardAmount < 1) return;
    setShardLoading(true);
    setShardMsg('');
    try {
      const res = await fetch('/api/admin/collectibles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action: 'shard', walletAddress: shardWallet, artistWallet: shardArtistWallet, amount: shardAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setShardMsg(`✓ ${shardAmount} Shards vergeben. Neuer Stand: ${data.newCount}`);
    } catch (e) {
      setShardMsg(`✗ ${e instanceof Error ? e.message : 'Fehler'}`);
    } finally {
      setShardLoading(false);
    }
  };

  // Collectibles
  const [colWallet, setColWallet] = useState('');
  const [colCollectionId, setColCollectionId] = useState('');
  const [colRarity, setColRarity] = useState<AdminRarity>('common');
  const [colLoading, setColLoading] = useState(false);
  const [colMsg, setColMsg] = useState('');
  const [colSearch, setColSearch] = useState('');

  const colFilteredUsers = users.filter(u =>
    !colSearch || u.walletAddress.toLowerCase().includes(colSearch.toLowerCase()) ||
    (u.displayName ?? '').toLowerCase().includes(colSearch.toLowerCase())
  );

  const handleGiveCollectible = async () => {
    if (!colWallet || !colCollectionId) return;
    setColLoading(true);
    setColMsg('');
    try {
      const res = await fetch('/api/admin/collectibles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action: 'collectible', walletAddress: colWallet, collectionId: colCollectionId, rarity: colRarity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setColMsg(`✓ Collectible (${colRarity}) vergeben. ID: ${data.id}`);
    } catch (e) {
      setColMsg(`✗ ${e instanceof Error ? e.message : 'Fehler'}`);
    } finally {
      setColLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Shards vergeben */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <GiCrystalShine className="text-amber-400" /> Shards vergeben
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Empfänger (Wallet)</label>
            <input
              type="text" value={shardSearch}
              onChange={e => { setShardSearch(e.target.value); setShardWallet(''); }}
              placeholder="Name oder Wallet suchen…"
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/50"
            />
            {shardSearch && !shardWallet && (
              <div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {shardFilteredUsers.slice(0, 10).map(u => (
                  <button key={u.walletAddress} onClick={() => { setShardWallet(u.walletAddress); setShardSearch(u.displayName ?? u.walletAddress); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2">
                    <span className="text-white">{u.displayName ?? '–'}</span>
                    <span className="text-zinc-500 text-xs">{u.walletAddress.slice(0, 10)}…</span>
                  </button>
                ))}
                {shardFilteredUsers.length === 0 && <p className="px-3 py-2 text-zinc-600 text-xs">Keine Treffer</p>}
              </div>
            )}
            {shardWallet && <p className="text-xs text-zinc-500 mt-1">{shardWallet}</p>}
          </div>
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Künstler (Shard-Kontext)</label>
            <input
              type="text" value={shardArtistSearch}
              onChange={e => { setShardArtistSearch(e.target.value); setShardArtistWallet(''); }}
              placeholder="Künstler suchen…"
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/50"
            />
            {shardArtistSearch && !shardArtistWallet && (
              <div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {shardFilteredArtists.slice(0, 10).map(u => (
                  <button key={u.walletAddress} onClick={() => { setShardArtistWallet(u.walletAddress); setShardArtistSearch(u.displayName ?? u.walletAddress); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2">
                    <span className="text-white">{u.displayName ?? '–'}</span>
                    <span className="text-zinc-500 text-xs">{u.walletAddress.slice(0, 10)}…</span>
                  </button>
                ))}
                {shardFilteredArtists.length === 0 && <p className="px-3 py-2 text-zinc-600 text-xs">Keine Künstler</p>}
              </div>
            )}
            {shardArtistWallet && <p className="text-xs text-zinc-500 mt-1">{shardArtistWallet}</p>}
          </div>
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Anzahl Shards</label>
            <input type="number" min={1} value={shardAmount} onChange={e => setShardAmount(Number(e.target.value))}
              className="w-32 bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={handleGiveShards} disabled={shardLoading || !shardWallet || !shardArtistWallet || shardAmount < 1}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl text-sm transition-colors">
            {shardLoading ? <FaSync className="animate-spin" /> : <GiCrystalShine />} Shards vergeben
          </button>
          {shardMsg && <p className={`text-sm font-medium ${shardMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{shardMsg}</p>}
        </div>
      </div>

      {/* Collectible vergeben */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <GiCrystalShine className="text-purple-400" /> Collectible direkt vergeben
        </h3>
        {loadingCollections && <p className="text-zinc-500 text-xs mb-3">Kollektionen laden…</p>}
        <div className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Empfänger (Wallet)</label>
            <input type="text" value={colSearch}
              onChange={e => { setColSearch(e.target.value); setColWallet(''); }}
              placeholder="Name oder Wallet suchen…"
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50"
            />
            {colSearch && !colWallet && (
              <div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {colFilteredUsers.slice(0, 10).map(u => (
                  <button key={u.walletAddress} onClick={() => { setColWallet(u.walletAddress); setColSearch(u.displayName ?? u.walletAddress); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2">
                    <span className="text-white">{u.displayName ?? '–'}</span>
                    <span className="text-zinc-500 text-xs">{u.walletAddress.slice(0, 10)}…</span>
                  </button>
                ))}
                {colFilteredUsers.length === 0 && <p className="px-3 py-2 text-zinc-600 text-xs">Keine Treffer</p>}
              </div>
            )}
            {colWallet && <p className="text-xs text-zinc-500 mt-1">{colWallet}</p>}
          </div>
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Kollektion</label>
            <select value={colCollectionId} onChange={e => setColCollectionId(e.target.value)}
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50">
              <option value="">– Bitte wählen –</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id.slice(0, 8)}…)</option>)}
            </select>
            {collections.length === 0 && !loadingCollections && (
              <p className="text-zinc-600 text-xs mt-1">Keine Kollektionen – bitte erst eine erstellen.</p>
            )}
          </div>
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Seltenheit</label>
            <select value={colRarity} onChange={e => setColRarity(e.target.value as AdminRarity)}
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50">
              {ADMIN_RARITIES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <button onClick={handleGiveCollectible} disabled={colLoading || !colWallet || !colCollectionId}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold rounded-xl text-sm transition-colors">
            {colLoading ? <FaSync className="animate-spin" /> : <GiCrystalShine />} Collectible vergeben
          </button>
          {colMsg && <p className={`text-sm font-medium ${colMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{colMsg}</p>}
        </div>
      </div>
    </div>
  );
}
