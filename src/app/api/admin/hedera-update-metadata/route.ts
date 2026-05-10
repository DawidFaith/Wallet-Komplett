/**
 * POST /api/admin/hedera-update-metadata
 * Header: x-admin-secret
 * Body: { tokenId, description?, imageBase64?, imageMimeType? }
 *
 * Lädt ein neues Bild + HIP-412 JSON auf Pinata IPFS und aktualisiert
 * die On-Chain Metadata des Tokens via TokenUpdateTransaction (metadata_key).
 */
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.MIGRATION_SECRET ?? 'admin123';
const HEDERA_REGEX = /^\d+\.\d+\.\d+$/;

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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { tokenId, description = '', imageBase64, imageMimeType = 'image/png' } = body ?? {};

  if (!tokenId || !HEDERA_REGEX.test(String(tokenId))) {
    return NextResponse.json({ error: 'Ungültige tokenId' }, { status: 400 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const network    = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';
  if (!operatorId) return NextResponse.json({ error: 'HEDERA_OPERATOR_ID fehlt' }, { status: 503 });

  try {
    // 1. Token-Info vom Mirror Node holen (Name, Symbol)
    const mirrorBase = network === 'testnet'
      ? 'https://testnet.mirrornode.hedera.com'
      : 'https://mainnet-public.mirrornode.hedera.com';
    const tokenRes  = await fetch(`${mirrorBase}/api/v1/tokens/${tokenId}`, { cache: 'no-store' });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Token nicht gefunden: ${tokenId}`);
    const { name, symbol } = tokenData;

    let metadataUri: string | null = null;

    if (imageBase64) {
      // 2. Bild auf Pinata hochladen
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const ext         = imageMimeType.split('/')[1] ?? 'png';
      const imageCid    = await uploadToPinata(imageBuffer, `${symbol}-image.${ext}`, imageMimeType);
      const imageUri    = `ipfs://${imageCid}`;

      // 3. HIP-412 Metadata JSON erstellen und hochladen
      const metadata = {
        name,
        symbol,
        description: description || `The official ${name} token`,
        image: imageUri,
        type: 'FungibleCommon',
        properties: {
          decimals: parseInt(tokenData.decimals ?? '2'),
        },
      };
      const metaCid  = await uploadToPinata(
        Buffer.from(JSON.stringify(metadata, null, 2)),
        `${symbol}-metadata.json`,
        'application/json',
      );
      metadataUri = `ipfs://${metaCid}`;
    } else {
      // Nur Description-Update ohne Bild — Metadata JSON ohne image
      const existing = tokenData.metadata
        ? (() => { try { return Buffer.from(tokenData.metadata, 'base64').toString(); } catch { return ''; } })()
        : '';
      // Wenn bereits eine IPFS URI existiert, einfach die Description im JSON updaten
      const metadata = {
        name,
        symbol,
        description: description || `The official ${name} token`,
        type: 'FungibleCommon',
        ...(existing.startsWith('ipfs://') ? {} : {}),
      };
      const metaCid = await uploadToPinata(
        Buffer.from(JSON.stringify(metadata, null, 2)),
        `${symbol}-metadata.json`,
        'application/json',
      );
      metadataUri = `ipfs://${metaCid}`;
    }

    // 4. On-Chain Token-Metadata aktualisieren
    const { Client, TokenUpdateTransaction, TokenId } = await import('@hashgraph/sdk');
    const { getOperatorKey } = await import('@/app/lib/hederaOperator');

    const operatorKey = await getOperatorKey();
    const client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    const tx = await new TokenUpdateTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .setMetadata(Buffer.from(metadataUri))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    client.close();

    return NextResponse.json({
      success: true,
      status: receipt.status.toString(),
      tokenId,
      metadataUri,
      explorerUrl: `https://hashscan.io/mainnet/token/${tokenId}`,
    });
  } catch (err) {
    console.error('[admin/hedera-update-metadata]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 });
  }
}
