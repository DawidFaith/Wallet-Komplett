/**
 * POST /api/admin/arweave-send
 * Body: { secret, toAddress, amount? }
 *
 * Sendet AR-Token aus dem App-Wallet (ARWEAVE_WALLET_KEY).
 * amount weggelassen/0 → gesamtes Guthaben minus Netzwerkgebühr senden.
 */
import { NextResponse } from 'next/server';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const AR_ADDRESS_RE = /^[A-Za-z0-9_-]{43}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { secret, toAddress, amount } = body as { secret?: string; toAddress?: string; amount?: number };

    if (secret !== process.env.MIGRATION_SECRET) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    if (!toAddress || !AR_ADDRESS_RE.test(toAddress.trim())) {
      return NextResponse.json({ error: 'Ungültige Arweave-Adresse (43 Zeichen erwartet)' }, { status: 400 });
    }
    const raw = process.env.ARWEAVE_WALLET_KEY;
    if (!raw) return NextResponse.json({ error: 'ARWEAVE_WALLET_KEY nicht konfiguriert' }, { status: 503 });

    const jwk = JSON.parse(raw);
    const { default: Arweave } = await import('arweave');
    const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

    const fromAddress    = await arweave.wallets.jwkToAddress(jwk);
    const balanceWinston = await arweave.wallets.getBalance(fromAddress);
    if (balanceWinston === '0') {
      return NextResponse.json({ error: 'Guthaben ist 0', fromAddress }, { status: 400 });
    }

    // Gebühr MIT Zieladresse schätzen — ohne target ist die reward-Schätzung
    // niedriger als die tatsächlich benötigte reward einer TX mit target,
    // was am Gateway zu "Transaction verification failed" führt.
    const feeWinston = await arweave.transactions.getPrice(0, toAddress);

    let sendWinston: bigint;
    if (typeof amount === 'number' && amount > 0) {
      sendWinston = BigInt(arweave.ar.arToWinston(String(amount)));
      if (sendWinston + BigInt(feeWinston) > BigInt(balanceWinston)) {
        return NextResponse.json({
          error: `Guthaben reicht nicht: ${arweave.ar.winstonToAr(balanceWinston)} AR verfügbar, `
               + `${amount} AR + ${arweave.ar.winstonToAr(feeWinston)} AR Gebühr angefordert`,
        }, { status: 400 });
      }
    } else {
      sendWinston = BigInt(balanceWinston) - BigInt(feeWinston);
      if (sendWinston <= 0n) {
        return NextResponse.json({
          error: 'Guthaben deckt nicht einmal die Netzwerkgebühr', fromAddress, balanceWinston, feeWinston,
        }, { status: 400 });
      }
    }

    const tx = await arweave.createTransaction({
      target:   toAddress,
      quantity: sendWinston.toString(),
    }, jwk);
    await arweave.transactions.sign(tx, jwk);
    const res = await arweave.transactions.post(tx);

    if (res.status !== 200 && res.status !== 202) {
      return NextResponse.json({ error: `Post fehlgeschlagen: ${res.status} ${res.statusText}` }, { status: 502 });
    }

    return NextResponse.json({
      success:    true,
      txId:       tx.id,
      fromAddress,
      toAddress,
      sentAr:     arweave.ar.winstonToAr(sendWinston.toString()),
      feeAr:      arweave.ar.winstonToAr(feeWinston),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('arweave-send Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
