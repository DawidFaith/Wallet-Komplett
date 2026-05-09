/**
 * POST /api/hedera/send-hbar
 * Body: { walletAddress: "0x...", toAccountId: "0.0.67890", amountHbar: 1.5 }
 *
 * Sendet HBAR server-seitig mit dem gespeicherten User-Key.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/hederaCrypto';

const EVM_REGEX    = /^0x[0-9a-fA-F]{40}$/;
const HEDERA_REGEX = /^\d+\.\d+\.\d+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { walletAddress, toAccountId, amountHbar } = body ?? {};

  if (!walletAddress || !EVM_REGEX.test(walletAddress)) {
    return NextResponse.json({ error: 'Ungültige walletAddress' }, { status: 400 });
  }
  if (!toAccountId || !HEDERA_REGEX.test(String(toAccountId))) {
    return NextResponse.json({ error: 'Ungültige toAccountId (Format: 0.0.12345)' }, { status: 400 });
  }
  const amount = parseFloat(amountHbar);
  if (!isFinite(amount) || amount <= 0 || amount > 1000) {
    return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
  }

  const sql  = getDb();
  const rows = await sql`
    SELECT hedera_account_id, hedera_private_key FROM hedera_accounts
    WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Kein Hedera Account gefunden' }, { status: 404 });
  }

  const { hedera_account_id: fromId, hedera_private_key: encKey } = rows[0];
  const network = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';
  const operatorId = process.env.HEDERA_OPERATOR_ID!;

  const { Client, PrivateKey, Hbar, TransferTransaction } = await import('@hashgraph/sdk');
  const { getOperatorKey } = await import('@/app/lib/hederaOperator');

  let client: InstanceType<typeof Client> | null = null;
  try {
    const operatorKey = await getOperatorKey();
    client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    const userKey = PrivateKey.fromStringDer(decryptKey(encKey));

    const tx = await new TransferTransaction()
      .addHbarTransfer(fromId, new Hbar(-amount))
      .addHbarTransfer(toAccountId, new Hbar(amount))
      .freezeWith(client)
      .sign(userKey);

    const result  = await tx.execute(client);
    const receipt = await result.getReceipt(client);

    return NextResponse.json({
      success: true,
      status: receipt.status.toString(),
      transactionId: result.transactionId.toString(),
    });
  } catch (err) {
    console.error('[hedera/send-hbar]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 });
  } finally {
    client?.close();
  }
}

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
