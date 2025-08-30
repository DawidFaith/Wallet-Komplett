import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

// Lade Stripe mit deinem Publishable Key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeCheckoutProps {
  walletAddress: string;
  amount: number;
  dinvestAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  onClose: () => void;
}

const CheckoutForm: React.FC<{
  walletAddress: string;
  amount: number;
  dinvestAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}> = ({ walletAddress, amount, dinvestAmount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');

  // Erstelle Payment Intent beim Laden
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            currency: 'eur',
            walletAddress,
            dinvestAmount,
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setClientSecret(data.clientSecret);
        } else {
          onError(data.error || 'Failed to create payment intent');
        }
      } catch (error) {
        onError('Network error occurred');
      }
    };

    createPaymentIntent();
  }, [amount, walletAddress, dinvestAmount, onError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Card element not found');
      setIsProcessing(false);
      return;
    }

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `Wallet: ${walletAddress.slice(0, 8)}...`,
          },
        },
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      }
    } catch (error: any) {
      onError(error.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: 'transparent',
        '::placeholder': {
          color: '#9ca3af',
        },
      },
      invalid: {
        color: '#ef4444',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Kreditkarte
        </label>
        <CardElement options={cardElementOptions} />
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="text-blue-400 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Betrag:</span>
            <span className="font-semibold">€{amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>D.INVEST Token:</span>
            <span className="font-semibold">{dinvestAmount}</span>
          </div>
          <div className="flex justify-between">
            <span>Wallet:</span>
            <span className="font-mono text-xs">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing || !clientSecret}
        className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all ${
          isProcessing || !clientSecret
            ? 'bg-zinc-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transform hover:scale-[1.02]'
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Zahlung wird verarbeitet...
          </div>
        ) : (
          `€${amount.toFixed(2)} bezahlen`
        )}
      </button>
    </form>
  );
};

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  walletAddress,
  amount,
  dinvestAmount,
  onSuccess,
  onError,
  onClose,
}) => {
  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#3b82f6',
        colorBackground: '#18181b',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
      },
    },
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 overflow-y-auto p-4">
      <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full border border-amber-400 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">D.INVEST kaufen</h3>
          <button
            onClick={onClose}
            className="p-2 text-amber-400 hover:text-yellow-300 hover:bg-zinc-800 rounded-lg transition-all"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>

        <div className="text-center mb-6">
          <img src="/D.INVEST.png" alt="D.INVEST" className="w-20 h-20 mx-auto mb-3 object-contain" />
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-full inline-block px-3 py-1">
            <span className="text-amber-400 text-sm font-semibold">
              €5.00 / D.INVEST
            </span>
          </div>
        </div>

        <Elements stripe={stripePromise} options={elementsOptions}>
          <CheckoutForm
            walletAddress={walletAddress}
            amount={amount}
            dinvestAmount={dinvestAmount}
            onSuccess={onSuccess}
            onError={onError}
          />
        </Elements>
      </div>
    </div>
  );
};

export default StripeCheckout;
