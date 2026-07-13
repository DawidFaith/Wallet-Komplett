/**
 * GET /api/nft-metadata/collection/[collectionId] — On-chain-Metadata für
 * Collectible-Collections (mpl-core). Die on-chain uri der Collection zeigt
 * hierauf; das JSON wird live aus collectible_collections generiert — kein
 * Arweave, keine Gateway-Wartezeit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { buildCollectionMetadata } from '../../../../lib/collectibleNft';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { collectionId: string } },
) {
  const { collectionId } = params;
  if (!/^[0-9a-zA-Z-]{1,64}$/.test(collectionId)) {
    return NextResponse.json({ error: 'Ungültige Collection-ID' }, { status: 400 });
  }

  const sql  = getDb();
  const rows = await sql`
    SELECT cc.name, cc.description, cc.image_url, cc.primary_bonus,
           cc.max_rep_bonus_percent, cc.max_credit_bonus_percent, cc.max_shard_chance_bonus,
           p.display_name    AS artist_name,
           sa.solana_address AS artist_solana
    FROM collectible_collections cc
    LEFT JOIN user_profiles   p  ON LOWER(p.wallet_address)  = cc.artist_wallet
    LEFT JOIN solana_accounts sa ON LOWER(sa.wallet_address) = cc.artist_wallet
    WHERE cc.id = ${collectionId}
    LIMIT 1
  `;
  if (!rows.length) {
    return NextResponse.json({ error: 'Kollektion nicht gefunden' }, { status: 404 });
  }
  const coll = rows[0] as Record<string, unknown>;

  const metadata = buildCollectionMetadata({
    artistSolanaAddress:   (coll.artist_solana as string | null) ?? '',
    artistName:            (coll.artist_name as string | null) ?? 'D.FAITH Artist',
    name:                  coll.name as string,
    description:           (coll.description as string | null) ?? '',
    imageUrl:              (coll.image_url as string | null) ?? '',
    primaryBonus:          (coll.primary_bonus ?? 'rep') as 'rep' | 'credits' | 'shard',
    maxRepBonusPercent:    Number(coll.max_rep_bonus_percent)    || 0,
    maxCreditBonusPercent: Number(coll.max_credit_bonus_percent) || 0,
    maxShardChanceBonus:   Number(coll.max_shard_chance_bonus)   || 0,
  });

  return NextResponse.json(metadata, {
    headers: {
      // Kein Caching: Vercel-Edge würde sonst veraltete Antworten einfrieren
      'Cache-Control':               'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
