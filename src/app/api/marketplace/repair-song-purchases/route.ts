/**
 * POST /api/marketplace/repair-song-purchases
 * Korrigiert shop_purchases.buyer_wallet für alle Song-NFTs die über den Marktplatz
 * verkauft wurden (vor dem Fix der buyer_wallet nicht aktualisiert hat).
 *
 * Logik:
 *   1. Alle sold Song-Listings laden
 *   2. Für jedes Listing: aktuellen SPL-Token-Inhaber on-chain bestimmen
 *   3. Inhaber per solana_accounts auf Clerk-wallet mappen
 *   4. shop_purchases.buyer_wallet auf den echten Besitzer setzen
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

async function getCurrentHolder(mintAddress: string): Promise<string | null> {
  try {
    const conn    = new Connection(RPC_URL, 'confirmed');
    const mintPk  = new PublicKey(mintAddress);
    const accounts = await conn.getTokenLargestAccounts(mintPk);
    const largest  = accounts.value.find(a => Number(a.amount) > 0);
    if (!largest) return null;
    const info = await conn.getParsedAccountInfo(largest.address);
    const parsed = (info.value?.data as any)?.parsed?.info;
    return (parsed?.owner as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql           = getDb();
    const treasuryAddr  = getTreasuryKeypair().publicKey.toBase58();

    // Alle sold Song-NFT-Listings
    const soldListings = await sql`
      SELECT mint_address FROM nft_listings
      WHERE status = 'sold' AND nft_type = 'song'
    `;

    const results: { mint: string; status: string; newBuyer?: string }[] = [];

    for (const row of soldListings) {
      const mint = row.mint_address as string;

      // Aktuellen on-chain Inhaber bestimmen
      const holderSolana = await getCurrentHolder(mint);
      if (!holderSolana) {
        results.push({ mint, status: 'holder_not_found' });
        continue;
      }
      // Treasury hält es noch → noch nicht verkauft / Fehler beim Transfer
      if (holderSolana === treasuryAddr) {
        results.push({ mint, status: 'still_in_treasury' });
        continue;
      }

      // Solana-Adresse auf Clerk-wallet mappen
      const walletRows = await sql`
        SELECT wallet_address FROM solana_accounts
        WHERE solana_address = ${holderSolana} LIMIT 1
      `;
      if (!walletRows.length) {
        results.push({ mint, status: 'wallet_not_found', newBuyer: holderSolana });
        continue;
      }
      const clerkWallet = walletRows[0].wallet_address as string;

      // shop_purchases aktualisieren
      const updated = await sql`
        UPDATE shop_purchases
        SET buyer_wallet = ${clerkWallet.toLowerCase()}
        WHERE nft_mint_address = ${mint}
          AND buyer_wallet != ${clerkWallet.toLowerCase()}
        RETURNING id
      `;

      results.push({
        mint,
        status: updated.length > 0 ? 'fixed' : 'already_correct',
        newBuyer: clerkWallet,
      });
    }

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
