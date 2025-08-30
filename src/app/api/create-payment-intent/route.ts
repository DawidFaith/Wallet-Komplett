import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialisiere Stripe mit deinem Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(req: NextRequest) {
  try {
    const { amount, currency = 'eur', walletAddress, dinvestAmount } = await req.json();

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

    // Erstelle Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe erwartet Cent-Beträge
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        walletAddress: walletAddress,
        dinvestAmount: dinvestAmount.toString(),
        tokenType: 'DINVEST',
        projectName: 'Dawid Faith Wallet',
      },
      description: `D.INVEST Token Purchase - ${dinvestAmount} tokens for wallet ${walletAddress.slice(0, 8)}...`,
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
