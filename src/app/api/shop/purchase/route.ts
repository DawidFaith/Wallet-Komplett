/**
 * POST /api/shop/purchase
 * Body: { buyerWallet, itemId }
 *
 * Zieht D.FAITH Credits vom Käufer ab und schreibt sie dem Artist gut.
 * Verhindert Doppelkäufe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { redeemDfaithCredits, addDfaithCredits } from '../../../lib/questDb';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { buyerWallet, itemId } = body as { buyerWallet?: string; itemId?: string };
  if (!buyerWallet || !itemId) {
    return NextResponse.json({ error: 'buyerWallet und itemId erforderlich' }, { status: 400 });
  }

  const sql = getDb();

  // Item laden
  const items = await sql`
    SELECT id, artist_wallet, price_credits, title, content_url, type, is_active
    FROM shop_items
    WHERE id = ${itemId}
    LIMIT 1
  `;
  if (!items.length || !items[0].is_active) {
    return NextResponse.json({ error: 'Item nicht gefunden oder nicht aktiv' }, { status: 404 });
  }

  const item = items[0] as {
    id: string;
    artist_wallet: string;
    price_credits: number;
    title: string;
    content_url: string;
    type: string;
    is_active: boolean;
  };

  // Käufer darf sich nichts selbst verkaufen
  if (item.artist_wallet === buyerWallet.toLowerCase()) {
    return NextResponse.json({ error: 'Du kannst dein eigenes Item nicht kaufen' }, { status: 400 });
  }

  // Doppelkauf prüfen
  const alreadyBought = await sql`
    SELECT id FROM shop_purchases
    WHERE buyer_wallet = ${buyerWallet.toLowerCase()} AND item_id = ${itemId}
    LIMIT 1
  `;
  if (alreadyBought.length) {
    return NextResponse.json({ error: 'Bereits gekauft' }, { status: 409 });
  }

  // Kauf abwickeln: Credits abziehen + Artist gutschreiben
  try {
    await redeemDfaithCredits(buyerWallet.toLowerCase(), item.price_credits);
  } catch {
    return NextResponse.json({ error: 'Nicht genug D.FAITH Credits' }, { status: 402 });
  }

  // Artist gutschreiben
  await addDfaithCredits(item.artist_wallet, item.price_credits);

  // Kauf speichern
  await sql`
    INSERT INTO shop_purchases (buyer_wallet, item_id, price_credits_paid)
    VALUES (${buyerWallet.toLowerCase()}, ${itemId}, ${item.price_credits})
  `;

  return NextResponse.json({
    success: true,
    title: item.title,
    contentUrl: item.content_url,
    type: item.type,
  });
}
