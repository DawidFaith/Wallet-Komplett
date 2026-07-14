/**
 * Song NFT – Metaplex Core (mpl-core)
 *
 * Song-Collection → wird beim Shop-Item-Erstellen geminted (Artist ist Authority)
 * Edition-Asset   → wird bei jedem Kauf an den Käufer geminted (Edition-Plugin mit Nummer)
 * Royalty         → 5 % an den Artist bei jedem Zweitverkauf (Royalties-Plugin der Collection)
 *
 * Kosten (Umstellung von Token Metadata auf mpl-core am 13.07.2026):
 *   Song erstellen: ~0,004 SOL statt 0,039 (keine doppelte Metaplex-Fee von 0,01)
 *   Edition-Mint:   ~0,003 SOL statt 0,020
 *
 * Metadata kommt live von /api/nft-metadata/[itemId] (kein Arweave, kein Warten).
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplCore,
  createCollection,
  create,
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
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { decryptKey } from './solanaCrypto';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de').replace(/\/$/, '');

// SOL-Mindestguthaben für NFT-Operationen (Rent + Tx-Gebühren, mit Puffer)
// Gemessen (14.07.2026, mpl-core): Collection 0,0045 / Edition-Asset 0,0050
const REQUIRED_SOL_SONG_CREATION = 0.01;
const REQUIRED_SOL_PRINT_EDITION = 0.008;

async function checkSolBalance(
  connection: Connection,
  publicKey: PublicKey,
  requiredSol: number,
  label: string,
): Promise<void> {
  const balance    = await connection.getBalance(publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  if (balanceSol < requiredSol) {
    throw new Error(
      `Zu wenig SOL im ${label}-Wallet für den NFT-Mint. ` +
      `Benötigt: ${requiredSol} SOL — Verfügbar: ${balanceSol.toFixed(4)} SOL. ` +
      `Bitte mind. ${(requiredSol - balanceSol).toFixed(4)} SOL nachladen.`,
    );
  }
}

function getArtistUmi(artistPrivateKey: string) {
  const artistKp = Keypair.fromSecretKey(bs58.decode(decryptKey(artistPrivateKey)));
  const umi = createUmi(RPC_URL, 'confirmed')
    .use(mplCore())
    .use(keypairIdentity(fromWeb3JsKeypair(artistKp)));
  return { umi, artistKp };
}

export interface SongMasterEditionResult {
  masterMint:     string;
  collectionMint: string;
  metadataUri:    string;
}

/**
 * Erstellt die mpl-core Collection für einen Song ("Artist — Titel").
 * Der Artist ist Authority + Payer; jede verkaufte Edition wird als Asset
 * in diese Collection geminted.
 *
 * masterMint im Result = collectionMint (Kompatibilität mit DB/UI, die den
 * On-Chain-Anker des Songs in master_edition_mint erwarten).
 */
export async function mintSongMasterEdition(params: {
  itemId: string;
  artistWallet: string;
  artistSolanaAddress: string;
  artistPrivateKey: string;
  artistName: string;
  title: string;
  description: string;
  coverImageUrl: string;
  audioUrl: string;
  maxSupply: number;
  symbol?: string;
}): Promise<SongMasterEditionResult> {
  const { itemId, artistSolanaAddress, artistPrivateKey, artistName, title, maxSupply } = params;

  const metadataUri   = `${APP_URL}/api/nft-metadata/${itemId}`;
  const collectionUri = `${metadataUri}?variant=collection`;
  // Collection trägt den Künstlernamen → Herkunft in Phantom/Marktplätzen sofort erkennbar
  const collectionName = `${artistName} — ${title}`.slice(0, 32);

  const { umi, artistKp } = getArtistUmi(artistPrivateKey);

  const conn = new Connection(RPC_URL, 'confirmed');
  await checkSolBalance(conn, artistKp.publicKey, REQUIRED_SOL_SONG_CREATION, 'Artist');

  const collectionSigner = generateSigner(umi);
  await createCollection(umi, {
    collection: collectionSigner,
    name:       collectionName,
    uri:        collectionUri,
    plugins: [
      {
        type:        'Royalties',
        basisPoints: 500,
        creators:    [{ address: umiPubkey(artistSolanaAddress), percentage: 100 }],
        ruleSet:     ruleSet('None'),
      },
      {
        // Numbered-Editions-Kennzeichnung: Wallets/Marktplätze zeigen "Limited Edition x/maxSupply"
        type:      'MasterEdition',
        maxSupply,
        name:      title.slice(0, 32),
        uri:       metadataUri,
      },
      {
        // On-chain Attributes → Artist-Gruppierung in der Wallet funktioniert ohne JSON-Fetch
        type:          'Attributes',
        attributeList: [
          { key: 'Type',        value: 'Music' },
          { key: 'Artist',      value: artistName },
          { key: 'Platform',    value: 'D.FAITH' },
          { key: 'MaxEditions', value: String(maxSupply) },
          { key: 'Website',     value: 'app.dawidfaith.de' },
        ],
      },
    ],
  }).sendAndConfirm(umi);

  const collectionMint = collectionSigner.publicKey.toString();
  return { masterMint: collectionMint, collectionMint, metadataUri };
}

export interface PrintEditionResult {
  printMint: string;
  editionNumber: number;
}

/**
 * Mintet eine nummerierte Edition (mpl-core Asset) an den Käufer.
 * Artist ist Collection-Authority und zahlt die Gebühren (~0,003 SOL).
 */
export async function mintSongPrintEdition(params: {
  itemId:             string;
  collectionMint:     string;
  buyerSolanaAddress: string;
  artistPrivateKey:   string;
  artistName:         string;
  title:              string;
  maxSupply:          number | null;
  editionNumber:      number;
}): Promise<PrintEditionResult> {
  const {
    itemId, collectionMint, buyerSolanaAddress, artistPrivateKey,
    artistName, title, maxSupply, editionNumber,
  } = params;

  const { umi, artistKp } = getArtistUmi(artistPrivateKey);

  const conn = new Connection(RPC_URL, 'confirmed');
  await checkSolBalance(conn, artistKp.publicKey, REQUIRED_SOL_PRINT_EDITION, 'Artist');

  const collection  = await fetchCollectionV1(umi, umiPubkey(collectionMint));
  const assetSigner = generateSigner(umi);

  // "Titel #3" — mpl-core Namen sind auf 32 Zeichen begrenzt
  const suffix    = ` #${editionNumber}`;
  const assetName = `${title.slice(0, 32 - suffix.length)}${suffix}`;

  await create(umi, {
    asset:      assetSigner,
    collection,
    owner:      umiPubkey(buyerSolanaAddress),
    name:       assetName,
    uri:        `${APP_URL}/api/nft-metadata/${itemId}?edition=${editionNumber}`,
    plugins: [
      {
        // Offizielles Edition-Plugin → Wallets zeigen die Editionsnummer nativ an
        type:   'Edition',
        number: editionNumber,
      },
      {
        type:          'Attributes',
        attributeList: [
          { key: 'Type',        value: 'Music' },
          { key: 'Artist',      value: artistName },
          { key: 'Platform',    value: 'D.FAITH' },
          { key: 'Edition',     value: String(editionNumber) },
          ...(maxSupply ? [{ key: 'MaxEditions', value: String(maxSupply) }] : []),
          { key: 'Website',     value: 'app.dawidfaith.de' },
        ],
      },
    ],
  }).sendAndConfirm(umi);

  return {
    printMint: assetSigner.publicKey.toString(),
    editionNumber,
  };
}

/**
 * Überträgt ein Song-Edition-Asset (mpl-core) von einem Wallet zu einem anderen.
 * Wird für Marktplatz-Escrow verwendet (Verkäufer → Treasury oder Treasury → Käufer/Verkäufer).
 * Die Collection wird on-chain vom Asset abgeleitet — Aufrufer brauchen sie nicht zu kennen.
 *
 * @param ownerKeypair  Aktueller Besitzer des Assets (signiert den Transfer)
 * @param payerKeypair  Zahlt die Tx-Fees (kann der gleiche wie ownerKeypair sein)
 */
export async function transferSongPrintEdition(params: {
  mintAddress:       string;
  ownerKeypair:      Keypair;
  recipientAddress:  string;
  payerKeypair?:     Keypair;
}): Promise<void> {
  const { mintAddress, ownerKeypair, recipientAddress, payerKeypair = ownerKeypair } = params;

  const umi = createUmi(RPC_URL, 'confirmed')
    .use(mplCore())
    .use(keypairIdentity(fromWeb3JsKeypair(payerKeypair)));

  const asset = await fetchAssetV1(umi, umiPubkey(mintAddress));

  // Collection aus der Update Authority des Assets ableiten
  const collection = asset.updateAuthority.type === 'Collection' && asset.updateAuthority.address
    ? await fetchCollectionV1(umi, asset.updateAuthority.address)
    : undefined;

  const ownerSigner = ownerKeypair.publicKey.equals(payerKeypair.publicKey)
    ? umi.identity
    : createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(ownerKeypair.secretKey));

  await transfer(umi, {
    asset,
    collection,
    newOwner:  umiPubkey(recipientAddress),
    authority: ownerSigner,
  }).sendAndConfirm(umi);
}
