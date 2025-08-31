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

interface CheckoutFormProps {
  walletAddress: string;
  amount: number;
  dinvestAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  onProcessingChange: (processing: boolean) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ 
  walletAddress, 
  amount, 
  dinvestAmount, 
  onSuccess, 
  onError,
  onProcessingChange 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Benachrichtige Parent über Processing-Status
  useEffect(() => {
    onProcessingChange(isProcessing || paymentCompleted);
  }, [isProcessing, paymentCompleted, onProcessingChange]);

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
            customerEmail: '', // Optional - könnte später erweitert werden
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

    // Verhindere mehrfache Aufrufe und prüfe Zahlungsstatus
    if (!stripe || !elements || !clientSecret || isProcessing || paymentCompleted) {
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
        setIsProcessing(false);
      } else if (paymentIntent?.status === 'succeeded') {
        setPaymentCompleted(true);
        setIsProcessing(false);
        onSuccess();
      }
    } catch (error: any) {
      onError(error.message || 'Payment processing failed');
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: '#9ca3af',
        },
        iconColor: '#9ca3af',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
      complete: {
        color: '#10b981',
        iconColor: '#10b981',
      },
    },
    hidePostalCode: true,
    disabled: isProcessing || paymentCompleted,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className={`bg-zinc-800 p-4 rounded-lg border border-zinc-700 transition-all ${
        isProcessing || paymentCompleted ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <label className="block text-sm font-medium text-zinc-300 mb-3">
          Kreditkartendaten
        </label>
        <CardElement 
          options={cardElementOptions} 
          className="text-white min-h-[40px]"
        />
        <div className="mt-3 text-xs text-zinc-500 flex items-center gap-2">
          <span className="text-green-400">🔒</span>
          Sichere Zahlung über Stripe • Alle Daten werden verschlüsselt übertragen
        </div>
        
        {/* Test Mode Hinweis */}
        <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
          <div className="text-yellow-400 text-xs font-medium mb-1">💳 Testkarten für Demo:</div>
          <div className="text-yellow-300 text-xs space-y-1">
            <div>• Erfolg: 4242 4242 4242 4242</div>
            <div>• Fehler: 4000 0000 0000 0002</div>
            <div>• Datum: 12/25 • CVC: 123</div>
          </div>
        </div>
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
        disabled={!stripe || isProcessing || !clientSecret || paymentCompleted}
        className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all ${
          isProcessing || !clientSecret || paymentCompleted
            ? 'bg-zinc-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transform hover:scale-[1.02]'
        }`}
      >
        {paymentCompleted ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-green-400">✓</span>
            Zahlung erfolgreich
          </div>
        ) : isProcessing ? (
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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#f59e0b', // Amber
        colorBackground: '#18181b', // Zinc-900
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        colorTextSecondary: '#9ca3af',
        colorTextPlaceholder: '#6b7280',
        borderRadius: '8px',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          backgroundColor: '#27272a', // Zinc-800
          border: '1px solid #52525b', // Zinc-600
          padding: '12px 16px',
          fontSize: '16px',
        },
        '.Input:focus': {
          border: '1px solid #f59e0b', // Amber-500
          boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.2)',
        },
        '.Input--invalid': {
          border: '1px solid #ef4444',
        },
        '.Label': {
          color: '#d4d4d8', // Zinc-300
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '8px',
        },
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
            disabled={isProcessingPayment}
            className={`p-2 text-amber-400 hover:text-yellow-300 hover:bg-zinc-800 rounded-lg transition-all ${
              isProcessingPayment ? 'opacity-50 cursor-not-allowed' : ''
            }`}
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
            onProcessingChange={setIsProcessingPayment}
          />
        </Elements>
      </div>
    </div>
  );
};

export default StripeCheckout;
