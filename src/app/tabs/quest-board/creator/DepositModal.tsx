'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import Modal from '../components/Modal';
import { useLang } from '../../../components/LangContext';
import { t, tFmt } from '../../../utils/i18n';

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  onDeposited: (amount: number) => void;
}

export default function DepositModal({ open, onClose, walletAddress, onDeposited }: DepositModalProps) {
  const lang = useLang();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'sending' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<{ credited: number; signature: string; explorerUrl: string } | null>(null);

  const handleSend = async () => {
    const num = Math.round(parseFloat(amount) * 100) / 100;
    if (!num || num <= 0) return;
    setStep('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/youtube-quests/deposit-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: num }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Fehler beim Senden');
        setStep('error');
        return;
      }
      setResult(data);
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
    setErrorMsg('');
    setResult(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={t('deposit.title', lang)}>

      {step === 'form' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={56} height={56} className="object-contain shrink-0" priority />
            <div>
              <p className="text-white font-bold text-base leading-tight">{t('deposit.header', lang)}</p>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                {t('deposit.desc', lang)}
              </p>
            </div>
          </div>

          {/* Betrag */}
          <div>
            <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5">
              {t('deposit.amountLabel', lang)}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('deposit.placeholder', lang)}
              min="0.01"
              step="0.01"
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:border-amber-500/50 focus:outline-none text-sm placeholder-zinc-600"
            />
          </div>

          <div className="flex gap-2.5">
            {[100, 500, 1000, 5000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-zinc-400 hover:text-white text-xs font-bold py-2 rounded-lg transition-colors"
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={handleSend}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Image src="/D.FAITH.png" alt="" width={16} height={16} className="object-contain" />
            {amount && parseFloat(amount) > 0
              ? tFmt('deposit.sendBtn', lang, { amount: parseFloat(amount).toLocaleString('de-DE') })
              : t('deposit.enterAmount', lang)}
          </button>
        </div>
      )}

      {step === 'sending' && (
        <div className="flex flex-col items-center py-12 gap-4">
          <div className="border-4 border-amber-500/30 border-t-amber-400 rounded-full w-12 h-12 animate-spin" />
          <div className="text-center">
            <p className="text-zinc-200 font-semibold">{t('deposit.sending', lang)}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('deposit.sendingDesc', lang)}</p>
          </div>
        </div>
      )}

      {step === 'success' && result && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-5 text-center space-y-3">
            <FaCheck size={28} className="text-green-400 mx-auto" />
            <p className="text-green-300 font-bold text-sm">{t('deposit.successTitle', lang)}</p>
            <div className="flex items-center justify-center gap-3">
              <Image src="/D.FAITH.png" alt="D.FAITH" width={40} height={40} className="object-contain" />
              <span className="text-amber-300 font-bold text-2xl">{Number(result.credited).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
              <span className="text-amber-600 font-semibold text-sm">D.FAITH Credits</span>
            </div>
          </div>
          {result.explorerUrl && (
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
            >
              <FaExternalLinkAlt size={10} /> {t('deposit.viewTx', lang)}
            </a>
          )}
          <button onClick={handleClose} className="w-full bg-white/5 border border-white/[0.08] hover:bg-white/10 text-zinc-300 py-3 rounded-xl transition-colors font-semibold">
            {t('btn.close', lang)}
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
            <p className="text-amber-300 text-sm">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('form')} className="flex-1 bg-white/5 border border-white/[0.08] hover:bg-white/10 text-zinc-300 py-3 rounded-xl transition-colors font-semibold text-sm">{t('btn.back', lang)}</button>
            <button onClick={handleClose} className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-xl transition-colors text-sm">{t('btn.close', lang)}</button>
          </div>
        </div>
      )}

    </Modal>
  );
}
