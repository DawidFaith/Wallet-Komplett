/**
 * POST /api/admin/burn-all-collectibles — TEMPORÄR (2026-07-14), 2. Anlauf
 *
 * Die alten Assets (26.06.) haben kein greifendes BurnDelegate → Burn als
 * jeweiliger BESITZER (mpl-core erlaubt Owner-Burns immer):
 *   Asset 2edvi… gehört dem Fan-Wallet EGLf… (Key in solana_accounts)
 *   Asset Czug…  gehört dem Treasury
 * Danach Collection-Burn durch den Artist (Update Authority).
 * DB wurde im 1. Anlauf bereits bereinigt. Endpoint wird danach entfernt.
 */
import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, burn, burnCollection, fetchAssetV1, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { keypairIdentity, publicKey as umiPubkey } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

const COLLECTION_MINT = 'HazogkMW7MB5cMV3xqzys4hmaJPboAz7U4X9hFUfjUqJ';
const FAN_ASSET       = '2edviDxVwWDUHDcTgLSXKTLmS5XJDm69t7pURrfVg3zK';
const FAN_SOLANA      = 'EGLf9GG8mQUZSPThfkEtpqcKG3Q7kb5fL96MjpStKADx';
const TREASURY_ASSET  = 'CzugBFnYqt96ux34BizPVYjGTLU81sg6YBVcGKwvyCf3';
const ARTIST_WALLET   = 'user_3dfvunr7ziaywue8bhzdqw2blsw';

function coreUmi(kp: Keypair) {
  return createUmi(RPC_URL, 'confirmed').use(mplCore()).use(keypairIdentity(fromWeb3JsKeypair(kp)));
}

async function burnAsOwner(ownerKp: Keypair, assetMint: string) {
  const umi = coreUmi(ownerKp);
  let asset;
  try {
    asset = await fetchAssetV1(umi, umiPubkey(assetMint));
  } catch {
    return 'already burned';
  }
  const collection = await fetchCollectionV1(umi, umiPubkey(COLLECTION_MINT));
  await burn(umi, { asset, collection }).sendAndConfirm(umi);
  return 'burned';
}

export async function POST() {
  const steps: Array<{ step: string; status: string; error?: string }> = [];
  const sql = getDb();

  // 1. Fan-Asset als Besitzer verbrennen (Rent-SOL geht an den Fan)
  try {
    const rows = await sql`
      SELECT solana_private_key FROM solana_accounts
      WHERE solana_address = ${FAN_SOLANA} LIMIT 1
    `;
    if (!rows.length) throw new Error('Fan-Keypair nicht gefunden');
    const fanKp = Keypair.fromSecretKey(bs58.decode(decryptKey(rows[0].solana_private_key as string)));
    steps.push({ step: 'burn fan asset', status: await burnAsOwner(fanKp, FAN_ASSET) });
  } catch (e) {
    steps.push({ step: 'burn fan asset', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  // 2. Treasury-Asset als Besitzer verbrennen
  try {
    steps.push({ step: 'burn treasury asset', status: await burnAsOwner(getTreasuryKeypair(), TREASURY_ASSET) });
  } catch (e) {
    steps.push({ step: 'burn treasury asset', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  // 3. Collection-NFT verbrennen (Artist ist Update Authority)
  try {
    const rows = await sql`
      SELECT solana_private_key FROM solana_accounts
      WHERE wallet_address = ${ARTIST_WALLET} LIMIT 1
    `;
    if (!rows.length) throw new Error('Artist-Keypair nicht gefunden');
    const artistKp = Keypair.fromSecretKey(bs58.decode(decryptKey(rows[0].solana_private_key as string)));
    const umi = coreUmi(artistKp);
    try {
      const collection = await fetchCollectionV1(umi, umiPubkey(COLLECTION_MINT));
      await burnCollection(umi, { collection: collection.publicKey, compressionProof: null }).sendAndConfirm(umi);
      steps.push({ step: 'burn collection', status: 'burned' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'burn collection', status: msg.includes('exist') ? 'already burned' : 'error', error: msg });
    }
  } catch (e) {
    steps.push({ step: 'burn collection', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ steps });
}
