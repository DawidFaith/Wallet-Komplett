/**
 * POST /api/admin/solana-mint
 * Body: { secret, name, symbol, totalSupply, imageUrl?, metadataUri? }
 *
 * Erstellt einen neuen SPL Token auf Solana.
 * - Treasury ist der Mint Authority und Initial-Holder
 * - Metadaten werden über Metaplex Token Metadata Program gesetzt
 *   (falls PINATA_JWT vorhanden, wird Bild erst zu IPFS hochgeladen)
 *
 * Nach dem Mint: NEXT_PUBLIC_SOLANA_DFAITH_TOKEN auf die neue Mint-Adresse setzen.
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction, getMinimumBalanceForRentExemptMint,
  MINT_SIZE, TOKEN_PROGRAM_ID, createMintToInstruction,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL  = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DECIMALS = 6;

// Metaplex Token Metadata Program ID (Mainnet)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { secret, name, symbol, totalSupply, metadataUri } = body as {
    secret?: string; name?: string; symbol?: string;
    totalSupply?: number; metadataUri?: string;
  };

  if (secret !== process.env.MIGRATION_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!name || !symbol || typeof totalSupply !== 'number' || totalSupply <= 0) {
    return NextResponse.json({ error: 'name, symbol, totalSupply benötigt' }, { status: 400 });
  }

  const treasury   = getTreasuryKeypair();
  const mintKp     = Keypair.generate();
  const connection = new Connection(RPC_URL, 'confirmed');

  const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);

  // ATA für Treasury anlegen
  const ata = await getAssociatedTokenAddress(
    mintKp.publicKey, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Schritt 1: Mint-Account anlegen + initialisieren + ATA + Mint-To
  const tx1 = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey:           treasury.publicKey,
      newAccountPubkey:     mintKp.publicKey,
      space:                MINT_SIZE,
      lamports:             lamportsForMint,
      programId:            TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mintKp.publicKey, DECIMALS, treasury.publicKey, treasury.publicKey),
    createAssociatedTokenAccountInstruction(treasury.publicKey, ata, treasury.publicKey, mintKp.publicKey, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createMintToInstruction(
      mintKp.publicKey, ata, treasury.publicKey,
      BigInt(Math.round(totalSupply * 10 ** DECIMALS)),
      [],
    ),
  );

  const sig1 = await sendAndConfirmTransaction(connection, tx1, [treasury, mintKp]);

  // Schritt 2: Metaplex Metadata setzen (wenn metadataUri vorhanden)
  let sig2: string | null = null;
  if (metadataUri) {
    try {
      const metadataPda = getMetadataPDA(mintKp.publicKey);
      // CreateMetadataAccountV3 Instruction manuell bauen
      // Args: name (max 32), symbol (max 10), uri (max 200), sellerFeeBasisPoints, creators, collection, uses, isMutable, collectionDetails
      const nameBytes   = Buffer.from(name.slice(0, 32), 'utf8');
      const symbolBytes = Buffer.from(symbol.slice(0, 10), 'utf8');
      const uriBytes    = Buffer.from(metadataUri.slice(0, 200), 'utf8');

      // Borsh-Layout für CreateMetadataAccountV3
      // Discriminator: 33 für CreateMetadataAccountV3
      const instrDiscriminator = Buffer.from([33]);
      const writeU32LE = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
      const writeU16LE = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
      const boolBuf    = (v: boolean) => Buffer.from([v ? 1 : 0]);

      const dataLayout = Buffer.concat([
        instrDiscriminator,
        // DataV2
        writeU32LE(nameBytes.length),   nameBytes,
        writeU32LE(symbolBytes.length), symbolBytes,
        writeU32LE(uriBytes.length),    uriBytes,
        writeU16LE(0),                  // sellerFeeBasisPoints
        boolBuf(false),                 // creators Option = None
        boolBuf(false),                 // collection Option = None
        boolBuf(false),                 // uses Option = None
        // isMutable
        boolBuf(true),
        // collectionDetails Option = None
        boolBuf(false),
      ]);

      const { TransactionInstruction } = await import('@solana/web3.js');
      const metaIx = new TransactionInstruction({
        programId: TOKEN_METADATA_PROGRAM_ID,
        keys: [
          { pubkey: metadataPda,         isSigner: false, isWritable: true  },
          { pubkey: mintKp.publicKey,    isSigner: false, isWritable: false },
          { pubkey: treasury.publicKey,  isSigner: true,  isWritable: false }, // mint authority
          { pubkey: treasury.publicKey,  isSigner: true,  isWritable: true  }, // payer
          { pubkey: treasury.publicKey,  isSigner: false, isWritable: false }, // update authority
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: dataLayout,
      });

      const tx2 = new Transaction().add(metaIx);
      sig2 = await sendAndConfirmTransaction(connection, tx2, [treasury]);
    } catch (e) {
      console.error('Metadata-Setzen fehlgeschlagen:', e);
    }
  }

  return NextResponse.json({
    success: true,
    mintAddress: mintKp.publicKey.toBase58(),
    ata: ata.toBase58(),
    sig1,
    sig2,
    explorerUrl: `https://solscan.io/token/${mintKp.publicKey.toBase58()}`,
    nextStep: `NEXT_PUBLIC_SOLANA_DFAITH_TOKEN=${mintKp.publicKey.toBase58()} in .env.local und Vercel setzen`,
  });
}
