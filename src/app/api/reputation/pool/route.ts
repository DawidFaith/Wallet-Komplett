import { NextRequest, NextResponse } from 'next/server';
import { getReputationPool, depositReputationPool } from '../../../lib/questDb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');
  if (!artistWallet) return NextResponse.json({ error: 'artistWallet required' }, { status: 400 });
  const balance = await getReputationPool(artistWallet);
  return NextResponse.json({ balance });
}

export async function POST(req: NextRequest) {
  try {
    const { artistWallet, amount } = await req.json();
    if (!artistWallet || !amount || amount <= 0) {
      return NextResponse.json({ error: 'artistWallet und amount erforderlich' }, { status: 400 });
    }
    const success = await depositReputationPool(artistWallet, Number(amount));
    if (!success) return NextResponse.json({ error: 'Nicht genug D.FAITH Credits' }, { status: 400 });
    const newBalance = await getReputationPool(artistWallet);
    return NextResponse.json({ success: true, poolBalance: newBalance });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
