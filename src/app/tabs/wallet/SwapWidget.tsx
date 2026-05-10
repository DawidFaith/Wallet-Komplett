'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaExchangeAlt, FaSpinner, FaCheckCircle, FaChevronDown, FaArrowDown } from 'react-icons/fa';
import { SiSolana } from 'react-icons/si';
import Image from 'next/image';

const SOL_MINT    = 'So11111111111111111111111111111111111111112';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';
const SLIPPAGE    = 50; // 0.5% in bps

interface TokenOption {
  mint:     string;
  symbol:   string;
  name:     string;
  image:    string | null;
  decimals: number;
  balance:  number;
}

interface QuoteResult {
  inAmount:        string;
  outAmount:       string;
  priceImpactPct:  string;
  routePlan:       { swapInfo: { label: string } }[];
  raw:             Record<string, unknown>;
}

interface Props {
  walletAddress:  string;   // custodial Solana address (Bs58)
  evmAddress:     string;   // Particle / DB identifier
  tokens:         TokenOption[];
  solBalance:     number;
  onSwapSuccess:  () => void;
}

function TokenIcon({ token }: { token: TokenOption }) {
  if (token.mint === SOL_MINT) {
    return (
      <div className="w-8 h-8 bg-purple-700/40 rounded-full flex items-center justify-center shrink-0">
        <SiSolana size={16} className="text-purple-300" />
      </div>
    );
  }
  if (token.image) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
        <Image src={token.image} alt={token.symbol} width={32} height={32} className="rounded-full object-cover" unoptimized />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center shrink-0">
      <span className="text-white text-xs font-bold">{token.symbol.slice(0, 2)}</span>
    </div>
  );
}

export default function SwapWidget({ walletAddress, evmAddress, tokens, solBalance, onSwapSuccess }: Props) {
  // Alle verfügbaren Input-Tokens (SOL + SPL mit Balance)
  const inputOptions: TokenOption[] = [
    { mint: SOL_MINT, symbol: 'SOL', name: 'Solana', image: null, decimals: 9, balance: solBalance },
    ...tokens.filter(t => t.balance > 0 && t.mint !== SOL_MINT),
  ];

  const dfaithToken: TokenOption = tokens.find(t => t.mint === DFAITH_MINT) ?? {
    mint: DFAITH_MINT, symbol: 'DFAITH', name: 'D.FAITH', image: null, decimals: 2, balance: 0,
  };

  const [inputToken, setInputToken]   = useState<TokenOption>(inputOptions[0]);
  const [outputToken, setOutputToken] = useState<TokenOption>(dfaithToken);
  const [inputAmt, setInputAmt]       = useState('');
  const [showInputDrop, setShowInputDrop]   = useState(false);
  const [showOutputDrop, setShowOutputDrop] = useState(false);

  const [quote, setQuote]         = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteErr, setQuoteErr]   = useState('');

  const [swapping, setSwapping]   = useState(false);
  const [swapOk, setSwapOk]       = useState('');
  const [swapErr, setSwapErr]     = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Output-Optionen: alle Tokens außer dem aktuellen Input
  const outputOptions: TokenOption[] = [
    dfaithToken,
    { mint: SOL_MINT, symbol: 'SOL', name: 'Solana', image: null, decimals: 9, balance: solBalance },
    ...tokens.filter(t => t.mint !== SOL_MINT && t.mint !== DFAITH_MINT),
  ].filter(t => t.mint !== inputToken.mint);

  // Tausch Input/Output
  const flipTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmt('');
    setQuote(null);
    setQuoteErr('');
  };

  // Quote holen (debounced)
  const fetchQuote = useCallback(async (amt: string, inTok: TokenOption, outTok: TokenOption) => {
    const parsed = parseFloat(amt);
    if (!parsed || parsed <= 0 || !inTok.mint || !outTok.mint) {
      setQuote(null); setQuoteErr(''); return;
    }
    const rawAmount = Math.round(parsed * 10 ** inTok.decimals);
    setQuoteLoading(true); setQuoteErr(''); setQuote(null);
    try {
      const res = await fetch(
        `/api/solana/jupiter-quote?inputMint=${inTok.mint}&outputMint=${outTok.mint}&amount=${rawAmount}&slippage=${SLIPPAGE}`
      );
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? 'Quote fehlgeschlagen');
      setQuote({
        inAmount:       data.inAmount as string,
        outAmount:      data.outAmount as string,
        priceImpactPct: data.priceImpactPct as string,
        routePlan:      (data.routePlan ?? []) as { swapInfo: { label: string } }[],
        raw:            data,
      });
    } catch (e) {
      setQuoteErr(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchQuote(inputAmt, inputToken, outputToken);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputAmt, inputToken, outputToken, fetchQuote]);

  const handleSwap = async () => {
    if (!quote) return;
    setSwapErr(''); setSwapOk(''); setSwapping(true);
    try {
      const res = await fetch('/api/solana/swap', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress: evmAddress, quoteResponse: quote.raw }),
      });
      const d = await res.json() as { success?: boolean; signature?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? 'Swap fehlgeschlagen');
      setSwapOk(d.signature!);
      setInputAmt(''); setQuote(null);
      setTimeout(onSwapSuccess, 3000);
    } catch (e) {
      setSwapErr(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSwapping(false);
    }
  };

  const outFormatted = quote
    ? (Number(quote.outAmount) / 10 ** outputToken.decimals).toLocaleString('de-DE', { maximumFractionDigits: 4 })
    : '';

  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">

        {/* ── Input ── */}
        <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">Von</span>
            <button
              onClick={() => { setInputAmt(String(inputToken.balance)); }}
              className="text-zinc-400 hover:text-white text-xs font-semibold">
              Max: {inputToken.balance.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step="any" value={inputAmt}
              onChange={e => setInputAmt(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-white text-2xl font-bold outline-none placeholder-zinc-600 min-w-0"
            />
            {/* Input Token Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowInputDrop(v => !v); setShowOutputDrop(false); }}
                className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl px-3 py-2 transition-colors">
                <TokenIcon token={inputToken} />
                <span className="text-white font-semibold text-sm">{inputToken.symbol}</span>
                <FaChevronDown size={10} className="text-zinc-400" />
              </button>
              {showInputDrop && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl min-w-[180px] overflow-hidden">
                  {inputOptions.map(t => (
                    <button key={t.mint} onClick={() => { setInputToken(t); setShowInputDrop(false); setInputAmt(''); setQuote(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-700 transition-colors text-left">
                      <TokenIcon token={t} />
                      <div>
                        <p className="text-white text-sm font-semibold">{t.symbol}</p>
                        <p className="text-zinc-500 text-xs">{t.balance.toLocaleString('de-DE', { maximumFractionDigits: 4 })}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Flip Button ── */}
        <div className="flex justify-center py-1">
          <button onClick={flipTokens}
            className="w-8 h-8 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center transition-colors text-zinc-400 hover:text-white">
            <FaArrowDown size={12} />
          </button>
        </div>

        {/* ── Output ── */}
        <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
          <span className="text-zinc-500 text-xs">Nach</span>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              {quoteLoading
                ? <FaSpinner size={16} className="animate-spin text-zinc-500 mt-1" />
                : <p className="text-white text-2xl font-bold">{outFormatted || '0.00'}</p>}
            </div>
            {/* Output Token Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowOutputDrop(v => !v); setShowInputDrop(false); }}
                className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl px-3 py-2 transition-colors">
                <TokenIcon token={outputToken} />
                <span className="text-white font-semibold text-sm">{outputToken.symbol}</span>
                <FaChevronDown size={10} className="text-zinc-400" />
              </button>
              {showOutputDrop && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl min-w-[180px] overflow-hidden">
                  {outputOptions.map(t => (
                    <button key={t.mint} onClick={() => { setOutputToken(t); setShowOutputDrop(false); setQuote(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-700 transition-colors text-left">
                      <TokenIcon token={t} />
                      <div>
                        <p className="text-white text-sm font-semibold">{t.symbol}</p>
                        <p className="text-zinc-400 text-xs">{t.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Quote Details ── */}
        {quote && !quoteLoading && (
          <div className="bg-zinc-800/40 rounded-xl px-3 py-2 space-y-1 mt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Kurs</span>
              <span className="text-zinc-300">
                1 {inputToken.symbol} ≈ {(Number(quote.outAmount) / Number(quote.inAmount) * 10 ** (inputToken.decimals - outputToken.decimals)).toLocaleString('de-DE', { maximumFractionDigits: 4 })} {outputToken.symbol}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Preisabweichung</span>
              <span className={priceImpact > 3 ? 'text-red-400' : priceImpact > 1 ? 'text-yellow-400' : 'text-green-400'}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Slippage</span>
              <span className="text-zinc-300">{SLIPPAGE / 100}%</span>
            </div>
            {quote.routePlan.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Route</span>
                <span className="text-zinc-300">{quote.routePlan.map(r => r.swapInfo.label).join(' → ')}</span>
              </div>
            )}
          </div>
        )}

        {quoteErr && (
          <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-3 space-y-1">
            <p className="text-red-400 text-xs font-medium">⚠ {quoteErr}</p>
            {quoteErr.includes('Liquiditätspool') && (
              <p className="text-zinc-500 text-xs">
                Erstelle zuerst einen Pool auf{' '}
                <a href="https://raydium.io/liquidity/create-pool" target="_blank" rel="noopener noreferrer"
                  className="text-emerald-400 underline">Raydium</a>{' '}
                oder{' '}
                <a href="https://app.meteora.ag/dlmm/create" target="_blank" rel="noopener noreferrer"
                  className="text-emerald-400 underline">Meteora</a>.
              </p>
            )}
          </div>
        )}

        {/* ── Swap Button ── */}
        <button
          onClick={handleSwap}
          disabled={!quote || swapping || quoteLoading || !!swapOk}
          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
          {swapping
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Swap läuft…</>
            : quoteLoading
            ? <><FaSpinner size={14} className="animate-spin" /> Quote wird geladen…</>
            : <><FaExchangeAlt size={14} /> {inputToken.symbol} → {outputToken.symbol} swappen</>}
        </button>

        {swapErr && <p className="text-red-400 text-xs break-all px-1">{swapErr}</p>}
        {swapOk  && (
          <div className="flex flex-col items-center gap-1 py-2">
            <FaCheckCircle size={20} className="text-green-400" />
            <p className="text-green-400 text-xs font-semibold">Swap erfolgreich!</p>
            <a href={`https://solscan.io/tx/${swapOk}`} target="_blank" rel="noopener noreferrer"
              className="text-zinc-400 hover:text-zinc-200 text-xs underline break-all">{swapOk}</a>
          </div>
        )}
      </div>

      <p className="text-zinc-600 text-xs text-center px-4">
        Powered by Jupiter · Beste Route · On-Chain
      </p>
    </div>
  );
}
