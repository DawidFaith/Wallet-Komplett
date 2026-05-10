'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useConnect, useAuthCore, useSolana } from '@particle-network/auth-core-modal';
import {
  FaCopy, FaCheckCircle, FaSync, FaPaperPlane, FaExternalLinkAlt,
  FaKey, FaEye, FaEyeSlash, FaSpinner, FaExchangeAlt,
} from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';

const DFAITH_MINT   = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';
const JUPITER_URL   = DFAITH_MINT
  ? `https://jup.ag/swap/SOL-${DFAITH_MINT}`
  : 'https://jup.ag';

type TabView = 'wallet' | 'swap';
type SendMode = 'sol' | 'dfaith';

export default function SolanaWalletTab() {
  const { connect, disconnect, connected, connectionStatus } = useConnect();
  const { userInfo } = useAuthCore();
  const { address: particleAddress } = useSolana();

  // Particle Solana-Adresse als stabiler User-Identifier (nur für DB-Lookup)
  const evmAddress = particleAddress ?? null;

  const [solanaAddr, setSolanaAddr]   = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const [solBalance, setSolBalance]       = useState<number | null>(null);
  const [dfaithBalance, setDfaithBalance] = useState<number | null>(null);
  const [loadingBal, setLoadingBal]       = useState(false);

  const [recipient, setRecipient] = useState('');
  const [sendAmt, setSendAmt]     = useState('');
  const [sendMode, setSendMode]   = useState<SendMode>('sol');
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');

  const [exportKey, setExportKey]         = useState('');
  const [showExport, setShowExport]       = useState(false);
  const [showKey, setShowKey]             = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [copied, setCopied]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('wallet');

  // ── Balance laden ─────────────────────────────────────────────────────────
  const loadBalance = useCallback(async (addr: string) => {
    setLoadingBal(true);
    try {
      const res = await fetch(`/api/solana/balance?solanaAddress=${addr}`);
      if (!res.ok) return;
      const d = await res.json();
      setSolBalance(d.solBalance ?? null);
      setDfaithBalance(d.dfaithBalance ?? null);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  // ── Account init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!evmAddress) {
      setSolanaAddr(null); setSolBalance(null); setDfaithBalance(null);
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
        // Noch kein Account → anlegen
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
      const endpoint = sendMode === 'sol' ? '/api/solana/send-sol' : '/api/solana/send-token';
      const bodyKey  = sendMode === 'sol' ? 'amountSol' : 'amount';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: evmAddress, toAddress: recipient.trim(), [bodyKey]: amt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Transaktion fehlgeschlagen');
      setSendOk(`✓ Gesendet! TX: ${d.signature}`);
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

  // ── States: Particle lädt ──────────────────────────────────────────────────
  if (connectionStatus === 'loading') {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 flex items-center justify-center min-h-[200px]">
        <FaSpinner size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  // ── States: nicht eingeloggt ───────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SiSolana size={24} className="text-purple-400" />
          <h2 className="text-white font-bold text-xl">Solana Wallet</h2>
          <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs px-2 py-0.5 rounded-full">SOL</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-purple-900/30 rounded-full flex items-center justify-center">
            <SiSolana size={32} className="text-purple-400" />
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">Anmelden um fortzufahren</p>
            <p className="text-zinc-400 text-sm">Dein Solana Wallet wird automatisch erstellt — kein Wallet-App nötig.</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => connect({ socialType: 'google' })}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              <FcGoogle size={20} />
              Mit Google anmelden
            </button>
            <button
              onClick={() => connect({ socialType: 'apple' })}
              className="w-full flex items-center justify-center gap-3 bg-black hover:bg-zinc-800 text-white border border-zinc-700 font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              <FaApple size={18} />
              Mit Apple anmelden
            </button>
            <button
              onClick={() => connect({ email: '' })}
              className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              ✉ Mit E-Mail anmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-zinc-500 text-xs">Stelle sicher dass SOLANA_TREASURY_PRIVATE_KEY gesetzt ist.</p>
        </div>
      </div>
    );
  }

  // ── Haupt-UI ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <SiSolana size={22} className="text-purple-400" />
        <h2 className="text-white font-bold text-xl">Solana Wallet</h2>
      </div>

      {/* Tab-Bar */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {(['wallet', 'swap'] as TabView[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
              ${activeTab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t === 'swap'
              ? <span className="flex items-center justify-center gap-1"><FaExchangeAlt size={10} /> Swap</span>
              : 'Wallet'}
          </button>
        ))}
      </div>

      {activeTab === 'wallet' && (
        <>
          {/* Adresse */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-zinc-500 text-xs font-medium">Deine Solana-Adresse</p>
              <div className="flex items-center gap-2">
                <button onClick={() => handleCopy(solanaAddr!)} className="text-zinc-500 hover:text-white text-xs flex items-center gap-1">
                  {copied ? <><FaCheckCircle size={10} className="text-green-400" /> Kopiert</> : <><FaCopy size={10} /> Kopieren</>}
                </button>
                <button onClick={() => disconnect()} className="text-zinc-600 hover:text-red-400 text-xs">Abmelden</button>
              </div>
            </div>
            <p className="text-white font-mono text-xs break-all">{solanaAddr}</p>
            {userInfo && (
              <p className="text-zinc-600 text-xs mt-1">
                {userInfo.name ?? userInfo.email ?? userInfo.google_email ?? ''}
              </p>
            )}
            <a href={`https://solscan.io/account/${solanaAddr}`} target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 mt-1">
              Solscan <FaExternalLinkAlt size={9} />
            </a>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-500 text-xs font-medium">SOL</p>
                <button onClick={() => loadBalance(solanaAddr!)} disabled={loadingBal}
                  className="text-zinc-600 hover:text-zinc-400 disabled:opacity-40">
                  <FaSync size={10} className={loadingBal ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-white text-2xl font-bold">
                {loadingBal ? '…' : solBalance !== null ? solBalance.toFixed(4) : '—'}
              </p>
              <p className="text-zinc-500 text-xs">SOL</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs font-medium mb-2">D.FAITH</p>
              <p className="text-white text-2xl font-bold">
                {loadingBal ? '…' : dfaithBalance !== null ? dfaithBalance.toLocaleString() : DFAITH_MINT ? '—' : 'bald'}
              </p>
              <p className="text-zinc-500 text-xs">D.FAITH</p>
            </div>
          </div>

          {/* Senden */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FaPaperPlane size={12} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">Senden</h3>
            </div>

            {/* SOL / D.FAITH Toggle */}
            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              {(['sol', 'dfaith'] as SendMode[]).map(m => (
                <button key={m} onClick={() => setSendMode(m)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all
                    ${sendMode === m ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {m === 'sol' ? 'SOL' : 'D.FAITH'}
                </button>
              ))}
            </div>

            <div>
              <label className="text-zinc-400 text-xs block mb-1">Empfänger (Solana-Adresse)</label>
              <input value={recipient} onChange={e => setRecipient(e.target.value)}
                placeholder="Bs58-Adresse…"
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-400 text-xs">
                  Betrag ({sendMode === 'sol' ? 'SOL' : 'D.FAITH'})
                </label>
                {sendMode === 'sol' && solBalance !== null && (
                  <button onClick={() => setSendAmt(Math.max(0, solBalance - 0.001).toFixed(6))}
                    className="text-zinc-400 hover:text-white text-xs font-semibold">MAX</button>
                )}
                {sendMode === 'dfaith' && dfaithBalance !== null && (
                  <button onClick={() => setSendAmt(String(dfaithBalance))}
                    className="text-zinc-400 hover:text-white text-xs font-semibold">MAX</button>
                )}
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
                : <><FaPaperPlane size={12} /> {sendMode === 'sol' ? 'SOL' : 'D.FAITH'} senden</>}
            </button>
            <p className="text-zinc-600 text-xs text-center">On-Chain · Kein Wallet-App nötig</p>
          </div>

          {/* Private Key Export */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FaKey size={12} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">Private Key exportieren</h3>
            </div>
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
        </>
      )}

      {/* Swap Tab — Jupiter */}
      {activeTab === 'swap' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden" style={{ height: 600 }}>
          {DFAITH_MINT ? (
            <iframe
              src={JUPITER_URL}
              className="w-full h-full border-0"
              title="Jupiter Swap"
              allow="clipboard-write"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
              <FaExchangeAlt size={32} className="text-zinc-600" />
              <p className="text-zinc-400 text-sm">Swap wird verfügbar sobald der D.FAITH Token geminted wurde.</p>
              <a href="https://jup.ag" target="_blank" rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1">
                Jupiter öffnen <FaExternalLinkAlt size={9} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
