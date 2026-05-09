/**
 * AES-256-GCM Verschlüsselung für Hedera Private Keys.
 * ENV: HEDERA_ENCRYPTION_KEY (64 Hex-Zeichen = 32 Bytes)
 * Generieren: openssl rand -hex 32
 *
 * Gespeichertes Format: "<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.HEDERA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'HEDERA_ENCRYPTION_KEY muss als 64 Hex-Zeichen (32 Bytes) in ENV gesetzt sein. ' +
      'Generieren mit: openssl rand -hex 32',
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptKey(plaintext: string): string {
  const key = getKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptKey(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Ungültiges Encrypted-Key-Format');
  const [ivHex, tagHex, encHex] = parts;
  const key       = getKey();
  const iv        = Buffer.from(ivHex, 'hex');
  const tag       = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
