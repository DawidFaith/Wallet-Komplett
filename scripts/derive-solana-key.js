/**
 * Leitet Solana Keypair aus 12/24-Wörter BIP39 Seed Phrase ab.
 * Derivation Path: m/44'/501'/0'/0' (Phantom / Solflare Standard)
 *
 * Aufruf:
 *   MNEMONIC="wort1 wort2 ... wort12" node scripts/derive-solana-key.js
 */
const bip39      = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair } = require('@solana/web3.js');
const bs58       = require('bs58');

const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  console.error('Fehler: MNEMONIC Umgebungsvariable fehlt.');
  console.error('Aufruf: MNEMONIC="wort1 wort2 ..." node scripts/derive-solana-key.js');
  process.exit(1);
}

if (!bip39.validateMnemonic(mnemonic.trim())) {
  console.error('Fehler: Ungültige Seed Phrase (BIP39 Validierung fehlgeschlagen).');
  process.exit(1);
}

const seed = bip39.mnemonicToSeedSync(mnemonic.trim());

// Phantom / Solflare: m/44'/501'/0'/0'
const path = "m/44'/501'/0'/0'";
const { key } = derivePath(path, seed.toString('hex'));

const keypair = Keypair.fromSeed(key);
const privateKeyBs58 = bs58.default ? bs58.default.encode(keypair.secretKey) : bs58.encode(keypair.secretKey);

console.log('\n=== Solana Wallet aus Seed Phrase ===');
console.log('Adresse (Public Key): ', keypair.publicKey.toBase58());
console.log('Private Key (BS58):   ', privateKeyBs58);
console.log('\n→ SOLANA_TREASURY_PRIVATE_KEY=' + privateKeyBs58);
console.log('→ Diesen Wert in Vercel eintragen.\n');
