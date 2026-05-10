/**
 * Solana Treasury Operator – liest SOLANA_TREASURY_PRIVATE_KEY (BS58) aus ENV.
 * Gibt das Keypair zurück, das als "Treasury" (Operator) dient.
 */
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let _cached: Keypair | null = null;

export function getTreasuryKeypair(): Keypair {
  if (_cached) return _cached;
  const key = process.env.SOLANA_TREASURY_PRIVATE_KEY;
  if (!key) {
    throw new Error('SOLANA_TREASURY_PRIVATE_KEY ist nicht gesetzt (BS58-encoded 64-Byte Secret Key).');
  }
  try {
    const secretKey = bs58.decode(key);
    _cached = Keypair.fromSecretKey(secretKey);
    return _cached;
  } catch {
    throw new Error('SOLANA_TREASURY_PRIVATE_KEY ist kein gültiger BS58-encoded Solana Secret Key.');
  }
}
