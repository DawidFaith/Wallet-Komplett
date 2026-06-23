/**
 * POST /api/admin/burn-master
 * Header: x-admin-secret
 * Body: { masterMint, itemId? }
 *
 * Ablauf:
 *  1. Alle Print Editions aus shop_purchases burnen (Käufer-Keypairs aus DB)
 *  2. Master Edition aus Treasury-Wallet burnen
 *  3. Shop-Item deaktivieren
 *
 * Metaplex blockiert das Burnen einer Master Edition solange Prints existieren.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  burnV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  keypairIdentity,
  publicKey as umiPubkey,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { masterMint, itemId } = await req.json();
    if (!masterMint) {
      return NextResponse.json({ error: 'masterMint erforderlich' }, { status: 400 });
    }

    const sql = getDb();
    const burned: string[] = [];
    const failed: string[] = [];

    // ── 1. Alle Print Editions burnen ────────────────────────────────────────
    if (itemId) {
      const prints = await sql`
        SELECT sp.id, sp.nft_mint_address, sp.buyer_wallet,
               sa.solana_private_key
        FROM shop_purchases sp
        JOIN solana_accounts sa ON sa.wallet_address = sp.buyer_wallet
        WHERE sp.item_id = ${itemId}
          AND sp.nft_mint_address IS NOT NULL
      `;

      for (const print of prints) {
        try {
          const secretB58 = decryptKey(print.solana_private_key as string);
          const buyerKp   = Keypair.fromSecretKey(bs58.decode(secretB58));

          const buyerUmi = createUmi(RPC_URL)
            .use(mplTokenMetadata())
            .use(keypairIdentity(fromWeb3JsKeypair(buyerKp)));

          await burnV1(buyerUmi, {
            mint:          umiPubkey(print.nft_mint_address as string),
            authority:     buyerUmi.identity,
            tokenOwner:    buyerUmi.identity.publicKey,
            tokenStandard: TokenStandard.NonFungible,
          }).sendAndConfirm(buyerUmi);

          burned.push(print.nft_mint_address as string);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Bereits geburnt oder nicht mehr vorhanden → ignorieren
          if (msg.includes('AccountNotFound') || msg.includes('invalid account data') || msg.includes('0x25')) {
            burned.push(print.nft_mint_address as string);
          } else {
            failed.push(`${print.nft_mint_address}: ${msg}`);
          }
        }
      }

      if (failed.length > 0) {
        return NextResponse.json({
          error: `${failed.length} Print(s) konnten nicht geburnt werden`,
          details: failed,
          burned,
        }, { status: 500 });
      }
    }

    // ── 2. Master Edition burnen ──────────────────────────────────────────────
    const treasury = getTreasuryKeypair();
    const umi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

    await burnV1(umi, {
      mint:          umiPubkey(masterMint),
      authority:     umi.identity,
      tokenOwner:    umi.identity.publicKey,
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(umi);

    // ── 3. Item deaktivieren ──────────────────────────────────────────────────
    if (itemId) {
      await sql`UPDATE shop_items SET is_active = FALSE WHERE id = ${itemId}`;
    }

    return NextResponse.json({ success: true, burnedPrints: burned.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Burn Master Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
