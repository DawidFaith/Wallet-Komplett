import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Extrahiere Metadaten
        const walletAddress = paymentIntent.metadata.walletAddress;
        const dinvestAmount = paymentIntent.metadata.dinvestAmount;
        const amountPaid = paymentIntent.amount_received / 100; // Von Cent zu EUR
        
        console.log('✅ Payment successful:', {
          paymentIntentId: paymentIntent.id,
          walletAddress,
          dinvestAmount,
          amountPaid,
        });

        // Hier würdest du normalerweise:
        // 1. Die Zahlung in deiner Datenbank speichern
        // 2. D.INVEST Token an die Wallet-Adresse senden
        // 3. Email-Bestätigung senden
        
        // Beispiel für Token-Transfer (du musst das an dein System anpassen):
        await sendDinvestTokens(walletAddress, parseInt(dinvestAmount));
        
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log('❌ Payment failed:', failedPayment.id);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Placeholder für Token-Transfer Funktion
async function sendDinvestTokens(walletAddress: string, amount: number) {
  // Hier würdest du den Smart Contract aufrufen, um D.INVEST Token zu senden
  // Beispiel mit thirdweb:
  /*
  const contract = getContract({
    client,
    chain: base,
    address: DINVEST_TOKEN_ADDRESS
  });
  
  const transaction = await prepareContractCall({
    contract,
    method: "transfer",
    params: [walletAddress, amount]
  });
  
  await sendAndConfirmTransaction({
    transaction,
    account: adminAccount // Dein Admin-Account
  });
  */
  
  console.log(`Would send ${amount} D.INVEST tokens to ${walletAddress}`);
}
