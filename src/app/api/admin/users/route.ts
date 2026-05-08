import { NextRequest, NextResponse } from 'next/server';
import { getAllUserProfiles, setArtistStatus } from '../../../lib/questDb';

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
  let body: { walletAddress?: string; isArtist?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }
  const { walletAddress, isArtist } = body;
  if (!walletAddress || typeof isArtist !== 'boolean') {
    return NextResponse.json({ error: 'walletAddress und isArtist erforderlich' }, { status: 400 });
  }
  try {
    await setArtistStatus(walletAddress, isArtist);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
