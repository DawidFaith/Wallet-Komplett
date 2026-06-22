/**
 * POST /api/admin/solana-mint
 * Body: { secret, name, symbol, totalSupply, decimals?, description?, imageBase64?, imageMimeType?, metadataUri? }
 */
import { NextResponse } from 'next/server';
import {
  Connection, Keypair, SystemProgram,
  Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction, getMinimumBalanceForRentExemptMint,
  MINT_SIZE, TOKEN_PROGRAM_ID, createMintToInstruction,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID, setAuthority, AuthorityType,
} from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, createMetadataAccountV3 } from '@metaplex-foundation/mpl-token-metadata';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { keypairIdentity, publicKey as umiPublicKey, none } from '@metaplex-foundation/umi';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL  = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DEFAULT_DECIMALS = 6;

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
    const { secret, name, symbol, totalSupply, decimals: decimalsRaw, description, imageBase64, imageMimeType, metadataUri: metadataUriDirect,
      website, twitter, instagram, youtube, telegram, discord,
    } = body as {
      secret?: string; name?: string; symbol?: string; totalSupply?: number; decimals?: number;
      description?: string; imageBase64?: string; imageMimeType?: string; metadataUri?: string;
      website?: string; twitter?: string; instagram?: string; youtube?: string; telegram?: string; discord?: string;
      disableMinting?: boolean;
    };
    const disableMinting = body.disableMinting === true;
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

      const extensions: Record<string, string> = {};
      if (website)   extensions.website   = website;
      if (twitter)   extensions.twitter   = twitter;
      if (instagram) extensions.instagram = instagram;
      if (youtube)   extensions.youtube   = youtube;
      if (telegram)  extensions.telegram  = telegram;
      if (discord)   extensions.discord   = discord;

      const metadata: Record<string, unknown> = {
        name,
        symbol,
        description: description ?? '',
        image: `ipfs://${imageHash}`,
        properties: { files: [{ uri: `ipfs://${imageHash}`, type: mime }], category: 'image' },
      };
      if (Object.keys(extensions).length > 0) metadata.extensions = extensions;
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
        BigInt(Math.round(totalSupply * 10 ** DECIMALS)),
        [],
      ),
    );
    const sig1 = await sendAndConfirmTransaction(connection, tx1, [treasury, mintKp]);

    // ── Schritt 2b: Minting permanent deaktivieren (optional) ─────────────────
    let mintingDisabled = false;
    if (disableMinting) {
      await setAuthority(connection, treasury, mintKp.publicKey, treasury, AuthorityType.MintTokens, null);
      mintingDisabled = true;
    }

    let sig2: string | null = null;
    if (metadataUri) {
      try {
        const umi = createUmi(RPC_URL)
          .use(mplTokenMetadata())
          .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

        const tx = await createMetadataAccountV3(umi, {
          mint:          umiPublicKey(mintKp.publicKey.toBase58()),
          mintAuthority: umi.identity,
          data: {
            name:                 name.slice(0, 32),
            symbol:               symbol.slice(0, 10),
            uri:                  metadataUri.slice(0, 200),
            sellerFeeBasisPoints: 0,
            creators:             none(),
            collection:           none(),
            uses:                 none(),
          },
          isMutable:         true,
          collectionDetails: none(),
        }).sendAndConfirm(umi);

        sig2 = Buffer.from(tx.signature).toString('base64');
      } catch (e) {
        console.error('Metadata-Setzen fehlgeschlagen:', e);
      }
    }

    return NextResponse.json({
      success:     true,
      mintAddress: mintKp.publicKey.toBase58(),
      ata:         ata.toBase58(),
      metadataUri: metadataUri || null,
      mintingDisabled,
      sig1,
      sig2,
      explorerUrl: `https://solscan.io/token/${mintKp.publicKey.toBase58()}`,
      nextStep:    `NEXT_PUBLIC_SOLANA_DFAITH_TOKEN=${mintKp.publicKey.toBase58()} in .env.local und Vercel setzen`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
