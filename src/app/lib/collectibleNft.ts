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
  transfer,
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
    return `+${shardBonus}% Shard Chance`;
  }).join(' · ');
}

function getUmi(payer: Keypair) {
  // 'confirmed' statt web3.js-Default 'finalized' → Preflight/Confirm sehen
  // frisch bestätigte Accounts und warten nicht ~30s auf Finalisierung.
  return createUmi(RPC_URL, 'confirmed')
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

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de').replace(/\/$/, '');

/**
 * Metadata-JSON einer Collectible-Collection — wird von
 * /api/nft-metadata/collection/[collectionId] live aus der DB generiert.
 */
export function buildCollectionMetadata(p: {
  artistSolanaAddress: string;
  artistName: string;
  name: string;
  description: string;
  imageUrl: string;
  primaryBonus: 'rep' | 'credits' | 'shard';
  maxRepBonusPercent: number;
  maxCreditBonusPercent: number;
  maxShardChanceBonus: number;
}) {
  const BONUS_LABELS: Record<'rep' | 'credits' | 'shard', string> = {
    rep: 'REP', credits: 'Credits', shard: 'Shard-Chance',
  };
  const image = toHttps(p.imageUrl);
  return {
    name:                    p.name,
    symbol:                  'DFAITH',
    description:             p.description,
    seller_fee_basis_points: 500,
    image,
    external_url:            'https://app.dawidfaith.de',
    properties: {
      category: 'image',
      files:    [{ uri: image, type: 'image/jpeg' }],
      creators: [{ address: p.artistSolanaAddress, share: 100 }],
    },
    attributes: [
      { trait_type: 'Platform',      value: 'D.FAITH' },
      { trait_type: 'Artist',        value: p.artistName },
      { trait_type: 'Type',          value: 'Collectible Collection' },
      { trait_type: 'Primary Bonus', value: BONUS_LABELS[p.primaryBonus] },
      { trait_type: 'Max REP',       value: `${p.maxRepBonusPercent}%` },
      { trait_type: 'Max Credits',   value: `${p.maxCreditBonusPercent}%` },
      { trait_type: 'Max Shard',     value: `${p.maxShardChanceBonus}%` },
      { trait_type: 'Royalties',     value: '5%' },
      { trait_type: 'Website',       value: 'app.dawidfaith.de' },
    ],
  };
}

export async function mintCollectibleCollection(params: {
  /** collectible_collections.id — Basis der Metadata-URL */
  collectionId: string;
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
    collectionId, artistSolanaAddress, artistName, name,
    primaryBonus, maxRepBonusPercent, maxCreditBonusPercent, maxShardChanceBonus,
  } = params;

  // Metadata wird live von unserer eigenen Domain ausgeliefert — kein Arweave,
  // keine Gateway-Wartezeit, sofort in Phantom/Solscan sichtbar
  const metadataUri = `${APP_URL}/api/nft-metadata/collection/${collectionId}`;

  const umi              = getUmi(params.payerKeypair);
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
  const umi = getUmi(payerKeypair);

  // Prüfen ob Collection noch on-chain existiert
  let collectionAccount;
  try {
    collectionAccount = await fetchCollectionV1(umi, umiPubkey(collectionMint));
    console.log('[burnCollection] fetched OK, currentSize:', collectionAccount.currentSize, 'updateAuthority:', JSON.stringify(collectionAccount.updateAuthority));
  } catch (e) {
    console.log('[burnCollection] fetchCollectionV1 failed (already burned?):', (e as Error).message);
    return;
  }

  try {
    const identityPubkey = umi.identity.publicKey;
    console.log('[burnCollection] calling burnCollection with identity:', identityPubkey, 'collection:', collectionMint);
    await (burnCollection as Function)(umi, {
      collection: umiPubkey(collectionMint),
      authority: umi.identity,
      payer: umi.payer,
      compressionProof: null,
    }).sendAndConfirm(umi);
    console.log('[burnCollection] success!');
  } catch (e) {
    const err = e as Error;
    console.error('[burnCollection] ERROR:', err.message);
    console.error('[burnCollection] STACK:', err.stack);
    throw err;
  }
}

// ─── Asset minten ─────────────────────────────────────────────────────────────

export interface CollectibleAssetResult {
  assetMint: string;
}

/**
 * Metadata-JSON eines Collectible-Assets — wird von
 * /api/nft-metadata/collectible/[collectibleId] live aus der DB generiert.
 */
export function buildAssetMetadata(p: {
  collectionName:      string;
  collectionImageUri:  string;
  artistSolanaAddress: string;
  artistName:          string;
  rarity:              CollectibleRarity;
  repBonusPercent:     number;
  creditBonusPercent:  number;
  shardBonus:          number;
  primaryBonus:        'rep' | 'credits' | 'shard';
  activeSlots:         1 | 2 | 3;
}) {
  const {
    collectionName, collectionImageUri, artistSolanaAddress, artistName,
    rarity, repBonusPercent, creditBonusPercent, shardBonus, primaryBonus, activeSlots,
  } = p;

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
  if (shardActive)  attributes.push({ trait_type: 'Shard Bonus',  value: `+${shardBonus}%` });
  attributes.push({ trait_type: 'Website', value: 'app.dawidfaith.de' });

  const imageHttps = toHttps(collectionImageUri);

  return {
    name:                    `${collectionName} — ${RARITY_LABELS[rarity]}`,
    symbol:                  'DFAITH',
    description:             `${RARITY_LABELS[rarity]} D.FAITH Collectible from the "${collectionName}" series by ${artistName}.\n\nBonuses: ${bonusLine}\n\nTradeable on secondary markets — 5% artist royalties on every resale.`,
    seller_fee_basis_points: 500,
    image:                   imageHttps,
    external_url:            'https://app.dawidfaith.de',
    background_color:        RARITY_BG_COLOR[rarity],
    properties: {
      category: 'image',
      files:    [{ uri: imageHttps, type: 'image/jpeg' }],
      creators: [{ address: artistSolanaAddress, share: 100 }],
    },
    attributes,
  };
}

export async function mintCollectibleAsset(params: {
  /** user_collectibles.id — Basis der Metadata-URL */
  collectibleId:       string;
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
    collectibleId,
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

  // Nur die für diese Rarität AKTIVEN Bonus-Slots on-chain speichern (primär zuerst)
  const slotOrder: Array<'rep' | 'credits' | 'shard'> = [
    primaryBonus,
    ...(['rep', 'credits', 'shard'] as const).filter(b => b !== primaryBonus),
  ];
  const activeKeys = new Set(slotOrder.slice(0, activeSlots));
  const repActive    = activeKeys.has('rep')     && repBonusPercent > 0;
  const creditActive = activeKeys.has('credits') && creditBonusPercent > 0;
  const shardActive  = activeKeys.has('shard')   && shardBonus > 0;

  // Metadata wird live von unserer eigenen Domain ausgeliefert — kein Arweave,
  // keine Gateway-Wartezeit, sofort in Phantom/Solscan sichtbar
  const metadataUri = `${APP_URL}/api/nft-metadata/collectible/${collectibleId}`;

  const umi         = getUmi(params.payerKeypair);
  const assetSigner = generateSigner(umi);
  const collection  = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  await create(umi, {
    asset:      assetSigner,
    collection,
    owner:      umiPubkey(ownerSolanaAddress),
    name:       `${collectionName} — ${RARITY_LABELS[rarity]}`.slice(0, 32),
    uri:        metadataUri,
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

// ─── NFT transferieren (Marktplatz-Kauf) ─────────────────────────────────────

/**
 * Überträgt ein mpl-core Collectible-Asset vom Verkäufer zum Käufer.
 * Der Verkäufer-Keypair muss als Payer/Identity übergeben werden (er muss signieren).
 */
export async function transferCollectibleAsset(
  assetMint:          string,
  collectionMint:     string,
  ownerKeypair:       Keypair,       // NFT-Besitzer (signiert als Transfer-Autorität)
  buyerSolanaAddress: string,
  feePayerKeypair?:   Keypair,       // zahlt Tx-Fees; Standard = ownerKeypair
): Promise<void> {
  // UMI mit dem Fee-Payer initialisieren (context.payer = fee payer)
  const payer = feePayerKeypair ?? ownerKeypair;
  const umi   = getUmi(payer);

  // transferV1 liest umi.identity NICHT – authority muss immer explizit übergeben werden.
  // Ohne explizite authority landet null in der Instruction → mpl-core nutzt payer als
  // Autorität → 0x1a wenn payer !== asset.owner.
  const ownerSigner = createSignerFromKeypair(umi, fromWeb3JsKeypair(ownerKeypair));

  const asset      = await fetchAssetV1(umi, umiPubkey(assetMint));
  const collection = await fetchCollectionV1(umi, umiPubkey(collectionMint));

  await transfer(umi, {
    asset,
    collection,
    newOwner:  umiPubkey(buyerSolanaAddress),
    authority: ownerSigner,   // explizit: mpl-core prüft ob ownerSigner === asset.owner
  }).sendAndConfirm(umi);
}
