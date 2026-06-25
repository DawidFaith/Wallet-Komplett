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
  burnCollection,
  ruleSet,
  fetchCollectionV1,
  fetchAssetV1,
} from '@metaplex-foundation/mpl-core';
import {
  keypairIdentity,
  generateSigner,
  publicKey as umiPubkey,
  createSignerFromKeypair,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import { getTreasuryKeypair } from './solanaOperator';
import { fetchAndUploadToArweave, uploadToArweave, waitForArweaveAvailability } from './arweaveUpload';
import type { CollectibleRarity } from './questDb/collectibles';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

const RARITY_LABELS: Record<CollectibleRarity, string> = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
  mythic:    'Mythic',
};

const RARITY_BG_COLOR: Record<CollectibleRarity, string> = {
  common:    '6b7280',
  uncommon:  '16a34a',
  rare:      '2563eb',
  epic:      '9333ea',
  legendary: 'd97706',
  mythic:    'dc2626',
};

const RARITY_DROP_RATE: Record<CollectibleRarity, string> = {
  common:    '48.9%',
  uncommon:  '30.0%',
  rare:      '15.0%',
  epic:       '5.0%',
  legendary:  '1.0%',
  mythic:     '0.1%',
};

function buildBonusLine(
  repBonusPercent:    number,
  creditBonusPercent: number,
  shardBonus:         number,
  primaryBonus:       'rep' | 'credits' | 'shard',
  activeSlots:        1 | 2 | 3,
): string {
  const order: Array<'rep' | 'credits' | 'shard'> = [
    primaryBonus,
    ...(['rep', 'credits', 'shard'] as const).filter(b => b !== primaryBonus),
  ];
  return order.slice(0, activeSlots).map(slot => {
    if (slot === 'rep')     return `+${repBonusPercent}% REP`;
    if (slot === 'credits') return `+${creditBonusPercent}% Credits`;
    return `+${shardBonus} Shard Chance`;
  }).join(' · ');
}

function getUmi(payer: Keypair) {
  return createUmi(RPC_URL)
    .use(mplCore())
    .use(keypairIdentity(fromWeb3JsKeypair(payer)));
}

function getTreasuryUmi() {
  return getUmi(getTreasuryKeypair());
}

function getTreasuryUmiPubkey() {
  return umiPubkey(getTreasuryKeypair().publicKey.toBase58());
}

// ─── Collection erstellen ─────────────────────────────────────────────────────

export interface CollectionNftResult {
  collectionMint: string;
  metadataUri: string;
}

const toHttps = (url: string) =>
  url.startsWith('ar://') ? `https://arweave.net/${url.slice(5)}` : url;

export async function mintCollectibleCollection(params: {
  artistWallet: string;
  artistSolanaAddress: string;
  artistName: string;
  name: string;
  description: string;
  imageUrl: string;
  primaryBonus: 'rep' | 'credits' | 'shard';
  maxRepBonusPercent: number;
  maxCreditBonusPercent: number;
  maxShardChanceBonus: number;
  /** Artist zahlt die Erstellungsgebühren */
  payerKeypair: Keypair;
}): Promise<CollectionNftResult> {
  const {
    artistSolanaAddress, artistName, name, description, imageUrl,
    primaryBonus, maxRepBonusPercent, maxCreditBonusPercent, maxShardChanceBonus,
  } = params;

  // Wenn das Bild bereits auf Arweave liegt, kein erneuter Upload nötig
  const arweaveImage = (imageUrl.startsWith('ar://') || imageUrl.includes('arweave.net'))
    ? toHttps(imageUrl)
    : toHttps(await fetchAndUploadToArweave(imageUrl, 'image/jpeg', [{ name: 'Collection', value: name }]));

  const BONUS_LABELS: Record<'rep' | 'credits' | 'shard', string> = {
    rep: 'REP', credits: 'Credits', shard: 'Shard-Chance',
  };

  const metadata = {
    name,
    description,
    image: arweaveImage,
    external_url: 'https://app.dawidfaith.de',
    properties: {
      category: 'collectible',
      creators: [{ address: artistSolanaAddress, share: 100 }],
    },
    attributes: [
      { trait_type: 'Platform',      value: 'D.FAITH' },
      { trait_type: 'Artist',        value: artistName },
      { trait_type: 'Type',          value: 'Collectible Collection' },
      { trait_type: 'Primary Bonus', value: BONUS_LABELS[primaryBonus] },
      { trait_type: 'Max REP',       value: `${maxRepBonusPercent}%` },
      { trait_type: 'Max Credits',   value: `${maxCreditBonusPercent}%` },
      { trait_type: 'Max Shard',     value: String(maxShardChanceBonus) },
      { trait_type: 'Royalties',     value: '5%' },
      { trait_type: 'Website',       value: 'app.dawidfaith.de' },
    ],
  };
  const metadataUri = await uploadToArweave(
    JSON.stringify(metadata),
    'application/json',
    [{ name: 'Type', value: 'Collection Metadata' }, { name: 'Collection', value: name }],
  );

  // Warten bis die Collection-Metadaten erreichbar sind (siehe mintCollectibleAsset)
  await waitForArweaveAvailability(metadataUri, { expectContentType: 'application/json' });

  const umi              = getUmi(params.payerKeypair);
  const collectionSigner = generateSigner(umi);

  await createCollection(umi, {
    collection: collectionSigner,
    name:       name.slice(0, 32),
    uri:        toHttps(metadataUri),
    plugins: [
      {
        type:        'Royalties',
        basisPoints: 500,
        creators:    [{ address: umiPubkey(artistSolanaAddress), percentage: 100 }],
        ruleSet:     ruleSet('None'),
      },
      {
        type:          'Attributes',
        attributeList: [
          { key: 'Platform',     value: 'D.FAITH' },
          { key: 'Artist',       value: artistName },
          { key: 'PrimaryBonus', value: primaryBonus },
          { key: 'MaxRep',       value: String(maxRepBonusPercent) },
          { key: 'MaxCredits',   value: String(maxCreditBonusPercent) },
          { key: 'MaxShard',     value: String(maxShardChanceBonus) },
          { key: 'Website',      value: 'app.dawidfaith.de' },
        ],
      },
    ],
  }).sendAndConfirm(umi);

  return { collectionMint: collectionSigner.publicKey.toString(), metadataUri };
}

// ─── Collection verbrennen ────────────────────────────────────────────────────

export async function burnCollectibleCollection(
  collectionMint: string,
  payerKeypair: Keypair,
): Promise<void> {
  const umi        = getUmi(payerKeypair);
  const collection = await fetchCollectionV1(umi, umiPubkey(collectionMint));
  await (burnCollection as Function)(umi, { collection }).sendAndConfirm(umi);
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
  artistName:          string;
  rarity:              CollectibleRarity;
  repBonusPercent:     number;
  creditBonusPercent:  number;
  shardBonus:          number;
  primaryBonus:        'rep' | 'credits' | 'shard';
  activeSlots:         1 | 2 | 3;
  /** User zahlt die Mint-Gebühren (~0.002-0.003 SOL) */
  payerKeypair:        Keypair;
}): Promise<CollectibleAssetResult> {
  const {
    collectionMint,
    collectionName,
    collectionImageUri,
    ownerSolanaAddress,
    artistSolanaAddress,
    artistName,
    rarity,
    repBonusPercent,
    creditBonusPercent,
    shardBonus,
    primaryBonus,
    activeSlots,
  } = params;

  const bonusLine = buildBonusLine(repBonusPercent, creditBonusPercent, shardBonus, primaryBonus, activeSlots);

  // Nur die für diese Rarität AKTIVEN Bonus-Slots speichern (primär zuerst),
  // damit Wallet, Solscan und Marktplätze überall dasselbe zeigen.
  const slotOrder: Array<'rep' | 'credits' | 'shard'> = [
    primaryBonus,
    ...(['rep', 'credits', 'shard'] as const).filter(b => b !== primaryBonus),
  ];
  const activeKeys = new Set(slotOrder.slice(0, activeSlots));
  const repActive    = activeKeys.has('rep')     && repBonusPercent > 0;
  const creditActive = activeKeys.has('credits') && creditBonusPercent > 0;
  const shardActive  = activeKeys.has('shard')   && shardBonus > 0;

  const attributes: { trait_type: string; value: string }[] = [
    { trait_type: 'Rarity',     value: RARITY_LABELS[rarity] },
    { trait_type: 'Artist',     value: artistName },
    { trait_type: 'Collection', value: collectionName },
    { trait_type: 'Platform',   value: 'D.FAITH' },
    { trait_type: 'Drop Rate',  value: RARITY_DROP_RATE[rarity] },
  ];
  if (repActive)    attributes.push({ trait_type: 'REP Bonus',    value: `+${repBonusPercent}%` });
  if (creditActive) attributes.push({ trait_type: 'Credit Bonus', value: `+${creditBonusPercent}%` });
  if (shardActive)  attributes.push({ trait_type: 'Shard Bonus',  value: `+${shardBonus}` });
  attributes.push({ trait_type: 'Website', value: 'app.dawidfaith.de' });

  const metadata = {
    name:             `${collectionName} — ${RARITY_LABELS[rarity]}`,
    description:      `${RARITY_LABELS[rarity]} D.FAITH Collectible from the "${collectionName}" series by ${artistName}.\n\nBonuses: ${bonusLine}\n\nTradeable on secondary markets — 5% artist royalties on every resale.`,
    image:            toHttps(collectionImageUri),
    external_url:     'https://app.dawidfaith.de',
    background_color: RARITY_BG_COLOR[rarity],
    attributes,
  };
  const metadataUri = await uploadToArweave(
    JSON.stringify(metadata),
    'application/json',
    [{ name: 'Rarity', value: rarity }, { name: 'Collection', value: collectionName }],
  );

  // Warten bis die Metadaten über das Gateway erreichbar sind, damit Indexer
  // (Helius/Solscan/ORB) sie beim ersten Crawl nach dem Mint korrekt lesen können.
  // Best-effort (max ~30s); Mint läuft auch bei Timeout weiter, da alle Daten
  // redundant im on-chain Attributes-Plugin liegen.
  await waitForArweaveAvailability(metadataUri, { expectContentType: 'application/json' });

  const umi         = getUmi(params.payerKeypair);
  const assetSigner = generateSigner(umi);
  const collection  = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  await create(umi, {
    asset:      assetSigner,
    collection,
    owner:      umiPubkey(ownerSolanaAddress),
    name:       `${collectionName} — ${RARITY_LABELS[rarity]}`.slice(0, 32),
    uri:        toHttps(metadataUri),
    plugins: [
      {
        type:        'Royalties',
        basisPoints: 500,
        creators:    [{ address: umiPubkey(artistSolanaAddress), percentage: 100 }],
        ruleSet:     ruleSet('None'),
      },
      {
        // Alle Collectible-Daten on-chain — kein Arweave-Indexierungswait nötig.
        // Bonus-Keys nur für aktive Slots → Wallet/Solscan/Marktplatz konsistent.
        type:          'Attributes',
        attributeList: [
          { key: 'Rarity',       value: RARITY_LABELS[rarity] },
          { key: 'Collection',   value: collectionName },
          { key: 'Platform',     value: 'D.FAITH' },
          { key: 'Artist',       value: artistName },
          { key: 'Image',        value: toHttps(collectionImageUri) },
          { key: 'DropRate',     value: RARITY_DROP_RATE[rarity] },
          ...(repActive    ? [{ key: 'RepBonus',    value: String(repBonusPercent) }]    : []),
          ...(creditActive ? [{ key: 'CreditBonus', value: String(creditBonusPercent) }] : []),
          ...(shardActive  ? [{ key: 'ShardBonus',  value: String(shardBonus) }]         : []),
          { key: 'PrimaryBonus', value: primaryBonus },
          { key: 'ActiveSlots',  value: String(activeSlots) },
          { key: 'Website',      value: 'app.dawidfaith.de' },
        ],
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
  const umi        = getTreasuryUmi();
  const collection = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  for (const assetMint of assetMints) {
    const asset = await fetchAssetV1(umi, umiPubkey(assetMint));
    await burn(umi, { asset, collection }).sendAndConfirm(umi);
  }
}

// ─── NFT einlösen (burn → DB) ────────────────────────────────────────────────

export interface RedeemResult {
  rarity:         CollectibleRarity;
  collectionMint: string;
  ownerAddress:   string;
}

/**
 * Liest Rarity + Collection vom on-chain Asset, verbrennt es via BurnDelegate.
 * Treasury bleibt Authority; userKeypair wird als Payer gesetzt → Rent-SOL geht an User.
 * fallbackRarity: DB-Wert für alte Assets ohne Attributes-Plugin.
 */
export async function redeemCollectibleAsset(
  assetMint:       string,
  collectionMint:  string,
  userKeypair?:    Keypair,
  fallbackRarity?: CollectibleRarity,
): Promise<RedeemResult> {
  const umi = getTreasuryUmi();

  // Wenn User-Keypair bekannt: User als Payer setzen → Rent-SOL geht an User
  if (userKeypair) {
    umi.payer = createSignerFromKeypair(umi, fromWeb3JsKeypair(userKeypair));
  }

  let asset;
  try {
    asset = await fetchAssetV1(umi, umiPubkey(assetMint));
  } catch {
    // Account leer = bereits verbrannt (z.B. Doppelklick oder DAS-Cache-Lag)
    throw new Error('ASSET_ALREADY_BURNED');
  }
  const collection = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  // Rarity aus on-chain Attributes lesen (neue Assets); fallback für alte Assets ohne Plugin
  const attrList   = (asset as any).attributes?.attributeList as { key: string; value: string }[] | undefined;
  const rarityAttr = attrList?.find((a: { key: string }) => a.key === 'Rarity' || a.key === 'rarity');
  const rarityLabel = rarityAttr?.value?.toLowerCase() ?? fallbackRarity ?? 'common';
  const rarityMap: Record<string, CollectibleRarity> = {
    common: 'common', uncommon: 'uncommon', rare: 'rare',
    epic: 'epic', legendary: 'legendary', mythic: 'mythic',
  };
  const rarity       = rarityMap[rarityLabel] ?? 'common';
  const ownerAddress = asset.owner.toString();

  await burn(umi, { asset, collection }).sendAndConfirm(umi);

  return { rarity, collectionMint, ownerAddress };
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
