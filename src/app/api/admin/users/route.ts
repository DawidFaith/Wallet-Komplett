import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAllUserProfiles, setArtistStatus, upsertUserProfile } from '../../../lib/questDb';
import { getDb } from '../../../lib/db';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const users = await getAllUserProfiles();

    // Clerk-E-Mails für alle Nutzer abrufen. DB speichert wallet_address als
    // lowercase, Clerk-IDs können Großbuchstaben enthalten → getUserList({ userId })
    // findet nichts. Deshalb alle User paginiert laden und per lowercase-Vergleich
    // matchen (gleiches Muster wie reputation/leaderboard/route.ts).
    const emailByWallet = new Map<string, string | null>();
    try {
      const clerk = await clerkClient();
      const idSet = new Set(users.map(u => u.walletAddress));
      let offset = 0;
      const pageSize = 100;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: batch, totalCount } = await clerk.users.getUserList({ limit: pageSize, offset });
        for (const u of batch) {
          const lcId = u.id.toLowerCase();
          if (idSet.has(lcId)) {
            emailByWallet.set(lcId, u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? null);
          }
        }
        if (batch.length < pageSize || offset + batch.length >= totalCount) break;
        offset += pageSize;
      }
    } catch { /* E-Mails bleiben null falls Clerk-Abruf fehlschlägt */ }

    const enriched = users.map(u => ({ ...u, email: emailByWallet.get(u.walletAddress) ?? null }));
    return NextResponse.json({ users: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  let body: { walletAddress?: string; isArtist?: boolean; rewardToken?: string; solanaAddress?: string; tokenMintAddress?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }
  const { walletAddress, isArtist, rewardToken, solanaAddress, tokenMintAddress } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress erforderlich' }, { status: 400 });
  }
  try {
    if (typeof isArtist === 'boolean') {
      await setArtistStatus(walletAddress, isArtist);
    }
    if (rewardToken !== undefined) {
      await upsertUserProfile(walletAddress, { rewardToken });
    }
    if (tokenMintAddress !== undefined) {
      await upsertUserProfile(walletAddress, { tokenMintAddress });
    }
    if (solanaAddress !== undefined) {
      const sql = getDb();
      const trimmed = solanaAddress.trim();
      if (trimmed === '') {
        await sql`DELETE FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}`;
      } else {
        await sql`
          INSERT INTO solana_accounts (wallet_address, solana_address, solana_private_key)
          VALUES (${walletAddress.toLowerCase()}, ${trimmed}, '')
          ON CONFLICT (wallet_address) DO UPDATE SET solana_address = ${trimmed}
        `;
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress')?.toLowerCase();
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress erforderlich' }, { status: 400 });
  }
  const sql = getDb();
  try {
    // Alle verknüpften Daten löschen
    await sql`DELETE FROM solana_accounts    WHERE wallet_address = ${walletAddress}`;
    await sql`DELETE FROM user_reputation    WHERE wallet_address = ${walletAddress}`;
    await sql`DELETE FROM user_referrals     WHERE referrer_wallet = ${walletAddress} OR referred_wallet = ${walletAddress}`;
    await sql`DELETE FROM pending_rewards    WHERE wallet_address = ${walletAddress}`.catch(() => {});
    await sql`DELETE FROM user_profiles      WHERE wallet_address = ${walletAddress}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
