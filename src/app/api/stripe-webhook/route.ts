import { NextRequest, NextResponse } from 'next/server';

// Überprüfe ob Stripe verfügbar ist
const STRIPE_AVAILABLE = process.env.STRIPE_SECRET_KEY && 
                         process.env.STRIPE_SECRET_KEY.startsWith('sk_') &&
                         process.env.STRIPE_WEBHOOK_SECRET;

// Dynamischer Import von Stripe nur wenn verfügbar
let Stripe: typeof import('stripe').default | null = null;
let stripe: import('stripe').default | null = null;

if (STRIPE_AVAILABLE) {
  try {
    Stripe = require('stripe').default;
    if (Stripe) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2024-12-18.acacia' as any,
      });
    }
  } catch (error) {
    console.warn('Stripe konnte nicht geladen werden:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Prüfe ob Stripe verfügbar ist
    if (!STRIPE_AVAILABLE || !stripe) {
      console.log('Stripe Webhook nicht verfügbar - Feature deaktiviert');
      return NextResponse.json(
        { 
          error: 'Webhook Service nicht verfügbar',
          message: 'Stripe Webhook ist nicht konfiguriert.'
        },
        { status: 503 }
      );
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Webhook Event verifizieren
    let event: import('stripe').Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Event Type handling
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleSuccessfulPayment(event.data.object as import('stripe').Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handleFailedPayment(event.data.object as import('stripe').Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.canceled':
        await handleCanceledPayment(event.data.object as import('stripe').Stripe.PaymentIntent);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

// ✅ Erfolgreiche Zahlung - D.INVEST Token senden
async function handleSuccessfulPayment(paymentIntent: import('stripe').Stripe.PaymentIntent) {
  try {
    const { 
      walletAddress, 
      dinvestAmount, 
      projectName,
      tokenType,
      customerEmail,
      pricePerToken,
      totalTokens,
      paymentMethod,
      timestamp
    } = paymentIntent.metadata;
    
    console.log('🎉 Payment successful:', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      walletAddress,
      dinvestAmount,
      projectName,
      tokenType,
      customerEmail,
      pricePerToken,
      totalTokens,
      paymentMethod,
      timestamp,
      description: paymentIntent.description
    });

    // TODO: Hier würdest du die D.INVEST Token an die Wallet senden
    await sendTokensToWallet(walletAddress, parseInt(dinvestAmount), paymentIntent.id);
    
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// ❌ Fehlgeschlagene Zahlung
async function handleFailedPayment(paymentIntent: import('stripe').Stripe.PaymentIntent) {
  console.log('❌ Payment failed:', {
    paymentIntentId: paymentIntent.id,
    walletAddress: paymentIntent.metadata.walletAddress,
    reason: paymentIntent.last_payment_error?.message
  });
}

// 🚫 Abgebrochene Zahlung
async function handleCanceledPayment(paymentIntent: import('stripe').Stripe.PaymentIntent) {
  console.log('🚫 Payment canceled:', {
    paymentIntentId: paymentIntent.id,
    walletAddress: paymentIntent.metadata.walletAddress
  });
}

// 🚀 Token-Sending Funktion (Placeholder)
async function sendTokensToWallet(walletAddress: string, amount: number, paymentIntentId: string) {
  try {
    console.log(`🚀 Sending ${amount} D.INVEST tokens to ${walletAddress}`);
    console.log(`✅ Would send ${amount} D.INVEST to ${walletAddress} for payment ${paymentIntentId}`);
    
    // TODO: Implementiere Smart Contract Call hier
    
  } catch (error) {
    console.error('Error sending tokens:', error);
    throw error;
  }
}

export async function GET() {
  return NextResponse.json({
    available: STRIPE_AVAILABLE,
    message: STRIPE_AVAILABLE ? 'Stripe Webhook verfügbar' : 'Stripe Webhook nicht konfiguriert'
  });
}
