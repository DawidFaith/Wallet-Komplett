/**
 * Gibt den Hedera Operator PrivateKey zurück.
 * Unterstützt:
 *   - HEDERA_OPERATOR_KEY: DER-String (302e...) ODER raw hex (64 Zeichen)
 *   - HEDERA_OPERATOR_MNEMONIC: 24 Wörter Seed Phrase
 *
 * Bei Mnemonic: vergleicht alle Derivationspfade automatisch mit dem
 * on-chain Public Key via Mirror Node → erkennt ED25519 und ECDSA automatisch.
 */
import type { PrivateKey as PrivateKeyType } from '@hashgraph/sdk';

async function fetchOnChainPubKey(accountId: string, network: string): Promise<string | null> {
  try {
    const base = network === 'testnet'
      ? 'https://testnet.mirrornode.hedera.com'
      : 'https://mainnet-public.mirrornode.hedera.com';
    const res = await fetch(`${base}/api/v1/accounts/${accountId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.key?.key ?? null; // raw hex public key
  } catch {
    return null;
  }
}

export async function getOperatorKey(): Promise<PrivateKeyType> {
  const { PrivateKey, Mnemonic } = await import('@hashgraph/sdk');

  const derKey   = process.env.HEDERA_OPERATOR_KEY?.trim();
  const mnemonic = process.env.HEDERA_OPERATOR_MNEMONIC?.trim();
  const network  = process.env.HEDERA_NETWORK ?? 'mainnet';

  if (derKey && derKey.length > 10) {
    try { return PrivateKey.fromStringDer(derKey); } catch {}
    try { return PrivateKey.fromStringED25519(derKey); } catch {}
    try { return PrivateKey.fromStringECDSA(derKey); } catch {}
    throw new Error('HEDERA_OPERATOR_KEY konnte nicht geparst werden');
  }

  if (mnemonic && mnemonic.split(' ').length >= 12) {
    const m = await Mnemonic.fromString(mnemonic);

    // On-chain Public Key holen und Derivation automatisch erkennen
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    if (operatorId) {
      const onChainPub = await fetchOnChainPubKey(operatorId, network);
      if (onChainPub) {
        const candidates: Array<() => Promise<PrivateKeyType>> = [
          () => m.toStandardEd25519PrivateKey('', 0),
          () => m.toStandardECDSAsecp256k1PrivateKey('', 0),
          () => m.toStandardEd25519PrivateKey('', 1),
          () => m.toStandardECDSAsecp256k1PrivateKey('', 1),
        ];
        for (const fn of candidates) {
          try {
            const k = await fn();
            if (k.publicKey.toStringRaw() === onChainPub) return k;
          } catch {}
        }
        console.warn('[hederaOperator] Kein Derivationspfad stimmt mit on-chain Key überein');
      }
    }

    // Fallback: Standard ED25519
    return await m.toStandardEd25519PrivateKey('', 0);
  }

  throw new Error('Weder HEDERA_OPERATOR_KEY noch HEDERA_OPERATOR_MNEMONIC ist in ENV gesetzt.');
}
