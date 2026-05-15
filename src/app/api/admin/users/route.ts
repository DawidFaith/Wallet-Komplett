import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ users });
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
