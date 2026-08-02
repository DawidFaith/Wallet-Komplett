'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { t, tFmt, type Lang } from '../utils/i18n';

// 1 € = 100 Credits — muss mit EUR_TO_CREDITS_RATE in /api/credits/checkout übereinstimmen
const EUR_TO_CREDITS_RATE = 100;
const MIN_EUR = 1;

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

interface Props {
  walletAddress: string;
  onSuccess: () => void;
  lang: Lang;
}

function CheckoutForm({ walletAddress, amountEur, onSuccess, onError, lang }: {
  walletAddress: string;
  amountEur: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
  lang: Lang;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingIntent(true);
    setClientSecret('');
    fetch('/api/credits/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, amountEur }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.clientSecret) throw new Error(d.error ?? t('shop.cardCreateError', lang));
        setClientSecret(d.clientSecret);
      })
      .catch(e => !cancelled && onError(e instanceof Error ? e.message : t('common.error', lang)))
      .finally(() => !cancelled && setLoadingIntent(false));
    return () => { cancelled = true; };
  }, [walletAddress, amountEur, onError, lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret || processing || done) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (error) {
        onError(error.message ?? t('shop.cardPaymentFailed', lang));
      } else if (paymentIntent?.status === 'succeeded') {
        setDone(true);
        // Webhook schreibt die Credits gut — kurze Verzögerung, damit er
        // (üblicherweise binnen 1-2s) durchgelaufen ist, bevor wir neu laden
        setTimeout(onSuccess, 2500);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t('shop.cardPaymentFailed', lang));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('shop.cardDetails', lang)}</label>
        <div className="bg-white/[0.04] border border-white/[0.08] focus-within:border-amber-500/60 rounded-xl px-4 py-4 transition-colors">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '18px', color: '#ffffff', fontFamily: 'system-ui, sans-serif',
                  lineHeight: '28px',
                  '::placeholder': { color: '#71717a' },
                },
                invalid: { color: '#f87171' },
              },
              hidePostalCode: true,
              disabled: processing || done || loadingIntent,
            }}
          />
        </div>
      </div>
      {done ? (
        <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm font-semibold">
          ✓ {t('shop.cardPaymentSuccess', lang)}
        </div>
      ) : (
        <button
          type="submit"
          disabled={!stripe || !clientSecret || processing || loadingIntent}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
        >
          {processing
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> {t('shop.cardProcessing', lang)}</span>
            : loadingIntent
            ? t('shop.cardPreparing', lang)
            : tFmt('shop.cardPayButton', lang, { amount: amountEur.toFixed(2) })}
        </button>
      )}
    </form>
  );
}

export default function CreditsCardCheckout({ walletAddress, onSuccess, lang }: Props) {
  const [amount, setAmount] = useState('10');
  const [error, setError]   = useState('');
  const amountEur = Number(amount);
  const validAmount = isFinite(amountEur) && amountEur >= MIN_EUR;
  const credits = useMemo(() => Math.round((validAmount ? amountEur : 0) * EUR_TO_CREDITS_RATE), [validAmount, amountEur]);

  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#f59e0b',
        colorBackground: '#18181b',
        colorText: '#ffffff',
        colorDanger: '#f87171',
        borderRadius: '8px',
      },
    },
  };

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <p className="text-zinc-500 text-xs bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        {t('shop.cardNotConfigured', lang)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{t('shop.cardAmountLabel', lang)}</label>
        <input
          type="number" min={MIN_EUR} step="1" value={amount}
          onChange={e => { setAmount(e.target.value); setError(''); }}
          className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-amber-500/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
        />
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-amber-200/80 text-xs font-semibold">{t('shop.cardYouReceive', lang)}</span>
        {validAmount ? (
          <span className="flex items-center gap-1.5 text-amber-300 font-black text-xl">
            {credits.toLocaleString('de-DE')} <span className="text-xs font-bold text-amber-400/80">{t('shop.cardCreditsUnit', lang)}</span>
          </span>
        ) : (
          <span className="text-red-400 text-xs font-semibold">{tFmt('shop.cardMinAmount', lang, { n: MIN_EUR })}</span>
        )}
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

      {validAmount && (
        <Elements key={amountEur} stripe={getStripePromise()} options={elementsOptions}>
          <CheckoutForm walletAddress={walletAddress} amountEur={amountEur} onSuccess={onSuccess} onError={setError} lang={lang} />
        </Elements>
      )}
    </div>
  );
}
