/**
 * GET /api/hedera/debug-key?secret=ADMIN_SECRET
 * Vergleicht alle möglichen abgeleiteten Public Keys mit dem on-chain Key.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const mnemonic   = process.env.HEDERA_OPERATOR_MNEMONIC?.trim();
  const network    = process.env.HEDERA_NETWORK ?? 'mainnet';

  const result: Record<string, unknown> = {
    operatorId,
    network,
    mnemonicWordCount: mnemonic?.split(' ').length ?? 0,
  };

  // 1) On-chain Public Key holen
  try {
    const base = network === 'testnet'
      ? 'https://testnet.mirrornode.hedera.com'
      : 'https://mainnet-public.mirrornode.hedera.com';
    const res = await fetch(`${base}/api/v1/accounts/${operatorId}`, { cache: 'no-store' });
    const data = await res.json();
    result['onChainKey'] = data?.key ?? null;
  } catch (e) {
    result['onChainKey'] = 'FEHLER: ' + (e instanceof Error ? e.message : String(e));
  }

  // 2) Alle Derivationspfade
  if (mnemonic) {
    try {
      const { Mnemonic } = await import('@hashgraph/sdk');
      const m = await Mnemonic.fromString(mnemonic);

      const derived: Record<string, string> = {};
      const variants: Array<[string, () => Promise<{ publicKey: { toStringRaw(): string } }>]> = [
        ['ED25519_idx0', () => m.toStandardEd25519PrivateKey('', 0)],
        ['ED25519_idx1', () => m.toStandardEd25519PrivateKey('', 1)],
        ['ECDSA_idx0',   () => m.toStandardECDSAsecp256k1PrivateKey('', 0)],
        ['ECDSA_idx1',   () => m.toStandardECDSAsecp256k1PrivateKey('', 1)],
      ];
      for (const [name, fn] of variants) {
        try {
          const k = await fn();
          derived[name] = k.publicKey.toStringRaw();
        } catch (e) {
          derived[name] = 'FEHLER: ' + (e instanceof Error ? e.message : String(e));
        }
      }
      result['derivedPublicKeys'] = derived;
    } catch (e) {
      result['mnemonicError'] = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(result);
}
