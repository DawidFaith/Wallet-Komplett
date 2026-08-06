import { NextRequest, NextResponse } from 'next/server';
import { claimPendingGiveawayEntriesForEmail } from '../../../lib/questDb';
import { requireOwnWallet } from '../../../lib/apiAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Wird einmal pro Session vom eingeloggten Client aufgerufen (siehe home/page.tsx),
 * damit offene Giveaway-Teilnahmen mit derselben E-Mail automatisch dem Account
 * zugeordnet werden — ohne dass der Fan die Bio-Code-Verifizierung erneut durchläuft.
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const { walletAddress, email } = body;
  if (!walletAddress || !email) {
    return NextResponse.json({ error: 'walletAddress und email erforderlich' }, { status: 400 });
  }

  const authCheck = requireOwnWallet(walletAddress);
  if (!authCheck.ok) return authCheck.response;

  try {
    await claimPendingGiveawayEntriesForEmail(walletAddress, email);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[giveaways/claim-by-email]', e);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
