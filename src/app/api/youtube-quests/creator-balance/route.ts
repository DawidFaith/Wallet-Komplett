import { NextRequest, NextResponse } from 'next/server';
import { getCreatorBalance, creditCreatorBalance, getDfaithCredits } from '@/app/lib/questDb';
import { getDb } from '@/app/lib/db';

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

// ─── POST: Einzahlung automatisch erkennen & gutschreiben ─────────────────────
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; senderWallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { walletAddress, senderWallet } = body;
  if (!walletAddress || !senderWallet) {
    return NextResponse.json(
      { error: 'walletAddress und senderWallet sind erforderlich' },
      { status: 400 },
    );
  }

  const sender = senderWallet.trim();
  if (!sender || sender.length < 32) {
    return NextResponse.json({ error: 'Ungültige Solana-Absenderadresse.' }, { status: 400 });
  }

  const rewardPool = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS;
  if (!rewardPool) {
    return NextResponse.json(
      { error: 'Reward-Pool nicht konfiguriert (NEXT_PUBLIC_REWARD_POOL_ADDRESS)' },
      { status: 500 },
    );
  }
  if (!DFAITH_MINT) {
    return NextResponse.json(
      { error: 'D.FAITH Token-Mint nicht konfiguriert (NEXT_PUBLIC_SOLANA_DFAITH_TOKEN)' },
      { status: 500 },
    );
  }

  try {
    // ── Schritt 1: Letzte Signaturen des Absenders holen ─────────────────────
    const sigsRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [sender, { limit: 20, commitment: 'confirmed' }],
      }),
    });
    const sigsData = await sigsRes.json();
    const signatures: { signature: string; err: unknown }[] = sigsData?.result ?? [];

    const sql = getDb();
    type TokenBalance = { owner: string; mint: string; uiTokenAmount: { uiAmount: number | null } };

    // ── Schritt 2: Jede Signatur prüfen ──────────────────────────────────────
    for (const sigInfo of signatures) {
      if (sigInfo.err !== null) continue; // fehlgeschlagene TXs überspringen

      const sig = sigInfo.signature;

      // Bereits gutgeschrieben? → überspringen
      const existing = await sql`
        SELECT 1 FROM creator_deposits WHERE tx_hash = ${sig.toLowerCase()} LIMIT 1
      `;
      if (existing.length > 0) continue;

      // Vollständige TX-Daten holen
      const txRes = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        }),
      });
      const txData = await txRes.json();
      const tx = txData?.result;
      if (!tx || tx.meta?.err !== null) continue;

      // D.FAITH-Eingang beim Reward-Pool prüfen
      const preBal  = (tx.meta?.preTokenBalances  ?? []) as TokenBalance[];
      const postBal = (tx.meta?.postTokenBalances ?? []) as TokenBalance[];

      const poolPost = postBal.find((b) => b.owner === rewardPool && b.mint === DFAITH_MINT);
      const poolPre  = preBal.find((b)  => b.owner === rewardPool && b.mint === DFAITH_MINT);

      if (!poolPost) continue;

      const received =
        (poolPost.uiTokenAmount.uiAmount ?? 0) - (poolPre?.uiTokenAmount.uiAmount ?? 0);
      if (received <= 0) continue;

      // Gefunden — gutschreiben
      const actualAmount = Math.round(received * 100) / 100;
      await creditCreatorBalance(walletAddress, actualAmount, sig);
      return NextResponse.json({ success: true, credited: actualAmount, signature: sig });
    }

    return NextResponse.json(
      {
        error:
          'Keine neue Transaktion an den Reward-Pool gefunden. ' +
          'Bitte kurz warten und erneut versuchen.',
      },
      { status: 404 },
    );
  } catch (e: unknown) {
    // PostgreSQL unique-violation = TX bereits gutgeschrieben
    if ((e as { code?: string })?.code === '23505' || (e as Error)?.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Diese Transaktion wurde bereits gutgeschrieben.' },
        { status: 409 },
      );
    }
    console.error('[creator-balance POST]', e);
    return NextResponse.json({ error: 'Interner Fehler bei der Verifizierung' }, { status: 500 });
  }
}
