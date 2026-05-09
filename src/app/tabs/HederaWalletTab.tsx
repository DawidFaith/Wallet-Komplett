'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { ConnectButton } from 'thirdweb/react';
import { client } from '../client';
import {
  FaCopy, FaCheckCircle, FaSync, FaPaperPlane, FaExternalLinkAlt,
  FaExchangeAlt, FaKey, FaEye, FaEyeSlash, FaSpinner,
} from 'react-icons/fa';
import { SiHedera } from 'react-icons/si';

const DFAITH_TOKEN_ID = process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID ?? '';
const SAUCER_URL = DFAITH_TOKEN_ID
  ? `https://www.saucerswap.finance/swap/HBAR/${DFAITH_TOKEN_ID}`
  : 'https://www.saucerswap.finance';

const wallets = [
  inAppWallet({ auth: { options: ['email', 'google', 'facebook'] } }),
  createWallet('io.metamask'),
];

type TabView = 'wallet' | 'swap';

export default function HederaWalletTab() {
  const account = useActiveAccount();
  const evmAddress = account?.address ?? null;

  const [hederaId, setHederaId]       = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const [hbar, setHbar]         = useState<number | null>(null);
  const [dfaith, setDfaith]     = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);

  const [recipient, setRecipient] = useState('');
  const [sendAmt, setSendAmt]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');

  const [exportKey, setExportKey]         = useState('');
  const [showExport, setShowExport]       = useState(false);
  const [showKey, setShowKey]             = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [copied, setCopied]     = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('wallet');

  const loadBalance = useCallback(async (id: string) => {
    setLoadingBal(true);
    try {
      const p = new URLSearchParams({ accountId: id });
      if (DFAITH_TOKEN_ID) p.set('tokenId', DFAITH_TOKEN_ID);
      const res = await fetch(`/api/hedera/balance?${p}`);
      if (!res.ok) return;
      const d = await res.json();
      setHbar(d.hbarBalance ?? null);
      setDfaith(d.tokenBalance ?? null);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  useEffect(() => {
    if (!evmAddress) {
      setHederaId(null);
      setHbar(null);
      setDfaith(null);
      return;
    }
    let cancelled = false;
    async function init() {
      try {
        const check = await fetch(`/api/hedera/create-account?walletAddress=${evmAddress}`);
        const checkData = await check.json();
        if (cancelled) return;
        if (checkData.hederaAccountId) {
          setHederaId(checkData.hederaAccountId);
          return;
        }
        setCreating(true);
        setCreateError('');
        const res = await fetch('/api/hedera/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: evmAddress }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Fehler');
        setHederaId(data.hederaAccountId);
      } catch (e) {
        if (!cancelled) setCreateError(e instanceof Error ? e.message : 'Fehler');
      } finally {
        if (!cancelled) setCreating(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [evmAddress]);

  useEffect(() => {
    if (hederaId) loadBalance(hederaId);
  }, [hederaId, loadBalance]);

  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!/^\d+\.\d+\.\d+$/.test(recipient.trim())) { setSendErr('Ungültige Empfänger-ID (Format: 0.0.12345)'); return; }
    const amt = parseFloat(sendAmt);
    if (!isFinite(amt) || amt <= 0) { setSendErr('Ungültiger Betrag'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/hedera/send-hbar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: evmAddress, toAccountId: recipient.trim(), amountHbar: amt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Fehler');
      setSendOk(`✓ Gesendet! TX: ${d.transactionId}`);
      setRecipient(''); setSendAmt('');
      setTimeout(() => loadBalance(hederaId!), 3000);
    } catch (e) {
      setSendErr('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    } finally {
      setSending(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/hedera/export-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: evmAddress }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Fehler');
      setExportKey(d.privateKeyHex);
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

  if (!evmAddress) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SiHedera size={24} className="text-zinc-300" />
          <h2 className="text-white font-bold text-xl">Hedera Wallet</h2>
          <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs px-2 py-0.5 rounded-full">HBAR</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center">
            <SiHedera size={32} className="text-zinc-300" />
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">Anmelden um fortzufahren</p>
            <p className="text-zinc-400 text-sm">Dein Hedera Account wird automatisch erstellt — kein Wallet-App nötig.</p>
          </div>
          <div className="flex justify-center">
            <ConnectButton
              client={client}
              wallets={wallets}
              theme="dark"
              connectButton={{ label: 'Mit Google / E-Mail anmelden' }}
              connectModal={{
                size: 'compact',
                title: 'Anmelden',
                welcomeScreen: { title: 'Hedera Wallet', subtitle: 'Dein Account wird automatisch erstellt' },
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (creating || (!hederaId && !createError)) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SiHedera size={24} className="text-zinc-300" />
          <h2 className="text-white font-bold text-xl">Hedera Wallet</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <FaSpinner size={28} className="animate-spin text-purple-400 mx-auto" />
          <p className="text-white font-semibold">Hedera Account wird erstellt…</p>
          <p className="text-zinc-400 text-sm">Einmalig, dauert ca. 5 Sekunden.</p>
        </div>
      </div>
    );
  }

  if (createError) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <SiHedera size={24} className="text-zinc-300" />
          <h2 className="text-white font-bold text-xl">Hedera Wallet</h2>
        </div>
        <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6 space-y-3">
          <p className="text-red-300 font-semibold text-sm">Account-Erstellung fehlgeschlagen</p>
          <p className="text-red-400 text-xs break-all">{createError}</p>
          <p className="text-zinc-500 text-xs">Stelle sicher dass HEDERA_OPERATOR_ID und HEDERA_OPERATOR_MNEMONIC gesetzt sind.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <SiHedera size={22} className="text-zinc-300" />
        <h2 className="text-white font-bold text-xl">Hedera Wallet</h2>
      </div>

      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {(['wallet', 'swap'] as TabView[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t === 'swap' ? <span className="flex items-center justify-center gap-1"><FaExchangeAlt size={10} /> Swap</span> : 'Wallet'}
          </button>
        ))}
      </div>

      {activeTab === 'wallet' && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-zinc-500 text-xs font-medium">Hedera Account-ID</p>
              <button onClick={() => handleCopy(hederaId!)} className="text-zinc-500 hover:text-white text-xs flex items-center gap-1">
                {copied ? <><FaCheckCircle size={10} className="text-green-400" /> Kopiert</> : <><FaCopy size={10} /> Kopieren</>}
              </button>
            </div>
            <p className="text-white font-mono text-sm">{hederaId}</p>
            <a href={`https://hashscan.io/mainnet/account/${hederaId}`} target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 mt-1">
              HashScan <FaExternalLinkAlt size={9} />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-500 text-xs font-medium">HBAR</p>
                <button onClick={() => loadBalance(hederaId!)} disabled={loadingBal} className="text-zinc-600 hover:text-zinc-400 disabled:opacity-40">
                  <FaSync size={10} className={loadingBal ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-white text-2xl font-bold">{loadingBal ? '…' : hbar !== null ? hbar.toFixed(2) : '—'}</p>
              <p className="text-zinc-500 text-xs">HBAR</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs font-medium mb-2">D.FAITH</p>
              <p className="text-white text-2xl font-bold">{loadingBal ? '…' : dfaith !== null ? dfaith.toFixed(2) : DFAITH_TOKEN_ID ? '—' : 'bald'}</p>
              <p className="text-zinc-500 text-xs">D.FAITH</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FaPaperPlane size={12} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">HBAR senden</h3>
            </div>
            <div>
              <label className="text-zinc-400 text-xs block mb-1">Empfänger Account-ID</label>
              <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0.0.12345"
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-400 text-xs">Betrag (HBAR)</label>
                {hbar !== null && <button onClick={() => setSendAmt(Math.max(0, hbar - 0.01).toFixed(4))} className="text-zinc-400 hover:text-white text-xs font-semibold">MAX</button>}
              </div>
              <input type="number" step="0.0001" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)} placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-500" />
            </div>
            {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
            {sendOk  && <p className="text-green-400 text-xs break-all">{sendOk}</p>}
            <button onClick={handleSend} disabled={sending || !recipient.trim() || !sendAmt.trim()}
              className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              {sending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Wird gesendet…</> : <><FaPaperPlane size={12} /> HBAR senden</>}
            </button>
            <p className="text-zinc-600 text-xs text-center">Kein Wallet-App nötig</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FaKey size={11} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">In HashPack exportieren</h3>
            </div>
            <p className="text-zinc-400 text-xs">Private Key anzeigen um ihn in HashPack oder Blade zu importieren.</p>
            {!showExport ? (
              <button onClick={handleExport} disabled={exportLoading}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 py-2 rounded-xl text-sm">
                {exportLoading ? 'Lade…' : 'Private Key anzeigen'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="bg-zinc-800 rounded-xl p-3 flex items-center gap-2">
                  <code className={`text-xs text-yellow-300 break-all flex-1 ${!showKey ? 'blur-sm select-none' : ''}`}>{exportKey}</code>
                  <button onClick={() => setShowKey(v => !v)} className="text-zinc-400 hover:text-white shrink-0">
                    {showKey ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
                <button onClick={() => handleCopy(exportKey)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-xl text-xs flex items-center justify-center gap-1">
                  <FaCopy size={10} /> Key kopieren
                </button>
                <p className="text-red-400 text-xs text-center">⚠ Zeig diesen Key niemandem!</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'swap' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaExchangeAlt size={12} className="text-zinc-400" />
              <span className="text-white text-sm font-semibold">SaucerSwap — HBAR ↔ D.FAITH</span>
            </div>
            <a href={SAUCER_URL} target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1">
              Im Browser öffnen <FaExternalLinkAlt size={9} />
            </a>
          </div>
          <iframe src={SAUCER_URL} className="w-full" style={{ height: '540px', border: 'none' }} title="SaucerSwap" allow="clipboard-write" />
        </div>
      )}

      <p className="text-zinc-600 text-xs text-center">Hedera Mainnet · HashScan Explorer</p>
    </div>
  );
}
