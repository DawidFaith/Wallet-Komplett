/**
 * GET  /api/admin/shop-items?artistWallet=xxx  – alle Items eines Artists
 * PATCH /api/admin/shop-items                  – Preis eines Items ändern
 */
import { NextRequest, NextResponse } from 'next/server';
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
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet')?.toLowerCase();
  const sql = getDb();

  if (artistWallet) {
    const rows = await sql`
      SELECT id, title, description, type, image_url,
             price_credits, price_tokens, is_active, created_at,
             master_edition_mint, nft_max_supply, edition_count, is_nft_enabled
      FROM shop_items
      WHERE LOWER(artist_wallet) = ${artistWallet}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  }

  // Alle Items (Admin-Übersicht)
  const rows = await sql`
    SELECT
      si.id, si.title, si.type, si.image_url, si.is_active, si.is_nft_enabled,
      si.master_edition_mint, si.nft_max_supply, si.edition_count,
      si.price_credits, si.created_at, si.artist_wallet,
      p.display_name AS artist_name,
      COUNT(sp.id)::int AS purchase_count
    FROM shop_items si
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = si.artist_wallet
    LEFT JOIN shop_purchases sp ON sp.item_id = si.id
    GROUP BY si.id, p.display_name
    ORDER BY si.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  let body: { itemId?: string; priceCredits?: number; priceTokens?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }
  const { itemId, priceCredits, priceTokens } = body;
  if (!itemId) {
    return NextResponse.json({ error: 'itemId fehlt' }, { status: 400 });
  }
  if (priceCredits !== undefined && (typeof priceCredits !== 'number' || priceCredits < 0)) {
    return NextResponse.json({ error: 'priceCredits muss eine nicht-negative Zahl sein' }, { status: 400 });
  }
  const sql = getDb();
  if (priceCredits !== undefined) {
    await sql`UPDATE shop_items SET price_credits = ${priceCredits} WHERE id = ${itemId}`;
  }
  if (priceTokens !== undefined) {
    await sql`UPDATE shop_items SET price_tokens = ${priceTokens} WHERE id = ${itemId}`;
  }
  return NextResponse.json({ success: true });
}
