/**
 * POST /api/solana/burn-nft
 * Body: { walletAddress, mintAddress }
 *
 * Verbrennt eine Print Edition NFT (mpl-token-metadata NonFungible).
 * Holder zahlt Gebühren und ist Authority (bekommt Rent zurück).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  burnV1,
  mintV1,
  TokenStandard,
  findEditionMarkerPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  keypairIdentity,
  publicKey as umiPubkey,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, getAccount,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, mintAddress } = await req.json();
    if (!walletAddress || !mintAddress) {
      return NextResponse.json({ error: 'walletAddress und mintAddress erforderlich' }, { status: 400 });
    }

    const sql = getDb();

    // Holder-Keypair laden
    const rows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet gefunden' }, { status: 404 });
    }
    const secretB58 = decryptKey(rows[0].solana_private_key as string);
    const holderKp  = Keypair.fromSecretKey(bs58.decode(secretB58));

    // Holder zahlt Gebühren und ist Authority
    const holderUmi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(holderKp)));

    // Master Edition Mint + Edition Number aus DB holen (Print Edition)
    const purchaseRows = await sql`
      SELECT sp.edition_number, si.master_edition_mint
      FROM shop_purchases sp
      JOIN shop_items si ON si.id = sp.item_id
      WHERE sp.nft_mint_address = ${mintAddress}
      LIMIT 1
    `;

    if (purchaseRows.length && purchaseRows[0].master_edition_mint) {
      const masterMint    = purchaseRows[0].master_edition_mint as string;
      const editionNumber = Number(purchaseRows[0].edition_number ?? 1);

      const treasury    = getTreasuryKeypair();
      const conn        = new Connection(RPC_URL, 'confirmed');
      const masterMintPk = new PublicKey(masterMint);
      const treasuryPk   = new PublicKey(treasury.publicKey.toBytes());
      const treasuryAta  = await getAssociatedTokenAddress(
        masterMintPk, treasuryPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Sicherstellen dass Treasury das Master Token hält (via Treasury-UMI)
      let hasMasterToken = false;
      try {
        const ataInfo = await getAccount(conn, treasuryAta);
        hasMasterToken = Number(ataInfo.amount) > 0;
      } catch { hasMasterToken = false; }

      if (!hasMasterToken) {
        const treasuryUmi = createUmi(RPC_URL)
          .use(mplTokenMetadata())
          .use(keypairIdentity(fromWeb3JsKeypair(treasury)));
        await mintV1(treasuryUmi, {
          mint:          umiPubkey(masterMint),
          tokenOwner:    treasuryUmi.identity.publicKey,
          amount:        1,
          tokenStandard: TokenStandard.NonFungible,
        }).sendAndConfirm(treasuryUmi);
      }

      const editionMarker = findEditionMarkerPda(holderUmi, {
        mint:          umiPubkey(masterMint),
        editionMarker: String(Math.floor(editionNumber / 248)),
      });

      await burnV1(holderUmi, {
        mint:               umiPubkey(mintAddress),
        authority:          holderUmi.identity,
        tokenOwner:         holderUmi.identity.publicKey,
        masterEditionMint:  umiPubkey(masterMint),
        masterEditionToken: umiPubkey(treasuryAta.toBase58()),
        editionMarker,
        tokenStandard:      TokenStandard.NonFungible,
      }).sendAndConfirm(holderUmi);
    } else {
      // Fallback: einfacher Burn (Master Edition oder unbekannter Typ)
      await burnV1(holderUmi, {
        mint:          umiPubkey(mintAddress),
        authority:     holderUmi.identity,
        tokenOwner:    holderUmi.identity.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      }).sendAndConfirm(holderUmi);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Burn NFT Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
