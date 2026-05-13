'use client';

import React from 'react';
import Image from 'next/image';
import { FaSync } from 'react-icons/fa';
import { formatCredits } from '../utils';

interface CreditsBoxProps {
  balance: number;
  /** Beschreibung unter dem Betrag */
  subtitle?: string;
  /** Text für den Action-Button. Wenn nicht gesetzt, kein Button. */
  actionLabel?: string;
  actionLoading?: boolean;
  onAction?: () => void;
  /** Zweiter Button (z.B. "Aufladen") */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Refresh-Button */
  onRefresh?: () => void;
  refreshLoading?: boolean;
}

export default function CreditsBox({
  balance,
  subtitle,
  actionLabel,
  actionLoading,
  onAction,
  secondaryLabel,
  onSecondary,
  onRefresh,
  refreshLoading,
}: CreditsBoxProps) {
  return (
    <div className="bg-gradient-to-r from-yellow-900/40 to-amber-900/30 border border-yellow-700/50 rounded-2xl p-4 flex items-center gap-4">
      <Image src="/D.FAITH.png" alt="D.FAITH" width={44} height={44} className="object-contain shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-yellow-300 font-bold text-base">{formatCredits(balance)} D.FAITH Credits</p>
        {subtitle && <p className="text-yellow-600 text-xs">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshLoading}
            className="text-yellow-600 hover:text-yellow-400 transition-colors disabled:opacity-40 p-1"
            title="Guthaben neu laden"
          >
            <FaSync size={12} className={refreshLoading ? 'animate-spin' : ''} />
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            onClick={onSecondary}
            className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {secondaryLabel}
          </button>
        )}
        {actionLabel && onAction && balance > 0 && (
          <button
            onClick={onAction}
            disabled={actionLoading}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            {actionLoading && <FaSync className="animate-spin" size={12} />}
            {actionLoading ? 'Sendet…' : actionLabel}
          </button>
        )}
        {!actionLabel && !secondaryLabel && balance === 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5 text-yellow-600 text-xs font-semibold">
            0 Credits
          </div>
        )}
      </div>
    </div>
  );
}
