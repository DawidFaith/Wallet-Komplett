/**
 * GET  /api/marketplace          → aktive Listings (optional ?seller=wallet für eigene)
 * POST /api/marketplace          → NFT einstellen
 * DELETE /api/marketplace        → Listing stornieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

// ─── GET: Listings laden ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seller = searchParams.get('seller');
  const rarity = searchParams.get('rarity');
  const collectionId = searchParams.get('collection');

  try {
    const sql = getDb();

    if (seller) {
      const rows = await sql`
        SELECT * FROM nft_listings
        WHERE seller_wallet = ${seller.toLowerCase()} AND status = 'active'
        ORDER BY listed_at DESC
      `;
      return NextResponse.json({ listings: rows });
    }

    // Alle aktiven Listings mit optionalen Filtern
    const rows = rarity && collectionId
      ? await sql`SELECT * FROM nft_listings WHERE status = 'active' AND rarity = ${rarity} AND collection_id = ${collectionId} ORDER BY price_dfaith ASC, listed_at DESC`
      : rarity
      ? await sql`SELECT * FROM nft_listings WHERE status = 'active' AND rarity = ${rarity} ORDER BY price_dfaith ASC, listed_at DESC`
      : collectionId
      ? await sql`SELECT * FROM nft_listings WHERE status = 'active' AND collection_id = ${collectionId} ORDER BY price_dfaith ASC, listed_at DESC`
      : await sql`SELECT * FROM nft_listings WHERE status = 'active' ORDER BY price_dfaith ASC, listed_at DESC LIMIT 100`;

    return NextResponse.json({ listings: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// ─── POST: NFT einstellen ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      walletAddress?: string;
      mintAddress?: string;
      priceDfaith?: number;
      collectionId?: string;
      collectionName?: string;
      rarity?: string;
      imageUrl?: string;
      nftName?: string;
      artistName?: string;
    };

    const { walletAddress, mintAddress, priceDfaith } = body;
    if (!walletAddress || !mintAddress || !priceDfaith || priceDfaith <= 0) {
      return NextResponse.json({ error: 'walletAddress, mintAddress und priceDfaith > 0 erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    // Prüfen ob User dieses NFT wirklich besitzt (DB-Check)
    const owns = await sql`
      SELECT id FROM user_collectibles
      WHERE wallet_address = ${walletAddress.toLowerCase()}
        AND nft_mint_address = ${mintAddress}
      LIMIT 1
    `;
    if (!owns.length) {
      return NextResponse.json({ error: 'Du besitzt dieses NFT nicht (laut Datenbank)' }, { status: 403 });
    }

    // Bereits gelistet?
    const existing = await sql`
      SELECT id FROM nft_listings WHERE mint_address = ${mintAddress} AND status = 'active'
    `;
    if (existing.length) {
      return NextResponse.json({ error: 'Dieses NFT ist bereits gelistet' }, { status: 409 });
    }

    const row = await sql`
      INSERT INTO nft_listings (mint_address, seller_wallet, price_dfaith, collection_id, collection_name, rarity, image_url, nft_name, artist_name)
      VALUES (${mintAddress}, ${walletAddress.toLowerCase()}, ${priceDfaith},
              ${body.collectionId ?? null}, ${body.collectionName ?? null}, ${body.rarity ?? null},
              ${body.imageUrl ?? null}, ${body.nftName ?? null}, ${body.artistName ?? null})
      RETURNING id
    `;

    return NextResponse.json({ success: true, listingId: row[0].id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// ─── DELETE: Listing stornieren ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { walletAddress, listingId } = await req.json() as {
      walletAddress?: string;
      listingId?: string;
    };
    if (!walletAddress || !listingId) {
      return NextResponse.json({ error: 'walletAddress und listingId erforderlich' }, { status: 400 });
    }

    const sql = getDb();
    const result = await sql`
      UPDATE nft_listings SET status = 'cancelled'
      WHERE id = ${listingId}
        AND seller_wallet = ${walletAddress.toLowerCase()}
        AND status = 'active'
      RETURNING id
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'Listing nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
