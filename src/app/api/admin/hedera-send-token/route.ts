/**
 * POST /api/admin/hedera-send-token
 * Header: x-admin-secret
 * Body: { toAccountId: "0.0.12345", amount: 100, tokenId?: "0.0.10472138" }
 * Sendet D.FAITH (oder HBAR) vom Treasury (Operator) an einen beliebigen Account.
 */
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.MIGRATION_SECRET ?? 'admin123';
const HEDERA_REGEX = /^\d+\.\d+\.\d+$/;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { toAccountId, amount, tokenId, sendHbar = false } = body ?? {};

  if (!toAccountId || !HEDERA_REGEX.test(String(toAccountId))) {
    return NextResponse.json({ error: 'Ungültige toAccountId' }, { status: 400 });
  }
  const amt = parseFloat(amount);
  if (!isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const dfaithId   = tokenId ?? process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID;
  const network    = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';

  if (!operatorId) return NextResponse.json({ error: 'HEDERA_OPERATOR_ID fehlt' }, { status: 503 });

  const { Client, Hbar, TransferTransaction, TokenId } = await import('@hashgraph/sdk');
  const { getOperatorKey } = await import('@/app/lib/hederaOperator');

  let client: InstanceType<typeof Client> | null = null;
  try {
    const operatorKey = await getOperatorKey();
    client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    const tx = new TransferTransaction().setMaxTransactionFee(new Hbar(2));

    if (sendHbar) {
      tx.addHbarTransfer(operatorId, new Hbar(-amt))
        .addHbarTransfer(toAccountId, new Hbar(amt));
    } else {
      if (!dfaithId) return NextResponse.json({ error: 'NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID fehlt' }, { status: 503 });
      // Betrag in kleinste Einheit (decimals=2)
      const tRes = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/tokens/${dfaithId}`, { cache: 'no-store' });
      const tData = await tRes.json();
      const decimals = parseInt(tData.decimals ?? '2');
      const rawAmt   = Math.round(amt * Math.pow(10, decimals));
      tx.addTokenTransfer(TokenId.fromString(dfaithId), operatorId, -rawAmt)
        .addTokenTransfer(TokenId.fromString(dfaithId), toAccountId, rawAmt);
    }

    const result  = await tx.execute(client);
    const receipt = await result.getReceipt(client);

    return NextResponse.json({
      success: true,
      status: receipt.status.toString(),
      transactionId: result.transactionId.toString(),
    });
  } catch (err) {
    console.error('[admin/hedera-send-token]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 });
  } finally {
    client?.close();
  }
}
