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
  mintV1,
  printV1,
  TokenStandard,
  verifyCreatorV1,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  keypairIdentity,
  generateSigner,
  percentAmount,
  publicKey as umiPubkey,
  some,
  none,
  createSignerFromKeypair,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, getAccount,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getTreasuryKeypair } from './solanaOperator';
import { decryptKey } from './solanaCrypto';
import { fetchAndUploadToArweave, uploadToArweave } from './arweaveUpload';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

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
  artistPrivateKey: string;
  artistName: string;
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
    artistPrivateKey,
    artistName,
    title,
    description,
    coverImageUrl,
    audioUrl,
    maxSupply,
    symbol = 'DFAITH',
  } = params;

  // Cover + Audio von Vercel Blob permanent auf Arweave hochladen
  const [arweaveCover, arweaveAudio] = await Promise.all([
    fetchAndUploadToArweave(coverImageUrl, 'image/jpeg', [{ name: 'Title', value: title }]),
    fetchAndUploadToArweave(audioUrl,      'audio/mpeg', [{ name: 'Title', value: title }]),
  ]);

  // ar:// → https://arweave.net/ damit Solscan + alle Viewer das Bild anzeigen können
  const toHttps = (url: string) => url.startsWith('ar://') ? `https://arweave.net/${url.slice(5)}` : url;
  const coverHttps = toHttps(arweaveCover);
  const audioHttps = toHttps(arweaveAudio);

  // Metadata JSON auf Arweave
  const metadata = {
    name:          title,
    symbol,
    description:   `${description}\n\nLimited to ${maxSupply} numbered editions — each holder receives a unique Print Edition NFT. Tradeable on secondary markets with 5% artist royalties on every resale.`,
    image:         coverHttps,
    animation_url: audioHttps,
    external_url:  'https://app.dawidfaith.de',
    properties: {
      category: 'audio',
      files: [
        { uri: coverHttps, type: 'image/jpeg' },
        { uri: audioHttps, type: 'audio/mpeg' },
      ],
      creators: [{ address: artistSolanaAddress, share: 100 }],
    },
    attributes: [
      { trait_type: 'Type',         value: 'Music' },
      { trait_type: 'Artist',       value: artistName },
      { trait_type: 'Platform',     value: 'D.FAITH' },
      { trait_type: 'Max Editions', value: String(maxSupply) },
      { trait_type: 'Royalties',    value: '5%' },
      { trait_type: 'Release Year', value: String(new Date().getFullYear()) },
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

  // Master Edition Token in die Treasury-ATA minten (Pflicht für spätere printV1-Calls)
  await mintV1(umi, {
    mint:          mintSigner.publicKey,
    tokenOwner:    umi.identity.publicKey,
    amount:        1,
    tokenStandard: TokenStandard.NonFungible,
  }).sendAndConfirm(umi);

  // Creator-Verifikation mit dem Artist-Keypair aus der DB (kein Phantom nötig)
  const artistSecretB58  = decryptKey(artistPrivateKey);
  const artistWeb3Kp     = Keypair.fromSecretKey(bs58.decode(artistSecretB58));
  const artistUmiKp      = umi.eddsa.createKeypairFromSecretKey(artistWeb3Kp.secretKey);
  const artistSigner     = createSignerFromKeypair(umi, artistUmiKp);

  const [metadataPda] = findMetadataPda(umi, { mint: mintSigner.publicKey });
  await verifyCreatorV1(umi, {
    metadata: metadataPda,
    authority: artistSigner,
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

  // Sicherstellen dass das Treasury das Master Edition Token hält (fix für ältere Items)
  const conn = new Connection(RPC_URL, 'confirmed');
  const masterMintPk = new PublicKey(masterMint);
  const treasuryPk   = new PublicKey(treasury.publicKey.toBase58());
  const treasuryAta  = await getAssociatedTokenAddress(masterMintPk, treasuryPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  let masterTokenMissing = false;
  try {
    const ataInfo = await getAccount(conn, treasuryAta);
    if (Number(ataInfo.amount) === 0) masterTokenMissing = true;
  } catch {
    masterTokenMissing = true;
  }
  if (masterTokenMissing) {
    await mintV1(umi, {
      mint:          umiPubkey(masterMint),
      tokenOwner:    umi.identity.publicKey,
      amount:        1,
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(umi);
  }

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
