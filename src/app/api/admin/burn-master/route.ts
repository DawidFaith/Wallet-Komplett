/**
 * POST /api/admin/burn-master
 * Header: x-admin-secret
 * Body: { masterMint, itemId? }
 *
 * Verbrennt eine Master Edition aus der Treasury-Wallet.
 * Deaktiviert optional das Shop-Item in der DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  burnV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  keypairIdentity,
  publicKey as umiPubkey,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { getDb } from '../../../lib/db';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { masterMint, itemId } = await req.json();
    if (!masterMint) {
      return NextResponse.json({ error: 'masterMint erforderlich' }, { status: 400 });
    }

    const treasury = getTreasuryKeypair();
    const umi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

    await burnV1(umi, {
      mint:          umiPubkey(masterMint),
      authority:     umi.identity,
      tokenOwner:    umi.identity.publicKey,
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(umi);

    if (itemId) {
      const sql = getDb();
      await sql`UPDATE shop_items SET is_active = FALSE WHERE id = ${itemId}`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Burn Master Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
