/**
 * POST /api/admin/arweave-drain?secret=MIGRATION_SECRET — TEMPORÄR (2026-07-14)
 *
 * Sendet das gesamte AR-Guthaben des App-Wallets (ARWEAVE_WALLET_KEY) an eine
 * fest einkodierte Zieladresse (User-Wunsch: Arweave wird für NFT-Metadata
 * nicht mehr gebraucht, Guthaben soll zurück ans eigene Wallet). Betrag =
 * aktuelles Guthaben minus Netzwerkgebühr. Endpoint wird danach entfernt.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RECIPIENT = 'flDl5veCjqBT7ihvp5qlPmsdE4aJKgGnt9GefFrHHeg';

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const raw = process.env.ARWEAVE_WALLET_KEY;
  if (!raw) return NextResponse.json({ error: 'ARWEAVE_WALLET_KEY nicht gesetzt' }, { status: 500 });
  const jwk = JSON.parse(raw);

  const { default: Arweave } = await import('arweave');
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

  const fromAddress = await arweave.wallets.jwkToAddress(jwk);
  const balanceWinston = await arweave.wallets.getBalance(fromAddress);

  if (balanceWinston === '0') {
    return NextResponse.json({ error: 'Guthaben ist bereits 0', fromAddress });
  }

  // Gebühr MIT Zieladresse schätzen (getPrice ohne target ergab eine zu
  // niedrige reward für eine TX, die tatsächlich ein target trägt →
  // "Transaction verification failed"). quantity ist TS-readonly, deshalb
  // direkt mit dem finalen Betrag erzeugen statt nachträglich zu mutieren.
  const feeWinston  = await arweave.transactions.getPrice(0, RECIPIENT);
  const sendWinston = BigInt(balanceWinston) - BigInt(feeWinston);

  if (sendWinston <= 0n) {
    return NextResponse.json({
      error: 'Guthaben deckt nicht einmal die Netzwerkgebühr',
      fromAddress, balanceWinston, feeWinston,
    }, { status: 400 });
  }

  const tx = await arweave.createTransaction({
    target:   RECIPIENT,
    quantity: sendWinston.toString(),
  }, jwk);
  await arweave.transactions.sign(tx, jwk);
  const res = await arweave.transactions.post(tx);

  if (res.status !== 200 && res.status !== 202) {
    return NextResponse.json({
      error: `Post fehlgeschlagen: ${res.status} ${res.statusText}`,
      fromAddress, balanceWinston,
    }, { status: 502 });
  }

  return NextResponse.json({
    success:        true,
    txId:           tx.id,
    fromAddress,
    toAddress:      RECIPIENT,
    sentAr:         (Number(sendWinston) / 1e12).toFixed(12),
    feeAr:          (Number(feeWinston)  / 1e12).toFixed(12),
    balanceBeforeAr:(Number(balanceWinston) / 1e12).toFixed(12),
  });
}
