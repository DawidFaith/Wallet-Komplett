/**
 * GET  /api/shop?artistWallet=XXX&wallet=USER  – Items eines Artists + Kauf-Status
 * POST /api/shop                               – Neues Item erstellen (Artist)
 * DELETE /api/shop                             – Item löschen (Artist)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { mintSongMasterEdition } from '../../lib/songNft';

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
           price_credits, price_tokens, content_url, image_url, is_active, created_at,
           required_level
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

  const {
    wallet, title, description, type, priceCredits, priceTokens,
    contentUrl, imageUrl, requiredLevel,
    mintAsNft = false, nftMaxSupply = 100,
  } = body as {
    wallet?: string;
    title?: string;
    description?: string;
    type?: string;
    priceCredits?: number;
    priceTokens?: number | null;
    contentUrl?: string;
    imageUrl?: string;
    requiredLevel?: number;
    mintAsNft?: boolean;
    nftMaxSupply?: number;
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

  // Sicherstellen, dass der Nutzer ein Artist ist + Pflichtfelder für Songs vorab prüfen
  const [profileRows, artistRows, artistNameRows] = await Promise.all([
    sql`SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`,
    sql`SELECT solana_address FROM solana_accounts WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`,
    sql`SELECT display_name, instagram_handle, tiktok_handle, facebook_handle FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`,
  ]);
  // YouTube-Binding separat (left join wäre nötig, separate query einfacher)
  const ytRows = await sql`SELECT channel_name FROM youtube_bindings WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`;

  if (!profileRows.length || !profileRows[0].is_artist) {
    return NextResponse.json({ error: 'Nur Artists können Items erstellen' }, { status: 403 });
  }

  if (type === 'song') {
    if (!contentUrl || !imageUrl) {
      return NextResponse.json({ error: 'Song benötigt Audio- und Cover-URL.' }, { status: 400 });
    }
    const artistName = artistNameRows[0]?.display_name as string | null;
    if (!artistName?.trim()) {
      return NextResponse.json({ error: 'Bitte hinterlege zuerst einen Künstlernamen in deinem Profil.' }, { status: 400 });
    }
    if (!artistRows.length || !artistRows[0].solana_address) {
      return NextResponse.json({ error: 'Keine Solana-Adresse hinterlegt. Bitte verbinde zuerst dein Solana-Wallet.' }, { status: 400 });
    }
  }

  const rows = await sql`
    INSERT INTO shop_items (artist_wallet, title, description, type, price_credits, price_tokens, content_url, image_url, required_level)
    VALUES (
      ${wallet.toLowerCase()},
      ${title.trim()},
      ${description?.trim() ?? ''},
      ${type},
      ${priceCredits},
      ${typeof priceTokens === 'number' && priceTokens > 0 ? priceTokens : null},
      ${contentUrl?.trim() ?? ''},
      ${imageUrl?.trim() ?? ''},
      ${typeof requiredLevel === 'number' && requiredLevel > 0 ? requiredLevel : 0}
    )
    RETURNING id, title, type, price_credits, price_tokens, is_active, created_at, required_level
  `;

  const item = rows[0] as { id: string; title: string; type: string; [k: string]: unknown };

  // Songs werden immer als NFT geminted (Master Edition + nummerierte Print Editions)
  if (type === 'song' && contentUrl && imageUrl) {
    try {
      if (artistRows.length && artistRows[0].solana_address) {
        const artistName = artistNameRows[0]?.display_name as string;
        const { masterMint, metadataUri } = await mintSongMasterEdition({
          artistWallet:        wallet.toLowerCase(),
          artistSolanaAddress: artistRows[0].solana_address as string,
          artistName,
          title:               title.trim(),
          description:         description?.trim() ?? '',
          coverImageUrl:       imageUrl.trim(),
          audioUrl:            contentUrl.trim(),
          maxSupply:           typeof nftMaxSupply === 'number' && nftMaxSupply > 0 ? nftMaxSupply : 100,
          instagramHandle:     (artistNameRows[0]?.instagram_handle as string | null) ?? null,
          tiktokHandle:        (artistNameRows[0]?.tiktok_handle    as string | null) ?? null,
          youtubeChannelName:  (ytRows[0]?.channel_name             as string | null) ?? null,
          facebookHandle:      (artistNameRows[0]?.facebook_handle  as string | null) ?? null,
        });
        await sql`
          UPDATE shop_items
          SET master_edition_mint = ${masterMint},
              nft_max_supply      = ${nftMaxSupply},
              is_nft_enabled      = TRUE
          WHERE id = ${item.id}
        `;
        return NextResponse.json({
          ...item, masterEditionMint: masterMint, metadataUri, isNftEnabled: true,
        }, { status: 201 });
      }
    } catch (nftErr) {
      console.error('Master Edition Mint fehlgeschlagen (Shop-Item wurde trotzdem erstellt):', nftErr);
    }
  }

  return NextResponse.json(item, { status: 201 });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, itemId, title, description, type, priceCredits, priceTokens, contentUrl, imageUrl, requiredLevel } = body as {
    wallet?: string;
    itemId?: string;
    title?: string;
    description?: string;
    type?: string;
    priceCredits?: number;
    priceTokens?: number | null;
    contentUrl?: string;
    imageUrl?: string;
    requiredLevel?: number;
  };

  if (!wallet || !itemId) {
    return NextResponse.json({ error: 'wallet und itemId erforderlich' }, { status: 400 });
  }
  if (type !== undefined && !['song', 'video', 'nft', 'exclusive'].includes(type)) {
    return NextResponse.json({ error: 'Ungültiger Typ' }, { status: 400 });
  }
  if (priceCredits !== undefined && (typeof priceCredits !== 'number' || priceCredits < 0)) {
    return NextResponse.json({ error: 'priceCredits muss >= 0 sein' }, { status: 400 });
  }

  const sql = getDb();

  // Nur eigene Items bearbeiten
  const rows = await sql`
    UPDATE shop_items
    SET
      title          = COALESCE(${title?.trim() ?? null}, title),
      description    = COALESCE(${description?.trim() ?? null}, description),
      type           = COALESCE(${type ?? null}, type),
      price_credits  = COALESCE(${priceCredits ?? null}, price_credits),
      price_tokens   = CASE
                         WHEN ${priceTokens !== undefined} THEN ${priceTokens ?? null}
                         ELSE price_tokens
                       END,
      content_url    = COALESCE(${contentUrl?.trim() ?? null}, content_url),
      image_url      = COALESCE(${imageUrl?.trim() ?? null}, image_url),
      required_level = COALESCE(${requiredLevel ?? null}, required_level)
    WHERE id = ${itemId} AND artist_wallet = ${wallet.toLowerCase()}
    RETURNING id
  `;

  if (!rows.length) {
    return NextResponse.json({ error: 'Item nicht gefunden oder keine Berechtigung' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
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
