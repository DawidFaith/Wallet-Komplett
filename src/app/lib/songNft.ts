/**
 * Song NFT – Metaplex Token Metadata (mpl-token-metadata v3)
 *
 * Master Edition  → wird beim Shop-Item-Erstellen geminted (Treasury hält es)
 * Print Edition   → wird bei jedem Kauf an den Käufer geminted (nummeriert)
 * Royalty         → 5 % gehen automatisch an den Artist bei jedem Zweitverkauf
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  createV1,
  printV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  keypairIdentity,
  generateSigner,
  percentAmount,
  publicKey as umiPubkey,
  some,
  none,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { getTreasuryKeypair } from './solanaOperator';
import { fetchAndUploadToArweave, uploadToArweave } from './arweaveUpload';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export interface SongMasterEditionResult {
  masterMint: string;
  metadataUri: string;
}

/**
 * Mintet eine Master Edition für einen Song.
 * Lädt Cover + Audio auf Arweave hoch und erstellt das NFT.
 *
 * @param artistSolanaAddress  On-chain Wallet des Artists (für Royalties in creators[])
 * @param maxSupply            Maximale Anzahl Print Editions (z.B. 100)
 */
export async function mintSongMasterEdition(params: {
  artistWallet: string;
  artistSolanaAddress: string;
  title: string;
  description: string;
  coverImageUrl: string;
  audioUrl: string;
  maxSupply: number;
  symbol?: string;
}): Promise<SongMasterEditionResult> {
  const {
    artistWallet,
    artistSolanaAddress,
    title,
    description,
    coverImageUrl,
    audioUrl,
    maxSupply,
    symbol = 'DFAITH',
  } = params;

  // Cover + Audio permanent auf Arweave hochladen
  const [arweaveCover, arweaveAudio] = await Promise.all([
    fetchAndUploadToArweave(coverImageUrl, 'image/jpeg', [{ name: 'Title', value: title }]),
    fetchAndUploadToArweave(audioUrl, 'audio/mpeg', [{ name: 'Title', value: title }]),
  ]);

  // Metadata JSON auf Arweave
  const metadata = {
    name: title,
    symbol,
    description,
    image: arweaveCover,
    animation_url: arweaveAudio,
    properties: {
      category: 'audio',
      files: [
        { uri: arweaveCover, type: 'image/jpeg' },
        { uri: arweaveAudio, type: 'audio/mpeg' },
      ],
      creators: [{ address: artistSolanaAddress, share: 100 }],
    },
    attributes: [
      { trait_type: 'Type', value: 'Music' },
      { trait_type: 'Max Editions', value: String(maxSupply) },
      { trait_type: 'Platform', value: 'D.FAITH' },
    ],
  };
  const metadataUri = await uploadToArweave(
    JSON.stringify(metadata),
    'application/json',
    [{ name: 'Type', value: 'NFT Metadata' }, { name: 'Title', value: title }],
  );

  // Master Edition auf Solana minten
  const treasury = getTreasuryKeypair();
  const umi = createUmi(RPC_URL)
    .use(mplTokenMetadata())
    .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

  const mintSigner = generateSigner(umi);

  await createV1(umi, {
    mint:                 mintSigner,
    authority:            umi.identity,
    updateAuthority:      umi.identity,
    name:                 title.slice(0, 32),
    symbol:               symbol.slice(0, 10),
    uri:                  metadataUri,
    sellerFeeBasisPoints: percentAmount(5),
    creators: some([{
      address:  umiPubkey(artistSolanaAddress),
      verified: false,
      share:    100,
    }]),
    tokenStandard: TokenStandard.NonFungible,
    printSupply:   some({ __kind: 'Limited', fields: [BigInt(maxSupply)] }),
    collection:    none(),
    uses:          none(),
  }).sendAndConfirm(umi);

  return {
    masterMint:  mintSigner.publicKey.toString(),
    metadataUri,
  };
}

export interface PrintEditionResult {
  printMint: string;
  editionNumber: number;
}

/**
 * Mintet eine nummerierte Print Edition an den Käufer.
 * Wird nach jedem erfolgreichen Kauf aufgerufen.
 *
 * @param buyerSolanaAddress  Solana-Adresse des Käufers (Empfänger des NFT)
 * @param editionNumber       Laufende Nummer (1, 2, 3, …)
 */
export async function mintSongPrintEdition(params: {
  masterMint: string;
  buyerSolanaAddress: string;
  editionNumber: number;
}): Promise<PrintEditionResult> {
  const { masterMint, buyerSolanaAddress, editionNumber } = params;

  const treasury = getTreasuryKeypair();
  const umi = createUmi(RPC_URL)
    .use(mplTokenMetadata())
    .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

  const editionMintSigner = generateSigner(umi);

  await printV1(umi, {
    masterEditionMint:         umiPubkey(masterMint),
    editionMint:               editionMintSigner,
    editionTokenAccountOwner:  umiPubkey(buyerSolanaAddress),
    masterTokenAccountOwner:   umi.identity,
    editionNumber:             BigInt(editionNumber),
    tokenStandard:             TokenStandard.NonFungible,
  }).sendAndConfirm(umi);

  return {
    printMint:     editionMintSigner.publicKey.toString(),
    editionNumber,
  };
}
