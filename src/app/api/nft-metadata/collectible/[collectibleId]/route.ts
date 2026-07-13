/**
 * GET /api/nft-metadata/collectible/[collectibleId] — On-chain-Metadata für
 * einzelne Collectible-Assets (mpl-core). Die on-chain uri jedes Assets zeigt
 * hierauf; das JSON wird live aus user_collectibles + collectible_collections
 * generiert — kein Arweave, keine Gateway-Wartezeit.
 *
 * Bonus-Berechnung identisch mit /api/collectibles/mint-nft (Math.round auf
 * Collection-Maximum × Raritäts-Multiplikator), damit NFT und App-Anzeige
 * übereinstimmen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { buildAssetMetadata } from '../../../../lib/collectibleNft';
import type { CollectibleRarity } from '../../../../lib/questDb/collectibles';
import { RARITY_REP_MULTIPLIER, RARITY_CREDIT_MULTIPLIER } from '../../../../lib/questDb/collectibles';

export const dynamic = 'force-dynamic';

function getActiveSlotsCount(rarity: CollectibleRarity): 1 | 2 | 3 {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const idx = order.indexOf(rarity);
  if (idx >= order.indexOf('mythic')) return 3;
  if (idx >= order.indexOf('epic'))   return 2;
  return 1;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { collectibleId: string } },
) {
  const { collectibleId } = params;
  if (!/^[0-9a-zA-Z-]{1,64}$/.test(collectibleId)) {
    return NextResponse.json({ error: 'Ungültige Collectible-ID' }, { status: 400 });
  }

  const sql  = getDb();
  const rows = await sql`
    SELECT uc.rarity,
           cc.name AS collection_name, cc.image_url, cc.primary_bonus,
           cc.max_rep_bonus_percent, cc.max_credit_bonus_percent, cc.max_shard_chance_bonus,
           p.display_name    AS artist_name,
           sa.solana_address AS artist_solana
    FROM user_collectibles uc
    JOIN collectible_collections cc ON cc.id = uc.collection_id
    LEFT JOIN user_profiles   p  ON LOWER(p.wallet_address)  = cc.artist_wallet
    LEFT JOIN solana_accounts sa ON LOWER(sa.wallet_address) = cc.artist_wallet
    WHERE uc.id = ${collectibleId}
    LIMIT 1
  `;
  if (!rows.length) {
    return NextResponse.json({ error: 'Collectible nicht gefunden' }, { status: 404 });
  }
  const row    = rows[0] as Record<string, unknown>;
  const rarity = row.rarity as CollectibleRarity;

  const metadata = buildAssetMetadata({
    collectionName:      row.collection_name as string,
    collectionImageUri:  (row.image_url as string | null) ?? '',
    artistSolanaAddress: (row.artist_solana as string | null) ?? '',
    artistName:          (row.artist_name as string | null) ?? 'D.FAITH Artist',
    rarity,
    repBonusPercent:     Math.round((Number(row.max_rep_bonus_percent)    || 0) * RARITY_REP_MULTIPLIER[rarity]),
    creditBonusPercent:  Math.round((Number(row.max_credit_bonus_percent) || 0) * RARITY_CREDIT_MULTIPLIER[rarity]),
    shardBonus:          Math.round((Number(row.max_shard_chance_bonus)   || 0) * RARITY_REP_MULTIPLIER[rarity]),
    primaryBonus:        (row.primary_bonus ?? 'rep') as 'rep' | 'credits' | 'shard',
    activeSlots:         getActiveSlotsCount(rarity),
  });

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control':               'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
