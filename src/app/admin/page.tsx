'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FaYoutube, FaInstagram, FaTiktok, FaFacebook,
  FaCheck, FaTimes, FaSearch, FaShieldAlt, FaCoins, FaStar, FaSync, FaPaperPlane,
} from 'react-icons/fa';
import { SiHedera, SiSolana } from 'react-icons/si';

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

  const [activeTab, setActiveTab] = useState<'users' | 'token'>('users');

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
        {(['users', 'token'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-red-500 bg-zinc-900'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab === 'users' ? 'Benutzer' : 'Token'}
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
        </>
      )}

      {/* ── Token Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'token' && (
        <>
          <SolanaTreasurySection secret={secret} />
          <SolanaMintSection secret={secret} />
          <SolanaDBMigrationSection secret={secret} />
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <p className="text-zinc-600 text-xs mb-4">─── Legacy: Hedera ───</p>
            <HederaTreasurySection secret={secret} />
            <HederaMintSection secret={secret} />
            <HederaUpdateMetadataSection secret={secret} />
          </div>
        </>
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
  const [description, setDescription] = useState('The official D.FAITH fan token by Dawid Faith');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [imagePreview, setImagePreview]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<{ mintAddress: string; explorerUrl: string; metadataUri?: string } | null>(null);
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
          description: description.trim(),
          imageBase64: imageBase64 || undefined,
          imageMimeType,
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
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Total Supply (gesamt, 6 Decimals)</label>
            <input type="number" value={totalSupply} onChange={e => setTotalSupply(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
            <p className="text-zinc-600 text-xs mt-0.5">= {parseInt(totalSupply || '0').toLocaleString()} D.FAITH (6 Decimals)</p>
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
                <img src={imagePreview} alt="Vorschau" className="w-14 h-14 rounded-xl object-cover border border-zinc-700 shrink-0" />
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

// ─── HederaTreasurySection ────────────────────────────────────────────────────

function HederaTreasurySection({ secret }: { secret: string }) {
  type TokenInfo = { tokenId: string; balance: number; name: string; symbol: string };
  const [hbar, setHbar]             = useState<number | null>(null);
  const [tokens, setTokens]         = useState<TokenInfo[]>([]);
  const [operatorId, setOperatorId] = useState('');
  const [loadingBal, setLoadingBal] = useState(false);

  const [sendTo, setSendTo]     = useState('');
  const [sendAmt, setSendAmt]   = useState('');
  const [sendMode, setSendMode] = useState<string>('');
  const [sending, setSending]   = useState(false);
  const [sendOk, setSendOk]     = useState('');
  const [sendErr, setSendErr]   = useState('');

  const loadBalance = useCallback(async () => {
    setLoadingBal(true);
    setSendOk(''); setSendErr('');
    try {
      const res = await fetch('/api/admin/hedera-balance', { headers: { 'x-admin-secret': secret } });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error);
      setHbar(d.hbar ?? null);
      const toks: TokenInfo[] = d.tokens ?? [];
      setTokens(toks);
      setOperatorId(d.operatorId ?? '');
      setSendMode(prev => {
        if (prev === '') return toks.length > 0 ? toks[0].tokenId : 'hbar';
        return prev;
      });
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoadingBal(false);
    }
  }, [secret]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!/^\d+\.\d+\.\d+$/.test(sendTo.trim())) { setSendErr('Ungültige Account-ID'); return; }
    const amt = parseFloat(sendAmt);
    if (!isFinite(amt) || amt <= 0) { setSendErr('Ungültiger Betrag'); return; }
    setSending(true);
    try {
      const isHbar = sendMode === 'hbar';
      const body: Record<string, unknown> = { toAccountId: sendTo.trim(), amount: amt, sendHbar: isHbar };
      if (!isHbar) body.tokenId = sendMode;
      const res = await fetch('/api/admin/hedera-send-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSendOk(`✓ gesendet! TX: ${d.transactionId}`);
      setSendTo(''); setSendAmt('');
      setTimeout(loadBalance, 3000);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSending(false);
    }
  };

  const currentToken = tokens.find(t => t.tokenId === sendMode);
  const gridCols = tokens.length >= 2 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="mt-8 bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <SiHedera size={16} className="text-zinc-300" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Treasury Wallet</h2>
            <p className="text-zinc-500 text-xs font-mono">{operatorId || '—'}</p>
          </div>
        </div>
        <button onClick={loadBalance} disabled={loadingBal}
          className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40">
          <FaSync size={13} className={loadingBal ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Balances */}
      <div className={`grid ${gridCols} gap-3`}>
        <div className="bg-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-500 text-xs mb-1">HBAR</p>
          <p className="text-white text-2xl font-bold">{loadingBal ? '…' : hbar !== null ? hbar.toFixed(2) : '—'}</p>
        </div>
        {tokens.map(tok => (
          <div key={tok.tokenId} className="bg-zinc-800 rounded-xl px-4 py-3">
            <p className="text-zinc-500 text-xs mb-1">{tok.name} <span className="text-zinc-600">({tok.tokenId})</span></p>
            <p className="text-white text-2xl font-bold">{loadingBal ? '…' : tok.balance.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Send */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FaPaperPlane size={11} className="text-zinc-400" />
          <h3 className="text-white text-sm font-semibold">Senden (vom Treasury)</h3>
          <div className="flex gap-1 ml-auto flex-wrap justify-end">
            <button onClick={() => setSendMode('hbar')}
              className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${sendMode === 'hbar' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              HBAR
            </button>
            {tokens.map(tok => (
              <button key={tok.tokenId} onClick={() => setSendMode(tok.tokenId)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${sendMode === tok.tokenId ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {tok.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="Empfänger (0.0.12345)"
            className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500 w-full" />
          <div className="flex gap-2">
            <input type="number" step="any" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
              placeholder={`Betrag (${sendMode === 'hbar' ? 'HBAR' : currentToken?.name ?? 'Token'})`}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-500 flex-1 min-w-0" />
            {currentToken && (
              <button onClick={() => setSendAmt(String(currentToken.balance))}
                className="text-zinc-400 hover:text-white text-xs px-2 shrink-0">MAX</button>
            )}
          </div>
        </div>
        {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
        {sendOk  && <p className="text-green-400 text-xs break-all">{sendOk}</p>}
        <button onClick={handleSend} disabled={sending || !sendTo.trim() || !sendAmt.trim()}
          className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
          {sending
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Wird gesendet…</>
            : <><FaPaperPlane size={11}/> {sendMode === 'hbar' ? 'HBAR' : (currentToken?.name ?? 'Token')} senden</>}
        </button>
      </div>
    </div>
  );
}

// ─── HederaMintSection ────────────────────────────────────────────────────────

function HederaMintSection({ secret }: { secret: string }) {
  const [name, setName]           = useState('D.FAITH');
  const [symbol, setSymbol]       = useState('DFAITH');
  const [decimals, setDecimals]   = useState('2');
  const [supply, setSupply]       = useState('1000000000');
  const [memo, setMemo]           = useState('D.FAITH Fan Token by Dawid Faith');
  const [description, setDescription] = useState('The official D.FAITH fan token by Dawid Faith');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [imagePreview, setImagePreview]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ tokenId: string; explorerUrl: string; metadataUri?: string } | null>(null);
  const [error, setError]         = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      // base64 ohne data:...-Prefix
      setImageBase64(dataUrl.split(',')[1] ?? '');
    };
    reader.readAsDataURL(file);
  };

  const handleMint = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/hedera-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({
          name: name.trim(),
          symbol: symbol.trim(),
          decimals: parseInt(decimals),
          initialSupply: parseInt(supply),
          memo: memo.trim(),
          description: description.trim(),
          imageBase64: imageBase64 || undefined,
          imageMimeType,
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
          <SiHedera size={16} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Hedera Token Minten (HTS)</h2>
          <p className="text-zinc-500 text-xs">Erstellt einen neuen Fungible Token auf Hedera Mainnet</p>
        </div>
      </div>

      {result ? (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 space-y-2">
          <p className="text-green-400 font-semibold text-sm">✓ Token erfolgreich erstellt!</p>
          <div>
            <p className="text-zinc-400 text-xs">Token-ID (in .env.local eintragen):</p>
            <code className="text-yellow-300 text-sm font-mono break-all">{result.tokenId}</code>
          </div>
          <p className="text-zinc-500 text-xs">
            → <code className="text-zinc-300">NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID={result.tokenId}</code>
          </p>
          {result.metadataUri && (
            <p className="text-zinc-500 text-xs">Metadata: <code className="text-zinc-300 break-all">{result.metadataUri}</code></p>
          )}
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 text-xs underline block mt-1"
          >
            HashScan Explorer öffnen →
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
            <label className="text-zinc-400 text-xs block mb-1">Decimals</label>
            <input type="number" value={decimals} onChange={e => setDecimals(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Initial Supply (kleinste Einheit)</label>
            <input type="number" value={supply} onChange={e => setSupply(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
            <p className="text-zinc-600 text-xs mt-0.5">
              = {(parseInt(supply || '0') / Math.pow(10, parseInt(decimals || '0'))).toLocaleString()} {symbol}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Beschreibung</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Memo (on-chain)</label>
            <input value={memo} onChange={e => setMemo(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-zinc-400 text-xs block mb-1">Token-Bild (optional, wird auf IPFS hochgeladen)</label>
            <div className="flex items-center gap-3">
              {imagePreview && (
                <img src={imagePreview} alt="Vorschau" className="w-14 h-14 rounded-xl object-cover border border-zinc-700" />
              )}
              <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 border-dashed hover:border-purple-500 text-zinc-400 hover:text-purple-300 rounded-xl px-4 py-3 text-sm text-center transition-colors">
                {imagePreview ? 'Anderes Bild wählen' : 'Bild auswählen (PNG, JPG, SVG)'}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {imagePreview && (
                <button onClick={() => { setImagePreview(''); setImageBase64(''); }}
                  className="text-zinc-500 hover:text-red-400 text-xs px-2">✕</button>
              )}
            </div>
            {imageBase64 && <p className="text-zinc-600 text-xs mt-1">Bild wird beim Mint auf Pinata IPFS hochgeladen</p>}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-red-300 text-sm break-all">
          {error}
        </div>
      )}

      {!result && (
        <button
          onClick={handleMint}
          disabled={loading || !name.trim() || !symbol.trim()}
          className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Token wird erstellt…</>
            : <><SiHedera size={14} /> D.FAITH Token auf Hedera erstellen</>}
        </button>
      )}

      {result && (
        <button
          onClick={() => setResult(null)}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-xl text-sm"
        >
          Neuen Token erstellen
        </button>
      )}
    </div>
  );
}

// ─── HederaUpdateMetadataSection ─────────────────────────────────────────────

function HederaUpdateMetadataSection({ secret }: { secret: string }) {
  const defaultToken = process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID ?? '';
  const [tokenId, setTokenId]         = useState(defaultToken);
  const [description, setDescription] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [imagePreview, setImagePreview]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ metadataUri: string; status: string } | null>(null);
  const [error, setError]       = useState('');

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
      const res = await fetch('/api/admin/hedera-update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({
          tokenId: tokenId.trim(),
          description: description.trim(),
          imageBase64: imageBase64 || undefined,
          imageMimeType,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Fehler');
      setResult(d);
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
          <SiHedera size={16} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Token Metadata aktualisieren</h2>
          <p className="text-zinc-500 text-xs">Bild + HIP-412 auf IPFS hochladen und On-Chain Metadata setzen</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-zinc-400 text-xs block mb-1">Token-ID</label>
          <input value={tokenId} onChange={e => setTokenId(e.target.value)}
            placeholder="0.0.XXXXXXX"
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-zinc-400 text-xs block mb-1">Beschreibung</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="The official D.FAITH fan token by Dawid Faith"
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-zinc-400 text-xs block mb-1">Token-Bild (wird auf Pinata IPFS hochgeladen)</label>
          <div className="flex items-center gap-3">
            {imagePreview && (
              <img src={imagePreview} alt="Vorschau" className="w-14 h-14 rounded-xl object-cover border border-zinc-700" />
            )}
            <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 border-dashed hover:border-blue-500 text-zinc-400 hover:text-blue-300 rounded-xl px-4 py-3 text-sm text-center transition-colors">
              {imagePreview ? 'Anderes Bild wählen' : 'Bild auswählen (PNG, JPG, SVG)'}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            {imagePreview && (
              <button onClick={() => { setImagePreview(''); setImageBase64(''); }}
                className="text-zinc-500 hover:text-red-400 text-xs px-2">✕</button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-red-300 text-sm break-all">{error}</div>
      )}

      {result && (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 space-y-2">
          <p className="text-green-400 font-semibold text-sm">✓ Metadata aktualisiert! Status: {result.status}</p>
          <p className="text-zinc-400 text-xs">Neue Metadata-URI:</p>
          <code className="text-blue-300 text-xs font-mono break-all">{result.metadataUri}</code>
        </div>
      )}

      <button onClick={handleUpdate} disabled={loading || !tokenId.trim()}
        className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
        {loading
          ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Wird hochgeladen…</>
          : <><SiHedera size={13}/> Metadata on-chain aktualisieren</>}
      </button>
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
