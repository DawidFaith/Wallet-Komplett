/**
 * GET  /api/shop?artistWallet=XXX&wallet=USER  – Items eines Artists + Kauf-Status
 * POST /api/shop                               – Neues Item erstellen (Artist)
 * DELETE /api/shop                             – Item löschen (Artist)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet')?.toLowerCase();
  const wallet       = searchParams.get('wallet')?.toLowerCase();

  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet fehlt' }, { status: 400 });
  }

  const sql = getDb();

  const items = await sql`
    SELECT id, artist_wallet, title, description, type,
           price_credits, price_tokens, content_url, image_url, is_active, created_at
    FROM shop_items
    WHERE artist_wallet = ${artistWallet} AND is_active = TRUE
    ORDER BY created_at DESC
  `;

  // Bereits gekaufte Items des Nutzers
  let purchasedIds: string[] = [];
  if (wallet) {
    const itemIds = (items as Array<Record<string, unknown>>).map(i => String(i.id));
    const rows = await sql`
      SELECT item_id FROM shop_purchases
      WHERE buyer_wallet = ${wallet} AND item_id = ANY(${itemIds})
    `;
    purchasedIds = (rows as Array<Record<string, unknown>>).map(r => String(r.item_id));
  }

  return NextResponse.json(
    items.map((item: Record<string, unknown>) => ({
      ...item,
      purchased: purchasedIds.includes(item.id as string),
    })),
  );
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, title, description, type, priceCredits, priceTokens, contentUrl, imageUrl } = body as {
    wallet?: string;
    title?: string;
    description?: string;
    type?: string;
    priceCredits?: number;
    priceTokens?: number | null;
    contentUrl?: string;
    imageUrl?: string;
  };

  if (!wallet || !title || !type) {
    return NextResponse.json({ error: 'wallet, title, type sind Pflichtfelder' }, { status: 400 });
  }
  if (!['song', 'video', 'nft', 'exclusive'].includes(type)) {
    return NextResponse.json({ error: 'Ungültiger Typ' }, { status: 400 });
  }
  if (typeof priceCredits !== 'number' || priceCredits < 0) {
    return NextResponse.json({ error: 'priceCredits muss >= 0 sein' }, { status: 400 });
  }

  const sql = getDb();

  // Sicherstellen, dass der Nutzer ein Artist ist
  const profile = await sql`
    SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
  `;
  if (!profile.length || !profile[0].is_artist) {
    return NextResponse.json({ error: 'Nur Artists können Items erstellen' }, { status: 403 });
  }

  const rows = await sql`
    INSERT INTO shop_items (artist_wallet, title, description, type, price_credits, price_tokens, content_url, image_url)
    VALUES (
      ${wallet.toLowerCase()},
      ${title.trim()},
      ${description?.trim() ?? ''},
      ${type},
      ${priceCredits},
      ${typeof priceTokens === 'number' && priceTokens > 0 ? priceTokens : null},
      ${contentUrl?.trim() ?? ''},
      ${imageUrl?.trim() ?? ''}
    )
    RETURNING id, title, type, price_credits, price_tokens, is_active, created_at
  `;

  return NextResponse.json(rows[0], { status: 201 });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, itemId } = body as { wallet?: string; itemId?: string };
  if (!wallet || !itemId) {
    return NextResponse.json({ error: 'wallet und itemId erforderlich' }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`
    UPDATE shop_items SET is_active = FALSE
    WHERE id = ${itemId} AND artist_wallet = ${wallet.toLowerCase()}
    RETURNING id
  `;

  if (!rows.length) {
    return NextResponse.json({ error: 'Item nicht gefunden oder keine Berechtigung' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
