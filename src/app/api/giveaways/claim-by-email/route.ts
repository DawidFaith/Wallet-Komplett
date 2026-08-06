import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { claimPendingGiveawayEntriesForEmail } from '../../../lib/questDb';
import { requireOwnWallet } from '../../../lib/apiAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Wird einmal pro Session vom eingeloggten Client aufgerufen (siehe home/page.tsx),
 * damit offene Giveaway-Teilnahmen mit derselben E-Mail automatisch dem Account
 * zugeordnet werden — ohne dass der Fan die Bio-Code-Verifizierung erneut durchläuft.
 *
 * Wichtig: die E-Mail wird NICHT aus dem Client-Body übernommen (fälschbar — sonst
 * könnte jeder eingeloggte Nutzer mit einer fremden/erratenen Gewinner-E-Mail deren
 * Giveaway-Credits auf die eigene Wallet umleiten), sondern serverseitig aus dem
 * verifizierten Clerk-Profil des angemeldeten Nutzers geholt.
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const { walletAddress } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress erforderlich' }, { status: 400 });
  }

  const authCheck = requireOwnWallet(walletAddress);
  if (!authCheck.ok) return authCheck.response;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(authCheck.userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    if (!email) return NextResponse.json({ success: true }); // kein verifiziertes Profil-E-Mail — nichts zu claimen

    await claimPendingGiveawayEntriesForEmail(walletAddress, email);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[giveaways/claim-by-email]', e);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
