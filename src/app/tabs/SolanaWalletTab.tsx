'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import Image from 'next/image';
import {
  FaCopy, FaCheckCircle, FaSync, FaPaperPlane, FaExternalLinkAlt,
  FaKey, FaEye, FaEyeSlash, FaSpinner, FaExchangeAlt,
  FaChevronDown, FaChevronUp, FaDownload, FaCreditCard,
  FaTimes, FaLock, FaUnlock, FaChartLine, FaInfoCircle, FaGem,
} from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';
import SwapWidget from './wallet/SwapWidget';
import { useLang } from '../components/LangContext';
import { t, tFmt } from '../utils/i18n';

const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

interface TokenEntry {
  mint:     string;
  balance:  number;
  decimals: number;
  name:     string;
  symbol:   string;
  image:    string | null;
  valueUsd: number | null;
  unitPriceUsd: number | null;  // Preis pro Token in USD
  priceChange24h: number | null;
}

type SendMode =
  | { type: 'sol' }
  | { type: 'token'; mint: string; symbol: string; max: number };

type Panel = 'key' | null;
type ActionModal = 'send' | 'swap' | 'receive' | 'buy' | null;

interface OwnedNft {
  mint:       string;
  name:       string;
  image:      string | null;
  collection: string | null;
  isDfaith:   boolean;
  interface:  string;
  attributes: { trait_type: string; value: string }[];
}

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({
  token, loading, onSend, onSwap, onClick,
}: {
  token: TokenEntry;
  loading: boolean;
  onSend: (mode: SendMode) => void;
  onSwap: () => void;
  onClick?: () => void;
}) {
  const isDfaith    = token.mint === DFAITH_MINT;
  const formattedValue = token.valueUsd !== null
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(token.valueUsd)
    : isDfaith ? '$0.00' : '—';
  const changeClass = token.priceChange24h === null
    ? 'text-zinc-500'
    : token.priceChange24h >= 0
    ? 'text-emerald-400'
    : 'text-red-400';
  const formattedChange = token.priceChange24h === null
    ? '—'
    : `${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${isDfaith
          ? 'bg-amber-950/20 border-amber-800/25 hover:bg-amber-950/30'
          : 'bg-white/[0.06] border-white/[0.1] hover:bg-white/[0.09]'}`}>
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
          ${isDfaith ? 'bg-amber-800/20' : 'bg-white/8'}`}>
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
        <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onSend({ type: 'token', mint: token.mint, symbol: token.symbol, max: token.balance })}
            className="bg-[#231e12] hover:bg-[#2d2615] text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1">
            <FaPaperPlane size={9} /> Send
          </button>
          <button
            onClick={onSwap}
            className="bg-[#231e12] hover:bg-emerald-900/40 text-emerald-400 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1">
            <FaExchangeAlt size={9} /> Swap
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Token Detail Modal ───────────────────────────────────────────────────────
type TokenDetailToken = TokenEntry | { type: 'sol'; solBalance: number | null; solValueUsd: number | null; solChange24h: number | null };

function TokenDetailModal({
  token,
  onClose,
  onSend,
  onSwap,
}: {
  token: TokenDetailToken;
  onClose: () => void;
  onSend: (mode: SendMode) => void;
  onSwap: () => void;
}) {
  const lang = useLang();
  const isSol = 'type' in token && token.type === 'sol';
  const isDfaith = !isSol && (token as TokenEntry).mint === DFAITH_MINT;

  const [supply, setSupply]           = useState<number | null>(null);
  const [mintingEnabled, setMintingEnabled] = useState<boolean | null>(null);
  const [supplyLoading, setSupplyLoading] = useState(false);

  // Max Supply für SPL Tokens laden
  useEffect(() => {
    if (isSol) return;
    const mint = (token as TokenEntry).mint;
    if (!mint) return;
    setSupplyLoading(true);
    fetch(`/api/solana/token-supply?mint=${encodeURIComponent(mint)}`)
      .then(r => r.json())
      .then((d: { totalSupply?: number; mintingEnabled?: boolean }) => {
        if (typeof d.totalSupply === 'number') setSupply(d.totalSupply);
        if (typeof d.mintingEnabled === 'boolean') setMintingEnabled(d.mintingEnabled);
      })
      .catch(() => {})
      .finally(() => setSupplyLoading(false));
  }, [isSol, token]);

  const tok = token as TokenEntry;
  const name   = isSol ? 'Solana'  : tok.name;
  const symbol = isSol ? 'SOL'     : tok.symbol;
  const image  = isSol ? null      : tok.image;
  const price  = isSol
    ? (token as { solValueUsd: number | null }).solValueUsd
    : tok.unitPriceUsd ?? (tok.valueUsd != null && tok.balance > 0 ? tok.valueUsd / tok.balance : null);
  const change = isSol
    ? (token as { solChange24h: number | null }).solChange24h
    : tok.priceChange24h;
  const balance = isSol
    ? (token as { solBalance: number | null }).solBalance
    : tok.balance;
  const mintAddress = isSol ? null : tok.mint;

  // GeckoTerminal-Embed (unterstützt Meteora, DLMM-Pools etc.)
  const DFAITH_POOL = '9Ei1AhVghZJxH1hsxP2rdakqBFN9sYsqH2hmTCgzC7yK';
  const SOL_USDC_POOL = 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'; // Raydium SOL/USDC
  const geckoTerminalUrl = isSol
    ? `https://www.geckoterminal.com/solana/pools/${SOL_USDC_POOL}?embed=1&info=0&swaps=0`
    : isDfaith
    ? `https://www.geckoterminal.com/solana/pools/${DFAITH_POOL}?embed=1&info=0&swaps=0`
    : mintAddress
    ? `https://www.geckoterminal.com/solana/tokens/${mintAddress}?embed=1&info=0&swaps=0`
    : null;
  const dexscreenerLink = isSol
    ? `https://dexscreener.com/solana/So11111111111111111111111111111111111111112`
    : isDfaith
    ? `https://dexscreener.com/solana/${DFAITH_POOL}`
    : mintAddress
    ? `https://dexscreener.com/solana/${mintAddress}`
    : null;

  const changeClass = change === null ? 'text-zinc-500' : change >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeLabel = change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[92vh] bg-[#13100a] border border-white/8 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            {image ? (
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                <Image src={image} alt={symbol} width={36} height={36}
                  style={{ width: '36px', height: '36px', objectFit: 'cover', display: 'block' }} unoptimized />
              </div>
            ) : isSol ? (
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.3), rgba(146,64,14,0.25))' }}>
                <SiSolana size={16} className="text-amber-300" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-amber-900/30 flex items-center justify-center shrink-0">
                <span className="text-amber-300 font-bold text-sm">{symbol.slice(0, 2)}</span>
              </div>
            )}
            <div>
              <p className="text-white font-bold text-base leading-tight">{name}</p>
              <p className="text-zinc-500 text-xs">{symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/8">
            <FaTimes size={14} />
          </button>
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="overflow-y-auto flex-1">

          {/* Preis + Balance */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">{t('sol.yourBalance', lang)}</p>
                <p className="text-white text-2xl font-bold">
                  {balance !== null ? balance.toLocaleString('de-DE', { maximumFractionDigits: 4 }) : '—'} {symbol}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${changeClass}`}>{changeLabel}</p>
                <p className="text-zinc-500 text-xs">24h</p>
              </div>
            </div>

            {/* Statistiken */}
            {!isSol && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.05] rounded-xl px-3 py-2.5">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FaChartLine size={8} /> {t('sol.priceApprox', lang)}
                  </p>
                  <p className="text-white text-sm font-semibold">
                    {price != null
                      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(price)
                      : '—'}
                  </p>
                </div>
                <div className="bg-white/[0.05] rounded-xl px-3 py-2.5">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FaInfoCircle size={8} /> {t('sol.maxSupply', lang)}
                  </p>
                  <p className="text-white text-sm font-semibold">
                    {supplyLoading
                      ? <span className="text-zinc-500 text-xs">{t('common.loading', lang)}</span>
                      : supply !== null
                      ? supply.toLocaleString('de-DE', { maximumFractionDigits: 0 })
                      : '—'}
                  </p>
                </div>
              </div>
            )}

            {/* Minting-Status für SPL Tokens */}
            {!isSol && mintingEnabled !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs
                ${mintingEnabled
                  ? 'bg-amber-900/20 border border-amber-800/30 text-amber-400'
                  : 'bg-emerald-900/15 border border-emerald-800/25 text-emerald-400'}`}>
                {mintingEnabled ? <FaUnlock size={10} /> : <FaLock size={10} />}
                <span>{mintingEnabled ? t('sol.mintingActive', lang) : t('sol.mintingDisabled', lang)}</span>
              </div>
            )}

            {/* DFAITH Beschreibung */}
            {isDfaith && (
              <div className="bg-amber-950/20 border border-amber-800/20 rounded-xl px-4 py-3 space-y-2">
                <p className="text-amber-300 text-xs font-bold uppercase tracking-wider">{t('sol.dfaithTitle', lang)}</p>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  {t('sol.dfaithDesc', lang)}
                </p>
                {mintAddress && (
                  <a
                    href={`https://solscan.io/token/${mintAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-300 text-xs transition-colors">
                    <FaExternalLinkAlt size={9} /> {t('sol.viewOnSolscan', lang)}
                  </a>
                )}
              </div>
            )}

            {/* Mint-Adresse für andere Tokens */}
            {!isSol && !isDfaith && mintAddress && (
              <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.06]">
                <span className="text-zinc-500 text-xs font-mono truncate flex-1">{mintAddress.slice(0, 16)}…{mintAddress.slice(-8)}</span>
                <a href={`https://solscan.io/token/${mintAddress}`} target="_blank" rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-amber-300 transition-colors shrink-0">
                  <FaExternalLinkAlt size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Preis-Chart */}
          {geckoTerminalUrl && (
            <div className="px-5 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <FaChartLine size={9} /> {t('sol.priceChart', lang)}
                </p>
                {dexscreenerLink && (
                  <a href={dexscreenerLink} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-amber-400 text-[10px] flex items-center gap-1 transition-colors">
                    DEXscreener <FaExternalLinkAlt size={8} />
                  </a>
                )}
              </div>
              <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ height: 320 }}>
                <iframe
                  src={geckoTerminalUrl}
                  title={`${symbol} Preis-Chart`}
                  width="100%"
                  height="320"
                  style={{ border: 'none', display: 'block' }}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isDfaith && (
            <div className="px-5 py-4 flex gap-3">
              <button
                onClick={() => { onClose(); isSol ? onSend({ type: 'sol' }) : onSend({ type: 'token', mint: tok.mint, symbol: tok.symbol, max: tok.balance }); }}
                className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                <FaPaperPlane size={12} /> {t('sol.send', lang)}
              </button>
              <button
                onClick={() => { onClose(); onSwap(); }}
                className="flex-1 bg-white/[0.08] hover:bg-emerald-900/30 border border-white/[0.1] text-emerald-400 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                <FaExchangeAlt size={12} /> {t('sol.swap', lang)}
              </button>
            </div>
          )}
          {isDfaith && <div className="pb-5" />}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SolanaWalletTab() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { openSignIn, signOut } = useClerk();
  const lang = useLang();
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
  const [tokenDetailModal, setTokenDetailModal] = useState<TokenDetailToken | null>(null);
  const [panel, setPanel]         = useState<Panel>(null);
  const [sendMode, setSendMode]   = useState<SendMode>({ type: 'sol' });
  const [recipient, setRecipient] = useState('');
  const [sendAmt, setSendAmt]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState('');
  const [sendOk, setSendOk]       = useState('');
  const [showSendTokenDrop, setShowSendTokenDrop] = useState(false);

  const [nfts, setNfts]                   = useState<OwnedNft[]>([]);
  const [nftsLoading, setNftsLoading]     = useState(false);
  const [nftSendTarget, setNftSendTarget] = useState<OwnedNft | null>(null);
  const [nftRecipient, setNftRecipient]   = useState('');
  const [nftSending, setNftSending]       = useState(false);
  const [nftSendErr, setNftSendErr]       = useState('');
  const [nftSendOk, setNftSendOk]         = useState('');
  const [nftBurnTarget, setNftBurnTarget] = useState<OwnedNft | null>(null);
  const [nftBurning, setNftBurning]       = useState(false);
  const [nftBurnErr, setNftBurnErr]       = useState('');
  const [nftBurnOk, setNftBurnOk]         = useState('');
  const [nftRedeemTarget, setNftRedeemTarget] = useState<OwnedNft | null>(null);
  const [nftRedeeming, setNftRedeeming]       = useState(false);
  const [nftRedeemErr, setNftRedeemErr]       = useState('');
  const [nftRedeemOk, setNftRedeemOk]         = useState('');

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

        // Referral-Code aus localStorage — unabhängig ob Wallet neu oder bereits vorhanden
        const referralCode = typeof window !== 'undefined' ? localStorage.getItem('dfaith_referral') : null;

        if (checkData.solanaAddress) {
          setSolanaAddr(checkData.solanaAddress);
          // Referral-Fallback: immer versuchen zu speichern wenn Code im localStorage
          // (home/page.tsx sollte ihn bereits gespeichert haben, ON CONFLICT DO NOTHING verhindert Duplikate)
          if (referralCode && userId) {
            fetch('/api/referral', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ referrerWallet: referralCode, referredWallet: userId }),
            }).then(r => {
              if ((r.ok || r.status === 400) && typeof window !== 'undefined') localStorage.removeItem('dfaith_referral');
            }).catch(() => {});
          }
          return;
        }
        setCreating(true);
        setCreateError('');
        const res = await fetch('/api/solana/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: userId, referredBy: referralCode ?? undefined }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Fehler beim Erstellen des Accounts');
        // Referral auch direkt via /api/referral speichern (zusätzlich zu referredBy im POST-Body)
        if (referralCode && userId) {
          fetch('/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrerWallet: referralCode, referredWallet: userId }),
          }).then(r => {
            if ((r.ok || r.status === 400) && typeof window !== 'undefined') localStorage.removeItem('dfaith_referral');
          }).catch(() => {});
        } else if (typeof window !== 'undefined') {
          localStorage.removeItem('dfaith_referral');
        }
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

  useEffect(() => {
    if (!solanaAddr) return;
    setNftsLoading(true);
    fetch(`/api/solana/nfts?solanaAddress=${solanaAddr}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: OwnedNft[]) => setNfts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setNftsLoading(false));
  }, [solanaAddr]);

  // ── Senden ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    setSendErr(''); setSendOk('');
    if (!recipient.trim()) { setSendErr(t('sol.invalidRecipient', lang)); return; }
    const isSolMax = sendMode.type === 'sol' && sendAmt === 'max';
    const amt = parseFloat(sendAmt);
    if (!isSolMax && (!isFinite(amt) || amt <= 0)) { setSendErr(t('sol.invalidAmount', lang)); return; }
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

  // ── NFT senden ───────────────────────────────────────────────────────────
  const handleNftSend = async () => {
    if (!nftSendTarget) return;
    setNftSendErr(''); setNftSendOk('');
    if (!nftRecipient.trim()) { setNftSendErr('Empfänger-Adresse fehlt'); return; }
    setNftSending(true);
    try {
      const res = await fetch('/api/solana/send-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userId,
          toAddress: nftRecipient.trim(),
          amount: 1,
          mintAddress: nftSendTarget.mint,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Transfer fehlgeschlagen');
      setNftSendOk(`✓ NFT gesendet: ${d.signature}`);
      setNfts(prev => prev.filter(n => n.mint !== nftSendTarget.mint));
      setNftRecipient('');
      setTimeout(() => { setNftSendTarget(null); setNftSendOk(''); }, 3000);
    } catch (e) {
      setNftSendErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setNftSending(false);
    }
  };

  // ── NFT burnen ───────────────────────────────────────────────────────────
  const handleNftBurn = async () => {
    if (!nftBurnTarget || !userId) return;
    setNftBurnErr(''); setNftBurnOk('');
    setNftBurning(true);
    try {
      const res = await fetch('/api/solana/burn-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userId, mintAddress: nftBurnTarget.mint }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Burn fehlgeschlagen');
      setNftBurnOk('✓ NFT geburnt — SOL zurückerhalten');
      setNfts(prev => prev.filter(n => n.mint !== nftBurnTarget.mint));
      setTimeout(() => { setNftBurnTarget(null); setNftBurnOk(''); }, 2500);
    } catch (e) {
      setNftBurnErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setNftBurning(false);
    }
  };

  // ── Collectible NFT einlösen (mpl-core → DB) ─────────────────────────────
  const handleNftRedeem = async () => {
    if (!nftRedeemTarget || !userId) return;
    setNftRedeemErr(''); setNftRedeemOk('');
    setNftRedeeming(true);
    try {
      // Collection-Mint aus Grouping-Attributen des NFT ableiten
      const collectionMint = nftRedeemTarget.attributes.find(a => a.trait_type === 'collection')?.value
        ?? nftRedeemTarget.attributes.find(a => a.trait_type === 'Collection')?.value
        ?? '';
      if (!collectionMint) throw new Error('Collection-Adresse nicht gefunden (Helius DAS fehlt collection grouping)');
      const res = await fetch('/api/collectibles/redeem-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userId, mintAddress: nftRedeemTarget.mint, collectionMint }),
      });
      const d = await res.json() as { success?: boolean; rarity?: string; error?: string };
      if (!res.ok || !d.success) throw new Error(d.error ?? 'Einlösen fehlgeschlagen');
      setNftRedeemOk(`✓ Eingelöst als ${d.rarity}-Collectible`);
      setNfts(prev => prev.filter(n => n.mint !== nftRedeemTarget.mint));
      setTimeout(() => { setNftRedeemTarget(null); setNftRedeemOk(''); }, 2500);
    } catch (e) {
      setNftRedeemErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setNftRedeeming(false);
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
        <div>
          <div className="flex items-center gap-2">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={32} height={32} className="w-8 h-8 rounded-full object-contain" />
            <h2 className="text-white font-bold text-sm tracking-widest uppercase">D.FAITH Ecosystem</h2>
          </div>
          <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5 ml-10">Solana Wallet</p>
        </div>
        <div className="bg-white/[0.06] border border-white/[0.1] rounded-2xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center overflow-hidden">
            {!isLoaded
              ? <FaSpinner size={28} className="animate-spin text-amber-400" />
              : <Image src="/D.FAITH.png" alt="D.FAITH" width={64} height={64} className="w-16 h-16 object-contain" />}
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">{t('sol.loginPrompt', lang)}</p>
            <p className="text-zinc-400 text-sm">{t('sol.walletAutoCreated', lang)}</p>
          </div>
          <button onClick={() => openSignIn()} disabled={!isLoaded}
            className="w-full flex items-center justify-center gap-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl text-sm transition-colors tracking-wide">
            {!isLoaded
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : t('sol.loginBtn', lang)}
          </button>
        </div>
      </div>
    );
  }

  // ── Erstellen ──────────────────────────────────────────────────────────────
  if (creating || (userId && !solanaAddr && !createError)) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={32} height={32} className="w-8 h-8 rounded-full object-contain" />
            <h2 className="text-white font-bold text-sm tracking-widest uppercase">D.FAITH Ecosystem</h2>
          </div>
          <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5 ml-10">Solana Wallet</p>
        </div>
        <div className="bg-white/[0.06] border border-white/[0.1] rounded-2xl p-8 text-center space-y-4">
          <FaSpinner size={28} className="animate-spin text-amber-400 mx-auto" />
          <p className="text-white font-semibold">{t('sol.creatingWallet', lang)}</p>
          <p className="text-zinc-400 text-sm">{t('sol.creatingHint', lang)}</p>
        </div>
      </div>
    );
  }

  // ── Fehler ─────────────────────────────────────────────────────────────────
  if (createError) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={32} height={32} className="w-8 h-8 rounded-full object-contain" />
            <h2 className="text-white font-bold text-sm tracking-widest uppercase">D.FAITH Ecosystem</h2>
          </div>
          <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5 ml-10">Solana Wallet</p>
        </div>
        <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6 space-y-3">
          <p className="text-red-300 font-semibold text-sm">{t('sol.createError', lang)}</p>
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
      unitPriceUsd: null,
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
        <div>
          <div className="flex items-center gap-2">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={32} height={32} className="w-8 h-8 rounded-full object-contain" />
            <span className="text-white font-bold text-sm tracking-widest uppercase">D.FAITH Ecosystem</span>
          </div>
          <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-semibold mt-0.5 ml-10">Solana Wallet</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadBalance(solanaAddr!)} disabled={loadingBal}
            className="text-zinc-500 hover:text-white disabled:opacity-40 p-1.5 rounded-lg hover:bg-[#231e12] transition-colors">
            <FaSync size={13} className={loadingBal ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => signOut()} className="text-zinc-500 hover:text-red-400 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-[#231e12] transition-colors">
            Abmelden
          </button>
        </div>
      </div>

      {/* ── Balance Card ── */}
      <div className="relative rounded-3xl overflow-hidden p-6 shadow-2xl border border-amber-900/20"
        style={{ background: 'linear-gradient(135deg, #1a150a 0%, #241c09 50%, #1a150a 100%)' }}>
        {/* Dekorative Kreise */}
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #d97706, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #92400e, transparent)', transform: 'translate(-30%, 30%)' }} />
        <div className="relative z-10 space-y-5">
          <div>
            <p className="text-amber-200/50 text-xs font-medium uppercase tracking-widest mb-1">{t('sol.totalAssets', lang)}</p>
            <p className="text-white text-4xl font-bold tracking-tight">
              {loadingBal ? <span className="opacity-40">…</span> : hasPriceData ? totalValueLabel : '—'}
            </p>
            {solChange24h !== null && (
              <p className={`text-sm mt-1 font-medium ${solChangeClass}`}>{solChangeLabel} (24h)</p>
            )}
          </div>
          {/* Wallet Adresse */}
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-amber-900/20">
            <SiSolana size={13} className="text-amber-400/70 shrink-0" />
            <span className="text-amber-100/70 font-mono text-xs flex-1 truncate">
              {solanaAddr?.slice(0, 10)}…{solanaAddr?.slice(-8)}
            </span>
            <button onClick={() => handleCopy(solanaAddr!)} className="text-amber-400/60 hover:text-amber-300 transition-colors shrink-0 p-1">
              {copied ? <FaCheckCircle size={12} className="text-emerald-400" /> : <FaCopy size={12} />}
            </button>
            <a href={`https://solscan.io/account/${solanaAddr}`} target="_blank" rel="noopener noreferrer"
              className="text-amber-400/60 hover:text-amber-300 transition-colors shrink-0 p-1">
              <FaExternalLinkAlt size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Send',    icon: <FaPaperPlane size={20} />,  color: 'text-amber-400 group-hover:text-amber-300', onClick: () => openSendPanel({ type: 'sol' }) },
          { label: 'Receive', icon: <FaDownload size={20} />,    color: 'text-blue-400 group-hover:text-blue-300',    onClick: () => setActionModal('receive') },
          { label: 'Swap',    icon: <FaExchangeAlt size={20} />, color: 'text-emerald-400 group-hover:text-emerald-300', onClick: () => setActionModal('swap') },
          { label: 'Buy',     icon: <FaCreditCard size={20} />,  color: 'text-amber-400 group-hover:text-amber-300',  onClick: () => setActionModal('buy') },
        ] as const).map(({ label, icon, color, onClick }) => (
          <button key={label} onClick={onClick}
            className="group flex flex-col items-center gap-2 py-4 bg-white/[0.06] border border-white/[0.1] hover:border-white/15 rounded-2xl transition-all hover:bg-white/6">
            <span className={`transition-all ${color}`}>{icon}</span>
            <span className="text-zinc-400 group-hover:text-white text-xs font-semibold transition-colors">{label}</span>
          </button>
        ))}
      </div>

      <>

      {/* ── Assets ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">{t('sol.assets', lang)}</p>
          {loadingBal && <FaSpinner size={10} className="text-zinc-600 animate-spin" />}
        </div>

        {/* SOL Row */}
        <div
          onClick={() => setTokenDetailModal({ type: 'sol', solBalance, solValueUsd, solChange24h })}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-white/[0.06] border-white/[0.1] hover:bg-white/[0.09] hover:border-white/15 transition-colors cursor-pointer">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-600/20"
            style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.25), rgba(146,64,14,0.2))' }}>
            <SiSolana size={20} className="text-amber-300" />
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
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">{t('sol.artistTokens', lang)}</p>
        </div>

        {/* D.FAITH — wird immer angezeigt */}
        {(() => {
          const dfaithDisplay = dfaithToken
            ? { ...dfaithToken, image: dfaithToken.image || '/D.FAITH.png' }
            : { mint: DFAITH_MINT, balance: 0, decimals: 2, name: 'D.FAITH', symbol: 'DFAITH', image: '/D.FAITH.png', valueUsd: 0, unitPriceUsd: null, priceChange24h: null };
          return (
            <TokenRow
              token={dfaithDisplay}
              loading={loadingBal}
              onSend={openSendPanel}
              onSwap={() => setActionModal('swap')}
              onClick={() => setTokenDetailModal(dfaithDisplay)}
            />
          );
        })()}

        {/* Weitere Artist Tokens */}
        {otherTokens.map(token => (
          <TokenRow key={token.mint} token={token} loading={false} onSend={openSendPanel} onSwap={() => setActionModal('swap')}
            onClick={() => setTokenDetailModal(token)} />
        ))}

        {tokens.length === 0 && !loadingBal && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-center space-y-1">
            <p className="text-zinc-500 text-sm">{t('sol.noArtistTokens', lang)}</p>
            <p className="text-zinc-600 text-xs">{t('sol.noArtistTokensHint', lang)}</p>
          </div>
        )}
      </div>

      {/* ── NFTs ── */}
      <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">NFTs</p>
            {nftsLoading && <FaSpinner size={10} className="text-zinc-600 animate-spin" />}
          </div>
          {nftsLoading ? (
            <div className="space-y-2">
              {[1,2].map(i => (
                <div key={i} className="h-16 rounded-2xl bg-zinc-900/60 border border-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : nfts.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-center space-y-1">
              <FaGem size={20} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Noch keine NFTs</p>
              <p className="text-zinc-600 text-xs">Kaufe Items im Shop um deine Sammlung zu starten</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nfts.map(nft => {
                const editionAttr = nft.attributes.find(a => a.trait_type === 'Max Editions')?.value;
                const artistAttr  = nft.attributes.find(a => a.trait_type === 'Artist')?.value;
                return (
                  <div key={nft.mint} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                    nft.isDfaith
                      ? 'bg-violet-950/20 border-violet-800/25 hover:bg-violet-950/30'
                      : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08]'
                  }`}>
                    {nft.image ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                        <Image src={nft.image} alt={nft.name} width={40} height={40}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', display: 'block' }} unoptimized />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${nft.isDfaith ? 'bg-violet-900/40' : 'bg-white/8'}`}>
                        <FaGem size={16} className={nft.isDfaith ? 'text-violet-400' : 'text-zinc-500'} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white text-sm font-semibold truncate">{nft.name}</p>
                        {nft.isDfaith && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-900/60 border border-violet-500/30 text-violet-300">D.FAITH</span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs truncate">
                        {artistAttr ? `${artistAttr}` : ''}
                        {editionAttr ? ` · ${editionAttr} Editionen` : ''}
                        {!artistAttr && !editionAttr ? nft.interface : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => { setNftSendTarget(nft); setNftSendErr(''); setNftSendOk(''); setNftRecipient(''); }}
                        className="bg-[#231e12] hover:bg-[#2d2615] text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                        <FaPaperPlane size={9} /> Send
                      </button>
                      {nft.isDfaith && nft.interface === 'MplCoreAsset' ? (
                        <button
                          onClick={() => { setNftRedeemTarget(nft); setNftRedeemErr(''); setNftRedeemOk(''); }}
                          className="bg-purple-950/40 hover:bg-purple-900/50 text-purple-400 hover:text-purple-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                          ✨ Einlösen
                        </button>
                      ) : (
                        <button
                          onClick={() => { setNftBurnTarget(nft); setNftBurnErr(''); setNftBurnOk(''); }}
                          className="bg-red-950/40 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                          🔥 Burn
                        </button>
                      )}
                      <a href={`https://solscan.io/token/${nft.mint}`} target="_blank" rel="noopener noreferrer"
                        className="bg-[#231e12] hover:bg-[#2d2615] text-zinc-500 hover:text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                        <FaExternalLinkAlt size={8} /> Info
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* ── Private Key (aufklappbar) ── */}
      <div className="bg-white/[0.06] border border-white/[0.1] rounded-2xl overflow-hidden">
        <button
          onClick={() => setPanel(p => p === 'key' ? null : 'key')}
          className="w-full flex items-center justify-between px-4 py-3 text-zinc-500 hover:text-amber-400 transition-colors">
          <div className="flex items-center gap-2">
            <FaKey size={12} />
            <span className="text-sm font-semibold">{t('sol.exportKey', lang)}</span>
          </div>
          {panel === 'key' ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
        </button>
        {panel === 'key' && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            {!showExport ? (
              <button onClick={handleExport} disabled={exportLoading}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-zinc-300 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                {exportLoading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.loading', lang)}</>
                  : <><FaKey size={12} /> {t('sol.showKey', lang)}</>}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <p className={`text-white font-mono text-xs break-all bg-[#231e12] rounded-xl p-3 ${!showKey ? 'blur-sm select-none' : ''}`}>
                    {exportKey}
                  </p>
                  <button onClick={() => setShowKey(!showKey)}
                    className="absolute top-2 right-2 text-zinc-400 hover:text-white">
                    {showKey ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
                {showKey && (
                  <button onClick={() => handleCopy(exportKey)}
                    className="w-full bg-[#2d2615] hover:bg-zinc-600 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1">
                    {copied ? <><FaCheckCircle size={10} className="text-green-400" /> {t('sol.copied', lang)}</> : <><FaCopy size={10} /> {t('sol.copy', lang)}</>}
                  </button>
                )}
                <p className="text-yellow-500/80 text-xs">{t('sol.privateKeyWarning', lang)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      </>

      {/* ── NFT Send Modal ── */}
      {nftSendTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-[#13100a] border border-violet-800/30 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-900/40 flex items-center justify-center">
                  <FaGem size={14} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{nftSendTarget.name}</p>
                  <p className="text-violet-300/60 text-xs">NFT senden</p>
                </div>
              </div>
              <button onClick={() => setNftSendTarget(null)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/8">
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-zinc-400 text-xs block mb-1.5">Empfänger (Solana-Adresse)</label>
                <input
                  value={nftRecipient}
                  onChange={e => setNftRecipient(e.target.value)}
                  placeholder="Bs58-Adresse…"
                  className="w-full bg-[#231e12] border border-white/[0.1] text-white rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-violet-500/50"
                />
              </div>
              {nftSendErr && <p className="text-red-400 text-xs">{nftSendErr}</p>}
              {nftSendOk  && <p className="text-emerald-400 text-xs break-all">{nftSendOk}</p>}
              <button
                onClick={handleNftSend}
                disabled={nftSending || !nftRecipient.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                {nftSending
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird gesendet…</>
                  : <><FaPaperPlane size={12} /> NFT senden</>}
              </button>
              <p className="text-zinc-600 text-xs text-center">On-Chain Transfer · nicht umkehrbar</p>
            </div>
          </div>
        </div>
      )}

      {/* ── NFT Burn Modal ── */}
      {nftBurnTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a0a0a] border border-red-900/40 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-red-900/30 flex items-center justify-between">
              <div>
                <p className="text-red-400 font-bold text-sm">🔥 NFT verbrennen</p>
                <p className="text-red-300/60 text-xs">{nftBurnTarget.name}</p>
              </div>
              <button onClick={() => setNftBurnTarget(null)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/8">
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-zinc-400 text-sm">
                Das NFT wird dauerhaft vernichtet und die Rent-SOL werden zurück auf dein Wallet gutgeschrieben. <span className="text-red-400 font-semibold">Diese Aktion ist nicht umkehrbar.</span>
              </p>
              {nftBurnErr && <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">{nftBurnErr}</p>}
              {nftBurnOk  && <p className="text-green-400 text-xs bg-green-900/20 rounded-lg px-3 py-2">{nftBurnOk}</p>}
              <button
                onClick={handleNftBurn}
                disabled={nftBurning}
                className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {nftBurning
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : '🔥 Jetzt verbrennen'}
              </button>
              <p className="text-zinc-600 text-xs text-center">Endgültig · SOL wird zurückerstattet</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Collectible NFT Einlösen Modal ── */}
      {nftRedeemTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f0b1a] border border-purple-900/40 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-purple-950/30 border-b border-purple-900/30">
              <div>
                <p className="text-purple-300 font-bold text-sm">✨ NFT einlösen</p>
                <p className="text-purple-300/60 text-xs">{nftRedeemTarget.name}</p>
              </div>
              <button onClick={() => setNftRedeemTarget(null)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/8">
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-zinc-400 text-sm">
                Das NFT wird on-chain verbrannt und als Collectible in deinem D.FAITH-Account gespeichert. Du kannst es danach wieder handeln oder nutzen.
              </p>
              {nftRedeemErr && <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">{nftRedeemErr}</p>}
              {nftRedeemOk  && <p className="text-green-400 text-xs bg-green-900/20 rounded-lg px-3 py-2">{nftRedeemOk}</p>}
              <button
                onClick={handleNftRedeem}
                disabled={nftRedeeming}
                className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {nftRedeeming
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : '✨ Jetzt einlösen'}
              </button>
              <p className="text-zinc-600 text-xs text-center">NFT wird verbrannt · Collectible wird in D.FAITH gespeichert</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Token Detail Modal ── */}
      {tokenDetailModal && (
        <TokenDetailModal
          token={tokenDetailModal}
          onClose={() => setTokenDetailModal(null)}
          onSend={openSendPanel}
          onSwap={() => setActionModal('swap')}
        />
      )}

      {/* ── Action Modal ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[88vh] bg-[#1a150a] border border-white/8 rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.1] flex items-center justify-between">
              <h3 className="text-amber-400 font-bold text-xs uppercase tracking-widest">
                {actionModal === 'send' && tFmt('sol.modalSend', lang, { label: sendLabel })}
                {actionModal === 'swap' && t('sol.tokenSwap', lang)}
                {actionModal === 'receive' && t('sol.modalReceive', lang)}
                {actionModal === 'buy' && t('sol.modalBuy', lang)}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-zinc-600 hover:text-zinc-300 text-xs uppercase tracking-wide">{t('common.close', lang)}</button>
            </div>

            <div className="overflow-y-auto max-h-[calc(88vh-56px)] p-4 bg-[#13120e]">
              {actionModal === 'send' && (
                <div className="space-y-3">
                  {/* Token Selector */}
                  <div className="relative">
                    <label className="text-zinc-400 text-xs block mb-1">Token</label>
                    <button
                      onClick={() => setShowSendTokenDrop(!showSendTokenDrop)}
                      className="w-full bg-[#231e12] border border-white/[0.1] hover:border-zinc-600 rounded-xl px-3 py-2 flex items-center justify-between text-white text-sm">
                      <span>{sendLabel}</span>
                      <FaChevronDown size={10} className={`transition-transform ${showSendTokenDrop ? 'rotate-180' : ''}`} />
                    </button>
                    {showSendTokenDrop && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#231e12] border border-white/[0.1] rounded-xl shadow-xl overflow-hidden">
                        <button
                          onClick={() => { openSendPanel({ type: 'sol' }); setShowSendTokenDrop(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#2d2615] transition-colors text-left">
                          <div className="w-6 h-6 bg-amber-700/30 rounded-full flex items-center justify-center shrink-0">
                            <SiSolana size={12} className="text-amber-400" />
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
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#2d2615] transition-colors text-left border-t border-white/[0.1]">
                            {token.image
                              ? <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                                  <Image src={token.image} alt={token.symbol} width={24} height={24} style={{ width: '24px', height: '24px', objectFit: 'cover', display: 'block' }} unoptimized />
                                </div>
                              : <div className="w-6 h-6 rounded-full bg-[#2d2615] flex items-center justify-center shrink-0">
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
                    <label className="text-zinc-400 text-xs block mb-1">{t('sol.labelRecipient', lang)}</label>
                    <input value={recipient} onChange={e => setRecipient(e.target.value)}
                      placeholder="Bs58-Adresse…"
                      className="w-full bg-[#231e12] border border-white/[0.1] text-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-zinc-400 text-xs">{tFmt('sol.amountLabel', lang, { label: sendLabel })}</label>
                      <button onClick={() => setSendAmt(sendMax)} className="text-zinc-400 hover:text-white text-xs font-semibold">MAX</button>
                    </div>
                    {sendAmt === 'max'
                      ? (
                        <div className="w-full bg-[#1f1609] border border-amber-700/50 text-amber-300/80 rounded-xl px-3 py-2 text-sm flex items-center justify-between">
                          <span>{t('sol.fullBalanceMinusFee', lang)}</span>
                          <button onClick={() => setSendAmt('')} className="text-zinc-500 hover:text-white text-xs ml-2">✕</button>
                        </div>
                      ) : (
                        <input type="number" step="0.000001" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#231e12] border border-white/[0.1] text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-zinc-500" />
                      )}
                  </div>
                  {sendErr && <p className="text-red-400 text-xs">{sendErr}</p>}
                  {sendOk  && <p className="text-green-400 text-xs break-all">{sendOk}</p>}
                  <button onClick={handleSend} disabled={sending || !recipient.trim() || !sendAmt.trim()}
                    className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                    {sending
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('sol.sending', lang)}</>
                      : <><FaPaperPlane size={12} /> {t('sol.send', lang)}</>}
                  </button>
                  <p className="text-zinc-600 text-xs text-center">{t('sol.onChainHint', lang)}</p>
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
                  <div className="bg-[#231e12]/50 border border-white/[0.1] rounded-2xl p-4 text-center space-y-3">
                    <Image src={receiveQrUrl} alt="SOL Receive QR" width={192} height={192} className="w-48 h-48 rounded-xl mx-auto bg-white p-2" />
                    <p className="text-zinc-400 text-xs">{t('sol.receiveHint', lang)}</p>
                    <p className="text-white font-mono text-xs break-all bg-[#231e12] rounded-xl p-3">{solanaAddr}</p>
                    <button onClick={() => handleCopy(solanaAddr!)}
                      className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
                      {copied ? <><FaCheckCircle size={11} /> {t('sol.copied', lang)}</> : <><FaCopy size={11} /> {t('sol.copyAddress', lang)}</>}
                    </button>
                  </div>
                </div>
              )}

              {actionModal === 'buy' && (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-xs">{t('sol.buyHint', lang)}</p>
                  <a
                    href={`https://buy.moonpay.com/?currencyCode=sol&walletAddress=${solanaAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                    <FaCreditCard size={14} /> {t('sol.buyWithMoonpay', lang)}
                  </a>
                  <div className="bg-[#231e12]/50 rounded-xl px-3 py-2">
                    <p className="text-zinc-500 text-xs font-medium mb-0.5">{t('sol.targetAddress', lang)}</p>
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

