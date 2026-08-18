/**
 * GET  /api/shop?artistWallet=XXX&wallet=USER  – Items eines Artists + Kauf-Status
 * POST /api/shop                               – Neues Item erstellen (Artist)
 * DELETE /api/shop                             – Item löschen (Artist)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { mintSongMasterEdition } from '../../lib/songNft';
import { requireOwnWallet } from '../../lib/apiAuth';
import { checkRateLimit } from '../../lib/rateLimit';

export const dynamic = 'force-dynamic';

// Lazy statt zentraler Migration, damit die Spalten garantiert existieren
// ohne dass erst /api/admin/migrate manuell aufgerufen werden muss.
async function ensureShopItemColumns(sql: ReturnType<typeof getDb>) {
  await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ`;
  // Nur für type='video' genutzt: optionaler MP3-Download zusätzlich zum YouTube-Link.
  await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS audio_download_url TEXT`;
  // Manuelle Reihenfolge im Shop — niedrigster Wert zuerst.
  await sql`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet    = searchParams.get('artistWallet')?.toLowerCase();
  const wallet          = searchParams.get('wallet')?.toLowerCase();
  // Nur für die eigene Shop-Verwaltung (MyShopPanel) — zeigt auch deaktivierte
  // Items, damit sie sich reaktivieren/umbenennen statt nur löschen lassen
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (!artistWallet) {
    return NextResponse.json({ error: 'artistWallet fehlt' }, { status: 400 });
  }

  const sql = getDb();
  await ensureShopItemColumns(sql);

  const items = await sql`
    SELECT si.id, si.artist_wallet, si.title, si.description, si.type,
           si.price_credits, si.price_tokens, si.content_url, si.image_url,
           si.is_active, si.created_at, si.required_level, si.available_until,
           si.nft_max_supply, si.is_nft_enabled, si.master_edition_mint, si.edition_count,
           si.audio_download_url, si.sort_order,
           p.display_name AS artist_name,
           COUNT(sp.id)::int AS sold_count
    FROM shop_items si
    LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = si.artist_wallet
    LEFT JOIN shop_purchases sp ON sp.item_id = si.id
    WHERE si.artist_wallet = ${artistWallet} AND (si.is_active = TRUE OR ${includeInactive})
      AND (${includeInactive} OR si.available_until IS NULL OR si.available_until > NOW())
    GROUP BY si.id, p.display_name
    ORDER BY si.sort_order ASC, si.created_at DESC
  `;

  // Wie viele Exemplare der Nutzer von jedem Item besitzt
  const ownedCounts: Record<string, number> = {};
  if (wallet) {
    const itemIds = (items as Array<Record<string, unknown>>).map(i => String(i.id));
    // Songs/NFTs zählen nur mit erfolgreich geminteter NFT als "besessen";
    // Pre-Release-Videos haben keinen On-Chain-Mint, jeder Kauf zählt direkt.
    const rows = await sql`
      SELECT sp.item_id, COUNT(*)::int AS cnt
      FROM shop_purchases sp
      JOIN shop_items si ON si.id = sp.item_id
      WHERE sp.buyer_wallet = ${wallet} AND sp.item_id = ANY(${itemIds})
        AND (sp.nft_mint_address IS NOT NULL OR si.type = 'video')
      GROUP BY sp.item_id
    `;
    for (const r of rows as Array<Record<string, unknown>>) {
      ownedCounts[String(r.item_id)] = Number(r.cnt);
    }
  }

  return NextResponse.json(
    items.map((item: Record<string, unknown>) => ({
      ...item,
      ownedCount: ownedCounts[String(item.id)] ?? 0,
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
    mintAsNft = false, nftMaxSupply = 100, availableUntil, audioDownloadUrl,
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
    availableUntil?: string | null;
    audioDownloadUrl?: string | null;
  };

  if (!wallet || !title || !type) {
    return NextResponse.json({ error: 'wallet, title, type sind Pflichtfelder' }, { status: 400 });
  }
  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;
  const rl = await checkRateLimit(`shop-create:${authCheck.userId}`, 5, 300);
  if (!rl.ok) return rl.response!;
  if (!['song', 'video', 'nft', 'exclusive'].includes(type)) {
    return NextResponse.json({ error: 'Ungültiger Typ' }, { status: 400 });
  }
  if (typeof priceCredits !== 'number' || priceCredits < 0) {
    return NextResponse.json({ error: 'priceCredits muss >= 0 sein' }, { status: 400 });
  }
  let availableUntilIso: string | null = null;
  if (availableUntil?.trim()) {
    const parsed = new Date(availableUntil);
    if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'Ungültiges "Verfügbar bis"-Datum' }, { status: 400 });
    availableUntilIso = parsed.toISOString();
  }

  const sql = getDb();
  await ensureShopItemColumns(sql);

  // Sicherstellen, dass der Nutzer ein Artist ist + Pflichtfelder für Songs vorab prüfen
  const [profileRows, artistRows, artistNameRows] = await Promise.all([
    sql`SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`,
    sql`SELECT solana_address, solana_private_key FROM solana_accounts WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`,
    sql`SELECT display_name FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`,
  ]);

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

  // nft_max_supply schon beim INSERT setzen: DAS-Indexer holen die Metadata-URL
  // sekundenschnell nach dem Mint — zu dem Zeitpunkt muss der Wert schon in der DB stehen
  const effectiveMaxSupply = typeof nftMaxSupply === 'number' && nftMaxSupply > 0 ? nftMaxSupply : 100;

  // Neues Item ans Ende der manuellen Reihenfolge anhängen
  const maxSortRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM shop_items WHERE artist_wallet = ${wallet.toLowerCase()}
  `;
  const nextSortOrder = Number(maxSortRows[0].max_sort) + 1;

  const rows = await sql`
    INSERT INTO shop_items (artist_wallet, title, description, type, price_credits, price_tokens, content_url, image_url, required_level, nft_max_supply, available_until, audio_download_url, sort_order)
    VALUES (
      ${wallet.toLowerCase()},
      ${title.trim()},
      ${description?.trim() ?? ''},
      ${type},
      ${priceCredits},
      ${typeof priceTokens === 'number' && priceTokens > 0 ? priceTokens : null},
      ${contentUrl?.trim() ?? ''},
      ${imageUrl?.trim() ?? ''},
      ${typeof requiredLevel === 'number' && requiredLevel > 0 ? requiredLevel : 0},
      ${type === 'song' ? effectiveMaxSupply : null},
      ${availableUntilIso},
      ${type === 'video' ? (audioDownloadUrl?.trim() ?? null) : null},
      ${nextSortOrder}
    )
    RETURNING id, title, type, price_credits, price_tokens, is_active, created_at, required_level, available_until, audio_download_url, sort_order
  `;

  const item = rows[0] as { id: string; title: string; type: string; [k: string]: unknown };

  // Songs werden immer als NFT geminted (Master Edition + nummerierte Print Editions)
  if (type === 'song' && contentUrl && imageUrl) {
    try {
      if (artistRows.length && artistRows[0].solana_address) {
        const artistName = artistNameRows[0]?.display_name as string;
        const { masterMint, collectionMint, metadataUri } = await mintSongMasterEdition({
          itemId:              item.id,
          artistWallet:        wallet.toLowerCase(),
          artistSolanaAddress: artistRows[0].solana_address as string,
          artistPrivateKey:    artistRows[0].solana_private_key as string,
          artistName,
          title:               title.trim(),
          description:         description?.trim() ?? '',
          coverImageUrl:       imageUrl.trim(),
          audioUrl:            contentUrl.trim(),
          maxSupply:           effectiveMaxSupply,
        });
        await sql`
          UPDATE shop_items
          SET master_edition_mint = ${masterMint},
              nft_collection_mint = ${collectionMint},
              is_nft_enabled      = TRUE
          WHERE id = ${item.id}
        `;
        return NextResponse.json({
          ...item, masterEditionMint: masterMint, collectionMint, metadataUri, isNftEnabled: true,
        }, { status: 201 });
      }
    } catch (nftErr) {
      const msg = nftErr instanceof Error ? nftErr.message : String(nftErr);
      console.error('Master Edition Mint fehlgeschlagen:', msg);
      // Item aus DB löschen damit kein Eintrag ohne NFT entsteht
      await sql`DELETE FROM shop_items WHERE id = ${item.id}`;
      return NextResponse.json({ error: `NFT-Mint fehlgeschlagen: ${msg}` }, { status: 500 });
    }
  }

  return NextResponse.json(item, { status: 201 });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, itemId, title, description, type, priceCredits, priceTokens, contentUrl, imageUrl, requiredLevel, isActive, nftMaxSupply, availableUntil, audioDownloadUrl } = body as {
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
    isActive?: boolean;
    nftMaxSupply?: number | null;
    availableUntil?: string | null;
    audioDownloadUrl?: string | null;
  };

  if (!wallet || !itemId) {
    return NextResponse.json({ error: 'wallet und itemId erforderlich' }, { status: 400 });
  }
  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;
  if (type !== undefined && !['song', 'video', 'nft', 'exclusive'].includes(type)) {
    return NextResponse.json({ error: 'Ungültiger Typ' }, { status: 400 });
  }
  if (priceCredits !== undefined && (typeof priceCredits !== 'number' || priceCredits < 0)) {
    return NextResponse.json({ error: 'priceCredits muss >= 0 sein' }, { status: 400 });
  }
  if (nftMaxSupply !== undefined && nftMaxSupply !== null && (typeof nftMaxSupply !== 'number' || nftMaxSupply < 1)) {
    return NextResponse.json({ error: 'nftMaxSupply muss >= 1 sein (oder null für unbegrenzt)' }, { status: 400 });
  }
  let availableUntilIso: string | null | undefined = undefined;
  if (availableUntil !== undefined) {
    if (availableUntil === null || availableUntil.trim() === '') {
      availableUntilIso = null;
    } else {
      const parsed = new Date(availableUntil);
      if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'Ungültiges "Verfügbar bis"-Datum' }, { status: 400 });
      availableUntilIso = parsed.toISOString();
    }
  }

  const sql = getDb();
  await ensureShopItemColumns(sql);

  // Nur eigene Items bearbeiten
  const rows = await sql`
    UPDATE shop_items
    SET
      title           = COALESCE(${title?.trim() ?? null}, title),
      description     = COALESCE(${description?.trim() ?? null}, description),
      type            = COALESCE(${type ?? null}, type),
      price_credits   = COALESCE(${priceCredits ?? null}, price_credits),
      price_tokens    = CASE
                          WHEN ${priceTokens !== undefined} THEN ${priceTokens ?? null}
                          ELSE price_tokens
                        END,
      content_url     = COALESCE(${contentUrl?.trim() ?? null}, content_url),
      image_url       = COALESCE(${imageUrl?.trim() ?? null}, image_url),
      required_level  = COALESCE(${requiredLevel ?? null}, required_level),
      is_active       = CASE WHEN ${isActive !== undefined} THEN ${isActive ?? null} ELSE is_active END,
      nft_max_supply     = CASE WHEN ${nftMaxSupply !== undefined} THEN ${nftMaxSupply ?? null} ELSE nft_max_supply END,
      available_until    = CASE WHEN ${availableUntilIso !== undefined} THEN ${availableUntilIso ?? null} ELSE available_until END,
      audio_download_url = CASE WHEN ${audioDownloadUrl !== undefined} THEN ${audioDownloadUrl?.trim() || null} ELSE audio_download_url END
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
  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

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
