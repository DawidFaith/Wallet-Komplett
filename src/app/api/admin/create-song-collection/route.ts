/**
 * POST /api/admin/create-song-collection
 * Erstellt einmalig die "D.FAITH Songs" Collection NFT auf Solana.
 * Treasury ist Update-Authority und kann damit alle Song-NFTs als Collection-Mitglieder verifizieren.
 * Speichert die Mint-Adresse in platform_settings (key = 'song_collection_mint').
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { uploadToArweave, waitForArweaveAvailability } from '../../../lib/arweaveUpload';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  createV1,
  mintV1,
  TokenStandard,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  keypairIdentity,
  generateSigner,
  percentAmount,
  some,
  none,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';

export const dynamic     = 'force-dynamic';
export const maxDuration = 120;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.password !== 'admin123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = getDb();

    // Schon vorhanden?
    const existing = await sql`SELECT value FROM platform_settings WHERE key = 'song_collection_mint' LIMIT 1`;
    if (existing.length) {
      return NextResponse.json({ alreadyExists: true, collectionMint: existing[0].value });
    }

    const treasury = getTreasuryKeypair();
    const umi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

    // Collection-Metadata auf Arweave
    const metadata = {
      name:         'D.FAITH Songs',
      symbol:       'DFAITH',
      description:  'Official D.FAITH Music NFT Collection — limited numbered Print Editions by artists on the D.FAITH platform. Each NFT includes an exclusive audio track with on-chain provenance and 5% artist royalties on every resale.',
      image:        'https://app.dawidfaith.de/logo.png',
      external_url: 'https://app.dawidfaith.de',
      attributes: [
        { trait_type: 'Platform', value: 'D.FAITH' },
        { trait_type: 'Type',     value: 'Music Collection' },
        { trait_type: 'Website',  value: 'app.dawidfaith.de' },
      ],
    };
    const metadataUri = await uploadToArweave(
      JSON.stringify(metadata),
      'application/json',
      [{ name: 'Type', value: 'Collection Metadata' }],
    );
    await waitForArweaveAvailability(metadataUri, { expectContentType: 'application/json' });

    const collectionMintSigner = generateSigner(umi);

    // Collection NFT erstellen (collectionDetails markiert es als Collection)
    await createV1(umi, {
      mint:                 collectionMintSigner,
      authority:            umi.identity,
      updateAuthority:      umi.identity,
      name:                 'D.FAITH Songs',
      symbol:               'DFAITH',
      uri:                  metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      creators:             none(),
      tokenStandard:        TokenStandard.NonFungible,
      collection:           none(),
      collectionDetails:    some({ __kind: 'V1', size: 0n }),
      uses:                 none(),
    }).sendAndConfirm(umi);

    // Token in Treasury minten (notwendig damit Collection-NFT existiert)
    await mintV1(umi, {
      mint:          collectionMintSigner.publicKey,
      tokenOwner:    umi.identity.publicKey,
      amount:        1,
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(umi);

    const collectionMint = collectionMintSigner.publicKey.toString();

    // In DB speichern
    await sql`
      INSERT INTO platform_settings (key, value) VALUES ('song_collection_mint', ${collectionMint})
      ON CONFLICT (key) DO UPDATE SET value = ${collectionMint}, updated_at = NOW()
    `;

    return NextResponse.json({ success: true, collectionMint });
  } catch (e) {
    console.error('[create-song-collection]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
