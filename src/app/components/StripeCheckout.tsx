import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

// Validierung: Nur Live-Keys akzeptiert (nur zur Laufzeit, nicht zur Build-Zeit)
const validateStripeKey = () => {
  if (typeof window !== 'undefined') {
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (stripeKey && !stripeKey.startsWith('pk_live_')) {
      console.error('❌ LIVE Stripe Key erforderlich! Test-Key erkannt:', stripeKey.substring(0, 8) + '...');
      throw new Error('Nur Live-Keys erlaubt. Test-Keys werden abgelehnt.');
    }
  }
};

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
        console.log('🚀 Creating LIVE Payment Intent:', {
          amount,
          walletAddress: walletAddress.slice(0, 8) + '...',
          dinvestAmount
        });

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
        
        console.log('💰 Payment Intent Response:', {
          status: response.status,
          mode: data.mode,
          available: data.available
        });
        
        if (response.ok) {
          // Zusätzliche Validierung der Response
          if (data.clientSecret && data.clientSecret.startsWith('pi_')) {
            console.log('✅ Valid Payment Intent created');
            setClientSecret(data.clientSecret);
          } else {
            console.error('❌ Invalid Payment Intent format:', data);
            onError('Invalid payment intent format');
          }
        } else {
          console.error('❌ Payment Intent creation failed:', data);
          onError(data.error || data.message || 'Failed to create payment intent');
        }
      } catch (error) {
        console.error('💥 Payment Intent network error:', error);
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
      // 🚀 LIVE PAYMENT - Nur Live-Modus aktiv
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `Wallet: ${walletAddress.slice(0, 8)}...`,
          },
        },
      });

      if (error) {
        console.error('🚫 Payment Error:', error);
        onError(error.message || 'Payment failed');
        setIsProcessing(false);
      } else if (paymentIntent?.status === 'succeeded') {
        console.log('🚀 LIVE Payment Successful:', paymentIntent.id);
        setPaymentCompleted(true);
        setIsProcessing(false);
        onSuccess();
      }
    } catch (error: any) {
      console.error('💥 Payment Processing Error:', error);
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
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-zinc-300">
            Kreditkartendaten
          </label>
          <div className="flex items-center gap-1">
            <div className="bg-white rounded px-1.5 py-0.5 text-[10px] font-bold text-blue-600">VISA</div>
            <div className="bg-white rounded px-1.5 py-0.5 text-[10px] font-bold text-red-600">MC</div>
            <div className="bg-white rounded px-1.5 py-0.5 text-[10px] font-bold text-blue-800">AMEX</div>
          </div>
        </div>
        <CardElement 
          options={cardElementOptions} 
          className="text-white min-h-[40px]"
        />
        <div className="mt-3 text-xs text-zinc-500 flex items-center gap-2">
          <span className="text-green-400">🔒</span>
          Sichere Zahlung über Stripe • Alle Daten werden verschlüsselt übertragen
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
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripePromiseState, setStripePromiseState] = useState<Promise<any> | null>(null);

  // Initialisiere Stripe nur im Browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        validateStripeKey();
        const promise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
        setStripePromiseState(promise);
        setStripeLoaded(true);
      } catch (error) {
        console.error('Stripe Initialization Error:', error);
        onError('Stripe-Konfigurationsfehler: ' + (error as Error).message);
      }
    }
  }, [onError]);

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
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-white">D.INVEST kaufen</h3>
            {/* LIVE Mode Indicator */}
            <div className="px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
              🚀 LIVE
            </div>
          </div>
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

        {stripeLoaded && stripePromiseState ? (
          <Elements stripe={stripePromiseState} options={elementsOptions}>
            <CheckoutForm
              walletAddress={walletAddress}
              amount={amount}
              dinvestAmount={dinvestAmount}
              onSuccess={onSuccess}
              onError={onError}
              onProcessingChange={setIsProcessingPayment}
            />
          </Elements>
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-zinc-300">Stripe wird geladen...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StripeCheckout;
