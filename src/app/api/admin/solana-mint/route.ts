/**
 * POST /api/admin/solana-mint
 * Body: { secret, name, symbol, totalSupply, description?, imageBase64?, imageMimeType?, metadataUri? }
 *
 * Erstellt einen neuen SPL Token auf Solana.
 * - Wenn imageBase64 angegeben: Bild + Metaplex JSON wird auf Pinata IPFS hochgeladen
 * - Wenn metadataUri direkt angegeben: wird direkt verwendet
 * - Metadaten werden via Metaplex Token Metadata Program on-chain gesetzt
 *
 * Nach dem Mint: NEXT_PUBLIC_SOLANA_DFAITH_TOKEN auf die neue Mint-Adresse setzen.
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, sendAndConfirmTransaction, TransactionInstruction,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction, getMinimumBalanceForRentExemptMint,
  MINT_SIZE, TOKEN_PROGRAM_ID, createMintToInstruction,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL  = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DEFAULT_DECIMALS = 6;

// Metaplex Token Metadata Program ID (Mainnet)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

async function uploadToPinata(content: string | Buffer, filename: string, mimeType: string): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT nicht konfiguriert');
  const formData = new FormData();
  const blob = new Blob([content], { type: mimeType });
  formData.append('file', blob, filename);
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Pinata Upload fehlgeschlagen: ${await res.text()}`);
  const data = await res.json();
  return data.IpfsHash as string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { secret, name, symbol, totalSupply, decimals: decimalsRaw, description, imageBase64, imageMimeType, metadataUri: metadataUriDirect } = body as {
      secret?: string; name?: string; symbol?: string; totalSupply?: number; decimals?: number;
      description?: string; imageBase64?: string; imageMimeType?: string; metadataUri?: string;
    };
    const DECIMALS = typeof decimalsRaw === 'number' && decimalsRaw >= 0 && decimalsRaw <= 9
      ? decimalsRaw
      : DEFAULT_DECIMALS;

    if (secret !== process.env.MIGRATION_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!name || !symbol || typeof totalSupply !== 'number' || totalSupply <= 0) {
      return NextResponse.json({ error: 'name, symbol, totalSupply benötigt' }, { status: 400 });
    }

    // ── Schritt 1: Bild + Metadata auf Pinata IPFS hochladen ─────────────────
    let metadataUri = metadataUriDirect ?? '';
    if (imageBase64 && !metadataUri) {
      const mime = imageMimeType ?? 'image/png';
      const ext  = mime.split('/')[1] ?? 'png';
      const imgBuffer  = Buffer.from(imageBase64, 'base64');
      const imageHash  = await uploadToPinata(imgBuffer, `${symbol.toLowerCase()}.${ext}`, mime);

      const metadata = {
        name,
        symbol,
        description: description ?? '',
        image: `ipfs://${imageHash}`,
        properties: { files: [{ uri: `ipfs://${imageHash}`, type: mime }], category: 'image' },
      };
      const metaHash = await uploadToPinata(
        JSON.stringify(metadata), `${symbol.toLowerCase()}-metadata.json`, 'application/json',
      );
      metadataUri = `ipfs://${metaHash}`;
    }

    // ── Schritt 2: SPL Token minten ───────────────────────────────────────────
    const treasury   = getTreasuryKeypair();
    const mintKp     = Keypair.generate();
    const connection = new Connection(RPC_URL, 'confirmed');

    const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);
    const ata = await getAssociatedTokenAddress(
      mintKp.publicKey, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const tx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey:       treasury.publicKey,
        newAccountPubkey: mintKp.publicKey,
        space:            MINT_SIZE,
        lamports:         lamportsForMint,
        programId:        TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(mintKp.publicKey, DECIMALS, treasury.publicKey, treasury.publicKey),
      createAssociatedTokenAccountInstruction(treasury.publicKey, ata, treasury.publicKey, mintKp.publicKey, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
      createMintToInstruction(
        mintKp.publicKey, ata, treasury.publicKey,
        BigInt(Math.round(totalSupply * 10 ** DECIMALS)), // totalSupply ist die rohe Anzahl ohne Dezimalstellen
        // z.B. totalSupply=1_000_000_000, decimals=6 → 1 Billion Token mit 6 Nachkommastellen
        [],
      ),
    );
    const sig1 = await sendAndConfirmTransaction(connection, tx1, [treasury, mintKp]);

    // ── Schritt 3: Metaplex Metadata on-chain setzen ──────────────────────────
    let sig2: string | null = null;
    if (metadataUri) {
      try {
        const metadataPda = getMetadataPDA(mintKp.publicKey);
        const nameBytes   = Buffer.from(name.slice(0, 32),        'utf8');
        const symbolBytes = Buffer.from(symbol.slice(0, 10),      'utf8');
        const uriBytes    = Buffer.from(metadataUri.slice(0, 200), 'utf8');

        const writeU32LE = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
        const writeU16LE = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
        const boolBuf    = (v: boolean) => Buffer.from([v ? 1 : 0]);

        const data = Buffer.concat([
          Buffer.from([33]),              // CreateMetadataAccountV3 discriminator
          writeU32LE(nameBytes.length),   nameBytes,
          writeU32LE(symbolBytes.length), symbolBytes,
          writeU32LE(uriBytes.length),    uriBytes,
          writeU16LE(0),                  // sellerFeeBasisPoints
          boolBuf(false),                 // creators = None
          boolBuf(false),                 // collection = None
          boolBuf(false),                 // uses = None
          boolBuf(true),                  // isMutable
          boolBuf(false),                 // collectionDetails = None
        ]);

        const metaIx = new TransactionInstruction({
          programId: TOKEN_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: metadataPda,             isSigner: false, isWritable: true  },
            { pubkey: mintKp.publicKey,        isSigner: false, isWritable: false },
            { pubkey: treasury.publicKey,      isSigner: true,  isWritable: false },
            { pubkey: treasury.publicKey,      isSigner: true,  isWritable: true  },
            { pubkey: treasury.publicKey,      isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        });

        sig2 = await sendAndConfirmTransaction(connection, new Transaction().add(metaIx), [treasury]);
      } catch (e) {
        console.error('Metadata-Setzen fehlgeschlagen:', e);
      }
    }

    return NextResponse.json({
      success:     true,
      mintAddress: mintKp.publicKey.toBase58(),
      ata:         ata.toBase58(),
      metadataUri: metadataUri || null,
      sig1,
      sig2,
      explorerUrl: `https://solscan.io/token/${mintKp.publicKey.toBase58()}`,
      nextStep:    `NEXT_PUBLIC_SOLANA_DFAITH_TOKEN=${mintKp.publicKey.toBase58()} in .env.local und Vercel setzen`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

