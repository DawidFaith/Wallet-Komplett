/**
 * POST /api/shop/gift  – Artist verschenkt eine Edition eines eigenen Shop-Items
 *                        kostenlos an eine E-Mail-Adresse (Body: { wallet, itemId, email })
 * GET  /api/shop/gift  – Liste der bisher verschenkten Editionen für ein Item
 *                        (Query: wallet, itemId)
 *
 * Der Eintrag bleibt als 'pending' liegen, bis sich die Person mit genau
 * dieser (von Clerk verifizierten) E-Mail registriert oder einloggt — dann
 * greift claimPendingShopGiftsForEmail über /api/shop/claim-gifts beim Login,
 * exakt analog zum bestehenden Giveaway-claim-by-email-Muster.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { createShopGift, listShopGiftsForArtist } from '../../../lib/questDb';
import { requireOwnWallet } from '../../../lib/apiAuth';
import { checkRateLimit } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';

async function loadOwnedItem(itemId: string, artistWallet: string) {
  const sql = getDb();
  const rows = await sql`SELECT id, artist_wallet FROM shop_items WHERE id = ${itemId} LIMIT 1`;
  if (!rows.length) return null;
  if ((rows[0].artist_wallet as string) !== artistWallet.toLowerCase()) return null;
  return rows[0];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, itemId, email } = body as { wallet?: string; itemId?: string; email?: string };
  if (!wallet || !itemId || !email) {
    return NextResponse.json({ error: 'wallet, itemId und email erforderlich' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
  }

  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

  const rl = await checkRateLimit(`shop-gift:${authCheck.userId}`, 30, 60);
  if (!rl.ok) return rl.response!;

  const item = await loadOwnedItem(itemId, wallet);
  if (!item) return NextResponse.json({ error: 'Item nicht gefunden oder nicht dein Item' }, { status: 404 });

  const cleanEmail = email.trim().toLowerCase();
  const gift = await createShopGift(itemId, wallet.toLowerCase(), cleanEmail);

  return NextResponse.json({ success: true, status: gift.status, giftId: gift.id });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  const itemId = searchParams.get('itemId') ?? undefined;
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

  const gifts = await listShopGiftsForArtist(wallet.toLowerCase(), itemId);
  return NextResponse.json(gifts);
}
