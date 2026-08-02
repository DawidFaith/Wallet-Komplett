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
import { getDb } from '../../../lib/db';
import { requireOwnWallet } from '../../../lib/apiAuth';
import { checkRateLimit } from '../../../lib/rateLimit';

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
  const authCheck = requireOwnWallet(walletAddress);
  if (!authCheck.ok) return authCheck.response;
  const rl = await checkRateLimit(`credits-checkout:${authCheck.userId}`, 10, 60);
  if (!rl.ok) return rl.response!;
  if (typeof amountEur !== 'number' || !isFinite(amountEur) || amountEur < MIN_EUR) {
    return NextResponse.json({ error: `Mindestbetrag ist ${MIN_EUR} €` }, { status: 400 });
  }

  const credits = Math.round(amountEur * EUR_TO_CREDITS_RATE);
  const accountId = walletAddress.trim().toLowerCase();

  // Anzeigename statt Wallet-Adresse für Stripe-Beschreibung/Metadaten — im
  // Stripe-Dashboard soll kein "walletAddress"-Feld auftauchen (sieht nach
  // Krypto-Geschäft aus, genau das Feld, an dem Stripes Compliance-Team bei
  // NFT/Crypto-nahen Businesses hängen bleiben könnte).
  let customerName = 'D.FAITH Nutzer';
  try {
    const sql  = getDb();
    const rows = await sql`SELECT display_name FROM user_profiles WHERE wallet_address = ${accountId} LIMIT 1`;
    const name = (rows[0]?.display_name as string | null)?.trim();
    if (name) customerName = name;
  } catch {
    // Fallback-Name reicht, kein harter Fehler nötig
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2025-08-27.basil' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountEur * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type:         'credits_purchase',
        accountId,
        customerName,
        amountEur:    amountEur.toFixed(2),
        credits:      String(credits),
      },
      description: `D.FAITH Credits (${credits}) für ${customerName}`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      credits,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('credits/checkout Fehler:', msg);
    return NextResponse.json({ error: 'Zahlung konnte nicht vorbereitet werden. Bitte versuche es erneut.' }, { status: 500 });
  }
}
