import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { claimPendingShopGiftsForEmail } from '../../../lib/questDb';
import { requireOwnWallet } from '../../../lib/apiAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Wird beim Login aufgerufen (siehe home/page.tsx), damit offen verschenkte
 * Shop-Items mit derselben E-Mail automatisch dem frisch registrierten/
 * eingeloggten Account gutgeschrieben werden. Gleiche Sicherheitslogik wie
 * /api/giveaways/claim-by-email: die E-Mail kommt NICHT aus dem Client-Body,
 * sondern serverseitig aus dem verifizierten Clerk-Profil.
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
    if (!email) return NextResponse.json({ success: true });

    await claimPendingShopGiftsForEmail(walletAddress, email);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[shop/claim-gifts]', e);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
