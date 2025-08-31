import { NextRequest, NextResponse } from 'next/server';

// Fallback API Route wenn Stripe nicht konfiguriert ist
export async function POST(req: NextRequest) {
  console.warn('Stripe Payment Intent API aufgerufen, aber nicht konfiguriert');
  
  return NextResponse.json(
    { 
      error: 'Stripe Payment nicht verfügbar',
      message: 'Zahlungsfunktion ist momentan nicht verfügbar. Bitte versuche es später erneut.'
    },
    { status: 503 } // Service Unavailable
  );
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { 
      status: 'Stripe Payment Intent API',
      configured: false,
      message: 'Stripe ist nicht konfiguriert'
    },
    { status: 200 }
  );
}
