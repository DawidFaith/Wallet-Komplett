import { NextRequest, NextResponse } from 'next/server';
import { refundExpiredQuests } from '../../../lib/questDb';
import { PLATFORM_ACCOUNTS } from '../../../lib/platformAccounts';

const PLATFORM_ACCOUNT_WALLETS = new Set(Object.values(PLATFORM_ACCOUNTS).map(a => a.wallet));
const DAWID_FAITH_WALLET = 'user_3dfvunr7ziaywue8bhzdqw2blsw';

/**
 * POST /api/youtube-quests/refund-expired
 * Gibt Credits für abgelaufene/ausgeschöpfte Quests an den Creator zurück.
 * Wird vom CreatorBoard beim Laden aufgerufen.
 */
export async function POST(req: NextRequest) {
  let body: { creatorWallet?: string; billingWallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { creatorWallet, billingWallet } = body;
  if (!creatorWallet) {
    return NextResponse.json({ error: 'creatorWallet erforderlich' }, { status: 400 });
  }

  const isPlatformAccount = PLATFORM_ACCOUNT_WALLETS.has(creatorWallet.toLowerCase());
  const refundWallet = (isPlatformAccount && billingWallet?.toLowerCase() === DAWID_FAITH_WALLET)
    ? DAWID_FAITH_WALLET
    : undefined;

  try {
    const refunds = await refundExpiredQuests(creatorWallet, refundWallet);
    const totalRefunded = refunds.reduce((sum, r) => sum + r.refundAmount, 0);
    return NextResponse.json({ success: true, refunds, totalRefunded });
  } catch (e) {
    console.error('[refund-expired]', e);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}
