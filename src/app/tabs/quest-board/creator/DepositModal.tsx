'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaCheck, FaCopy, FaCheckCircle } from 'react-icons/fa';
import Modal from '../components/Modal';

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string; // Clerk user ID (DB-Schlüssel)
  onDeposited: (amount: number) => void;
}

export default function DepositModal({ open, onClose, walletAddress, onDeposited }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [senderWallet, setSenderWallet] = useState('');
  const [txHash, setTxHash] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'verifying' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [creditedAmount, setCreditedAmount] = useState(0);
  const [copied, setCopied] = useState<'pool' | 'token' | null>(null);

  const poolAddress = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS ?? '';
  const dfaithMint = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

  const handleCopy = (text: string, key: 'pool' | 'token') => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleVerify = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0 || !txHash.trim() || !senderWallet.trim()) return;
    setStep('verifying');
    setErrorMsg('');
    try {
      const res = await fetch('/api/youtube-quests/creator-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          senderWallet: senderWallet.trim(),
          txHash: txHash.trim(),
          amount: Math.round(num * 100) / 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Fehler bei der Gutschrift');
        setStep('error');
        return;
      }
      setCreditedAmount(data.credited);
      onDeposited(data.credited);
      setStep('success');
    } catch (e: unknown) {
      setErrorMsg((e as Error)?.message ?? 'Unbekannter Fehler');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('form');
    setAmount('');
    setSenderWallet('');
    setTxHash('');
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Quest-Pool aufladen">
      {step === 'form' && (
        <div className="space-y-4">
          {/* Anleitung + Adressen */}
          <div className="bg-amber-950/20 border border-amber-800/25 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <Image src="/D.FAITH.png" alt="D.FAITH" width={18} height={18} className="w-4 h-4 object-contain" />
              </div>
              <p className="text-amber-400 font-semibold text-sm">So funktioniert es</p>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Sende D.FAITH aus deiner Solana-Wallet (z.B. Phantom) an die Reward-Pool-Adresse.
              Klicke danach auf &bdquo;Ich habe gesendet&ldquo; und füge die TX-Signatur ein.
            </p>
            <div className="space-y-1.5">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Einzahlungsadresse (Reward Pool)</p>
              <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/5">
                <p className="text-white font-mono text-xs flex-1 break-all">{poolAddress || 'Nicht konfiguriert'}</p>
                {poolAddress && (
                  <button onClick={() => handleCopy(poolAddress, 'pool')} className="text-amber-400 hover:text-amber-300 shrink-0 ml-1">
                    {copied === 'pool' ? <FaCheckCircle size={12} className="text-green-400" /> : <FaCopy size={12} />}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">D.FAITH Token-Mint (Solana)</p>
              <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/5">
                <p className="text-zinc-400 font-mono text-xs flex-1 truncate">{dfaithMint || 'Nicht konfiguriert'}</p>
                {dfaithMint && (
                  <button onClick={() => handleCopy(dfaithMint, 'token')} className="text-amber-400 hover:text-amber-300 shrink-0 ml-1">
                    {copied === 'token' ? <FaCheckCircle size={12} className="text-green-400" /> : <FaCopy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Betrag */}
          <div>
            <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5">Betrag (DFAITH)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="z.B. 1000"
              min="0.01"
              step="0.01"
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:border-amber-500/50 focus:outline-none text-sm placeholder-zinc-600"
            />
          </div>
          {!poolAddress && (
            <p className="text-red-400 text-xs bg-red-900/20 rounded-xl p-3">Pool-Adresse nicht konfiguriert (NEXT_PUBLIC_REWARD_POOL_ADDRESS).</p>
          )}
          <button
            onClick={() => setStep('confirm')}
            disabled={!amount || parseFloat(amount) <= 0 || !poolAddress}
            className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Image src="/D.FAITH.png" alt="D.FAITH" width={18} height={18} className="w-4 h-4 object-contain" />
            Ich habe {amount || '…'} DFAITH gesendet
          </button>
        </div>
      )}
      {step === 'confirm' && (
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Füge deine Solana-Absenderadresse und die TX-Signatur ein, damit wir die Transaktion verifizieren können.</p>
          <div>
            <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5">Deine Solana Wallet-Adresse (Absender)</label>
            <input
              type="text"
              value={senderWallet}
              onChange={(e) => setSenderWallet(e.target.value)}
              placeholder="z.B. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgSsv"
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:border-amber-500/50 focus:outline-none text-sm placeholder-zinc-600 font-mono"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5">TX-Signatur</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="z.B. 5j7s6..."
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:border-amber-500/50 focus:outline-none text-sm placeholder-zinc-600 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('form')} className="flex-1 bg-white/5 border border-white/8 hover:bg-white/10 text-zinc-300 py-3 rounded-xl transition-colors font-semibold text-sm">Zurück</button>
            <button
              onClick={handleVerify}
              disabled={!txHash.trim() || !senderWallet.trim()}
              className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors text-sm"
            >
              Bestätigen
            </button>
          </div>
        </div>
      )}
      {step === 'verifying' && (
        <div className="flex flex-col items-center py-10 gap-4">
          <div className="border-4 border-amber-500/30 border-t-amber-400 rounded-full w-12 h-12 animate-spin" />
          <div className="text-center">
            <p className="text-zinc-200 font-semibold">Transaktion wird verifiziert…</p>
            <p className="text-zinc-500 text-xs mt-1">On-Chain Verifizierung via Solana RPC</p>
          </div>
        </div>
      )}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-5 text-center space-y-3">
            <FaCheck size={28} className="text-green-400 mx-auto" />
            <p className="text-green-300 font-bold text-sm">Erfolgreich aufgeladen!</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center">
                <Image src="/D.FAITH.png" alt="D.FAITH" width={24} height={24} className="w-6 h-6 object-contain" />
              </div>
              <span className="text-amber-300 font-bold text-2xl">{Number(creditedAmount).toFixed(2)}</span>
              <span className="text-amber-600 font-semibold text-sm">D.FAITH</span>
            </div>
            <p className="text-zinc-500 text-xs">Dein Artist-Pool wurde aufgeladen.</p>
          </div>
          <button onClick={handleClose} className="w-full bg-white/5 border border-white/8 hover:bg-white/10 text-zinc-300 py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
            <p className="text-red-300 text-sm">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('confirm')} className="flex-1 bg-white/5 border border-white/8 hover:bg-white/10 text-zinc-300 py-3 rounded-xl transition-colors font-semibold text-sm">Zurück</button>
            <button onClick={handleClose} className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-xl transition-colors text-sm">Schließen</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
