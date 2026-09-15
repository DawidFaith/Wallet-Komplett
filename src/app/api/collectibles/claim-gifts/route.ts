import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { claimPendingCollectibleGiftsForEmail } from '../../../lib/questDb';
import { requireOwnWallet } from '../../../lib/apiAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Wird beim Login aufgerufen (siehe home/page.tsx), damit per Admin per
 * E-Mail verschenkte Collectibles (siehe /admin → Collectibles) automatisch
 * dem frisch registrierten/eingeloggten Account gutgeschrieben werden.
 * Gleiche Sicherheitslogik wie /api/giveaways/claim-by-email und
 * /api/shop/claim-gifts: die E-Mail kommt serverseitig aus dem verifizierten
 * Clerk-Profil, nicht aus dem Client-Body.
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

    await claimPendingCollectibleGiftsForEmail(walletAddress, email);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[collectibles/claim-gifts]', e);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
