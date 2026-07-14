/**
 * GET /api/nft-metadata/[itemId] — On-chain-Metadata für Song-NFTs.
 *
 * Die on-chain uri der Song-NFTs (Collection, Master + alle Print Editions)
 * zeigt hierauf. Das JSON wird live aus shop_items generiert — kein Arweave,
 * keine Gateway-Wartezeit: sofort nach dem Mint vollständig in Phantom,
 * Solscan & DAS-Indexern sichtbar. Cover/Audio sind die Vercel-Blob-URLs.
 *
 * Bewusst OHNE is_active-Filter: Das NFT existiert on-chain weiter, auch wenn
 * das Shop-Item deaktiviert wurde — die Metadata muss erreichbar bleiben.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const { itemId } = params;
  if (!UUID_RE.test(itemId)) {
    return NextResponse.json({ error: 'Ungültige Item-ID' }, { status: 400 });
  }
  // ?variant=collection → Metadata des Collection-NFTs ("Artist — Titel")
  // ?edition=N          → Metadata einer nummerierten Edition ("Titel #N")
  const searchParams  = new URL(req.url).searchParams;
  const isCollection  = searchParams.get('variant') === 'collection';
  const editionParam  = searchParams.get('edition');
  const editionNumber = editionParam && /^\d{1,6}$/.test(editionParam) ? Number(editionParam) : null;

  const sql  = getDb();
  const rows = await sql`
    SELECT si.title, si.description, si.image_url, si.content_url,
           si.nft_max_supply, si.created_at,
           p.display_name AS artist_name,
           sa.solana_address AS artist_solana_address
    FROM shop_items si
    LEFT JOIN user_profiles   p  ON LOWER(p.wallet_address)  = si.artist_wallet
    LEFT JOIN solana_accounts sa ON LOWER(sa.wallet_address) = si.artist_wallet
    WHERE si.id = ${itemId}
    LIMIT 1
  `;
  if (!rows.length) {
    return NextResponse.json({ error: 'Item nicht gefunden' }, { status: 404 });
  }

  const item       = rows[0] as Record<string, unknown>;
  const maxSupply  = Number(item.nft_max_supply) > 0 ? Number(item.nft_max_supply) : 100;
  const artistName = (item.artist_name as string | null) ?? 'D.FAITH Artist';
  const coverUrl   = (item.image_url as string | null) ?? '';
  const audioUrl   = (item.content_url as string | null) ?? '';

  if (isCollection) {
    const collectionMetadata = {
      name:                    `${artistName} — ${item.title as string}`,
      symbol:                  'DFAITH',
      description:             `Official song collection by ${artistName} on D.FAITH. Contains the Master Edition and all numbered Print Editions of "${item.title as string}".`,
      seller_fee_basis_points: 500,
      image:                   coverUrl,
      external_url:            'https://app.dawidfaith.de',
      properties: {
        category: 'image',
        files:    [{ uri: coverUrl, type: 'image/jpeg' }],
        ...(item.artist_solana_address
          ? { creators: [{ address: item.artist_solana_address as string, share: 100 }] }
          : {}),
      },
      attributes: [
        { trait_type: 'Type',     value: 'Song Collection' },
        { trait_type: 'Artist',   value: artistName },
        { trait_type: 'Platform', value: 'D.FAITH' },
        { trait_type: 'Website',  value: 'app.dawidfaith.de' },
      ],
    };
    return NextResponse.json(collectionMetadata, {
      headers: {
        'Cache-Control':               'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const metadata = {
    name:                    editionNumber !== null ? `${item.title as string} #${editionNumber}` : item.title as string,
    symbol:                  'DFAITH',
    description:             `${(item.description as string | null) ?? ''}\n\nLimited to ${maxSupply} numbered editions — each holder receives a unique Edition NFT. Tradeable on secondary markets with 5% artist royalties on every resale.`,
    seller_fee_basis_points: 500,
    image:                   coverUrl,
    animation_url:           audioUrl,
    external_url:            'https://app.dawidfaith.de',
    properties: {
      category: 'audio',
      files: [
        { uri: coverUrl, type: 'image/jpeg' },
        { uri: audioUrl, type: 'audio/mpeg' },
      ],
      ...(item.artist_solana_address
        ? { creators: [{ address: item.artist_solana_address as string, share: 100 }] }
        : {}),
    },
    attributes: [
      { trait_type: 'Type',         value: 'Music' },
      { trait_type: 'Artist',       value: artistName },
      { trait_type: 'Platform',     value: 'D.FAITH' },
      ...(editionNumber !== null ? [{ trait_type: 'Edition', value: String(editionNumber) }] : []),
      { trait_type: 'Max Editions', value: String(maxSupply) },
      { trait_type: 'Royalties',    value: '5%' },
      { trait_type: 'Release Year', value: String(new Date(item.created_at as string).getFullYear()) },
      { trait_type: 'Website',      value: 'app.dawidfaith.de' },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      // Kein Caching: Vercel-Edge würde sonst die erste Indexer-Antwort einfrieren
      // (Race direkt nach dem Mint) und Item-Edits kämen verspätet an
      'Cache-Control':               'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
