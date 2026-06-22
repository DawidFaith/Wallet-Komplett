/**
 * Collectible NFT – Metaplex Core (mpl-core)
 *
 * Collection   → einmalig beim Anlegen der Kollektion geminted
 * Asset        → bei jedem Shard-Fuse an den User geminted
 * BurnDelegate → Treasury kann NFTs verbrennen (Upgrade ohne User-Signatur)
 * Royalties    → 5 % an Artist bei Sekundärmarkt-Verkauf
 *
 * Upgrade-Flow: 10 NFTs der aktuellen Rarität → verbrennen → 1 NFT nächste Rarität
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplCore,
  createCollection,
  create,
  burn,
  ruleSet,
  fetchCollectionV1,
  fetchAssetV1,
} from '@metaplex-foundation/mpl-core';
import {
  keypairIdentity,
  generateSigner,
  publicKey as umiPubkey,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { getTreasuryKeypair } from './solanaOperator';
import { fetchAndUploadToArweave, uploadToArweave } from './arweaveUpload';
import type { CollectibleRarity } from './questDb/collectibles';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const RARITY_LABELS: Record<CollectibleRarity, string> = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
  mythic:    'Mythic',
};

function getUmi() {
  const treasury = getTreasuryKeypair();
  return createUmi(RPC_URL)
    .use(mplCore())
    .use(keypairIdentity(fromWeb3JsKeypair(treasury)));
}

function getTreasuryUmiPubkey() {
  return umiPubkey(getTreasuryKeypair().publicKey.toBase58());
}

// ─── Collection erstellen ─────────────────────────────────────────────────────

export interface CollectionNftResult {
  collectionMint: string;
  metadataUri: string;
}

export async function mintCollectibleCollection(params: {
  artistWallet: string;
  artistSolanaAddress: string;
  name: string;
  description: string;
  imageUrl: string;
}): Promise<CollectionNftResult> {
  const { artistSolanaAddress, name, description, imageUrl } = params;

  const arweaveImage = await fetchAndUploadToArweave(
    imageUrl,
    'image/jpeg',
    [{ name: 'Collection', value: name }],
  );

  const metadata = {
    name,
    description,
    image: arweaveImage,
    properties: {
      category: 'collectible',
      creators: [{ address: artistSolanaAddress, share: 100 }],
    },
    attributes: [
      { trait_type: 'Platform', value: 'D.FAITH' },
      { trait_type: 'Type', value: 'Collectible Collection' },
    ],
  };
  const metadataUri = await uploadToArweave(
    JSON.stringify(metadata),
    'application/json',
    [{ name: 'Type', value: 'Collection Metadata' }, { name: 'Collection', value: name }],
  );

  const umi              = getUmi();
  const collectionSigner = generateSigner(umi);

  await createCollection(umi, {
    collection: collectionSigner,
    name:       name.slice(0, 32),
    uri:        metadataUri,
    plugins: [
      {
        type:        'Royalties',
        basisPoints: 500,
        creators:    [{ address: umiPubkey(artistSolanaAddress), percentage: 100 }],
        ruleSet:     ruleSet('None'),
      },
    ],
  }).sendAndConfirm(umi);

  return { collectionMint: collectionSigner.publicKey.toString(), metadataUri };
}

// ─── Asset minten ─────────────────────────────────────────────────────────────

export interface CollectibleAssetResult {
  assetMint: string;
}

export async function mintCollectibleAsset(params: {
  collectionMint:      string;
  collectionName:      string;
  collectionImageUri:  string;
  ownerSolanaAddress:  string;
  artistSolanaAddress: string;
  rarity:              CollectibleRarity;
}): Promise<CollectibleAssetResult> {
  const {
    collectionMint,
    collectionName,
    collectionImageUri,
    ownerSolanaAddress,
    artistSolanaAddress,
    rarity,
  } = params;

  const metadata = {
    name:        `${collectionName} [${RARITY_LABELS[rarity]}]`,
    description: `${RARITY_LABELS[rarity]} Collectible aus der ${collectionName} Kollektion`,
    image:       collectionImageUri,
    attributes: [
      { trait_type: 'Rarity',   value: RARITY_LABELS[rarity] },
      { trait_type: 'Platform', value: 'D.FAITH' },
    ],
  };
  const metadataUri = await uploadToArweave(
    JSON.stringify(metadata),
    'application/json',
    [{ name: 'Rarity', value: rarity }, { name: 'Collection', value: collectionName }],
  );

  const umi         = getUmi();
  const assetSigner = generateSigner(umi);
  const collection  = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  await create(umi, {
    asset:      assetSigner,
    collection,
    owner:      umiPubkey(ownerSolanaAddress),
    name:       `${collectionName} [${RARITY_LABELS[rarity]}]`.slice(0, 32),
    uri:        metadataUri,
    plugins: [
      {
        type:        'Royalties',
        basisPoints: 500,
        creators:    [{ address: umiPubkey(artistSolanaAddress), percentage: 100 }],
        ruleSet:     ruleSet('None'),
      },
      {
        // Erlaubt dem Treasury, dieses NFT on-chain zu verbrennen (Upgrade ohne User-Signatur)
        type:      'BurnDelegate',
        authority: { type: 'Address', address: getTreasuryUmiPubkey() },
      },
    ],
  }).sendAndConfirm(umi);

  return { assetMint: assetSigner.publicKey.toString() };
}

// ─── NFTs verbrennen (Upgrade) ────────────────────────────────────────────────

/**
 * Verbrennt mehrere Collectible-Assets on-chain.
 * Möglich weil beim Mint ein BurnDelegate auf die Treasury gesetzt wurde.
 * Die NFTs können dabei dem User oder Sekundärmarkt-Käufern gehören.
 */
export async function burnCollectibleAssets(
  assetMints:     string[],
  collectionMint: string,
): Promise<void> {
  if (assetMints.length === 0) return;
  const umi        = getUmi();
  const collection = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  for (const assetMint of assetMints) {
    const asset = await fetchAssetV1(umi, umiPubkey(assetMint));
    await burn(umi, { asset, collection }).sendAndConfirm(umi);
  }
}

// ─── On-chain Scan (Sekundärmarkt-Erkennung) ─────────────────────────────────

interface DasAsset {
  id: string;
  grouping?: { group_key: string; group_value: string }[];
  content?: {
    metadata?: {
      attributes?: { trait_type: string; value: string }[];
    };
  };
}

/**
 * Scannt die Solana-Wallet des Users via DAS API (getAssetsByOwner).
 * Findet Collectibles die auf dem Sekundärmarkt (Magic Eden etc.) gekauft wurden
 * und deshalb nicht in unserer DB stehen.
 *
 * Benötigt einen DAS-fähigen RPC (z.B. Helius, QuickNode).
 * Gibt leeres Array zurück wenn RPC DAS nicht unterstützt.
 */
export async function scanCollectiblesByOwner(
  ownerSolanaAddress: string,
  collectionMint:     string,
  rarity?:            CollectibleRarity,
): Promise<string[]> {
  try {
    const res = await fetch(RPC_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        jsonrpc: '2.0',
        id:      1,
        method:  'getAssetsByOwner',
        params: {
          ownerAddress:   ownerSolanaAddress,
          page:           1,
          limit:          1000,
          displayOptions: { showCollectionMetadata: false },
        },
      }),
    });
    if (!res.ok) return [];

    const data   = await res.json() as { result?: { items?: DasAsset[] } };
    const items  = data.result?.items ?? [];
    const target = rarity ? RARITY_LABELS[rarity].toLowerCase() : null;

    return items
      .filter(a => {
        const inCollection = a.grouping?.some(
          g => g.group_key === 'collection' && g.group_value === collectionMint,
        );
        if (!inCollection) return false;
        if (!target) return true;
        const rarityAttr = a.content?.metadata?.attributes?.find(
          at => at.trait_type === 'Rarity',
        );
        return rarityAttr?.value?.toLowerCase() === target;
      })
      .map(a => a.id);
  } catch {
    return [];
  }
}
