/**
 * GET  /api/hedera/create-account?walletAddress=0x...
 *   → Gibt bestehenden Hedera Account zurück (oder null)
 *
 * POST /api/hedera/create-account  { walletAddress: "0x..." }
 *   → Erstellt neuen Hedera Account server-seitig, speichert in DB,
 *     assoziiert D.FAITH Token und sendet 0.5 HBAR Startguthaben.
 *     Idempotent: gibt bestehenden Account zurück wenn schon vorhanden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { encryptKey } from '@/app/lib/hederaCrypto';

const EVM_REGEX = /^0x[0-9a-fA-F]{40}$/;

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get('walletAddress');
  if (!walletAddress || !EVM_REGEX.test(walletAddress)) {
    return NextResponse.json({ error: 'Ungültige walletAddress' }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT hedera_account_id FROM hedera_accounts
    WHERE wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  return NextResponse.json({ hederaAccountId: rows[0]?.hedera_account_id ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const walletAddress: string | undefined = body?.walletAddress;

  if (!walletAddress || !EVM_REGEX.test(walletAddress)) {
    return NextResponse.json({ error: 'Ungültige walletAddress' }, { status: 400 });
  }

  const normalized = walletAddress.toLowerCase();

  const operatorId  = process.env.HEDERA_OPERATOR_ID;
  const dfaithToken = process.env.NEXT_PUBLIC_HEDERA_DFAITH_TOKEN_ID;
  const network     = (process.env.HEDERA_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';

  if (!operatorId) {
    return NextResponse.json({ error: 'HEDERA_OPERATOR_ID nicht konfiguriert' }, { status: 503 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL nicht konfiguriert' }, { status: 503 });
  }
  if (!process.env.HEDERA_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'HEDERA_ENCRYPTION_KEY nicht konfiguriert' }, { status: 503 });
  }

  const {
    Client, PrivateKey, Hbar,
    AccountCreateTransaction,
    TokenAssociateTransaction, TokenId,
    TransferTransaction,
  } = await import('@hashgraph/sdk');
  const { getOperatorKey } = await import('@/app/lib/hederaOperator');

  let client: InstanceType<typeof Client> | null = null;
  try {
    const sql = getDb();

    // Idempotent: bereits vorhandenen Account zurückgeben
    const existing = await sql`
      SELECT hedera_account_id FROM hedera_accounts
      WHERE wallet_address = ${normalized} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ hederaAccountId: existing[0].hedera_account_id, created: false });
    }

    const operatorKey = await getOperatorKey();
    client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
    client.setOperator(operatorId, operatorKey);

    // 1) Neues ED25519 Keypair für den User
    const userKey = PrivateKey.generateED25519();

    // 2) Hedera Account erstellen (Operator zahlt ~$0.05)
    const createTx = await new AccountCreateTransaction()
      .setKey(userKey.publicKey)
      .setInitialBalance(new Hbar(0.5))
      .setMaxTransactionFee(new Hbar(2))
      .execute(client);

    const receipt      = await createTx.getReceipt(client);
    const newAccountId = receipt.accountId!.toString();

    // 3) D.FAITH Token assoziieren (wenn konfiguriert)
    if (dfaithToken) {
      const assocTx = await new TokenAssociateTransaction()
        .setAccountId(newAccountId)
        .setTokenIds([TokenId.fromString(dfaithToken)])
        .freezeWith(client)
        .sign(userKey);
      await (await assocTx.execute(client)).getReceipt(client);
    }

    // 4) Private Key verschlüsselt speichern
    const encryptedKey = encryptKey(userKey.toStringDer());

    await sql`
      INSERT INTO hedera_accounts (wallet_address, hedera_account_id, hedera_private_key)
      VALUES (${normalized}, ${newAccountId}, ${encryptedKey})
      ON CONFLICT (wallet_address) DO NOTHING
    `;

    // Race-condition check
    const saved = await sql`
      SELECT hedera_account_id FROM hedera_accounts
      WHERE wallet_address = ${normalized} LIMIT 1
    `;

    return NextResponse.json({
      hederaAccountId: saved[0].hedera_account_id,
      created: true,
    });
  } catch (err) {
    console.error('[hedera/create-account]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    }, { status: 500 });
  } finally {
    client?.close();
  }
}
