/**
 * POST /api/credits/checkout
 * Body: { walletAddress, amountEur }
 *
 * Erstellt einen Stripe Payment Intent für einen D.FAITH-Credits-Kauf per Karte.
 * Gutgeschrieben werden die Credits erst im Webhook (payment_intent.succeeded),
 * nicht hier — der Client bestätigt die Zahlung separat mit dem clientSecret.
 *
 * Funktioniert mit Test- UND Live-Keys (sk_test_.../sk_live_...), damit der
 * Checkout vor dem Live-Gang mit Stripe-Testkarten durchgetestet werden kann.
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// 1 € = 100 Credits — muss mit EUR_TO_CREDITS_RATE in CreditsCardCheckout.tsx übereinstimmen.
// Kein `export`: Next.js lässt in Route-Dateien nur GET/POST/etc. + Config-Exports zu.
const EUR_TO_CREDITS_RATE = 100;
const MIN_EUR = 1;

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt)' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { walletAddress, amountEur } = (body ?? {}) as { walletAddress?: string; amountEur?: number };

  if (!walletAddress?.trim()) {
    return NextResponse.json({ error: 'walletAddress erforderlich' }, { status: 400 });
  }
  if (typeof amountEur !== 'number' || !isFinite(amountEur) || amountEur < MIN_EUR) {
    return NextResponse.json({ error: `Mindestbetrag ist ${MIN_EUR} €` }, { status: 400 });
  }

  const credits = Math.round(amountEur * EUR_TO_CREDITS_RATE);
  const stripe = new Stripe(secretKey, { apiVersion: '2025-08-27.basil' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountEur * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type:          'credits_purchase',
        walletAddress: walletAddress.trim().toLowerCase(),
        amountEur:     amountEur.toFixed(2),
        credits:       String(credits),
      },
      description: `D.FAITH Credits (${credits}) für Wallet ${walletAddress.slice(0, 12)}…`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      credits,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('credits/checkout Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
