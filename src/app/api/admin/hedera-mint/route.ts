/**
 * POST /api/admin/hedera-mint
 * Header: x-admin-secret
 * Body: { name, symbol, decimals, initialSupply, memo, imageBase64?, imageMimeType?, description? }
 *
 * Erstellt einen neuen HTS Fungible Token auf Hedera Mainnet.
 * Wenn imageBase64 übergeben wird, wird das Bild + HIP-412 Metadata-JSON auf Pinata IPFS
 * hochgeladen und die IPFS-URI als Token-Metadata gesetzt.
 */
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.MIGRATION_SECRET ?? 'admin123';

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
  // Auth
  const headerSecret = req.headers.get('x-admin-secret');
  if (!headerSecret || headerSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const {
    name, symbol,
    decimals = 2, initialSupply = 1_000_000_000, memo = '',
    description = '',
    imageBase64, imageMimeType = 'image/png',
  } = body ?? {};

  if (!name || !symbol) {
    return NextResponse.json({ error: 'name und symbol sind Pflichtfelder' }, { status: 400 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const network    = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';

  if (!operatorId) {
    return NextResponse.json({ error: 'HEDERA_OPERATOR_ID nicht konfiguriert' }, { status: 503 });
  }

  // ── Bild + Metadata auf IPFS hochladen (optional) ────────────────────────
  let metadataUri = '';
  if (imageBase64) {
    try {
      const ext = imageMimeType.split('/')[1] ?? 'png';
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const imageHash = await uploadToPinata(imgBuffer, `${symbol.toLowerCase()}-token.${ext}`, imageMimeType);

      const metadata = {
        name,
        symbol,
        description,
        image: `ipfs://${imageHash}`,
        type: 'FungibleCommon',
        properties: { decimals, initialSupply },
      };
      const metaHash = await uploadToPinata(
        JSON.stringify(metadata),
        `${symbol.toLowerCase()}-metadata.json`,
        'application/json',
      );
      metadataUri = `ipfs://${metaHash}`;
    } catch (e) {
      console.warn('[hedera-mint] IPFS Upload fehlgeschlagen, Token ohne Bild:', e);
    }
  }

  const {
    Client, Hbar,
    TokenCreateTransaction, TokenType, TokenSupplyType,
  } = await import('@hashgraph/sdk');
  const { getOperatorKey } = await import('@/app/lib/hederaOperator');

  let client: InstanceType<typeof Client> | null = null;
  try {
    const operatorKey = await getOperatorKey();
    client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    const tx = new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setDecimals(decimals)
      .setInitialSupply(initialSupply)
      .setTreasuryAccountId(operatorId)
      .setAdminKey(operatorKey.publicKey)
      .setSupplyKey(operatorKey.publicKey)
      .setFreezeDefault(false)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTokenMemo(memo)
      .setMaxTransactionFee(new Hbar(30));

    if (metadataUri) {
      tx.setMetadata(Buffer.from(metadataUri));
    }

    const result  = await tx.execute(client);
    const receipt = await result.getReceipt(client);
    const tokenId = receipt.tokenId!.toString();

    const explorerBase = network === 'testnet'
      ? 'https://hashscan.io/testnet/token'
      : 'https://hashscan.io/mainnet/token';

    return NextResponse.json({
      tokenId,
      explorerUrl: `${explorerBase}/${tokenId}`,
      metadataUri: metadataUri || null,
    });
  } catch (err) {
    console.error('[admin/hedera-mint]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    }, { status: 500 });
  } finally {
    client?.close();
  }
}
