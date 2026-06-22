/**
 * Collectible NFT – Metaplex Core (mpl-core)
 *
 * Collection  → wird beim Erstellen einer Collectible-Kollektion geminted
 * Asset       → wird bei jedem Fuse/Upgrade an den User geminted
 * Royalty     → 5 % an Artist bei Zweitverkauf (RoyaltiesPlugin)
 *
 * mpl-core ist ~10× günstiger als mpl-token-metadata → ideal für Collectibles
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplCore,
  createCollection,
  create,
  ruleSet,
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

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

function getUmi() {
  const treasury = getTreasuryKeypair();
  return createUmi(RPC_URL)
    .use(mplCore())
    .use(keypairIdentity(fromWeb3JsKeypair(treasury)));
}

export interface CollectionNftResult {
  collectionMint: string;
  metadataUri: string;
}

/**
 * Erstellt eine mpl-core Collection für eine Collectible-Kollektion.
 * Wird einmalig beim Anlegen der Kollektion aufgerufen.
 */
export async function mintCollectibleCollection(params: {
  artistWallet: string;
  artistSolanaAddress: string;
  name: string;
  description: string;
  imageUrl: string;
}): Promise<CollectionNftResult> {
  const { artistWallet, artistSolanaAddress, name, description, imageUrl } = params;

  // Bild permanent auf Arweave hochladen
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
      creators: [{ address: artistWallet, share: 100 }],
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

  const umi = getUmi();
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

  return {
    collectionMint: collectionSigner.publicKey.toString(),
    metadataUri,
  };
}

export interface CollectibleAssetResult {
  assetMint: string;
}

const RARITY_LABELS: Record<CollectibleRarity, string> = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
  mythic:    'Mythic',
};

/**
 * Mintet ein einzelnes Collectible-Asset in die Collection.
 * Wird nach jedem Fuse oder Upgrade aufgerufen.
 *
 * @param ownerSolanaAddress  Solana-Adresse des Users (Empfänger des NFT)
 */
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

  // Asset-Metadata erstellen (referenziert Collection-Bild, zeigt Rarity)
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

  const umi = getUmi();
  const assetSigner = generateSigner(umi);

  await create(umi, {
    asset:      assetSigner,
    collection: umiPubkey(collectionMint),
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
    ],
  }).sendAndConfirm(umi);

  return { assetMint: assetSigner.publicKey.toString() };
}
