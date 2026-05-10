/**
 * Solana Treasury Operator.
 *
 * Unterstützt zwei ENV-Variablen (erste gefundene gewinnt):
 *   SOLANA_TREASURY_MNEMONIC    – 12 oder 24 Wörter Seed Phrase (Phantom/Solflare Standard)
 *   SOLANA_TREASURY_PRIVATE_KEY – BS58-encoded 64-Byte Secret Key
 */
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

let _cached: Keypair | null = null;

export function getTreasuryKeypair(): Keypair {
  if (_cached) return _cached;

  // Option 1: Seed Phrase (12 oder 24 Wörter)
  const mnemonic = process.env.SOLANA_TREASURY_MNEMONIC;
  if (mnemonic && mnemonic.trim().split(/\s+/).length >= 12) {
    const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
    const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
    _cached = Keypair.fromSeed(key);
    return _cached;
  }

  // Option 2: Direkter BS58 Private Key
  const rawKey = process.env.SOLANA_TREASURY_PRIVATE_KEY;
  if (rawKey) {
    try {
      _cached = Keypair.fromSecretKey(bs58.decode(rawKey));
      return _cached;
    } catch {
      throw new Error('SOLANA_TREASURY_PRIVATE_KEY ist kein gültiger BS58-encoded Solana Secret Key.');
    }
  }

  throw new Error(
    'Weder SOLANA_TREASURY_MNEMONIC noch SOLANA_TREASURY_PRIVATE_KEY ist gesetzt.',
  );
}

