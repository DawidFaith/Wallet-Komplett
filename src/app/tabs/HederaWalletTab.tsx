'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCopy, FaCheckCircle, FaSync, FaPaperPlane, FaExternalLinkAlt,
  FaExchangeAlt, FaLink, FaKey, FaEye, FaEyeSlash,
} from 'react-icons/fa';
import { SiHedera } from 'react-icons/si';

// Token-ID aus ENV (NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID setzen nach dem Minten)
const DFAITH_TOKEN_ID = process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID ?? '';
const SAUCER_URL = DFAITH_TOKEN_ID
  ? `https://www.saucerswap.finance/swap/HBAR/${DFAITH_TOKEN_ID}`
  : 'https://www.saucerswap.finance';

type Tab = 'wallet' | 'swap';

export default function HederaWalletTab() {
  // ── Account State ──────────────────────────────────────────────
  const [accountId, setAccountId] = useState('');
  const [inputId, setInputId]     = useState('');
  const [inputErr, setInputErr]   = useState('');

  // ── Balance ────────────────────────────────────────────────────
  const [hbar, setHbar]   = useState<number | null>(null);
  const [dfaith, setDfaith] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);

  // ── Send HBAR (server-seitig) ──────────────────────────────────
  const [recipient, setRecipient] = useState('');
  const [sendAmt, setSendAmt]     = useState('');
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');
  const [sending, setSending]     = useState(false);

  // ── Association ────────────────────────────────────────────────
  const [assocMsg, setAssocMsg]   = useState('');
  const [assocLoading, setAssocLoading] = useState(false);

  // ── Key Export ─────────────────────────────────────────────────
  const [showExport, setShowExport]   = useState(false);
  const [exportKey, setExportKey]     = useState('');
  const [showKey, setShowKey]         = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Misc ───────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('wallet');

  // Laden aus localStorage beim Mount
  useEffect(() => {
    const saved = localStorage.getItem('hedera_account_id');
    if (saved) setAccountId(saved);
  }, []);

  // ── Balance laden ──────────────────────────────────────────────
  const loadBalance = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingBal(true);
    try {
      const p = new URLSearchParams({ accountId: id });
      if (DFAITH_TOKEN_ID) p.set('tokenId', DFAITH_TOKEN_ID);
      const res = await fetch(`/api/hedera/balance?${p}`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const d = await res.json();
      setHbar(d.hbarBalance ?? null);
      setDfaith(d.tokenBalance ?? null);
    } catch {
      // ignore, user sieht "—"
    } finally {
      setLoadingBal(false);
    }
  }, []);

  useEffect(() => {
    if (accountId) loadBalance(accountId);
  }, [accountId, loadBalance]);

  // ── Verbinden ──────────────────────────────────────────────────
  const handleConnect = () => {
    setInputErr('');
    const id = inputId.trim();
    if (!/^\d+\.\d+\.\d+$/.test(id)) {
      setInputErr('Format: 0.0.12345');
      return;
    }
    localStorage.setItem('hedera_account_id', id);
    setAccountId(id);
    setInputId('');
  };

  const handleDisconnect = () => {
    localStorage.removeItem('hedera_account_id');
    setAccountId('');
    setHbar(null);
    setDfaith(null);
    setShowExport(false);
    setExportKey('');
  };

  // ── Kopieren ───────────────────────────────────────────────────
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── D.FAITH aktivieren ─────────────────────────────────────────
  const handleAssociate = async () => {
    setAssocLoading(true);
    setAssocMsg('');
    try {
      const res = await fetch('/api/hedera/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Fehler');
      setAssocMsg(d.alreadyAssociated
        ? '✓ D.FAITH bereits aktiviert'
        : '✓ D.FAITH aktiviert! +0.5 HBAR Startguthaben erhalten.');
      if (!d.alreadyAssociated) setTimeout(() => loadBalance(accountId), 2500);
    } catch (e) {
      setAssocMsg('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    } finally {
      setAssocLoading(false);
    }
  };

  // ── HBAR senden (server-seitig, kein Wallet-App nötig) ─────────
  const handleSend = async () => {
    setSendErr('');
    setSendOk('');
    if (!/^\d+\.\d+\.\d+$/.test(recipient.trim())) {
      setSendErr('Ungültige Empfänger-ID (0.0.12345)');
      return;
    }
    const amt = parseFloat(sendAmt);
    if (!isFinite(amt) || amt <= 0) {
      setSendErr('Ungültiger Betrag');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/hedera/send-hbar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, toAccountId: recipient.trim(), amountHbar: amt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Fehler');
      setSendOk(`✓ Gesendet! TX: ${d.transactionId}`);
      setRecipient('');
      setSendAmt('');
      setTimeout(() => loadBalance(accountId), 3000);
    } catch (e) {
      setSendErr('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    } finally {
      setSending(false);
    }
  };

  // ── Private Key exportieren ────────────────────────────────────
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/hedera/export-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
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

  // ══════════════════════════════════════════════════════════════
  // Nicht verbunden → Account-ID Eingabe
  // ══════════════════════════════════════════════════════════════
  if (!accountId) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SiHedera size={24} className="text-zinc-300" />
          <h2 className="text-white font-bold text-xl">Hedera Wallet</h2>
          <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs px-2 py-0.5 rounded-full">HBAR</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center">
            <SiHedera size={32} className="text-zinc-300" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-white font-semibold">Hedera Account-ID eingeben</p>
            <p className="text-zinc-400 text-sm">
              Gib deine Account-ID aus Blade oder HashPack ein.
            </p>
          </div>
          <div className="space-y-2">
            <input
              value={inputId}
              onChange={e => setInputId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="0.0.12345"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500 text-center"
            />
            {inputErr && <p className="text-red-400 text-xs text-center">{inputErr}</p>}
            <button
              onClick={handleConnect}
              disabled={!inputId.trim()}
              className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              <FaLink size={12} /> Verbinden
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-4 text-center space-y-2">
            <p className="text-zinc-500 text-xs font-medium">Empfohlene Wallets (kostenlos, Social Login)</p>
            <div className="flex justify-center gap-4">
              <a href="https://bladewallet.io" target="_blank" rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white text-xs flex items-center gap-1">
                Blade <FaExternalLinkAlt size={9} />
              </a>
              <span className="text-zinc-700">|</span>
              <a href="https://www.hashpack.app" target="_blank" rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white text-xs flex items-center gap-1">
                HashPack <FaExternalLinkAlt size={9} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Verbunden → Wallet-Dashboard
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SiHedera size={22} className="text-zinc-300" />
          <h2 className="text-white font-bold text-xl">Hedera Wallet</h2>
        </div>
        <button onClick={handleDisconnect} className="text-zinc-500 hover:text-red-400 text-xs transition-colors">
          Trennen
        </button>
      </div>

      {/* Tab-Switcher */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {(['wallet', 'swap'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize
              ${activeTab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t === 'swap' ? <span className="flex items-center justify-center gap-1"><FaExchangeAlt size={10} /> Swap</span> : 'Wallet'}
          </button>
        ))}
      </div>

      {activeTab === 'wallet' && (
        <>
          {/* Account-ID */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-zinc-500 text-xs font-medium">Account-ID</p>
              <button onClick={() => handleCopy(accountId)} className="text-zinc-500 hover:text-white text-xs flex items-center gap-1">
                {copied ? <><FaCheckCircle size={10} className="text-green-400" /> Kopiert</> : <><FaCopy size={10} /> Kopieren</>}
              </button>
            </div>
            <p className="text-white font-mono text-sm">{accountId}</p>
            <a
              href={`https://hashscan.io/mainnet/account/${accountId}`}
              target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 mt-1"
            >
              HashScan <FaExternalLinkAlt size={9} />
            </a>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-500 text-xs font-medium">HBAR</p>
                <button onClick={() => loadBalance(accountId)} disabled={loadingBal} className="text-zinc-600 hover:text-zinc-400 disabled:opacity-40">
                  <FaSync size={10} className={loadingBal ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-white text-2xl font-bold">{loadingBal ? '…' : hbar !== null ? hbar.toFixed(2) : '—'}</p>
              <p className="text-zinc-500 text-xs">HBAR</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs font-medium mb-2">D.FAITH</p>
              <p className="text-white text-2xl font-bold">
                {loadingBal ? '…' : dfaith !== null ? dfaith.toFixed(2) : DFAITH_TOKEN_ID ? '—' : 'bald'}
              </p>
              <p className="text-zinc-500 text-xs">D.FAITH</p>
            </div>
          </div>

          {/* D.FAITH aktivieren */}
          {DFAITH_TOKEN_ID && dfaith === null && !loadingBal && (
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-4 space-y-3">
              <p className="text-white text-sm font-semibold">D.FAITH Token aktivieren</p>
              <p className="text-zinc-400 text-xs">
                Einmalig kostenlos — wir übernehmen die Gebühr ($0.05) und schicken 0.5 HBAR Startguthaben.
              </p>
              {assocMsg && (
                <p className={`text-xs ${assocMsg.startsWith('Fehler') ? 'text-red-400' : 'text-green-400'}`}>{assocMsg}</p>
              )}
              <button
                onClick={handleAssociate}
                disabled={assocLoading}
                className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-semibold py-2 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {assocLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Wird aktiviert…</>
                  : <><FaCheckCircle size={12} />D.FAITH kostenlos aktivieren</>}
              </button>
            </div>
          )}

          {/* HBAR senden */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FaPaperPlane size={12} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">HBAR senden</h3>
            </div>
            <div>
              <label className="text-zinc-400 text-xs block mb-1">Empfänger Account-ID</label>
              <input
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="0.0.12345"
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-400 text-xs">Betrag (HBAR)</label>
                {hbar !== null && (
                  <button onClick={() => setSendAmt(Math.max(0, hbar - 0.01).toFixed(4))} className="text-zinc-400 hover:text-white text-xs font-semibold">
                    MAX
                  </button>
                )}
              </div>
              <input
                type="number" step="0.0001" min="0"
                value={sendAmt}
                onChange={e => setSendAmt(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
            {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
            {sendOk  && <p className="text-green-400 text-xs break-all">{sendOk}</p>}
            <button
              onClick={handleSend}
              disabled={sending || !recipient.trim() || !sendAmt.trim()}
              className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {sending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Wird gesendet…</>
                : <><FaPaperPlane size={12} /> HBAR senden</>}
            </button>
            <p className="text-zinc-600 text-xs text-center">Kein Wallet-App nötig — Server signiert direkt</p>
          </div>

          {/* Key Export */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FaKey size={11} className="text-zinc-400" />
              <h3 className="text-white text-sm font-semibold">In HashPack / Blade exportieren</h3>
            </div>
            <p className="text-zinc-400 text-xs">
              Du kannst deinen Private Key einmalig anzeigen lassen und ihn in eine eigene Wallet importieren.
            </p>
            {!showExport ? (
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 font-medium py-2 rounded-xl text-sm"
              >
                {exportLoading ? 'Lade…' : 'Private Key anzeigen'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="bg-zinc-800 rounded-xl p-3 flex items-center gap-2">
                  <code className={`text-xs text-yellow-300 break-all flex-1 ${!showKey ? 'blur-sm select-none' : ''}`}>
                    {exportKey}
                  </code>
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

      {/* Swap Tab */}
      {activeTab === 'swap' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaExchangeAlt size={12} className="text-zinc-400" />
              <span className="text-white text-sm font-semibold">SaucerSwap — HBAR ↔ D.FAITH</span>
            </div>
            <a href={SAUCER_URL} target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1">
              Öffnen <FaExternalLinkAlt size={9} />
            </a>
          </div>
          <iframe
            src={SAUCER_URL}
            className="w-full"
            style={{ height: '540px', border: 'none' }}
            title="SaucerSwap"
            allow="clipboard-write"
          />
        </div>
      )}

      <p className="text-zinc-600 text-xs text-center">Hedera Mainnet · HashScan Explorer</p>
    </div>
  );
}
