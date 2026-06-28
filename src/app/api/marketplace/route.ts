/**
 * GET    /api/marketplace  → aktive Listings (optional ?seller=wallet)
 * POST   /api/marketplace  → NFT einstellen (überträgt NFT in Treasury-Escrow)
 * DELETE /api/marketplace  → Listing stornieren (NFT zurück an Verkäufer)
 *
 * Escrow-Flow:
 *   Listing erstellt → NFT Seller → Treasury
 *   Kauf             → NFT Treasury → Käufer  (buy/route.ts)
 *   Stornierung      → NFT Treasury → Seller
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { transferCollectibleAsset } from '../../lib/collectibleNft';
import { transferSongPrintEdition } from '../../lib/songNft';
import { getTreasuryKeypair } from '../../lib/solanaOperator';
import { decryptKey } from '../../lib/solanaCrypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// ─── Tabelle sicherstellen (idempotent) ───────────────────────────────────────

async function ensureTable(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS nft_listings (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mint_address        TEXT NOT NULL UNIQUE,
      seller_wallet       TEXT NOT NULL,
      price_dfaith        NUMERIC(20,2) NOT NULL,
      collection_id       TEXT,
      collection_name     TEXT,
      rarity              TEXT,
      image_url           TEXT,
      nft_name            TEXT,
      artist_name         TEXT,
      nft_collection_mint TEXT,
      listed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status              TEXT NOT NULL DEFAULT 'active'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_nft_listings_status ON nft_listings(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_nft_listings_seller ON nft_listings(seller_wallet)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_nft_listings_mint   ON nft_listings(mint_address)`;
  await sql`ALTER TABLE nft_listings ADD COLUMN IF NOT EXISTS nft_collection_mint TEXT`;
  await sql`ALTER TABLE nft_listings ADD COLUMN IF NOT EXISTS attributes JSONB`;
  await sql`ALTER TABLE nft_listings ADD COLUMN IF NOT EXISTS nft_type TEXT NOT NULL DEFAULT 'collectible'`;
  await sql`ALTER TABLE nft_listings ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE nft_listings ADD COLUMN IF NOT EXISTS content_url TEXT`;
  await sql`ALTER TABLE nft_listings ADD COLUMN IF NOT EXISTS edition_number INTEGER`;
}

// ─── GET: Listings laden ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seller       = searchParams.get('seller');
  const rarity       = searchParams.get('rarity');
  const collectionId = searchParams.get('collection');

  try {
    const sql = getDb();
    await ensureTable(sql);

    // Explizite Spaltenauswahl — für Song-NFTs: description/content_url/edition_number
    // live aus shop_purchases + shop_items nachladen (Fallback für ältere Listings ohne gespeicherte Werte)
    const cols = sql`
      nl.id, nl.mint_address, nl.seller_wallet, nl.price_dfaith,
      nl.collection_id, nl.collection_name, nl.rarity, nl.image_url, nl.nft_name,
      nl.nft_type,
      NULLIF(COALESCE(NULLIF(nl.description,''), NULLIF(si.description,''), NULLIF(cc.description,'')), '') AS description,
      NULLIF(COALESCE(NULLIF(nl.content_url,''), NULLIF(si.content_url,'')), '') AS content_url,
      COALESCE(nl.edition_number, sp.edition_number)::int                 AS edition_number,
      COALESCE(
        CASE WHEN up.display_platform = 'youtube'   THEN yb.channel_name     ELSE NULL END,
        CASE WHEN up.display_platform = 'instagram' THEN up.instagram_name   ELSE NULL END,
        CASE WHEN up.display_platform = 'tiktok'    THEN up.tiktok_name      ELSE NULL END,
        CASE WHEN up.display_platform = 'facebook'  THEN up.facebook_name    ELSE NULL END,
        up.display_name, nl.artist_name
      )                                                                    AS artist_name,
      nl.nft_collection_mint, nl.listed_at, nl.status, nl.attributes,
      COALESCE(
        CASE WHEN up.display_platform = 'youtube'   THEN yb.channel_thumbnail  ELSE NULL END,
        CASE WHEN up.display_platform = 'clerk'     THEN up.clerk_image_url    ELSE NULL END,
        CASE WHEN up.display_platform = 'instagram' THEN up.instagram_picture  ELSE NULL END,
        CASE WHEN up.display_platform = 'tiktok'    THEN up.tiktok_picture     ELSE NULL END,
        CASE WHEN up.display_platform = 'facebook'  THEN up.facebook_picture   ELSE NULL END,
        up.clerk_image_url,
        yb.channel_thumbnail,
        up.instagram_picture, up.tiktok_picture, up.facebook_picture
      )                                                                    AS artist_picture
    `;
    const joins = sql`
      LEFT JOIN shop_purchases sp            ON sp.nft_mint_address = nl.mint_address
      LEFT JOIN shop_items si                ON si.id = sp.item_id
      LEFT JOIN user_collectibles uc         ON uc.nft_mint_address = nl.mint_address
      LEFT JOIN collectible_collections cc   ON cc.id = uc.collection_id
      LEFT JOIN user_profiles up             ON LOWER(up.wallet_address) = COALESCE(cc.artist_wallet, si.artist_wallet)
      LEFT JOIN youtube_bindings yb          ON yb.wallet_address = up.wallet_address
    `;

    if (seller) {
      const rows = await sql`
        SELECT ${cols} FROM nft_listings nl ${joins}
        WHERE nl.seller_wallet = ${seller.toLowerCase()} AND nl.status = 'active'
        ORDER BY nl.listed_at DESC
      `;
      return NextResponse.json({ listings: rows });
    }

    const rows = rarity && collectionId
      ? await sql`SELECT ${cols} FROM nft_listings nl ${joins}
          WHERE nl.status = 'active' AND nl.rarity = ${rarity} AND nl.collection_id = ${collectionId}
          ORDER BY nl.price_dfaith ASC, nl.listed_at DESC`
      : rarity
      ? await sql`SELECT ${cols} FROM nft_listings nl ${joins}
          WHERE nl.status = 'active' AND nl.rarity = ${rarity}
          ORDER BY nl.price_dfaith ASC, nl.listed_at DESC`
      : collectionId
      ? await sql`SELECT ${cols} FROM nft_listings nl ${joins}
          WHERE nl.status = 'active' AND nl.collection_id = ${collectionId}
          ORDER BY nl.price_dfaith ASC, nl.listed_at DESC`
      : await sql`SELECT ${cols} FROM nft_listings nl ${joins}
          WHERE nl.status = 'active'
          ORDER BY nl.price_dfaith ASC, nl.listed_at DESC
          LIMIT 100`;

    return NextResponse.json({ listings: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// ─── POST: NFT einstellen + in Treasury-Escrow übertragen ────────────────────

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
      nftCollectionMint?: string;
      nftType?: 'collectible' | 'song';
      description?: string | null;
      contentUrl?: string | null;
      editionNumber?: number | null;
      attributes?: { trait_type: string; value: string }[] | null;
    };

    const { walletAddress, mintAddress, priceDfaith } = body;
    if (!walletAddress || !mintAddress || !priceDfaith || priceDfaith <= 0) {
      return NextResponse.json({ error: 'walletAddress, mintAddress und priceDfaith > 0 erforderlich' }, { status: 400 });
    }

    const sql = getDb();
    await ensureTable(sql);

    // Bereits aktiv gelistet?
    const existing = await sql`
      SELECT id FROM nft_listings WHERE mint_address = ${mintAddress} AND status = 'active'
    `;
    if (existing.length) {
      return NextResponse.json({ error: 'Dieses NFT ist bereits gelistet' }, { status: 409 });
    }

    // Alte abgeschlossene/stornierte Listings löschen um Unique-Constraint-Konflikt zu vermeiden
    await sql`DELETE FROM nft_listings WHERE mint_address = ${mintAddress} AND status != 'active'`;

    // NFT-Typ bestimmen: explizit übergeben oder aus Attributen ableiten
    const nftType: 'collectible' | 'song' =
      body.nftType === 'song'
      || (body.attributes ?? []).some(a => a.trait_type === 'Type' && a.value === 'Music')
        ? 'song'
        : 'collectible';

    // Seller-Solana-Keypair laden
    const sellerSolRows = await sql`
      SELECT solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!sellerSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet gefunden — verbinde zuerst dein Wallet' }, { status: 400 });
    }
    const sellerKeypair = Keypair.fromSecretKey(
      bs58.decode(decryptKey(sellerSolRows[0].solana_private_key as string))
    );

    const treasuryKeypair = getTreasuryKeypair();
    const treasuryAddress = treasuryKeypair.publicKey.toBase58();

    // nft_collection_mint nur für Collectibles benötigt
    let nftCollectionMint: string | null = body.nftCollectionMint ?? null;

    if (nftType === 'collectible') {
      // Aus DB holen falls nicht übergeben
      if (!nftCollectionMint) {
        const ccRow = await sql`
          SELECT cc.nft_collection_mint FROM user_collectibles uc
          JOIN collectible_collections cc ON cc.id = uc.collection_id
          WHERE uc.wallet_address = ${walletAddress.toLowerCase()}
            AND uc.nft_mint_address = ${mintAddress}
          LIMIT 1
        `;
        nftCollectionMint = (ccRow[0]?.nft_collection_mint as string | null) ?? null;
      }
      if (!nftCollectionMint) {
        return NextResponse.json({ error: 'Collection-Mint fehlt — Collectible kann nicht übertragen werden' }, { status: 400 });
      }
      try {
        await transferCollectibleAsset(mintAddress, nftCollectionMint, sellerKeypair, treasuryAddress, treasuryKeypair);
      } catch (transferErr) {
        return NextResponse.json({
          error: `NFT-Escrow-Transfer fehlgeschlagen: ${transferErr instanceof Error ? transferErr.message : String(transferErr)}`,
        }, { status: 500 });
      }
    } else {
      // Song Print Edition → SPL Token Transfer
      try {
        await transferSongPrintEdition({
          mintAddress,
          ownerKeypair:     sellerKeypair,
          recipientAddress: treasuryAddress,
          payerKeypair:     treasuryKeypair,  // Treasury zahlt Tx-Fees
        });
      } catch (transferErr) {
        return NextResponse.json({
          error: `NFT-Escrow-Transfer fehlgeschlagen: ${transferErr instanceof Error ? transferErr.message : String(transferErr)}`,
        }, { status: 500 });
      }
    }

    // Listing nur einfügen wenn Transfer erfolgreich war
    const attributesJson = body.attributes ? JSON.stringify(body.attributes) : null;
    const row = await sql`
      INSERT INTO nft_listings
        (mint_address, seller_wallet, price_dfaith, collection_id, collection_name, rarity, image_url, nft_name, artist_name, nft_collection_mint, nft_type, description, content_url, edition_number, attributes)
      VALUES
        (${mintAddress}, ${walletAddress.toLowerCase()}, ${priceDfaith},
         ${body.collectionId ?? null}, ${body.collectionName ?? null}, ${body.rarity ?? null},
         ${body.imageUrl ?? null}, ${body.nftName ?? null}, ${body.artistName ?? null},
         ${nftCollectionMint}, ${nftType},
         ${body.description ?? null}, ${body.contentUrl ?? null}, ${body.editionNumber ?? null},
         ${attributesJson}::jsonb)
      RETURNING id
    `;

    return NextResponse.json({ success: true, listingId: row[0].id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// ─── DELETE: Listing stornieren + NFT aus Escrow zurück an Verkäufer ─────────

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

    // Listing laden und Besitz prüfen
    const listingRows = await sql`
      SELECT mint_address, nft_collection_mint, nft_type
      FROM nft_listings
      WHERE id           = ${listingId}
        AND seller_wallet = ${walletAddress.toLowerCase()}
        AND status        = 'active'
      LIMIT 1
    `;
    if (!listingRows.length) {
      return NextResponse.json({ error: 'Listing nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }

    const mintAddress       = listingRows[0].mint_address        as string;
    const nftCollectionMint = listingRows[0].nft_collection_mint as string | null;
    const nftType           = (listingRows[0].nft_type as string | null) ?? 'collectible';

    // Seller-Solana-Adresse laden (Ziel für Rückgabe)
    const sellerSolRows = await sql`
      SELECT solana_address FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!sellerSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet für Verkäufer gefunden' }, { status: 400 });
    }
    const sellerSolanaAddress = sellerSolRows[0].solana_address as string;

    // NFT aus Treasury-Escrow zurück an Verkäufer übertragen
    const treasuryKeypair = getTreasuryKeypair();
    try {
      if (nftType === 'song') {
        await transferSongPrintEdition({
          mintAddress,
          ownerKeypair:     treasuryKeypair,
          recipientAddress: sellerSolanaAddress,
          payerKeypair:     treasuryKeypair,
        });
      } else if (nftCollectionMint) {
        await transferCollectibleAsset(mintAddress, nftCollectionMint, treasuryKeypair, sellerSolanaAddress);
      }
    } catch (transferErr) {
      return NextResponse.json({
        error: `NFT-Rückgabe fehlgeschlagen: ${transferErr instanceof Error ? transferErr.message : String(transferErr)}`,
      }, { status: 500 });
    }

    // Erst nach erfolgreichem Transfer als storniert markieren
    await sql`UPDATE nft_listings SET status = 'cancelled' WHERE id = ${listingId}`;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
