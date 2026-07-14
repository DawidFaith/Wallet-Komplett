/**
 * POST /api/admin/burn-all-collectibles — TEMPORÄR (2026-07-14)
 *
 * Verbrennt auf ausdrücklichen Wunsch alle bisherigen Collectible-NFTs der
 * Kollektion "Katze" (2 Assets + Collection-NFT) und entfernt die Kollektion
 * aus der DB — gleiche Semantik wie /api/collectibles/burn-collection.
 * Alles fest einkodiert; der Endpoint wird nach der Ausführung entfernt.
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { burnCollectibleAssets, burnCollectibleCollection } from '../../../lib/collectibleNft';
import { decryptKey } from '../../../lib/solanaCrypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const COLLECTION_ID   = 'ddead9ce-2583-428f-8053-ae86e59c8fa0';           // "Katze"
const COLLECTION_MINT = 'HazogkMW7MB5cMV3xqzys4hmaJPboAz7U4X9hFUfjUqJ';
const ASSET_MINTS = [
  '2edviDxVwWDUHDcTgLSXKTLmS5XJDm69t7pURrfVg3zK', // Halter: Fan-Wallet
  'CzugBFnYqt96ux34BizPVYjGTLU81sg6YBVcGKwvyCf3', // Halter: Treasury
];

export async function POST() {
  const steps: Array<{ step: string; status: string; error?: string }> = [];
  const sql = getDb();

  // 1. Assets via Treasury-BurnDelegate verbrennen (keine Halter-Signatur nötig)
  try {
    await burnCollectibleAssets(ASSET_MINTS, COLLECTION_MINT);
    steps.push({ step: 'burn assets', status: 'ok' });
  } catch (e) {
    steps.push({ step: 'burn assets', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  // 2. Collection-NFT verbrennen (Artist ist Update Authority)
  try {
    const rows = await sql`
      SELECT sa.solana_private_key
      FROM collectible_collections cc
      JOIN solana_accounts sa ON sa.wallet_address = cc.artist_wallet
      WHERE cc.id = ${COLLECTION_ID} LIMIT 1
    `;
    if (!rows.length) throw new Error('Artist-Keypair nicht gefunden');
    const artistKp = Keypair.fromSecretKey(bs58.decode(decryptKey(rows[0].solana_private_key as string)));
    await burnCollectibleCollection(COLLECTION_MINT, artistKp);
    steps.push({ step: 'burn collection', status: 'ok' });
  } catch (e) {
    steps.push({ step: 'burn collection', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  // 3. DB aufräumen (wie /api/collectibles/burn-collection)
  try {
    await sql`DELETE FROM user_collectibles WHERE collection_id = ${COLLECTION_ID}`;
    await sql`DELETE FROM collectible_collections WHERE id = ${COLLECTION_ID}`;
    steps.push({ step: 'db cleanup', status: 'ok' });
  } catch (e) {
    steps.push({ step: 'db cleanup', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ steps });
}
