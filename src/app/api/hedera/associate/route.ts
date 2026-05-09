/**
 * POST /api/hedera/associate
 * Body: { accountId: "0.0.12345" }
 *
 * Server assoziiert D.FAITH Token mit dem angegebenen Account
 * und schickt 0.5 HBAR Startguthaben.
 *
 * Benötigt: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY, NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID
 *
 * WICHTIG: Der Account muss dem Operator-Key gehören ODER
 *          der Account-Owner muss die Assoziation selbst signieren.
 *          Da wir hier server-managed accounts nutzen, liegt der Key beim Server.
 *          Für externe Wallets (Blade/HashPack) muss der User selbst assoziieren —
 *          dieser Endpoint funktioniert daher nur für server-erstellte Accounts.
 */
import { NextRequest, NextResponse } from 'next/server';

const MIRROR = 'https://mainnet-public.mirrornode.hedera.com/api/v1';

export async function POST(req: NextRequest) {
  const body      = await req.json().catch(() => null);
  const accountId: string | undefined = body?.accountId;

  if (!accountId || !/^\d+\.\d+\.\d+$/.test(accountId)) {
    return NextResponse.json({ error: 'Ungültige accountId' }, { status: 400 });
  }

  const tokenId    = process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID;
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const network    = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';

  if (!tokenId) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID nicht konfiguriert' }, { status: 503 });
  }
  if (!operatorId) {
    return NextResponse.json({ error: 'HEDERA_OPERATOR_ID nicht konfiguriert' }, { status: 503 });
  }

  // Prüfen ob bereits assoziiert (Mirror Node)
  try {
    const check = await fetch(`${MIRROR}/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`);
    if (check.ok) {
      const data = await check.json();
      if (data.tokens?.length > 0) {
        return NextResponse.json({ alreadyAssociated: true });
      }
    }
  } catch {
    // Weitermachen wenn Mirror Node nicht antwortet
  }

  // Hedera SDK (nur Node.js)
  const {
    Client, Hbar,
    TokenAssociateTransaction, TokenId,
    TransferTransaction,
  } = await import('@hashgraph/sdk');
  const { getOperatorKey } = await import('@/app/lib/hederaOperator');

  let client: InstanceType<typeof Client> | null = null;
  try {
    const operatorKey = await getOperatorKey();
    client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    // Token Association — funktioniert nur wenn accountId = operatorId
    // oder der Account-Key beim Server liegt (server-managed accounts)
    const assocTx = await new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([TokenId.fromString(tokenId)])
      .setMaxTransactionFee(new Hbar(2))
      .execute(client);
    await assocTx.getReceipt(client);

    // 0.5 HBAR Startguthaben senden
    await new TransferTransaction()
      .addHbarTransfer(operatorId, new Hbar(-0.5))
      .addHbarTransfer(accountId, new Hbar(0.5))
      .execute(client);

    return NextResponse.json({ alreadyAssociated: false });
  } catch (err) {
    console.error('[hedera/associate]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    }, { status: 500 });
  } finally {
    client?.close();
  }
}
