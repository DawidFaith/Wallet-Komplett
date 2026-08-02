import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDb } from '../../lib/db';
import { addDfaithCredits } from '../../lib/questDb/credits';

export const dynamic = 'force-dynamic';

// Test- UND Live-Keys erlaubt, damit der komplette Flow (inkl. Webhook) vor
// dem Live-Gang mit Stripe-Testkarten durchgetestet werden kann. Für einen
// echten Kauf muss trotzdem ein sk_live_-Key + der passende Live-Webhook-
// Secret in Vercel hinterlegt sein (Test- und Live-Webhooks haben getrennte
// Secrets im Stripe-Dashboard).
const STRIPE_AVAILABLE = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_AVAILABLE
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' })
  : null;

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe Webhook ist nicht konfiguriert' }, { status: 503 });
  }

  const body      = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleSuccessfulPayment(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        console.log('❌ Payment failed:', (event.data.object as Stripe.PaymentIntent).id);
        break;
      default:
        // Andere Event-Typen ignorieren wir bewusst
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  const { type } = paymentIntent.metadata;

  if (type === 'credits_purchase') {
    await handleCreditsPurchase(paymentIntent);
    return;
  }

  // Unbekannter/älterer Payment-Typ (z.B. abgebrochenes D.INVEST-Experiment) — nur loggen
  console.log('ℹ️ Payment succeeded ohne bekannten type:', paymentIntent.id, paymentIntent.metadata);
}

/**
 * Schreibt die gekauften Credits gut. Idempotent über die UNIQUE-Constraint
 * auf payment_intent_id — Stripe kann denselben Webhook-Event mehrfach
 * zustellen, ohne dieses Guard würde doppelt gutgeschrieben.
 */
async function handleCreditsPurchase(paymentIntent: Stripe.PaymentIntent) {
  // Fallback auf den alten Key-Namen "walletAddress" für die eine
  // Test-Zahlung, die vor der Umbenennung auf "accountId" erstellt wurde
  const walletAddress = paymentIntent.metadata.accountId ?? paymentIntent.metadata.walletAddress;
  const credits        = Number(paymentIntent.metadata.credits);
  const amountEur       = Number(paymentIntent.metadata.amountEur);

  if (!walletAddress || !isFinite(credits) || credits <= 0) {
    console.error('credits_purchase mit ungültigen Metadaten:', paymentIntent.id, paymentIntent.metadata);
    return;
  }

  const sql = getDb();
  let inserted: unknown[];
  try {
    inserted = await sql`
      INSERT INTO stripe_credit_purchases (payment_intent_id, wallet_address, amount_eur, credits_granted)
      VALUES (${paymentIntent.id}, ${walletAddress}, ${amountEur}, ${credits})
      ON CONFLICT (payment_intent_id) DO NOTHING
      RETURNING id
    `;
  } catch (e) {
    console.error('stripe_credit_purchases INSERT fehlgeschlagen:', e);
    throw e;
  }

  if (inserted.length === 0) {
    console.log('ℹ️ Credits-Kauf bereits verarbeitet (doppelter Webhook):', paymentIntent.id);
    return;
  }

  await addDfaithCredits(walletAddress, credits);
  console.log(`✅ ${credits} Credits gutgeschrieben an ${walletAddress} (${amountEur} €, TX: ${paymentIntent.id})`);
}

export async function GET() {
  return NextResponse.json({
    available: STRIPE_AVAILABLE,
    webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    keyType: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      ? 'live'
      : process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
      ? 'test'
      : 'missing',
  });
}
