'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useConnect, useAuthCore, useSolana } from '@particle-network/auth-core-modal';
import {
  FaCopy, FaCheckCircle, FaSync, FaPaperPlane, FaExternalLinkAlt,
  FaKey, FaEye, FaEyeSlash, FaSpinner, FaExchangeAlt,
  FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import Image from 'next/image';

const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

interface TokenEntry {
  mint:     string;
  balance:  number;
  decimals: number;
  name:     string;
  symbol:   string;
  image:    string | null;
}

type SendMode =
  | { type: 'sol' }
  | { type: 'token'; mint: string; symbol: string; max: number };

type Panel = 'send' | 'key' | null;

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({
  token, loading, onSend,
}: {
  token: TokenEntry;
  loading: boolean;
  onSend: (mode: SendMode) => void;
}) {
  const isDfaith    = token.mint === DFAITH_MINT;
  const jupiterUrl  = `https://jup.ag/swap/${token.mint}-SOL`;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors
      ${isDfaith
        ? 'bg-purple-950/30 border-purple-800/40'
        : 'bg-zinc-900 border-zinc-800'}`}>
      {/* Icon */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden
        ${isDfaith ? 'bg-purple-800/50' : 'bg-zinc-800'}`}>
        {token.image ? (
          <Image
            src={token.image} alt={token.symbol}
            width={40} height={40}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-white font-bold text-sm">
            {token.symbol.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Name + Symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{token.name}</p>
        <p className="text-zinc-500 text-xs">{token.symbol}</p>
      </div>

      {/* Balance */}
      <div className="text-right mr-1 shrink-0">
        <p className="text-white font-bold text-sm">
          {loading ? '…' : token.balance.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
        </p>
        <p className="text-zinc-500 text-xs">{token.symbol}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          onClick={() => onSend({ type: 'token', mint: token.mint, symbol: token.symbol, max: token.balance })}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1">
          <FaPaperPlane size={9} /> Send
        </button>
        <a
          href={jupiterUrl} target="_blank" rel="noopener noreferrer"
          className="bg-zinc-800 hover:bg-emerald-900/40 text-emerald-400 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1">
          <FaExchangeAlt size={9} /> Swap
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SolanaWalletTab() {
  const { connect, disconnect, connected, connectionStatus } = useConnect();
  const { userInfo } = useAuthCore();
  const { address: particleAddress } = useSolana();
  const evmAddress = particleAddress ?? null;

  const [solanaAddr, setSolanaAddr]   = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokens, setTokens]         = useState<TokenEntry[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);

  const [panel, setPanel]         = useState<Panel>(null);
  const [sendMode, setSendMode]   = useState<SendMode>({ type: 'sol' });
  const [recipient, setRecipient] = useState('');
  const [sendAmt, setSendAmt]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');

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
      setTokens(d.tokens ?? []);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  // ── Account init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!evmAddress) {
      setSolanaAddr(null); setSolBalance(null); setTokens([]);
      return;
    }
    let cancelled = false;
    async function init() {
      try {
        const check = await fetch(`/api/solana/create-account?walletAddress=${evmAddress}`);
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
          body: JSON.stringify({ walletAddress: evmAddress }),
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
  }, [evmAddress]);

  useEffect(() => {
    if (solanaAddr) loadBalance(solanaAddr);
  }, [solanaAddr, loadBalance]);

  // ── Senden ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!recipient.trim()) { setSendErr('Empfänger-Adresse eingeben'); return; }
    const amt = parseFloat(sendAmt);
    if (!isFinite(amt) || amt <= 0) { setSendErr('Ungültiger Betrag'); return; }
    setSending(true);
    try {
      if (sendMode.type === 'sol') {
        const res = await fetch('/api/solana/send-sol', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: evmAddress, toAddress: recipient.trim(), amountSol: amt }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? 'Transaktion fehlgeschlagen');
        setSendOk(`✓ TX: ${d.signature}`);
      } else {
        const res = await fetch('/api/solana/send-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: evmAddress,
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
        body: JSON.stringify({ walletAddress: evmAddress }),
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
    setPanel(p => p === 'send' ? null : 'send');
  };

  // ── Loading oder nicht eingeloggt → immer Login-UI zeigen ───────────────
  if (!connected) {
    const isLoading = connectionStatus === 'loading';
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SiSolana size={24} className="text-purple-400" />
          <div>
            <h2 className="text-white font-bold text-xl leading-tight">Solana Wallet</h2>
            <p className="text-purple-400 text-xs font-medium">Support &amp; Earn</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-purple-900/30 rounded-full flex items-center justify-center">
            {isLoading
              ? <FaSpinner size={28} className="animate-spin text-purple-400" />
              : <SiSolana size={32} className="text-purple-400" />}
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">Anmelden um fortzufahren</p>
            <p className="text-zinc-400 text-sm">Dein Solana Wallet wird automatisch erstellt — kein Wallet-App nötig.</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => connect({ socialType: 'google' })} disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-800 font-semibold py-3 rounded-xl text-sm transition-colors">
              <FcGoogle size={20} /> Mit Google anmelden
            </button>
            <button onClick={() => connect({ socialType: 'apple' })} disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white border border-zinc-700 font-semibold py-3 rounded-xl text-sm transition-colors">
              <FaApple size={18} /> Mit Apple anmelden
            </button>
            <button onClick={() => connect({ email: '' })} disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white border border-zinc-700 font-semibold py-3 rounded-xl text-sm transition-colors">
              ✉ Mit E-Mail anmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Erstellen ──────────────────────────────────────────────────────────────
  if (creating || (!solanaAddr && !createError)) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SiSolana size={24} className="text-purple-400" />
          <h2 className="text-white font-bold text-xl">Solana Wallet</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <FaSpinner size={28} className="animate-spin text-purple-400 mx-auto" />
          <p className="text-white font-semibold">Solana Wallet wird erstellt…</p>
          <p className="text-zinc-400 text-sm">Einmalig, dauert ca. 5 Sekunden.</p>
        </div>
      </div>
    );
  }

  // ── Fehler ─────────────────────────────────────────────────────────────────
  if (createError) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <SiSolana size={24} className="text-purple-400" />
          <h2 className="text-white font-bold text-xl">Solana Wallet</h2>
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

  const sendLabel = sendMode.type === 'sol' ? 'SOL' : sendMode.symbol;
  const sendMax   = sendMode.type === 'sol'
    ? (solBalance !== null ? Math.max(0, solBalance - 0.001).toFixed(6) : '')
    : String((sendMode as { type: 'token'; max: number }).max ?? 0);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SiSolana size={22} className="text-purple-400" />
          <div>
            <h2 className="text-white font-bold text-xl leading-tight">Solana Wallet</h2>
            <p className="text-purple-400 text-xs font-medium">Support &amp; Earn</p>
          </div>
        </div>
        <button onClick={() => loadBalance(solanaAddr!)} disabled={loadingBal}
          className="text-zinc-500 hover:text-white disabled:opacity-40 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
          <FaSync size={13} className={loadingBal ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Adresse ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {userInfo && (
            <p className="text-zinc-400 text-xs mb-0.5 truncate">
              {userInfo.name ?? userInfo.email ?? (userInfo as unknown as Record<string, string>).google_email ?? ''}
            </p>
          )}
          <p className="text-white font-mono text-xs truncate">{solanaAddr}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => handleCopy(solanaAddr!)} className="text-zinc-500 hover:text-white">
            {copied ? <FaCheckCircle size={11} className="text-green-400" /> : <FaCopy size={11} />}
          </button>
          <a href={`https://solscan.io/account/${solanaAddr}`} target="_blank" rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white"><FaExternalLinkAlt size={10} /></a>
          <button onClick={() => disconnect()} className="text-zinc-600 hover:text-red-400 text-xs ml-1">Abmelden</button>
        </div>
      </div>

      {/* ── SOL — oben, groß ── */}
      <div className="bg-gradient-to-br from-purple-950/60 to-zinc-900 border border-purple-800/30 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-purple-700/40 rounded-full flex items-center justify-center">
              <SiSolana size={22} className="text-purple-300" />
            </div>
            <div>
              <p className="text-white font-semibold">Solana</p>
              <p className="text-zinc-500 text-xs">SOL</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-2xl font-bold">
              {loadingBal ? '…' : solBalance !== null ? solBalance.toFixed(4) : '—'}
            </p>
            <p className="text-zinc-500 text-xs">SOL</p>
          </div>
        </div>
        <button onClick={() => openSendPanel({ type: 'sol' })}
          className="mt-4 w-full bg-purple-700/40 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors">
          <FaPaperPlane size={10} /> SOL senden
        </button>
      </div>

      {/* ── Artist Tokens ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Artist Tokens</p>
          {loadingBal && <FaSpinner size={10} className="text-zinc-600 animate-spin" />}
        </div>

        {/* D.FAITH — wird immer angezeigt */}
        <TokenRow
          token={dfaithToken ?? {
            mint: DFAITH_MINT, balance: 0, decimals: 2,
            name: 'D.FAITH', symbol: 'DFAITH', image: null,
          }}
          loading={loadingBal}
          onSend={openSendPanel}
        />

        {/* Weitere Artist Tokens */}
        {otherTokens.map(token => (
          <TokenRow key={token.mint} token={token} loading={false} onSend={openSendPanel} />
        ))}

        {tokens.length === 0 && !loadingBal && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-center space-y-1">
            <p className="text-zinc-500 text-sm">Noch keine Artist Tokens</p>
            <p className="text-zinc-600 text-xs">Schließe Quests ab um Artist Tokens zu verdienen.</p>
          </div>
        )}
      </div>

      {/* ── Send Panel ── */}
      {panel === 'send' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaPaperPlane size={12} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">{sendLabel} senden</h3>
            </div>
            <button onClick={() => setPanel(null)} className="text-zinc-500 hover:text-white">
              <FaChevronUp size={12} />
            </button>
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
            <input type="number" step="0.000001" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-500" />
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

    </div>
  );
}

