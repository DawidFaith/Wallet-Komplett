import { NextRequest, NextResponse } from 'next/server';
import { getCreatorBalance, creditCreatorBalance, getDfaithCredits } from '@/app/lib/questDb';

const SOLANA_RPC  = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

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
  let body: { walletAddress?: string; senderWallet?: string; txHash?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { walletAddress, senderWallet, txHash, amount } = body;
  if (!walletAddress || !txHash || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'walletAddress, txHash und amount sind erforderlich' },
      { status: 400 },
    );
  }

  // senderWallet = Solana-Adresse des Absenders für On-Chain-Prüfung.
  // Fallback auf walletAddress für Rückwärtskompatibilität.
  const sender = (senderWallet ?? walletAddress).trim();
  if (!sender || sender.length < 32) {
    return NextResponse.json(
      { error: 'Ungültige Solana-Absenderadresse.' },
      { status: 400 },
    );
  }

  const rewardPool = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS;
  if (!rewardPool) {
    return NextResponse.json({ error: 'Reward-Pool nicht konfiguriert (NEXT_PUBLIC_REWARD_POOL_ADDRESS)' }, { status: 500 });
  }
  if (!DFAITH_MINT) {
    return NextResponse.json({ error: 'D.FAITH Token-Mint nicht konfiguriert (NEXT_PUBLIC_SOLANA_DFAITH_TOKEN)' }, { status: 500 });
  }

  // ── On-Chain Verifizierung via Solana-RPC ──────────────────────────────────
  try {
    const rpcRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      }),
    });
    const rpcData = await rpcRes.json();
    const tx = rpcData?.result;

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaktion nicht gefunden. Bitte kurz warten und erneut versuchen.' },
        { status: 400 },
      );
    }
    if (tx.meta?.err !== null) {
      return NextResponse.json({ error: 'Transaktion ist fehlgeschlagen.' }, { status: 400 });
    }

    // Token Balance Changes: D.FAITH-Eingang beim Pool prüfen
    const preBal: { owner: string; mint: string; uiTokenAmount: { uiAmount: number | null } }[] =
      tx.meta?.preTokenBalances ?? [];
    const postBal: { owner: string; mint: string; uiTokenAmount: { uiAmount: number | null } }[] =
      tx.meta?.postTokenBalances ?? [];

    const poolPost = postBal.find((b) => b.owner === rewardPool && b.mint === DFAITH_MINT);
    const poolPre  = preBal.find((b) => b.owner === rewardPool && b.mint === DFAITH_MINT)
      ?? { uiTokenAmount: { uiAmount: 0 } };

    if (!poolPost) {
      return NextResponse.json(
        { error: 'Kein D.FAITH-Transfer an den Reward-Pool gefunden.' },
        { status: 400 },
      );
    }

    const received = (poolPost.uiTokenAmount.uiAmount ?? 0) - (poolPre.uiTokenAmount.uiAmount ?? 0);
    if (received <= 0) {
      return NextResponse.json({ error: 'Pool-Guthaben hat sich nicht erhöht.' }, { status: 400 });
    }

    if (Math.abs(received - amount) > 0.01) {
      return NextResponse.json(
        { error: `Betrag stimmt nicht überein. Gefunden: ${received} D.FAITH, gemeldet: ${amount} D.FAITH.` },
        { status: 400 },
      );
    }

    const actualAmount = Math.round(received * 100) / 100;
    // Gutschreiben (UNIQUE tx_hash verhindert Doppelgutschrift)
    await creditCreatorBalance(walletAddress, actualAmount, txHash);
    return NextResponse.json({ success: true, credited: actualAmount });
  } catch (e: unknown) {
    // PostgreSQL unique-violation = Tx bereits gutgeschrieben
    if ((e as { code?: string })?.code === '23505' || (e as Error)?.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Diese Transaktion wurde bereits gutgeschrieben.' },
        { status: 409 },
      );
    }
    console.error('[creator-balance POST]', e);
    return NextResponse.json({ error: 'Fehler bei der Verifikation' }, { status: 500 });
  }
}
