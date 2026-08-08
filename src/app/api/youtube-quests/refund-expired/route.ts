import { NextRequest, NextResponse } from 'next/server';
import { refundExpiredQuests } from '../../../lib/questDb';

/**
 * POST /api/youtube-quests/refund-expired
 * Gibt Credits für abgelaufene/ausgeschöpfte Quests an den Creator zurück.
 * Wird vom CreatorBoard beim Laden aufgerufen.
 */
export async function POST(req: NextRequest) {
  let body: { creatorWallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { creatorWallet } = body;
  if (!creatorWallet) {
    return NextResponse.json({ error: 'creatorWallet erforderlich' }, { status: 400 });
  }

  try {
    const refunds = await refundExpiredQuests(creatorWallet);
    const totalRefunded = refunds.reduce((sum, r) => sum + r.refundAmount, 0);
    return NextResponse.json({ success: true, refunds, totalRefunded });
  } catch (e) {
    console.error('[refund-expired]', e);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}
