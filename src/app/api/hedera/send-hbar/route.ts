/**
 * POST /api/hedera/send-hbar
 * Body: { accountId: "0.0.12345", toAccountId: "0.0.67890", amountHbar: 1.5 }
 *
 * Sendet HBAR server-seitig. Funktioniert nur für server-managed Accounts
 * (wo der Private Key beim Server liegt). Für externe Wallets (Blade/HashPack)
 * muss der User selbst über die Wallet-App senden.
 *
 * Für den Test-Betrieb: der Operator sendet direkt.
 */
import { NextRequest, NextResponse } from 'next/server';

const HEDERA_ID = /^\d+\.\d+\.\d+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { accountId, toAccountId, amountHbar } = body ?? {};

  if (!accountId || !HEDERA_ID.test(accountId)) {
    return NextResponse.json({ error: 'Ungültige accountId' }, { status: 400 });
  }
  if (!toAccountId || !HEDERA_ID.test(String(toAccountId))) {
    return NextResponse.json({ error: 'Ungültige toAccountId' }, { status: 400 });
  }
  const amount = parseFloat(amountHbar);
  if (!isFinite(amount) || amount <= 0 || amount > 1000) {
    return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const network    = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';

  if (!operatorId) {
    return NextResponse.json({ error: 'HEDERA_OPERATOR_ID nicht konfiguriert' }, { status: 503 });
  }

  const { Client, Hbar, TransferTransaction } = await import('@hashgraph/sdk');
  const { getOperatorKey } = await import('@/app/lib/hederaOperator');

  let client: InstanceType<typeof Client> | null = null;
  try {
    const operatorKey = await getOperatorKey();
    client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    // Sendet von accountId (muss = operatorId sein oder Server hält den Key)
    const tx = await new TransferTransaction()
      .addHbarTransfer(accountId, new Hbar(-amount))
      .addHbarTransfer(toAccountId, new Hbar(amount))
      .setMaxTransactionFee(new Hbar(1))
      .execute(client);

    const receipt = await tx.getReceipt(client);

    return NextResponse.json({
      success: true,
      status: receipt.status.toString(),
      transactionId: tx.transactionId.toString(),
    });
  } catch (err) {
    console.error('[hedera/send-hbar]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Fehler',
    }, { status: 500 });
  } finally {
    client?.close();
  }
}
