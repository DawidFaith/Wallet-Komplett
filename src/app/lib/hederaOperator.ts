/**
 * Gibt den Hedera Operator PrivateKey zurück.
 * Unterstützt zwei ENV-Formate:
 *   - HEDERA_OPERATOR_KEY: DER-String (302e...)
 *   - HEDERA_OPERATOR_MNEMONIC: 24 Wörter Seed Phrase
 */
import type { PrivateKey as PrivateKeyType } from '@hashgraph/sdk';

export async function getOperatorKey(): Promise<PrivateKeyType> {
  const { PrivateKey, Mnemonic } = await import('@hashgraph/sdk');

  const derKey    = process.env.HEDERA_OPERATOR_KEY?.trim();
  const mnemonic  = process.env.HEDERA_OPERATOR_MNEMONIC?.trim();

  if (derKey && derKey.length > 10) {
    return PrivateKey.fromStringDer(derKey);
  }

  if (mnemonic && mnemonic.split(' ').length >= 12) {
    const m = await Mnemonic.fromString(mnemonic);
    // Standard ED25519 Derivation (kompatibel mit HashPack)
    return await m.toStandardEd25519PrivateKey('', 0);
  }

  throw new Error(
    'Weder HEDERA_OPERATOR_KEY noch HEDERA_OPERATOR_MNEMONIC ist in ENV gesetzt.',
  );
}
