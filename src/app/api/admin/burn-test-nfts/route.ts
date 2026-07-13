/**
 * POST /api/admin/burn-test-nfts — TEMPORÄR (2026-07-13)
 *
 * Verbrennt die 9 Test-NFTs aus den Mint-Tests vom 13.07.2026, um das
 * Rent-SOL zurückzuholen. Die Liste ist fest einkodiert — der Endpoint kann
 * ausschließlich diese Test-NFTs verbrennen und wird danach wieder entfernt.
 * Rent geht an das Treasury (Token-Owner der Test-NFTs).
 */
import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata, burnV1, TokenStandard, findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, publicKey as umiPubkey } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

// Master Editions zuerst (mit collectionMetadata → Collection-Size wird
// dekrementiert), danach die Collection-NFTs selbst.
const BURN_LIST: Array<{ mint: string; collectionMint?: string }> = [
  { mint: 'A2AwN8XFg71TzSrxCyaez6YMXY5oDMUeZcc1M5RgXeHT', collectionMint: '329vgmbgcASJ9LF6wJGfJ1rbMsZAfh77ghqrhopFab3V' },
  { mint: 'AkyoG4S9ptTKuEzahx36YJNeA6LRX2HnAPp71tmqy4oM', collectionMint: 'Bu8UtdsDZWpZbRmCGMtB4YU2SfrtB8RsMfamr9pjeiRd' },
  { mint: 'CSFisMDwyL5PuPvevxvEXbBSLW1ENyBvXfCUVZuKmq4b', collectionMint: 'DdzQMktWV1UNLbib4kTZzJQodbcRyfkStHwqPnPa78KY' },
  { mint: 'AbmguphUyZQc4BzZwLKibgqsBcbZ5biAkvtGhSadVcRg' }, // Master, Collection unverifiziert
  { mint: '329vgmbgcASJ9LF6wJGfJ1rbMsZAfh77ghqrhopFab3V' },
  { mint: 'Bu8UtdsDZWpZbRmCGMtB4YU2SfrtB8RsMfamr9pjeiRd' },
  { mint: 'DdzQMktWV1UNLbib4kTZzJQodbcRyfkStHwqPnPa78KY' },
  { mint: '2hJYRTjj1ecGUx4GDPuLrq31PFxb2DRGWQWMAqrHZfRE' },
  { mint: '9GGEEXr2JyVUwuXqrzWgiFY7FSxoGppMK81SA5N5wiWw' },
];

export async function POST() {
  const umi = createUmi(RPC_URL, 'confirmed')
    .use(mplTokenMetadata())
    .use(keypairIdentity(fromWeb3JsKeypair(getTreasuryKeypair())));

  const results: Array<{ mint: string; status: string; error?: string }> = [];
  for (const { mint, collectionMint } of BURN_LIST) {
    try {
      await burnV1(umi, {
        mint:          umiPubkey(mint),
        authority:     umi.identity,
        tokenOwner:    umi.identity.publicKey,
        tokenStandard: TokenStandard.NonFungible,
        ...(collectionMint
          ? { collectionMetadata: findMetadataPda(umi, { mint: umiPubkey(collectionMint) })[0] }
          : {}),
      }).sendAndConfirm(umi);
      results.push({ mint, status: 'burned' });
    } catch (e) {
      results.push({ mint, status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ results });
}
