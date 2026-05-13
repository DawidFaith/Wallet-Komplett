'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import {
  FaCopy, FaCheckCircle, FaSync, FaPaperPlane, FaExternalLinkAlt,
  FaKey, FaEye, FaEyeSlash, FaSpinner, FaExchangeAlt,
  FaChevronDown, FaChevronUp, FaDownload, FaCreditCard,
} from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';
import Image from 'next/image';
import SwapWidget from './wallet/SwapWidget';

const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

interface TokenEntry {
  mint:     string;
  balance:  number;
  decimals: number;
  name:     string;
  symbol:   string;
  image:    string | null;
  valueUsd: number | null;
  priceChange24h: number | null;
}

type SendMode =
  | { type: 'sol' }
  | { type: 'token'; mint: string; symbol: string; max: number };

type Panel = 'key' | null;
type ActionModal = 'send' | 'swap' | 'receive' | 'buy' | null;

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({
  token, loading, onSend, onSwap,
}: {
  token: TokenEntry;
  loading: boolean;
  onSend: (mode: SendMode) => void;
  onSwap: () => void;
}) {
  const isDfaith    = token.mint === DFAITH_MINT;
  const formattedValue = token.valueUsd !== null
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(token.valueUsd)
    : '—';
  const changeClass = token.priceChange24h === null
    ? 'text-zinc-500'
    : token.priceChange24h >= 0
    ? 'text-emerald-400'
    : 'text-red-400';
  const formattedChange = token.priceChange24h === null
    ? '—'
    : `${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors
      ${isDfaith
        ? 'bg-purple-950/30 border-purple-800/40'
        : 'bg-zinc-900 border-zinc-800'}`}>
      {/* Icon */}
      {token.image ? (
        <div className="w-10 h-10 shrink-0 overflow-hidden rounded-full">
          <Image
            src={token.image} alt={token.symbol}
            width={40} height={40}
            style={{ width: '40px', height: '40px', objectFit: 'cover', display: 'block' }}
            unoptimized
          />
        </div>
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
          ${isDfaith ? 'bg-purple-800/50' : 'bg-zinc-800'}`}>
          <span className="text-white font-bold text-sm">
            {token.symbol.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}

      {/* Name + Symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{token.name}</p>
        <p className="text-zinc-500 text-xs truncate">
          {loading ? '…' : token.balance.toLocaleString('de-DE', { maximumFractionDigits: 4 })} {token.symbol}
        </p>
      </div>

      {/* Value + Change */}
      <div className="text-right mr-1 shrink-0">
        <p className="text-white font-bold text-sm">{loading ? '…' : formattedValue}</p>
        <p className={`text-xs ${changeClass}`}>{loading ? '…' : formattedChange}</p>
      </div>

      {/* Action Buttons */}
      {!isDfaith && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onSend({ type: 'token', mint: token.mint, symbol: token.symbol, max: token.balance })}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1">
            <FaPaperPlane size={9} /> Send
          </button>
          <button
            onClick={onSwap}
            className="bg-zinc-800 hover:bg-emerald-900/40 text-emerald-400 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1">
            <FaExchangeAlt size={9} /> Swap
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SolanaWalletTab() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { openSignIn, signOut } = useClerk();
  const userId = user?.id ?? null;
  const connected = isLoaded && !!isSignedIn;

  const [solanaAddr, setSolanaAddr]   = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solValueUsd, setSolValueUsd] = useState<number | null>(null);
  const [solChange24h, setSolChange24h] = useState<number | null>(null);
  const [tokens, setTokens]         = useState<TokenEntry[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);

  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [panel, setPanel]         = useState<Panel>(null);
  const [sendMode, setSendMode]   = useState<SendMode>({ type: 'sol' });
  const [recipient, setRecipient] = useState('');
  const [sendAmt, setSendAmt]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');
  const [showSendTokenDrop, setShowSendTokenDrop] = useState(false);

  const [exportKey, setExportKey]         = useState('');
  const [showExport, setShowExport]       = useState(false);
  const [showKey, setShowKey]             = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [copied, setCopied]               = useState(false);

  // ── Balance laden ─────────────────────────────────────────────────────────
  const loadBalance = useCallback(async (addr: string) => {
    setLoadingBal(true);
    try {
      const res = await fetch(`/api/solana/balance?solanaAddress=${addr}`);
      if (!res.ok) return;
      const d = await res.json();
      setSolBalance(d.solBalance ?? null);
      setSolValueUsd(d.solValueUsd ?? null);
      setSolChange24h(d.solChange24h ?? null);
      setTokens(d.tokens ?? []);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  // ── Account init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setSolanaAddr(null); setSolBalance(null); setSolValueUsd(null); setSolChange24h(null); setTokens([]);
      setCreateError('');
      return;
    }
    let cancelled = false;
    async function init() {
      try {
        const check = await fetch(`/api/solana/create-account?walletAddress=${encodeURIComponent(userId!)}`);
        const checkData = await check.json();
        if (cancelled) return;
        if (checkData.solanaAddress) {
          setSolanaAddr(checkData.solanaAddress);
          return;
        }
        setCreating(true);
        setCreateError('');
        const res = await fetch('/api/solana/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: userId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Fehler beim Erstellen des Accounts');
        setSolanaAddr(data.solanaAddress);
      } catch (e) {
        if (!cancelled) setCreateError(e instanceof Error ? e.message : 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setCreating(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (solanaAddr) loadBalance(solanaAddr);
  }, [solanaAddr, loadBalance]);

  // ── Senden ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!recipient.trim()) { setSendErr('Empfänger-Adresse eingeben'); return; }
    const isSolMax = sendMode.type === 'sol' && sendAmt === 'max';
    const amt = parseFloat(sendAmt);
    if (!isSolMax && (!isFinite(amt) || amt <= 0)) { setSendErr('Ungültiger Betrag'); return; }
    setSending(true);
    try {
      if (sendMode.type === 'sol') {
        const res = await fetch('/api/solana/send-sol', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: userId, toAddress: recipient.trim(), amountSol: isSolMax ? 'max' : amt }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? 'Transaktion fehlgeschlagen');
        setSendOk(`✓ TX: ${d.signature}`);
      } else {
        const res = await fetch('/api/solana/send-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userId,
            toAddress: recipient.trim(),
            amount: amt,
            mintAddress: sendMode.mint,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? 'Transaktion fehlgeschlagen');
        setSendOk(`✓ TX: ${d.signature}`);
      }
      setRecipient(''); setSendAmt('');
      setTimeout(() => loadBalance(solanaAddr!), 4000);
    } catch (e) {
      setSendErr('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    } finally {
      setSending(false);
    }
  };

  // ── Key Export ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/solana/export-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Export fehlgeschlagen');
      setExportKey(d.privateKeyBs58);
      setShowExport(true);
    } catch (e) {
      alert('Export fehlgeschlagen: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openSendPanel = (mode: SendMode) => {
    setSendErr(''); setSendOk(''); setRecipient(''); setSendAmt('');
    setSendMode(mode);
    setShowSendTokenDrop(false);
    setActionModal('send');
  };

  // ── Nicht eingeloggt → Login-UI (auch während Clerk lädt) ───────────────
  if (!connected) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-700/30 rounded-full flex items-center justify-center">
            <SiSolana size={16} className="text-purple-400" />
          </div>
          <h2 className="text-white font-bold text-lg">D.FAITH Ecosystem</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-purple-900/30 rounded-full flex items-center justify-center">
            {!isLoaded
              ? <FaSpinner size={28} className="animate-spin text-purple-400" />
              : <SiSolana size={32} className="text-purple-400" />}
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">Anmelden um fortzufahren</p>
            <p className="text-zinc-400 text-sm">Dein Solana Wallet wird automatisch erstellt — kein Wallet-App nötig.</p>
          </div>
          <button onClick={() => openSignIn()} disabled={!isLoaded}
            className="w-full flex items-center justify-center gap-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors">
            {!isLoaded
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Anmelden'}
          </button>
        </div>
      </div>
    );
  }

  // ── Erstellen ──────────────────────────────────────────────────────────────
  if (creating || (userId && !solanaAddr && !createError)) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-700/30 rounded-full flex items-center justify-center">
            <SiSolana size={16} className="text-purple-400" />
          </div>
          <h2 className="text-white font-bold text-lg">D.FAITH Ecosystem</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <FaSpinner size={28} className="animate-spin text-purple-400 mx-auto" />
          <p className="text-white font-semibold">Wallet wird erstellt…</p>
          <p className="text-zinc-400 text-sm">Einmalig, dauert ca. 5 Sekunden.</p>
        </div>
      </div>
    );
  }

  // ── Fehler ─────────────────────────────────────────────────────────────────
  if (createError) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-700/30 rounded-full flex items-center justify-center">
            <SiSolana size={16} className="text-purple-400" />
          </div>
          <h2 className="text-white font-bold text-lg">D.FAITH Ecosystem</h2>
        </div>
        <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6 space-y-3">
          <p className="text-red-300 font-semibold text-sm">Account-Erstellung fehlgeschlagen</p>
          <p className="text-red-400 text-xs break-all">{createError}</p>
        </div>
      </div>
    );
  }

  // ── Haupt-UI ───────────────────────────────────────────────────────────────
  const dfaithToken = tokens.find(t => t.mint === DFAITH_MINT);
  const otherTokens = tokens.filter(t => t.mint !== DFAITH_MINT);
  const sendTokenOptions: TokenEntry[] = [
    dfaithToken ?? {
      mint: DFAITH_MINT,
      balance: 0,
      decimals: 2,
      name: 'D.FAITH',
      symbol: 'DFAITH',
      image: '/D.FAITH.png',
      valueUsd: null,
      priceChange24h: null,
    },
    ...otherTokens,
  ];

  const sendLabel = sendMode.type === 'sol' ? 'SOL' : sendMode.symbol;
  const sendMax   = sendMode.type === 'sol'
    ? 'max'
    : String((sendMode as { type: 'token'; max: number }).max ?? 0);
  const receiveQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`solana:${solanaAddr}`)}`;
  const solValueLabel = solValueUsd !== null
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(solValueUsd)
    : '—';
  const solChangeLabel = solChange24h === null
    ? '—'
    : `${solChange24h >= 0 ? '+' : ''}${solChange24h.toFixed(2)}%`;
  const solChangeClass = solChange24h === null
    ? 'text-zinc-500'
    : solChange24h >= 0
    ? 'text-emerald-400'
    : 'text-red-400';

  const totalValueUsd   = (solValueUsd ?? 0) + tokens.reduce((s, t) => s + (t.valueUsd ?? 0), 0);
  const hasPriceData    = solValueUsd !== null || tokens.some(t => t.valueUsd !== null);
  const totalValueLabel = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(totalValueUsd);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-700/30 rounded-full flex items-center justify-center">
            <SiSolana size={15} className="text-purple-400" />
          </div>
          <span className="text-white font-bold text-lg">D.FAITH Ecosystem</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadBalance(solanaAddr!)} disabled={loadingBal}
            className="text-zinc-500 hover:text-white disabled:opacity-40 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
            <FaSync size={13} className={loadingBal ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => signOut()} className="text-zinc-500 hover:text-red-400 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
            Abmelden
          </button>
        </div>
      </div>

      {/* ── Balance Card ── */}
      <div className="relative rounded-3xl overflow-hidden p-6 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #3b0764 0%, #4c1d95 40%, #1e1b4b 100%)' }}>
        {/* Dekorative Kreise */}
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #a855f7, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', transform: 'translate(-30%, 30%)' }} />
        <div className="relative z-10 space-y-5">
          <div>
            <p className="text-purple-200/60 text-xs font-medium uppercase tracking-widest mb-1">Gesamtvermögen</p>
            <p className="text-white text-4xl font-bold tracking-tight">
              {loadingBal ? <span className="opacity-40">…</span> : hasPriceData ? totalValueLabel : '—'}
            </p>
            {solChange24h !== null && (
              <p className={`text-sm mt-1 font-medium ${solChangeClass}`}>{solChangeLabel} (24h)</p>
            )}
          </div>
          {/* Wallet Adresse */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-2.5">
            <SiSolana size={13} className="text-purple-300 shrink-0" />
            <span className="text-purple-100 font-mono text-xs flex-1 truncate">
              {solanaAddr?.slice(0, 10)}…{solanaAddr?.slice(-8)}
            </span>
            <button onClick={() => handleCopy(solanaAddr!)} className="text-purple-300 hover:text-white transition-colors shrink-0 p-1">
              {copied ? <FaCheckCircle size={12} className="text-emerald-400" /> : <FaCopy size={12} />}
            </button>
            <a href={`https://solscan.io/account/${solanaAddr}`} target="_blank" rel="noopener noreferrer"
              className="text-purple-300 hover:text-white transition-colors shrink-0 p-1">
              <FaExternalLinkAlt size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Send',    icon: <FaPaperPlane size={20} />,  color: 'text-purple-400 group-hover:text-purple-300', onClick: () => openSendPanel({ type: 'sol' }) },
          { label: 'Receive', icon: <FaDownload size={20} />,    color: 'text-blue-400 group-hover:text-blue-300',    onClick: () => setActionModal('receive') },
          { label: 'Swap',    icon: <FaExchangeAlt size={20} />, color: 'text-emerald-400 group-hover:text-emerald-300', onClick: () => setActionModal('swap') },
          { label: 'Buy',     icon: <FaCreditCard size={20} />,  color: 'text-amber-400 group-hover:text-amber-300',  onClick: () => setActionModal('buy') },
        ] as const).map(({ label, icon, color, onClick }) => (
          <button key={label} onClick={onClick}
            className="group flex flex-col items-center gap-2 py-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl transition-all hover:bg-zinc-800/80">
            <span className={`transition-all ${color}`}>{icon}</span>
            <span className="text-zinc-400 group-hover:text-white text-xs font-semibold transition-colors">{label}</span>
          </button>
        ))}
      </div>

      <>

      {/* ── Assets ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Vermögenswerte</p>
          {loadingBal && <FaSpinner size={10} className="text-zinc-600 animate-spin" />}
        </div>

        {/* SOL Row */}
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 ring-1 ring-purple-600/30"
            style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.5), rgba(67,56,202,0.5))' }}>
            <SiSolana size={20} className="text-purple-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Solana</p>
            <p className="text-zinc-500 text-xs">{loadingBal ? '…' : (solBalance ?? 0).toFixed(4)} SOL</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white font-bold text-sm">{loadingBal ? '…' : solValueLabel}</p>
            <p className={`text-xs ${solChangeClass}`}>{loadingBal ? '…' : solChangeLabel}</p>
          </div>
        </div>

        {/* Artist Tokens */}
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-zinc-600 text-xs font-semibold uppercase tracking-wider">Artist Tokens</p>
        </div>

        {/* D.FAITH — wird immer angezeigt */}
        <TokenRow
          token={dfaithToken
            ? { ...dfaithToken, image: dfaithToken.image || '/D.FAITH.png' }
            : {
              mint: DFAITH_MINT, balance: 0, decimals: 2,
              name: 'D.FAITH', symbol: 'DFAITH', image: '/D.FAITH.png', valueUsd: null, priceChange24h: null,
            }}
          loading={loadingBal}
          onSend={openSendPanel}
          onSwap={() => setActionModal('swap')}
        />

        {/* Weitere Artist Tokens */}
        {otherTokens.map(token => (
          <TokenRow key={token.mint} token={token} loading={false} onSend={openSendPanel} onSwap={() => setActionModal('swap')} />
        ))}

        {tokens.length === 0 && !loadingBal && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-center space-y-1">
            <p className="text-zinc-500 text-sm">Noch keine Artist Tokens</p>
            <p className="text-zinc-600 text-xs">Schließe Quests ab um Artist Tokens zu verdienen.</p>
          </div>
        )}
      </div>

      {/* ── Private Key (aufklappbar) ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setPanel(p => p === 'key' ? null : 'key')}
          className="w-full flex items-center justify-between px-4 py-3 text-zinc-400 hover:text-white transition-colors">
          <div className="flex items-center gap-2">
            <FaKey size={12} />
            <span className="text-sm font-semibold">Private Key exportieren</span>
          </div>
          {panel === 'key' ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
        </button>
        {panel === 'key' && (
          <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
            {!showExport ? (
              <button onClick={handleExport} disabled={exportLoading}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                {exportLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Lädt…</>
                  : <><FaKey size={12} /> Private Key anzeigen</>}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <p className={`text-white font-mono text-xs break-all bg-zinc-800 rounded-xl p-3 ${!showKey ? 'blur-sm select-none' : ''}`}>
                    {exportKey}
                  </p>
                  <button onClick={() => setShowKey(!showKey)}
                    className="absolute top-2 right-2 text-zinc-400 hover:text-white">
                    {showKey ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
                {showKey && (
                  <button onClick={() => handleCopy(exportKey)}
                    className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1">
                    {copied ? <><FaCheckCircle size={10} className="text-green-400" /> Kopiert</> : <><FaCopy size={10} /> Kopieren</>}
                  </button>
                )}
                <p className="text-yellow-500/80 text-xs">⚠ Diesen Key sicher speichern und nie teilen! BS58-Format für Phantom / Solflare.</p>
              </div>
            )}
          </div>
        )}
      </div>

      </>

      {/* ── Action Modal ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[88vh] bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                {actionModal === 'send' && `${sendLabel} senden`}
                {actionModal === 'swap' && 'Token Swap'}
                {actionModal === 'receive' && 'SOL empfangen'}
                {actionModal === 'buy' && 'SOL kaufen'}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-zinc-500 hover:text-white text-sm">Schließen</button>
            </div>

            <div className="overflow-y-auto max-h-[calc(88vh-56px)] p-4">
              {actionModal === 'send' && (
                <div className="space-y-3">
                  {/* Token Selector */}
                  <div className="relative">
                    <label className="text-zinc-400 text-xs block mb-1">Token</label>
                    <button
                      onClick={() => setShowSendTokenDrop(!showSendTokenDrop)}
                      className="w-full bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-xl px-3 py-2 flex items-center justify-between text-white text-sm">
                      <span>{sendLabel}</span>
                      <FaChevronDown size={10} className={`transition-transform ${showSendTokenDrop ? 'rotate-180' : ''}`} />
                    </button>
                    {showSendTokenDrop && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                        <button
                          onClick={() => { openSendPanel({ type: 'sol' }); setShowSendTokenDrop(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-700 transition-colors text-left">
                          <div className="w-6 h-6 bg-purple-700/40 rounded-full flex items-center justify-center shrink-0">
                            <SiSolana size={12} className="text-purple-300" />
                          </div>
                          <div>
                            <p className="text-white text-sm font-semibold">SOL</p>
                            <p className="text-zinc-500 text-xs">{solBalance?.toLocaleString('de-DE', { maximumFractionDigits: 4 }) || '0'}</p>
                          </div>
                        </button>
                        {sendTokenOptions.map(token => (
                          <button
                            key={token.mint}
                            onClick={() => { openSendPanel({ type: 'token', mint: token.mint, symbol: token.symbol, max: token.balance }); setShowSendTokenDrop(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-700 transition-colors text-left border-t border-zinc-700">
                            {token.image
                              ? <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                                  <Image src={token.image} alt={token.symbol} width={24} height={24} style={{ width: '24px', height: '24px', objectFit: 'cover', display: 'block' }} unoptimized />
                                </div>
                              : <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                                  <span className="text-white text-xs font-bold">{token.symbol.slice(0, 1)}</span>
                                </div>
                            }
                            <div>
                              <p className="text-white text-sm font-semibold">{token.symbol}</p>
                              <p className="text-zinc-500 text-xs">{token.balance.toLocaleString('de-DE', { maximumFractionDigits: 4 })}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs block mb-1">Empfänger (Solana-Adresse)</label>
                    <input value={recipient} onChange={e => setRecipient(e.target.value)}
                      placeholder="Bs58-Adresse…"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-zinc-400 text-xs">Betrag ({sendLabel})</label>
                      <button onClick={() => setSendAmt(sendMax)} className="text-zinc-400 hover:text-white text-xs font-semibold">MAX</button>
                    </div>
                    {sendAmt === 'max'
                      ? (
                        <div className="w-full bg-zinc-800 border border-purple-600 text-purple-300 rounded-xl px-3 py-2 text-sm flex items-center justify-between">
                          <span>Gesamte Balance (abzgl. Fee)</span>
                          <button onClick={() => setSendAmt('')} className="text-zinc-500 hover:text-white text-xs ml-2">✕</button>
                        </div>
                      ) : (
                        <input type="number" step="0.000001" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-500" />
                      )}
                  </div>
                  {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
                  {sendOk  && <p className="text-green-400 text-xs break-all">{sendOk}</p>}
                  <button onClick={handleSend} disabled={sending || !recipient.trim() || !sendAmt.trim()}
                    className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                    {sending
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Wird gesendet…</>
                      : <><FaPaperPlane size={12} /> Senden</>}
                  </button>
                  <p className="text-zinc-600 text-xs text-center">On-Chain · Kein Wallet-App nötig</p>
                </div>
              )}

              {actionModal === 'swap' && (
                <SwapWidget
                  walletAddress={solanaAddr!}
                  evmAddress={userId!}
                  tokens={tokens}
                  solBalance={solBalance ?? 0}
                  onSwapSuccess={() => loadBalance(solanaAddr!)}
                />
              )}

              {actionModal === 'receive' && (
                <div className="space-y-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 text-center space-y-3">
                    <img src={receiveQrUrl} alt="SOL Receive QR" className="w-48 h-48 rounded-xl mx-auto bg-white p-2" />
                    <p className="text-zinc-400 text-xs">Scanne den QR Code oder kopiere die Adresse.</p>
                    <p className="text-white font-mono text-xs break-all bg-zinc-800 rounded-xl p-3">{solanaAddr}</p>
                    <button onClick={() => handleCopy(solanaAddr!)}
                      className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
                      {copied ? <><FaCheckCircle size={11} /> Kopiert</> : <><FaCopy size={11} /> Adresse kopieren</>}
                    </button>
                  </div>
                </div>
              )}

              {actionModal === 'buy' && (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-xs">Kaufe SOL direkt auf deine Wallet — per Karte, Bank oder Apple Pay.</p>
                  <a
                    href={`https://buy.moonpay.com/?currencyCode=sol&walletAddress=${solanaAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                    <FaCreditCard size={14} /> Mit MoonPay kaufen
                  </a>
                  <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                    <p className="text-zinc-500 text-xs font-medium mb-0.5">Ziel-Adresse</p>
                    <p className="text-zinc-300 font-mono text-xs break-all">{solanaAddr}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

