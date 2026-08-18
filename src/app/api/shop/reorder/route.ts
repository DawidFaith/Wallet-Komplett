/**
 * PATCH /api/shop/reorder
 * Body: { wallet, itemId, direction: 'up' | 'down' }
 * Vertauscht sort_order mit dem direkten Nachbarn in der aktuellen Anzeige-Reihenfolge.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { requireOwnWallet } from '../../../lib/apiAuth';

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, itemId, direction } = body as {
    wallet?: string;
    itemId?: string;
    direction?: 'up' | 'down';
  };
  if (!wallet || !itemId || (direction !== 'up' && direction !== 'down')) {
    return NextResponse.json({ error: 'wallet, itemId und direction (up/down) erforderlich' }, { status: 400 });
  }
  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

  const sql = getDb();

  // Gleiche Reihenfolge wie die Shop-Verwaltung (MyShopPanel), damit "hoch/runter"
  // genau das tut, was der Artist visuell erwartet.
  const items = await sql`
    SELECT id, sort_order FROM shop_items
    WHERE artist_wallet = ${wallet.toLowerCase()}
    ORDER BY sort_order ASC, created_at DESC
  `;
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Item nicht gefunden oder keine Berechtigung' }, { status: 404 });
  }

  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= items.length) {
    return NextResponse.json({ success: true }); // Schon am Anfang/Ende — nichts zu tun
  }

  // Positionen im Array tauschen und ALLE Items neu sequenziell durchnummerieren
  // (statt nur zwei Werte zu tauschen) — robust gegen alte Bestandsdaten, bei denen
  // sort_order noch nicht eindeutig ist (z.B. alle 0 vor Einführung dieses Features).
  [items[idx], items[neighborIdx]] = [items[neighborIdx], items[idx]];
  await Promise.all(
    items.map((item, i) => sql`UPDATE shop_items SET sort_order = ${i} WHERE id = ${item.id}`),
  );

  return NextResponse.json({ success: true });
}
