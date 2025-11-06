import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const keyInfo = {
    publishableKey: {
      exists: !!publishableKey,
      type: publishableKey?.startsWith('pk_live_') ? 'LIVE' : 
            publishableKey?.startsWith('pk_test_') ? 'TEST' : 'UNKNOWN',
      prefix: publishableKey?.substring(0, 12) + '...' || 'NOT_SET'
    },
    secretKey: {
      exists: !!secretKey,
      type: secretKey?.startsWith('sk_live_') ? 'LIVE' : 
            secretKey?.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN',
      prefix: secretKey?.substring(0, 12) + '...' || 'NOT_SET'
    },
    webhookSecret: {
      exists: !!webhookSecret,
      prefix: webhookSecret?.substring(0, 12) + '...' || 'NOT_SET'
    },
    validation: {
      allLive: publishableKey?.startsWith('pk_live_') && secretKey?.startsWith('sk_live_'),
      hasTestKeys: publishableKey?.startsWith('pk_test_') || secretKey?.startsWith('sk_test_'),
      ready: !!(publishableKey?.startsWith('pk_live_') && secretKey?.startsWith('sk_live_') && webhookSecret)
    }
  };

  console.log('🔍 Stripe Keys Debug:', keyInfo);

  return NextResponse.json({
    message: '🔍 Stripe Keys Debug Information',
    ...keyInfo,
    warning: keyInfo.validation.hasTestKeys ? '⚠️ TEST KEYS DETECTED! Only Live keys should be used.' : null,
    status: keyInfo.validation.ready ? '✅ Ready for Live' : '❌ Not Ready'
  });
}