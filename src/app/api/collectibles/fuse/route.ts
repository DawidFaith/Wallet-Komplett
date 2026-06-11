import { NextRequest, NextResponse } from 'next/server';
import { fuseShards, upgradeCollectibles, type CollectibleRarity } from '../../../lib/questDb/collectibles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collectibles/fuse
 * Body: { walletAddress, collectionId }
 * → 10 Shards verschmelzen → 1 Collectible
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; collectionId?: string; action?: 'fuse' | 'upgrade'; fromRarity?: CollectibleRarity };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 }); }

  const { walletAddress, collectionId, action = 'fuse', fromRarity } = body;
  if (!walletAddress || !collectionId) {
    return NextResponse.json({ error: 'walletAddress und collectionId fehlen' }, { status: 400 });
  }

  try {
    if (action === 'upgrade') {
      if (!fromRarity) return NextResponse.json({ error: 'fromRarity fehlt' }, { status: 400 });
      const result = await upgradeCollectibles(walletAddress.toLowerCase(), collectionId, fromRarity);
      return NextResponse.json({ success: true, ...result });
    }

    // Default: fuse (10 Shards → 1 Collectible)
    const result = await fuseShards(walletAddress.toLowerCase(), collectionId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
