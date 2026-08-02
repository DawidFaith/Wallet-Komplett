/**
 * POST /api/shop/burn-collection
 * Body: { wallet, itemId }
 *
 * Verbrennt die on-chain Song-Collection eines Items und entfernt es
 * vollständig aus der DB (hard delete). Nur möglich wenn noch keine
 * einzige Edition verkauft wurde (edition_count === 0) — mpl-core
 * erlaubt burnCollection nur bei leeren Collections, und ein Burn bei
 * bereits verkauften Editionen würde Käufern schaden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, burnCollection, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { keypairIdentity, publicKey as umiPubkey } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';
import { requireOwnWallet } from '../../../lib/apiAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    const { wallet, itemId } = await req.json() as { wallet?: string; itemId?: string };
    if (!wallet || !itemId) {
      return NextResponse.json({ error: 'wallet und itemId erforderlich' }, { status: 400 });
    }
    const authCheck = requireOwnWallet(wallet);
    if (!authCheck.ok) return authCheck.response;

    const sql = getDb();
    const rows = await sql`
      SELECT si.master_edition_mint, si.edition_count, sa.solana_private_key
      FROM shop_items si
      LEFT JOIN solana_accounts sa ON sa.wallet_address = si.artist_wallet
      WHERE si.id = ${itemId} AND si.artist_wallet = ${wallet.toLowerCase()}
      LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Item nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }
    const { master_edition_mint: collectionMint, edition_count: editionCount, solana_private_key: encKey } = rows[0];

    if (Number(editionCount) > 0) {
      return NextResponse.json({
        error: `Es wurden bereits ${editionCount} Edition(en) verkauft — die on-chain Collection kann nicht mehr verbrannt werden. Bitte stattdessen normal löschen.`,
      }, { status: 400 });
    }

    if (collectionMint) {
      if (!encKey) {
        return NextResponse.json({ error: 'Kein Solana-Wallet für diesen Künstler gefunden' }, { status: 400 });
      }
      const artistKp = Keypair.fromSecretKey(bs58.decode(decryptKey(encKey as string)));
      const umi = createUmi(RPC_URL, 'confirmed')
        .use(mplCore())
        .use(keypairIdentity(fromWeb3JsKeypair(artistKp)));

      try {
        const collection = await fetchCollectionV1(umi, umiPubkey(collectionMint as string));
        await burnCollection(umi, { collection: collection.publicKey, compressionProof: null }).sendAndConfirm(umi);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Bereits verbrannt/nicht mehr vorhanden ist kein Fehler für uns — DB trotzdem aufräumen
        if (!msg.toLowerCase().includes('not found') && !msg.toLowerCase().includes('account not')) {
          console.error('On-Chain-Burn fehlgeschlagen:', msg);
          return NextResponse.json({ error: 'On-Chain-Burn fehlgeschlagen. Bitte versuche es erneut.' }, { status: 500 });
        }
      }
    }

    await sql`DELETE FROM shop_purchases WHERE item_id = ${itemId}`;
    await sql`DELETE FROM shop_items WHERE id = ${itemId}`;

    return NextResponse.json({ success: true, burned: !!collectionMint });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('shop/burn-collection Fehler:', msg);
    return NextResponse.json({ error: 'Aktion fehlgeschlagen. Bitte versuche es erneut.' }, { status: 500 });
  }
}
