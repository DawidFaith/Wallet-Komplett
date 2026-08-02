/**
 * POST /api/admin/burn-song-collection — TEMPORÄR (2026-08-02)
 *
 * Verbrennt die on-chain Collection eines nie verkauften Song-Items ("Zinkła",
 * falscher Name, 0 Editionen verkauft) und entfernt beide DB-Reste ("Zinkła"
 * mit Mint, "Znikła" ohne Mint — nur ein Fragment aus einem fehlgeschlagenen
 * Versuch). Fest einkodiert, Endpoint wird danach wieder entfernt.
 */
import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, burnCollection, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { keypairIdentity, publicKey as umiPubkey } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

const ARTIST_WALLET   = 'user_3dfvunr7ziaywue8bhzdqw2blsw';
const COLLECTION_MINT = 'GW5d5mNhftre5zDHyHkCSFY3fRWrGfz3V1eeVfuRwmX1'; // "Zinkła"
const ITEM_ID_ZINKLA  = 'efce1899-6b4c-4a2f-b1f1-afce4cd1bec7';
const ITEM_ID_ZNIKLA  = '623f1b3e-5e64-4c4b-a980-336e96d6f960'; // kein Mint, nur DB-Rest

export async function POST() {
  const sql = getDb();
  const steps: Array<{ step: string; status: string; error?: string }> = [];

  try {
    const rows = await sql`
      SELECT solana_private_key FROM solana_accounts
      WHERE wallet_address = ${ARTIST_WALLET} LIMIT 1
    `;
    if (!rows.length) throw new Error('Artist-Keypair nicht gefunden');
    const artistKp = Keypair.fromSecretKey(bs58.decode(decryptKey(rows[0].solana_private_key as string)));

    const umi = createUmi(RPC_URL, 'confirmed')
      .use(mplCore())
      .use(keypairIdentity(fromWeb3JsKeypair(artistKp)));

    const collection = await fetchCollectionV1(umi, umiPubkey(COLLECTION_MINT));
    await burnCollection(umi, { collection: collection.publicKey, compressionProof: null }).sendAndConfirm(umi);
    steps.push({ step: 'burn collection', status: 'burned' });
  } catch (e) {
    steps.push({ step: 'burn collection', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  try {
    await sql`DELETE FROM shop_purchases WHERE item_id IN (${ITEM_ID_ZINKLA}, ${ITEM_ID_ZNIKLA})`;
    await sql`DELETE FROM shop_items WHERE id IN (${ITEM_ID_ZINKLA}, ${ITEM_ID_ZNIKLA})`;
    steps.push({ step: 'db cleanup', status: 'ok' });
  } catch (e) {
    steps.push({ step: 'db cleanup', status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ steps });
}
