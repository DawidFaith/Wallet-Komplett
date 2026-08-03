import { NextRequest, NextResponse } from 'next/server';
import { endGiveawayCampaign } from '../../../../lib/questDb';
import { requireOwnWallet } from '../../../../lib/apiAuth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const artistWallet = req.nextUrl.searchParams.get('artistWallet');
  if (!artistWallet) return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
  const authCheck = requireOwnWallet(artistWallet);
  if (!authCheck.ok) return authCheck.response;

  const ok = await endGiveawayCampaign(params.id, artistWallet);
  if (!ok) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden oder bereits beendet.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
