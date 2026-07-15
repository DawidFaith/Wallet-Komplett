/**
 * POST /api/admin/solana-update-metadata
 * Body: { secret, mintAddress, name, symbol, description, imageBase64?, imageMimeType?, metadataUri? }
 *
 * Setzt oder aktualisiert die Metaplex-Metadaten eines bestehenden SPL Tokens.
 * Nutzt das offizielle @metaplex-foundation SDK für korrekte Borsh-Serialisierung.
 */
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { Connection } from '@solana/web3.js';
import { setAuthority, AuthorityType } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, createMetadataAccountV3, updateV1, fetchMetadataFromSeeds } from '@metaplex-foundation/mpl-token-metadata';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { keypairIdentity, publicKey as umiPublicKey, none, some } from '@metaplex-foundation/umi';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

// Vercel Blob statt IPFS/Pinata — schnell & zuverlässig, kein ipfs://-Auflösungsproblem bei Wallets wie Solflare.
async function uploadToBlob(content: string | Buffer, filename: string, mimeType: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN nicht konfiguriert');
  const blob = await put(`tokens/${filename}`, content, {
    access:      'public',
    contentType: mimeType,
    addRandomSuffix: true,
  });
  return blob.url;
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
      creatorName?: string;
      disableMinting?: boolean; revokeFreezeAuthority?: boolean; makeImmutable?: boolean;
    };
    const creatorName = body.creatorName;
    const disableMinting        = body.disableMinting === true;
    const revokeFreezeAuthority = body.revokeFreezeAuthority === true;
    const makeImmutable         = body.makeImmutable === true;

    if (secret !== process.env.MIGRATION_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!mintAddress) {
      return NextResponse.json({ error: 'mintAddress benötigt' }, { status: 400 });
    }

    // Wenn nur Minting deaktiviert werden soll (ohne Metadata-Update)
    if (disableMinting && !imageBase64 && !metadataUriDirect && !name && !symbol) {
      const connection = new Connection(RPC_URL, 'confirmed');
      const treasury = getTreasuryKeypair();
      await setAuthority(connection, treasury, new PublicKey(mintAddress), treasury, AuthorityType.MintTokens, null);
      return NextResponse.json({ success: true, metadataUri: null, signature: null, mintingDisabled: true, explorerUrl: `https://solscan.io/token/${mintAddress}` });
    }

    // Freeze Authority permanent widerrufen (unwiderruflich — kein Konto kann danach je wieder eingefroren werden)
    if (revokeFreezeAuthority && !imageBase64 && !metadataUriDirect && !name && !symbol) {
      const connection = new Connection(RPC_URL, 'confirmed');
      const treasury = getTreasuryKeypair();
      const sig = await setAuthority(connection, treasury, new PublicKey(mintAddress), treasury, AuthorityType.FreezeAccount, null);
      return NextResponse.json({ success: true, freezeAuthorityRevoked: true, signature: sig, explorerUrl: `https://solscan.io/token/${mintAddress}` });
    }

    // Metadata permanent unveränderlich machen (unwiderruflich — Name/Symbol/Bild/URI danach für immer fix)
    if (makeImmutable && !imageBase64 && !metadataUriDirect && !name && !symbol) {
      const treasury = getTreasuryKeypair();
      const umi = createUmi(RPC_URL).use(mplTokenMetadata()).use(keypairIdentity(fromWeb3JsKeypair(treasury)));
      const tx = await updateV1(umi, {
        mint:              umiPublicKey(mintAddress),
        isMutable:         some(false),
        authorizationData: none(),
      }).sendAndConfirm(umi);
      return NextResponse.json({
        success:               true,
        metadataMadeImmutable: true,
        signature:             Buffer.from(tx.signature).toString('base64'),
        explorerUrl:           `https://solscan.io/token/${mintAddress}`,
      });
    }

    if (!name || !symbol) {
      return NextResponse.json({ error: 'name und symbol benötigt (oder nur disableMinting ohne weitere Felder)' }, { status: 400 });
    }

    // ── Schritt 1: Bild auf Vercel Blob hochladen (falls vorhanden) ───────────
    let metadataUri = metadataUriDirect ?? '';
    if (imageBase64 && !metadataUri) {
      const mime = imageMimeType ?? 'image/png';
      const ext  = mime.split('/')[1] ?? 'png';
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const imageUrl  = await uploadToBlob(imgBuffer, `${symbol.toLowerCase()}-logo.${ext}`, mime);

      const extensions: Record<string, string> = {};
      if (website)   extensions.website   = website;
      if (twitter)   extensions.twitter   = twitter;
      if (instagram) extensions.instagram = instagram;
      if (youtube)   extensions.youtube   = youtube;
      if (telegram)  extensions.telegram  = telegram;
      if (discord)   extensions.discord   = discord;

      const attributes: Array<{ trait_type: string; value: string }> = [];
      if (creatorName) attributes.push({ trait_type: 'Artist',     value: creatorName });
      attributes.push({ trait_type: 'Platform', value: symbol });
      if (website)   attributes.push({ trait_type: 'Website',     value: website });
      if (twitter)   attributes.push({ trait_type: 'Twitter / X', value: twitter });
      if (instagram) attributes.push({ trait_type: 'Instagram',   value: instagram });
      if (youtube)   attributes.push({ trait_type: 'YouTube',     value: youtube });
      if (telegram)  attributes.push({ trait_type: 'Telegram',    value: telegram });
      if (discord)   attributes.push({ trait_type: 'Discord',     value: discord });

      const metadata: Record<string, unknown> = {
        name,
        symbol,
        description: description ?? '',
        image: imageUrl,
        properties: { files: [{ uri: imageUrl, type: mime }], category: 'image' },
        attributes,
      };
      if (Object.keys(extensions).length > 0) metadata.extensions = extensions;
      metadataUri = await uploadToBlob(
        JSON.stringify(metadata), `${symbol.toLowerCase()}-metadata.json`, 'application/json',
      );
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

    // ── Minting permanent deaktivieren (optional) ─────────────────────────────
    let mintingDisabled = false;
    if (disableMinting) {
      const connection = new Connection(RPC_URL, 'confirmed');
      const treasury = getTreasuryKeypair();
      await setAuthority(connection, treasury, new PublicKey(mintAddress), treasury, AuthorityType.MintTokens, null);
      mintingDisabled = true;
    }

    return NextResponse.json({
      success:     true,
      metadataUri,
      signature:   txSignature,
      mintingDisabled,
      explorerUrl: `https://solscan.io/token/${mintAddress}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
