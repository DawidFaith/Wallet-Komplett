/**
 * POST /api/admin/burn-all-shop-nfts — TEMPORÄR (2026-07-14), voller Reset vor Retest
 * Header: x-admin-secret
 *
 * Verbrennt JEDE Song-Print-Edition (mpl-core Asset) im gesamten Shop, über
 * alle Käufer hinweg, und räumt shop_purchases + shop_items.edition_count auf.
 * Endpoint danach entfernen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { burnSongPrintEdition } from '../../../lib/songNft';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const treasuryKeypair = getTreasuryKeypair();

    const purchases = await sql`
      SELECT sp.id, sp.item_id, sp.nft_mint_address, sa.solana_private_key
      FROM shop_purchases sp
      JOIN solana_accounts sa ON sa.wallet_address = sp.buyer_wallet
      WHERE sp.nft_mint_address IS NOT NULL
    `;

    const burned: string[] = [];
    const failed: Array<{ mint: string; error: string }> = [];

    for (const p of purchases) {
      const mint = p.nft_mint_address as string;
      try {
        const ownerKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(p.solana_private_key as string)));
        await burnSongPrintEdition({
          mintAddress:  mint,
          ownerKeypair,
          payerKeypair: treasuryKeypair,
        });
        await sql`DELETE FROM shop_purchases WHERE id = ${p.id}`;
        await sql`UPDATE shop_items SET edition_count = GREATEST(COALESCE(edition_count, 0) - 1, 0) WHERE id = ${p.item_id}`;
        burned.push(mint);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('AccountNotFound') || msg.includes('could not find account')) {
          await sql`DELETE FROM shop_purchases WHERE id = ${p.id}`;
          await sql`UPDATE shop_items SET edition_count = GREATEST(COALESCE(edition_count, 0) - 1, 0) WHERE id = ${p.item_id}`;
          burned.push(mint);
        } else {
          failed.push({ mint, error: msg });
        }
      }
    }

    return NextResponse.json({ success: true, total: purchases.length, burned, failed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('burn-all-shop-nfts Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
