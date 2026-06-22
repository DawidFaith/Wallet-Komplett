/**
 * GET /api/solana/token-supply?mint=...
 * Gibt total supply + decimals eines SPL-Tokens zurück.
 */
import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get('mint');
  if (!mint) return NextResponse.json({ error: 'mint fehlt' }, { status: 400 });

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const mintInfo = await getMint(connection, new PublicKey(mint));
    const decimals = mintInfo.decimals;
    const totalSupply = Number(mintInfo.supply) / Math.pow(10, decimals);
    const mintingEnabled = mintInfo.mintAuthority !== null;

    return NextResponse.json({ totalSupply, decimals, mintingEnabled });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
