import { NextRequest, NextResponse } from 'next/server';
import { endGiveawayCampaign, deleteGiveawayCampaign } from '../../../../lib/questDb';
import { requireOwnWallet } from '../../../../lib/apiAuth';

/** PATCH /api/giveaways/campaigns/[id] — Kampagne beenden (gibt ungenutztes Budget zurück) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const artistWallet = req.nextUrl.searchParams.get('artistWallet');
  if (!artistWallet) return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
  const authCheck = requireOwnWallet(artistWallet);
  if (!authCheck.ok) return authCheck.response;

  const ok = await endGiveawayCampaign(params.id, artistWallet);
  if (!ok) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden oder bereits beendet.' }, { status: 404 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/giveaways/campaigns/[id] — beendete Kampagne endgültig löschen */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const artistWallet = req.nextUrl.searchParams.get('artistWallet');
  if (!artistWallet) return NextResponse.json({ error: 'artistWallet erforderlich' }, { status: 400 });
  const authCheck = requireOwnWallet(artistWallet);
  if (!authCheck.ok) return authCheck.response;

  const ok = await deleteGiveawayCampaign(params.id, artistWallet);
  if (!ok) return NextResponse.json({ error: 'Gewinnspiel nicht gefunden oder noch aktiv (erst beenden).' }, { status: 400 });
  return NextResponse.json({ success: true });
}
