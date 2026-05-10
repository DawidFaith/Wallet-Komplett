/**
 * POST /api/admin/solana-update-metadata
 * Body: { secret, mintAddress, name, symbol, description, imageBase64?, imageMimeType?, metadataUri? }
 *
 * Setzt oder aktualisiert die Metaplex-Metadaten eines bestehenden SPL Tokens.
 * Nutzt das offizielle @metaplex-foundation SDK für korrekte Borsh-Serialisierung.
 */
import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, createMetadataAccountV3, updateV1, fetchMetadataFromSeeds } from '@metaplex-foundation/mpl-token-metadata';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { keypairIdentity, publicKey as umiPublicKey, none, some } from '@metaplex-foundation/umi';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

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
    const { secret, mintAddress, name, symbol, description, imageBase64, imageMimeType, metadataUri: metadataUriDirect,
      website, twitter, instagram, youtube, telegram, discord,
    } = body as {
      secret?: string; mintAddress?: string; name?: string; symbol?: string;
      description?: string; imageBase64?: string; imageMimeType?: string; metadataUri?: string;
      website?: string; twitter?: string; instagram?: string; youtube?: string; telegram?: string; discord?: string;
    };

    if (secret !== process.env.MIGRATION_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!mintAddress || !name || !symbol) {
      return NextResponse.json({ error: 'mintAddress, name, symbol benötigt' }, { status: 400 });
    }

    // ── Schritt 1: Bild auf Pinata hochladen (falls vorhanden) ───────────────
    let metadataUri = metadataUriDirect ?? '';
    if (imageBase64 && !metadataUri) {
      const mime = imageMimeType ?? 'image/png';
      const ext  = mime.split('/')[1] ?? 'png';
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const imageHash = await uploadToPinata(imgBuffer, `${symbol.toLowerCase()}.${ext}`, mime);

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

    if (!metadataUri) {
      return NextResponse.json({ error: 'metadataUri oder imageBase64 benötigt' }, { status: 400 });
    }

    // ── Schritt 2: UMI + Metaplex setup ─────────────────────────────────────
    const treasury = getTreasuryKeypair();
    const umi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

    const mint = umiPublicKey(mintAddress);

    const data = {
      name:                 name.slice(0, 32),
      symbol:               symbol.slice(0, 10),
      uri:                  metadataUri.slice(0, 200),
      sellerFeeBasisPoints: 0,
      creators:             none<never>(),
      collection:           none<never>(),
      uses:                 none<never>(),
    };

    // ── Schritt 3: Prüfen ob Metadata-Account bereits existiert ──────────────
    let txSignature: string;
    try {
      // Existiert bereits → updateV1
      await fetchMetadataFromSeeds(umi, { mint });
      const tx = await updateV1(umi, {
        mint,
        data: some(data),
        authorizationData: none(),
      }).sendAndConfirm(umi);
      txSignature = Buffer.from(tx.signature).toString('base64');
    } catch {
      // Existiert nicht → createMetadataAccountV3
      const tx = await createMetadataAccountV3(umi, {
        mint,
        mintAuthority: umi.identity,
        data,
        isMutable: true,
        collectionDetails: none(),
      }).sendAndConfirm(umi);
      txSignature = Buffer.from(tx.signature).toString('base64');
    }

    return NextResponse.json({
      success:     true,
      metadataUri,
      signature:   txSignature,
      explorerUrl: `https://solscan.io/token/${mintAddress}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
