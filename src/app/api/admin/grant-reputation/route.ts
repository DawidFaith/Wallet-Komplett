/**
 * POST /api/admin/grant-reputation
 * Body: { walletAddress: string, artistWallet: string, amount: number }
 * Header: x-admin-secret
 * Vergib manuell Reputation an einen User für einen Artist.
 * Löst bei Bedarf den Referral-Trigger aus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { addUserReputation, getUserReputation } from '../../../lib/questDb';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    walletAddress?: string;
    artistWallet?: string;
    amount?: number;
  };

  const walletAddress = body.walletAddress?.trim();
  const artistWallet = body.artistWallet?.trim();
  const amount = Number(body.amount ?? 0);

  if (!walletAddress || !artistWallet) {
    return NextResponse.json({ error: 'walletAddress und artistWallet erforderlich' }, { status: 400 });
  }
  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount muss > 0 sein' }, { status: 400 });
  }

  // Referral-Status vor dem Grant merken
  const sql = getDb();
  const beforeRows = await sql`
    SELECT id, triggered_at FROM user_referrals
    WHERE referred_wallet = ${walletAddress.toLowerCase()} AND triggered_at IS NULL
    LIMIT 1
  `.catch(() => []);

  await addUserReputation(walletAddress, artistWallet, amount);

  // Prüfen ob Trigger während des Grants ausgelöst wurde
  const afterRows = beforeRows.length > 0
    ? await sql`
        SELECT triggered_at FROM user_referrals
        WHERE id = ${beforeRows[0].id as number}
        LIMIT 1
      `.catch(() => [])
    : [];
  const referralTriggered = afterRows.length > 0 && afterRows[0].triggered_at != null;

  const newRep = await getUserReputation(walletAddress, artistWallet);
  return NextResponse.json({
    success: true,
    reputation: newRep.reputation,
    level: newRep.level,
    levelName: newRep.levelName,
    referralTriggered,
  });
}
