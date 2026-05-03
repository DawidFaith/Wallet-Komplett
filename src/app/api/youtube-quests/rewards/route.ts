import { NextRequest, NextResponse } from 'next/server';
import { getDfaithCredits } from '../../../lib/questDb';

// GET: Dfaith Credits einer Wallet laden
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');
  if (!walletAddress) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }
  try {
    const balance = await getDfaithCredits(walletAddress);
    return NextResponse.json({ balance, total: balance });
  } catch (err) {
    console.error('Fehler beim Laden der Credits:', err);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}
