/**
 * POST /api/admin/burn-shop-nfts — TEMPORÄR (2026-07-14), für Retest nach mpl-core-Metadaten-Fix
 * Header: x-admin-secret
 * Body: { solanaAddress }
 *
 * Verbrennt alle Song-Print-Editions (mpl-core Assets) eines Test-Wallets und
 * räumt shop_purchases + shop_items.edition_count auf, damit dieselben
 * Editionsplätze frisch neu gekauft werden können. Endpoint danach entfernen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { burnSongPrintEdition } from '../../../lib/songNft';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { solanaAddress } = await req.json() as { solanaAddress?: string };
    if (!solanaAddress) {
      return NextResponse.json({ error: 'solanaAddress erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    const ownerRows = await sql`
      SELECT wallet_address, solana_private_key FROM solana_accounts
      WHERE solana_address = ${solanaAddress} LIMIT 1
    `;
    if (!ownerRows.length) {
      return NextResponse.json({ error: 'Kein Account mit dieser solanaAddress gefunden' }, { status: 404 });
    }
    const buyerWallet = ownerRows[0].wallet_address as string;
    const ownerKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(ownerRows[0].solana_private_key as string)));
    const treasuryKeypair = getTreasuryKeypair();

    const purchases = await sql`
      SELECT sp.id, sp.item_id, sp.nft_mint_address
      FROM shop_purchases sp
      WHERE sp.buyer_wallet = ${buyerWallet}
        AND sp.nft_mint_address IS NOT NULL
    `;

    const burned: string[] = [];
    const failed: Array<{ mint: string; error: string }> = [];

    for (const p of purchases) {
      const mint = p.nft_mint_address as string;
      try {
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
        // Asset schon weg (evtl. vorheriger Lauf) -> DB trotzdem aufräumen
        if (msg.includes('AccountNotFound') || msg.includes('could not find account')) {
          await sql`DELETE FROM shop_purchases WHERE id = ${p.id}`;
          await sql`UPDATE shop_items SET edition_count = GREATEST(COALESCE(edition_count, 0) - 1, 0) WHERE id = ${p.item_id}`;
          burned.push(mint);
        } else {
          failed.push({ mint, error: msg });
        }
      }
    }

    return NextResponse.json({ success: true, burned, failed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('burn-shop-nfts Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
