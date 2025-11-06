import { NextRequest, NextResponse } from 'next/server';

// Überprüfe ob Stripe Live Keys verfügbar sind
const STRIPE_AVAILABLE = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_live_');

if (!STRIPE_AVAILABLE) {
  console.error('❌ LIVE Stripe Keys erforderlich! Nur sk_live_ Keys werden akzeptiert.');
}

console.log('� Stripe LIVE Configuration:', {
  available: STRIPE_AVAILABLE,
  keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 12) + '...'
});

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
      console.log('Stripe nicht verfügbar - Feature deaktiviert');
      return NextResponse.json(
        { 
          error: 'Payment Service nicht verfügbar',
          message: 'Zahlungsfunktion ist momentan nicht verfügbar.'
        },
        { status: 503 }
      );
    }

    const { amount, currency = 'eur', walletAddress, dinvestAmount, customerEmail } = await req.json();

    // Validierung
    if (!amount || amount < 5) {
      return NextResponse.json(
        { error: 'Minimum amount is 5 EUR' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!dinvestAmount || dinvestAmount < 1) {
      return NextResponse.json(
        { error: 'D.INVEST amount is required and must be at least 1' },
        { status: 400 }
      );
    }

    // 🚀 Erstelle LIVE Payment Intent
    console.log('💰 Creating LIVE Payment Intent:', {
      amount: amount,
      currency: currency,
      walletAddress: walletAddress.slice(0, 8) + '...',
      dinvestAmount: dinvestAmount
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe erwartet Cent-Beträge
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        walletAddress: walletAddress,
        dinvestAmount: dinvestAmount.toString(),
        projectName: 'Dawid Faith Wallet',
        tokenType: 'DINVEST',
        customerEmail: customerEmail || '', // Optional
        pricePerToken: '5.00',
        totalTokens: dinvestAmount.toString(),
        paymentMethod: 'stripe_card',
        paymentMode: 'LIVE',
        timestamp: new Date().toISOString(),
      },
      description: `[LIVE] D.INVEST Token Purchase - ${dinvestAmount} tokens for wallet ${walletAddress.slice(0, 8)}...`,
    });

    console.log('✅ LIVE Payment Intent created successfully:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error: any) {
    console.error('Stripe Payment Intent Error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment intent creation failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    available: STRIPE_AVAILABLE,
    mode: 'LIVE',
    message: STRIPE_AVAILABLE 
      ? '🚀 Stripe LIVE Payment verfügbar' 
      : '❌ Stripe LIVE Keys erforderlich (nur sk_live_ Keys akzeptiert)',
    keyType: STRIPE_AVAILABLE ? 'Live Key' : 'Missing Live Key'
  });
}
