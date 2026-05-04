import { NextRequest, NextResponse } from 'next/server';
import { upsertUserProfile, getUserProfile } from '../../../lib/questDb';

/**
 * POST /api/youtube-quests/facebook-oauth
 * Speichert einen verifizierten Facebook-Account (via Thirdweb OAuth) für eine Wallet.
 *
 * Body: { walletAddress, facebookId, name, picture }
 * facebookId = die deterministische Thirdweb-Wallet-Adresse des Facebook-Accounts
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; facebookId?: string; name?: string; picture?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const { walletAddress, facebookId, name, picture } = body;

  if (!walletAddress || !facebookId) {
    return NextResponse.json({ error: 'walletAddress und facebookId sind erforderlich' }, { status: 400 });
  }

  const normalized = walletAddress.toLowerCase();
  const normalizedFbId = facebookId.toLowerCase();

  // Duplikat-Check: Ist dieser Facebook-Account bereits einer anderen Wallet zugeordnet?
  // Wir speichern die facebookId im facebookHandle-Feld
  // Dazu alle Profile prüfen die denselben facebookHandle haben
  try {
    // Direkte DB-Abfrage für Duplikat-Check
    const { getDb } = await import('../../../lib/db');
    const sql = getDb();
    const existing = await sql`
      SELECT wallet_address FROM user_profiles
      WHERE facebook_handle = ${normalizedFbId}
        AND wallet_address != ${normalized}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Dieser Facebook-Account ist bereits mit einer anderen Wallet verknüpft.' },
        { status: 409 }
      );
    }

    await upsertUserProfile(normalized, {
      facebookHandle: normalizedFbId,
      facebookVerified: true,
      facebookName: name ?? null,
      facebookPicture: picture ?? null,
    });

    return NextResponse.json({ success: true, name, picture });
  } catch (err) {
    console.error('[facebook-oauth] Fehler:', err);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}

/**
 * DELETE /api/youtube-quests/facebook-oauth?wallet=0x...
 * Trennt den Facebook-Account von der Wallet.
 */
export async function DELETE(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  try {
    await upsertUserProfile(wallet, {
      facebookHandle: null,
      facebookVerified: false,
      facebookName: null,
      facebookPicture: null,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}
