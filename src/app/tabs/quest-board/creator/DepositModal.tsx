'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { getContract, prepareContractCall } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { client } from '../../../client';
import { FaCheck, FaSync } from 'react-icons/fa';
import Modal from '../components/Modal';
import { DFAITH_TOKEN, DFAITH_DECIMALS } from '../types';

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  onDeposited: (amount: number) => void;
}

export default function DepositModal({ open, onClose, walletAddress, onDeposited }: DepositModalProps) {
  const { mutateAsync: sendTransaction } = useSendTransaction();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'sending' | 'verifying' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [creditedAmount, setCreditedAmount] = useState(0);

  const poolAddress = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS ?? '';

  const handleDeposit = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0 || !poolAddress) return;
    setStep('sending');
    setErrorMsg('');
    try {
      const contract = getContract({ client, chain: base, address: DFAITH_TOKEN });
      const tx = prepareContractCall({
        contract,
        method: 'function transfer(address,uint256) returns (bool)',
        params: [
          poolAddress as `0x${string}`,
          BigInt(Math.round(num * Math.pow(10, DFAITH_DECIMALS))),
        ],
      });
      const result = await sendTransaction(tx);
      const txHash = result.transactionHash;

      setStep('verifying');
      await new Promise((res) => setTimeout(res, 4000));

      const res = await fetch('/api/youtube-quests/creator-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, txHash, amount: Math.round(num * 100) / 100 }),
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
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Unbekannter Fehler');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('form');
    setAmount('');
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Quest-Pool aufladen">
      {step === 'form' && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-sm space-y-2">
            <p className="text-yellow-400 font-semibold">So funktioniert es:</p>
            <p className="text-zinc-300">Zahle DFAITH ein – diese Tokens werden als Belohnungen an deine Fans ausgezahlt.</p>
            <div className="bg-zinc-900 rounded-lg p-3">
              <p className="text-zinc-500 text-xs mb-1">Einzahlungsadresse (Reward Pool):</p>
              <p className="text-white font-mono text-xs break-all">{poolAddress || 'Nicht konfiguriert'}</p>
            </div>
          </div>
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Betrag (DFAITH)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="z.B. 1000"
              min="0.01"
              step="0.01"
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-yellow-500 focus:outline-none text-sm placeholder-zinc-500"
            />
          </div>
          {!poolAddress && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-3">NEXT_PUBLIC_REWARD_POOL_ADDRESS ist nicht konfiguriert.</p>
          )}
          <button
            onClick={handleDeposit}
            disabled={!amount || parseFloat(amount) <= 0 || !poolAddress}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Image src="/D.FAITH.png" alt="D.FAITH" width={20} height={20} className="w-5 h-5 object-contain" />
            {amount || '0'} D.FAITH einzahlen
          </button>
        </div>
      )}
      {step === 'sending' && (
        <div className="flex flex-col items-center py-10 gap-4">
          <div className="border-4 border-yellow-500/30 border-t-yellow-500 rounded-full w-12 h-12 animate-spin" />
          <div className="text-center">
            <p className="text-zinc-200 font-semibold">Transaktion wird gesendet…</p>
            <p className="text-zinc-500 text-xs mt-1">Bitte in deiner Wallet bestätigen</p>
          </div>
        </div>
      )}
      {step === 'verifying' && (
        <div className="flex flex-col items-center py-10 gap-4">
          <div className="border-4 border-blue-500/30 border-t-blue-500 rounded-full w-12 h-12 animate-spin" />
          <div className="text-center">
            <p className="text-zinc-200 font-semibold">Transaktion wird verifiziert…</p>
            <p className="text-zinc-500 text-xs mt-1">Einen Moment bitte</p>
          </div>
        </div>
      )}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-5 text-center">
            <FaCheck size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-bold text-sm mb-2">Erfolgreich aufgeladen!</p>
            <div className="flex items-center justify-center gap-2">
              <Image src="/D.FAITH.png" alt="D.FAITH" width={28} height={28} className="w-7 h-7 object-contain" />
              <span className="text-yellow-300 font-bold text-2xl">{Number(creditedAmount).toFixed(2)}</span>
              <span className="text-yellow-500 font-semibold text-sm">D.FAITH</span>
            </div>
            <p className="text-zinc-400 text-sm mt-2">Dein Artist-Pool wurde aufgeladen.</p>
          </div>
          <button onClick={handleClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold">
            Schließen
          </button>
        </div>
      )}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
            <p className="text-red-300">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('form')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl transition-colors font-semibold">Zurück</button>
            <button onClick={handleClose} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-xl transition-colors font-semibold">Schließen</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
