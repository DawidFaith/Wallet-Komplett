import { NextRequest, NextResponse } from 'next/server';
import { creditCreatorBalance, getCreatorBalance, getDfaithCredits } from '../../../lib/questDb';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  let body: { walletAddress?: string; amount?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { walletAddress, amount, note } = body;

  if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.trim()) {
    return NextResponse.json({ error: 'walletAddress erforderlich' }, { status: 400 });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
    return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
  }

  // Unique pseudo-txHash für Admin-Gutschriften (UNIQUE constraint in creator_deposits)
  const pseudoTxHash = `admin_manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const noteTag = note?.trim() ? `_${note.trim().replace(/\s+/g, '_').slice(0, 40)}` : '';
  const txHash = `${pseudoTxHash}${noteTag}`;

  try {
    await creditCreatorBalance(walletAddress.trim(), amount, txHash);
    const [creatorBalance, dfaithBalance] = await Promise.all([
      getCreatorBalance(walletAddress.trim()),
      getDfaithCredits(walletAddress.trim()),
    ]);
    return NextResponse.json({ success: true, newBalance: dfaithBalance, creatorBalance, credited: amount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
