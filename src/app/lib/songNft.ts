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
  verifyCollectionV1,
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
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, getAccount,
  createAssociatedTokenAccountInstruction, createTransferInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getTreasuryKeypair } from './solanaOperator';
import { decryptKey } from './solanaCrypto';
import { fetchAndUploadToArweave, uploadToArweave, waitForArweaveAvailability } from './arweaveUpload';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

// SOL-Mindestguthaben für NFT-Operationen (Rent + Tx-Gebühren, mit Puffer)
const REQUIRED_SOL_SONG_CREATION = 0.05;   // Collection NFT + Master Edition + Verifikationen
const REQUIRED_SOL_PRINT_EDITION = 0.02;   // Print Edition + Collection-Verify

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

export interface SongMasterEditionResult {
  masterMint:     string;
  collectionMint: string;
  metadataUri:    string;
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

  // Warten bis Bild + Audio wirklich vom Gateway ausgeliefert werden bevor Metadata gebaut wird
  await Promise.all([
    waitForArweaveAvailability(arweaveCover, { maxWaitMs: 120_000, expectContentType: 'image' }),
    waitForArweaveAvailability(arweaveAudio, { maxWaitMs: 120_000, expectContentType: 'audio' }),
  ]);

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
      { trait_type: 'Website',      value: 'app.dawidfaith.de' },
    ],
  };
  const rawMetadataUri = await uploadToArweave(
    JSON.stringify(metadata),
    'application/json',
    [{ name: 'Type', value: 'NFT Metadata' }, { name: 'Title', value: title }],
  );
  // ar:// → https://arweave.net/ damit DAS-Indexer, Phantom und alle Tools es direkt auflösen können
  const metadataUri = toHttps(rawMetadataUri);
  await waitForArweaveAvailability(rawMetadataUri, { maxWaitMs: 120_000 });

  // Master Edition auf Solana minten
  // Treasury bleibt Authority (für Heal-Path in printV1), Artist zahlt die Gebühren
  // 'confirmed' statt web3.js-Default 'finalized' → Preflight + Confirm sehen
  // frisch bestätigte Accounts und warten nicht ~30s auf Finalisierung.
  const treasury = getTreasuryKeypair();
  const umi = createUmi(RPC_URL, 'confirmed')
    .use(mplTokenMetadata())
    .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

  const artistSecretB58 = decryptKey(artistPrivateKey);
  const artistWeb3Kp    = Keypair.fromSecretKey(bs58.decode(artistSecretB58));
  const artistUmiKp     = umi.eddsa.createKeypairFromSecretKey(artistWeb3Kp.secretKey);
  const artistSigner    = createSignerFromKeypair(umi, artistUmiKp);
  umi.payer             = artistSigner;

  // SOL-Prüfung temporär deaktiviert (zum Testen)
  const conn = new Connection(RPC_URL, 'confirmed');

  // ── 1. Collection NFT für diesen Song erstellen (Treasury hält es) ──────────
  // Jeder Song bekommt seine eigene Collection NFT. Master + alle Print Editions
  // werden als verifizierte Mitglieder eingetragen → Phantom erkennt sie nicht als Spam.
  // createV1 + mintV1 in einer einzigen Transaktion senden, damit der RPC-Node
  // die frisch erstellten Accounts (Metadata-PDA) beim Mint sofort sieht.
  const collectionMintSigner = generateSigner(umi);
  await createV1(umi, {
    mint:                 collectionMintSigner,
    authority:            umi.identity,
    updateAuthority:      umi.identity,
    name:                 title.slice(0, 32),
    symbol:               symbol.slice(0, 10),
    uri:                  metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    creators:             none(),
    tokenStandard:        TokenStandard.NonFungible,
    printSupply:          some({ __kind: 'Zero' }),
    collection:           none(),
    collectionDetails:    some({ __kind: 'V1', size: 0n }),
    uses:                 none(),
  }).add(mintV1(umi, {
    mint:          collectionMintSigner.publicKey,
    tokenOwner:    umi.identity.publicKey,
    amount:        1,
    tokenStandard: TokenStandard.NonFungible,
  })).sendAndConfirm(umi);

  // ── 2. Master Edition erstellen + Creator/Collection in einer Transaktion verifizieren ──
  // verifyCollectionV1 referenziert die in TX 1 erstellten Collection-Accounts.
  // Die Preflight-Simulation kann auf einem RPC-Node laufen, der TX 1 noch nicht
  // kennt → IncorrectOwner (0x39). Deshalb skipPreflight: der Leader, der die TX
  // ausführt, hat den bestätigten State von TX 1 garantiert.
  const mintSigner = generateSigner(umi);
  const [masterMetadataPda] = findMetadataPda(umi, { mint: mintSigner.publicKey });
  const masterTx = await createV1(umi, {
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
    collection:    some({ key: collectionMintSigner.publicKey, verified: false }),
    uses:          none(),
  }).add(mintV1(umi, {
    mint:          mintSigner.publicKey,
    tokenOwner:    umi.identity.publicKey,
    amount:        1,
    tokenStandard: TokenStandard.NonFungible,
  })).add(verifyCreatorV1(umi, {
    metadata:  masterMetadataPda,
    authority: artistSigner,
  })).add(verifyCollectionV1(umi, {
    metadata:       masterMetadataPda,
    collectionMint: collectionMintSigner.publicKey,
  })).sendAndConfirm(umi, { send: { skipPreflight: true } });

  // Ohne Preflight meldet erst das Confirm-Ergebnis einen On-Chain-Fehler
  if (masterTx.result.value.err) {
    throw new Error(
      `Master Edition TX on-chain fehlgeschlagen: ${JSON.stringify(masterTx.result.value.err)} ` +
      `(Signature: ${bs58.encode(masterTx.signature)})`,
    );
  }

  return {
    masterMint:     mintSigner.publicKey.toString(),
    collectionMint: collectionMintSigner.publicKey.toString(),
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
  masterMint:        string;
  collectionMint:    string;
  buyerSolanaAddress: string;
  artistPrivateKey:  string;
  editionNumber:     number;
}): Promise<PrintEditionResult> {
  const { masterMint, collectionMint, buyerSolanaAddress, artistPrivateKey, editionNumber } = params;

  // Treasury bleibt Authority (masterTokenAccountOwner), Artist zahlt die Gebühren
  const treasury = getTreasuryKeypair();
  const umi = createUmi(RPC_URL, 'confirmed')
    .use(mplTokenMetadata())
    .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

  const artistWeb3Kp = Keypair.fromSecretKey(bs58.decode(decryptKey(artistPrivateKey)));
  const artistUmiKp  = umi.eddsa.createKeypairFromSecretKey(artistWeb3Kp.secretKey);
  umi.payer          = createSignerFromKeypair(umi, artistUmiKp);

  // SOL-Prüfung: Artist muss Print Edition bezahlen können (sonst kein NFT für Käufer)
  const conn = new Connection(RPC_URL, 'confirmed');
  await checkSolBalance(conn, artistWeb3Kp.publicKey, REQUIRED_SOL_PRINT_EDITION, 'Artist');

  const editionMintSigner = generateSigner(umi);

  // Sicherstellen dass das Treasury das Master Edition Token hält (fix für ältere Items)
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

  // Print Edition als verifiziertes Mitglied der Song-Collection eintragen.
  // printV1 kopiert das collection-Feld automatisch vom Master (unverified) →
  // wir müssen nur noch verifizieren. Ohne verif. Collection blendet Phantom als Spam aus.
  // skipPreflight: die Metadata-PDA der Edition stammt aus der printV1-TX davor —
  // die Preflight-Simulation kann auf einem Node laufen, der sie noch nicht kennt.
  if (collectionMint) {
    try {
      const [printMetadataPda] = findMetadataPda(umi, { mint: editionMintSigner.publicKey });
      const verifyTx = await verifyCollectionV1(umi, {
        metadata:       printMetadataPda,
        collectionMint: umiPubkey(collectionMint),
      }).sendAndConfirm(umi, { send: { skipPreflight: true } });
      if (verifyTx.result.value.err) {
        console.warn('[songNft] Collection-Verify für Print Edition on-chain fehlgeschlagen:', JSON.stringify(verifyTx.result.value.err));
      }
    } catch (e) {
      console.warn('[songNft] Collection-Verify für Print Edition fehlgeschlagen:', e);
    }
  }

  return {
    printMint:     editionMintSigner.publicKey.toString(),
    editionNumber,
  };
}

/**
 * Überträgt eine Print Edition (Token Metadata SPL-Token) von einem Wallet zu einem anderen.
 * Wird für Marktplatz-Escrow verwendet (Verkäufer → Treasury oder Treasury → Käufer/Verkäufer).
 *
 * @param ownerKeypair  Aktueller Besitzer der Edition (signiert den Transfer)
 * @param payerKeypair  Zahlt die Tx-Fees (kann der gleiche wie ownerKeypair sein)
 */
export async function transferSongPrintEdition(params: {
  mintAddress:       string;
  ownerKeypair:      Keypair;
  recipientAddress:  string;
  payerKeypair?:     Keypair;
}): Promise<void> {
  const { mintAddress, ownerKeypair, recipientAddress, payerKeypair = ownerKeypair } = params;

  const conn      = new Connection(RPC_URL, 'confirmed');
  const mintPk    = new PublicKey(mintAddress);
  const ownerPk   = ownerKeypair.publicKey;
  const payerPk   = payerKeypair.publicKey;
  const recipPk   = new PublicKey(recipientAddress);

  const sourceAta = await getAssociatedTokenAddress(mintPk, ownerPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const destAta   = await getAssociatedTokenAddress(mintPk, recipPk,  false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const tx = new Transaction();

  // Ziel-ATA anlegen falls noch nicht vorhanden
  const destAtaInfo = await conn.getAccountInfo(destAta);
  if (!destAtaInfo) {
    tx.add(createAssociatedTokenAccountInstruction(
      payerPk, destAta, recipPk, mintPk,
      TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  }

  tx.add(createTransferInstruction(sourceAta, destAta, ownerPk, 1, [], TOKEN_PROGRAM_ID));

  const signers = ownerKeypair === payerKeypair
    ? [ownerKeypair]
    : [payerKeypair, ownerKeypair];

  await sendAndConfirmTransaction(conn, tx, signers, { commitment: 'confirmed' });
}
