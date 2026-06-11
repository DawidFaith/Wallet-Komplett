import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { addShard, getAllActiveCollections } from '../../../lib/questDb/collectibles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/collectibles
 * Shards oder Collectibles manuell an einen User vergeben (für Tests).
 * Body:
 *   { action: 'shard',      walletAddress, artistWallet, amount }
 *   { action: 'collectible', walletAddress, collectionId, rarity }
 * Header: x-admin-secret
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  let body: {
    action?: string;
    walletAddress?: string;
    artistWallet?: string;
    amount?: number;
    collectionId?: string;
    rarity?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  const { action, walletAddress } = body;
  if (!walletAddress?.trim()) {
    return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });
  }
  const wallet = walletAddress.trim().toLowerCase();

  if (action === 'shard') {
    const { artistWallet, amount } = body;
    if (!artistWallet?.trim()) return NextResponse.json({ error: 'artistWallet fehlt' }, { status: 400 });
    const amt = Number(amount ?? 1);
    if (!Number.isFinite(amt) || amt < 1) return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
    const newCount = await addShard(wallet, artistWallet.trim().toLowerCase(), amt);
    return NextResponse.json({ success: true, newCount });
  }

  if (action === 'collectible') {
    const { collectionId, rarity } = body;
    if (!collectionId?.trim()) return NextResponse.json({ error: 'collectionId fehlt' }, { status: 400 });
    const VALID = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    if (!rarity || !VALID.includes(rarity)) return NextResponse.json({ error: 'Ungültige rarity' }, { status: 400 });
    const sql = getDb();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO user_collectibles (id, wallet_address, collection_id, rarity)
      VALUES (${id}, ${wallet}, ${collectionId.trim()}, ${rarity})
    `;
    return NextResponse.json({ success: true, id });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

/**
 * GET /api/admin/collectibles
 * Alle aktiven Kollektionen + Künstler laden (für Admin-Dropdown).
 * Header: x-admin-secret
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const collections = await getAllActiveCollections();
  return NextResponse.json({ collections });
}
