'use client';

import React, { useEffect, useRef, useState } from 'react';
import { initOnRamp } from '@coinbase/cbpay-js';
import { FaCreditCard, FaSpinner } from 'react-icons/fa';

const APP_ID = process.env.NEXT_PUBLIC_COINBASE_APP_ID ?? '';

interface Props {
  solanaAddress: string;
}

export default function CoinbaseBuyWidget({ solanaAddress }: Props) {
  const instanceRef = useRef<{ open: () => void; destroy: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!APP_ID || !solanaAddress) return;

    setReady(false);
    setError('');

    initOnRamp(
      {
        appId: APP_ID,
        widgetParameters: {
          destinationWallets: [
            {
              address: solanaAddress,
              assets: ['SOL', 'USDC'],
              supportedNetworks: ['solana'],
            },
          ],
        },
        onSuccess: () => {
          setReady(false);
        },
        onExit: () => {
          /* Widget geschlossen */
        },
        onEvent: () => {
          /* optional: Events tracken */
        },
        experienceLoggedIn:  'popup',
        experienceLoggedOut: 'popup',
      },
      (err, instance) => {
        if (err) {
          setError('Widget konnte nicht geladen werden');
          return;
        }
        instanceRef.current = instance ?? null;
        setReady(true);
      },
    );

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [solanaAddress]);

  const handleOpen = () => {
    instanceRef.current?.open();
  };

  if (!APP_ID) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={handleOpen}
        disabled={!ready}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
        {ready
          ? <><FaCreditCard size={14} /> SOL / USDC kaufen</>
          : <><FaSpinner size={14} className="animate-spin" /> Widget lädt…</>}
      </button>

      {error && <p className="text-red-400 text-xs text-center">{error}</p>}

      <p className="text-zinc-600 text-xs text-center">
        Powered by Coinbase · Karte, Bank, Apple Pay
      </p>
    </div>
  );
}
