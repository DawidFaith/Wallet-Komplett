import { NextRequest, NextResponse } from 'next/server';
import { getCreatorBalance, creditCreatorBalance, getDfaithCredits } from '@/app/lib/questDb';

const DFAITH_TOKEN = '0x69eFD833288605f320d77eB2aB99DDE62919BbC1';
const DFAITH_DECIMALS = 2;
const BASE_RPC = 'https://mainnet.base.org';

// Transfer(address,address,uint256) – keccak256 Signatur
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ─── GET: Guthaben eines Creators abrufen ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  try {
    const [poolBalance, credits] = await Promise.all([
      getCreatorBalance(wallet),
      getDfaithCredits(wallet),
    ]);

    return NextResponse.json({ balance: credits, poolBalance });
  } catch (e) {
    console.error('[creator-balance GET]', e);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}

// ─── POST: Einzahlung verifizieren & gutschreiben ─────────────────────────────
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; txHash?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { walletAddress, txHash, amount } = body;
  if (!walletAddress || !txHash || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'walletAddress, txHash und amount sind erforderlich' },
      { status: 400 },
    );
  }

  const rewardPool = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS;
  if (!rewardPool) {
    return NextResponse.json({ error: 'Reward-Pool nicht konfiguriert (NEXT_PUBLIC_REWARD_POOL_ADDRESS)' }, { status: 500 });
  }

  // ── On-Chain Verifizierung via Base-RPC ──────────────────────────────────
  try {
    const rpcRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });
    const rpcData = await rpcRes.json();
    const receipt = rpcData?.result;

    if (!receipt) {
      return NextResponse.json(
        { error: 'Transaktion noch nicht bestätigt. Bitte kurz warten und erneut versuchen.' },
        { status: 400 },
      );
    }
    if (receipt.status !== '0x1') {
      return NextResponse.json({ error: 'Transaktion ist fehlgeschlagen (reverted).' }, { status: 400 });
    }

    // Transfer-Event aus DFAITH-Vertrag suchen
    const transfer = (receipt.logs as any[])?.find(
      (log) =>
        log.address?.toLowerCase() === DFAITH_TOKEN.toLowerCase() &&
        log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC.toLowerCase() &&
        // from = creator wallet (32-Byte padded)
        log.topics?.[1]?.toLowerCase().endsWith(walletAddress.toLowerCase().replace('0x', '')) &&
        // to = reward pool (32-Byte padded)
        log.topics?.[2]?.toLowerCase().endsWith(rewardPool.toLowerCase().replace('0x', '')),
    );

    if (!transfer) {
      return NextResponse.json(
        { error: 'Kein gültiger DFAITH-Transfer an den Reward-Pool gefunden.' },
        { status: 400 },
      );
    }

    // Übertragene Menge aus Event-Data dekodieren
    const transferredWei = BigInt(transfer.data);
    const transferredAmount = Number(transferredWei) / Math.pow(10, DFAITH_DECIMALS);
    const actualAmount = Math.round(transferredAmount); // DFAITH hat 2 Dezimalstellen

    // Toleranz: ±0.5 DFAITH (Rundungsschutz)
    if (Math.abs(transferredAmount - amount) > 0.5) {
      return NextResponse.json(
        {
          error: `Betrag stimmt nicht überein. Gefunden: ${transferredAmount} DFAITH, gemeldet: ${amount} DFAITH.`,
        },
        { status: 400 },
      );
    }

    // Gutschreiben (UNIQUE tx_hash verhindert Doppelgutschrift)
    await creditCreatorBalance(walletAddress, actualAmount, txHash);
    return NextResponse.json({ success: true, credited: actualAmount });
  } catch (e: any) {
    // PostgreSQL unique-violation = Tx bereits gutgeschrieben
    if (e?.code === '23505' || e?.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Diese Transaktion wurde bereits gutgeschrieben.' },
        { status: 409 },
      );
    }
    console.error('[creator-balance POST]', e);
    return NextResponse.json({ error: 'Fehler bei der Verifikation' }, { status: 500 });
  }
}
