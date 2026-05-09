/**
 * GET /api/hedera/debug-key
 * Zeigt alle möglichen Public Keys für die aktuelle Mnemonic.
 * Vergleich mit HashScan → Settings → Key deines Accounts.
 * NUR lokal verwenden, nie auf Production deployen.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mnemonic = process.env.HEDERA_OPERATOR_MNEMONIC?.trim();
  if (!mnemonic) return NextResponse.json({ error: 'HEDERA_OPERATOR_MNEMONIC nicht gesetzt' }, { status: 400 });

  const { Mnemonic } = await import('@hashgraph/sdk');
  const m = await Mnemonic.fromString(mnemonic);

  const results: Record<string, string> = {};

  try {
    const k = await m.toStandardEd25519PrivateKey('', 0);
    results['toStandardEd25519PrivateKey(index=0)'] = k.publicKey.toStringDer();
  } catch (e) { results['toStandardEd25519PrivateKey(index=0)'] = 'FEHLER: ' + e; }

  try {
    const k = await m.toStandardEd25519PrivateKey('', 0);
    results['toStandardEd25519PrivateKey(index=0)_raw'] = k.publicKey.toStringRaw();
  } catch (e) { results['toStandardEd25519PrivateKey(index=0)_raw'] = 'FEHLER: ' + e; }

  try {
    const k = await m.toStandardECDSAsecp256k1PrivateKey('', 0);
    results['toStandardECDSAsecp256k1(index=0)'] = k.publicKey.toStringDer();
  } catch (e) { results['toStandardECDSAsecp256k1(index=0)'] = 'FEHLER: ' + e; }

  try {
    const k = await (m as any).toLegacyPrivateKey();
    results['toLegacyPrivateKey'] = k.publicKey.toStringDer();
  } catch (e) { results['toLegacyPrivateKey'] = 'FEHLER: ' + e; }

  return NextResponse.json({
    hint: `Öffne HashScan: https://hashscan.io/mainnet/account/${process.env.HEDERA_OPERATOR_ID} → Keys → vergleiche den Public Key`,
    keys: results,
  });
}
