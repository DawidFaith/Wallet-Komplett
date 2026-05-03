import { NextRequest, NextResponse } from 'next/server';
import { loadPendingRewardsByWallet, getPendingRewardTotal } from '../../../lib/questDb';

// GET: Ausstehende Rewards einer Wallet laden
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');
  if (!walletAddress) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }
  try {
    const [rewards, total] = await Promise.all([
      loadPendingRewardsByWallet(walletAddress),
      getPendingRewardTotal(walletAddress),
    ]);
    return NextResponse.json({ rewards, total });
  } catch (err) {
    console.error('Fehler beim Laden der Rewards:', err);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}
