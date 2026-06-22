/**
 * GET /api/admin/arweave-keygen?secret=MIGRATION_SECRET
 *
 * Einmalige Nutzung: Generiert ein neues Arweave JWK-Wallet.
 * Die Wallet-Adresse mit AR-Token aufladen, dann den Key als
 * ARWEAVE_WALLET_KEY in Vercel Environment Variables eintragen.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  // Dynamic import so webpack doesn't try to bundle arweave at build time
  const { default: Arweave } = await import('arweave') as {
    default: { init(cfg: { host: string; port: number; protocol: string }): {
      wallets: {
        generate(): Promise<Record<string, string>>;
        jwkToAddress(jwk: Record<string, string>): Promise<string>;
      };
    }};
  };
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
  const jwk     = await arweave.wallets.generate();
  const address = await arweave.wallets.jwkToAddress(jwk);

  return NextResponse.json({
    address,
    instructions: [
      `1. Lade die Wallet-Adresse ${address} mit AR-Token auf (z.B. via Binance → AR → Arweave)`,
      `2. Trage ARWEAVE_WALLET_KEY='${JSON.stringify(jwk)}' in Vercel Environment Variables ein`,
      `3. Prüfe Balance: https://arweave.net/wallet/${address}/balance`,
      `4. Upload-Kosten: ~0.0001 AR/KB (~$0.002/MB bei aktuellem AR-Preis)`,
    ],
    jwk,
  });
}
