/**
 * POST /api/admin/hedera-mint
 * Header: x-admin-secret
 * Body: { name, symbol, decimals, initialSupply, memo }
 *
 * Erstellt einen neuen HTS Fungible Token auf Hedera Mainnet.
 * Der Operator ist gleichzeitig Treasury (hält alle Token).
 */
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.MIGRATION_SECRET ?? 'admin123';

export async function POST(req: NextRequest) {
  // Auth
  const headerSecret = req.headers.get('x-admin-secret');
  if (!headerSecret || headerSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { name, symbol, decimals = 2, initialSupply = 1_000_000_000, memo = '' } = body ?? {};

  if (!name || !symbol) {
    return NextResponse.json({ error: 'name und symbol sind Pflichtfelder' }, { status: 400 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const network    = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';

  if (!operatorId) {
    return NextResponse.json({ error: 'HEDERA_OPERATOR_ID nicht konfiguriert' }, { status: 503 });
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

    const tx = await new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setDecimals(decimals)
      .setInitialSupply(initialSupply)
      .setTreasuryAccountId(operatorId)       // Operator = Treasury
      .setAdminKey(operatorKey.publicKey)     // Kann Token verwalten
      .setSupplyKey(operatorKey.publicKey)    // Kann mehr minen
      .setFreezeDefault(false)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTokenMemo(memo)
      .setMaxTransactionFee(new Hbar(30))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const tokenId = receipt.tokenId!.toString();

    const explorerBase = network === 'testnet'
      ? 'https://hashscan.io/testnet/token'
      : 'https://hashscan.io/mainnet/token';

    return NextResponse.json({
      tokenId,
      explorerUrl: `${explorerBase}/${tokenId}`,
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
