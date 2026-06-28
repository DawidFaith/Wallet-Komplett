import { NextRequest, NextResponse } from 'next/server';
import {
  createCollectibleCollection,
  updateCollectibleCollection,
  getCollectionsByArtist,
  getAllActiveCollections,
  getUserShards,
  getAllUserShards,
  getUserCollectibles,
  getUserCollectibleCountsByRarity,
  getCollectiblesRepBonus,
} from '../../lib/questDb/collectibles';
import { mintCollectibleCollection } from '../../lib/collectibleNft';
import { getDb } from '../../lib/db';
import { decryptKey } from '../../lib/solanaCrypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collectibles
 * ?wallet=       → eigene Shards + Collectibles
 * ?artistWallet= → Kollektionen eines Künstlers
 * ?all=1         → alle aktiven Kollektionen (für Übersichtsseite)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet       = searchParams.get('wallet');
  const artistWallet = searchParams.get('artistWallet');
  const all          = searchParams.get('all');

  try {
    if (all === '1') {
      const collections = await getAllActiveCollections();
      return NextResponse.json({ collections });
    }

    if (artistWallet) {
      const collections = await getCollectionsByArtist(artistWallet);
      const result = await Promise.all(
        collections.map(async (col) => {
          const counts = wallet
            ? await getUserCollectibleCountsByRarity(wallet.toLowerCase(), col.id)
            : {};
          const shards = wallet
            ? await getUserShards(wallet.toLowerCase(), artistWallet.toLowerCase())
            : 0;
          return {
            collection: { ...col, nftCollectionMint: (col as any).nftCollectionMint ?? null },
            ownedByRarity: counts,
            shards,
          };
        }),
      );
      return NextResponse.json({ data: result });
    }

    if (wallet) {
      const [shards, collectibles] = await Promise.all([
        getAllUserShards(wallet.toLowerCase()),
        getUserCollectibles(wallet.toLowerCase()),
      ]);
      // Rep-Bonus pro Artist aggregieren (nach collectibles geladen)
      const artistWallets = [...new Set(collectibles.map((c) => c.artistWallet).filter(Boolean) as string[])];
      const bonuses: Record<string, number> = {};
      await Promise.all(
        artistWallets.map(async (aw) => {
          bonuses[aw] = await getCollectiblesRepBonus(wallet.toLowerCase(), aw);
        }),
      );
      return NextResponse.json({ shards, collectibles, repBonuses: bonuses });
    }

    return NextResponse.json({ error: 'wallet oder artistWallet fehlt' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST /api/collectibles
 * Body: { artistWallet, name, description, imageUrl, chanceCommon, ... }
 * → Neue Kollektion anlegen (nur Artist)
 */
export async function POST(req: NextRequest) {
  let body: {
    artistWallet?: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    chanceCommon?: number;
    chanceUncommon?: number;
    chanceRare?: number;
    chanceEpic?: number;
    chanceLegendary?: number;
    chanceMythic?: number;
    maxRepBonusPercent?: number;
    maxShardChanceBonus?: number;
    maxCreditBonusPercent?: number;
    primaryBonus?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 }); }

  const { artistWallet, name } = body;
  if (!artistWallet || !name?.trim()) {
    return NextResponse.json({ error: 'artistWallet und name sind erforderlich' }, { status: 400 });
  }

  // Wahrscheinlichkeiten validieren (Summe muss 100 ergeben)
  const chances = {
    chanceCommon:    body.chanceCommon    ?? 50,
    chanceUncommon:  body.chanceUncommon  ?? 25,
    chanceRare:      body.chanceRare      ?? 15,
    chanceEpic:      body.chanceEpic      ?? 7,
    chanceLegendary: body.chanceLegendary ?? 2,
    chanceMythic:    body.chanceMythic    ?? 1,
  };
  const total = Object.values(chances).reduce((s, v) => s + v, 0);
  if (total !== 100) {
    return NextResponse.json({ error: `Wahrscheinlichkeiten müssen zusammen 100 ergeben (aktuell: ${total})` }, { status: 400 });
  }

  // Blob-URL direkt speichern — Arweave-Upload passiert erst beim NFT-Minten
  // (mintCollectibleCollection lädt das Bild selbst auf Arweave hoch)
  const finalImageUrl = body.imageUrl ?? '';

  try {
    const sql = getDb();

    // Artist-Keypair für on-chain Zahlung laden
    const artistSolRows = await sql`
      SELECT sa.solana_address, sa.solana_private_key, p.display_name AS artist_name
      FROM solana_accounts sa
      LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = LOWER(sa.wallet_address)
      WHERE LOWER(sa.wallet_address) = ${artistWallet.toLowerCase()} LIMIT 1
    `;
    if (!artistSolRows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet für diesen Künstler gefunden' }, { status: 400 });
    }
    const { solana_address: artistSolana, solana_private_key: encKey, artist_name: artistDisplayName } = artistSolRows[0];
    const artistKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(encKey as string)));

    const artistDisplayNameStr = (artistDisplayName as string | null)?.trim() || artistWallet;
    // Fallback-Beschreibung — identisch mit dem Text der auf jedes einzelne NFT geminted wird
    const description = (body.description ?? '').trim()
      || `D.FAITH Collectible from the "${name.trim()}" series by ${artistDisplayNameStr}. Tradeable on secondary markets — 5% artist royalties on every resale.`;

    // DB-Eintrag anlegen
    const result = await createCollectibleCollection({
      artistWallet,
      name: name.trim(),
      description,
      imageUrl: finalImageUrl,
      ...chances,
      maxRepBonusPercent: body.maxRepBonusPercent ?? 0,
      maxShardChanceBonus: body.maxShardChanceBonus ?? 0,
      maxCreditBonusPercent: body.maxCreditBonusPercent ?? 0,
      primaryBonus: (['rep', 'credits', 'shard'].includes(body.primaryBonus ?? '') ? body.primaryBonus : 'rep') as 'rep' | 'credits' | 'shard',
    });

    // mpl-core Collection on-chain minten (Artist zahlt)
    const primaryBonus = (['rep', 'credits', 'shard'].includes(body.primaryBonus ?? '') ? body.primaryBonus : 'rep') as 'rep' | 'credits' | 'shard';
    const nftResult = await mintCollectibleCollection({
      artistWallet,
      artistSolanaAddress: artistSolana as string,
      artistName:          artistDisplayNameStr,
      name:                name.trim(),
      description,
      imageUrl:             finalImageUrl,
      primaryBonus,
      maxRepBonusPercent:   body.maxRepBonusPercent   ?? 0,
      maxCreditBonusPercent: body.maxCreditBonusPercent ?? 0,
      maxShardChanceBonus:  body.maxShardChanceBonus  ?? 0,
      payerKeypair:         artistKeypair,
    });
    await sql`UPDATE collectible_collections SET nft_collection_mint = ${nftResult.collectionMint} WHERE id = ${result.id}`;

    return NextResponse.json({ id: result.id, nftCollectionMint: nftResult.collectionMint });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * PATCH /api/collectibles
 * Body: { id, artistWallet, name?, description?, imageUrl?, chanceCommon?, ... }
 * → Kollektion bearbeiten (nur der Besitzer)
 */
export async function PATCH(req: NextRequest) {
  let body: {
    id?: string;
    artistWallet?: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    chanceCommon?: number;
    chanceUncommon?: number;
    chanceRare?: number;
    chanceEpic?: number;
    chanceLegendary?: number;
    chanceMythic?: number;
    maxRepBonusPercent?: number;
    maxShardChanceBonus?: number;
    maxCreditBonusPercent?: number;
    primaryBonus?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 }); }

  const { id, artistWallet } = body;
  if (!id?.trim() || !artistWallet?.trim()) {
    return NextResponse.json({ error: 'id und artistWallet sind erforderlich' }, { status: 400 });
  }

  // Wenn Chancen geändert werden, Summe prüfen
  const hasChances = [body.chanceCommon, body.chanceUncommon, body.chanceRare, body.chanceEpic, body.chanceLegendary, body.chanceMythic].some(v => v !== undefined);
  if (hasChances) {
    const total = (body.chanceCommon ?? 0) + (body.chanceUncommon ?? 0) + (body.chanceRare ?? 0)
      + (body.chanceEpic ?? 0) + (body.chanceLegendary ?? 0) + (body.chanceMythic ?? 0);
    if (total !== 100) {
      return NextResponse.json({ error: `Wahrscheinlichkeiten müssen 100 ergeben (aktuell: ${total})` }, { status: 400 });
    }
  }

  // Blob-URL direkt speichern (kein Arweave-Upload hier nötig)
  const patchImageUrl = body.imageUrl;

  try {
    const updated = await updateCollectibleCollection(id.trim(), artistWallet.trim(), {
      name:                  body.name,
      description:           body.description,
      imageUrl:              patchImageUrl,
      chanceCommon:          body.chanceCommon,
      chanceUncommon:        body.chanceUncommon,
      chanceRare:            body.chanceRare,
      chanceEpic:            body.chanceEpic,
      chanceLegendary:       body.chanceLegendary,
      chanceMythic:          body.chanceMythic,
      maxRepBonusPercent:    body.maxRepBonusPercent,
      maxShardChanceBonus:   body.maxShardChanceBonus,
      maxCreditBonusPercent: body.maxCreditBonusPercent,
      primaryBonus:          (['rep', 'credits', 'shard'].includes(body.primaryBonus ?? '') ? body.primaryBonus as 'rep' | 'credits' | 'shard' : undefined),
    });
    if (!updated) return NextResponse.json({ error: 'Kollektion nicht gefunden oder keine Berechtigung' }, { status: 403 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
