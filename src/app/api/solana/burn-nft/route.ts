/**
 * POST /api/solana/burn-nft
 * Body: { walletAddress, mintAddress }
 *
 * Verbrennt eine Print Edition NFT (mpl-token-metadata NonFungible).
 * Verwendet den gespeicherten Keypair des Nutzers.
 * Treasury zahlt Gebühren, Holder bleibt Authority.
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
  createSignerFromKeypair,
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

    // Master Edition Mint + Edition Number aus DB holen (falls Print Edition)
    const purchaseRows = await sql`
      SELECT sp.edition_number, si.master_edition_mint
      FROM shop_purchases sp
      JOIN shop_items si ON si.id = sp.item_id
      WHERE sp.nft_mint_address = ${mintAddress}
      LIMIT 1
    `;

    // Treasury als Fee-Payer, Holder als Authority
    const treasury = getTreasuryKeypair();
    const umi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(treasury)));

    const holderUmiKp  = umi.eddsa.createKeypairFromSecretKey(holderKp.secretKey);
    const holderSigner = createSignerFromKeypair(umi, holderUmiKp);

    if (purchaseRows.length && purchaseRows[0].master_edition_mint) {
      // Print Edition: masterEditionMint + masterEditionToken + editionMarker nötig
      const masterMint   = purchaseRows[0].master_edition_mint as string;
      const editionNumber = Number(purchaseRows[0].edition_number ?? 1);

      const conn         = new Connection(RPC_URL, 'confirmed');
      const masterMintPk = new PublicKey(masterMint);
      const treasuryPk   = new PublicKey(treasury.publicKey.toBytes());
      const treasuryAta  = await getAssociatedTokenAddress(
        masterMintPk, treasuryPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Sicherstellen dass Treasury das Master Token hält
      let hasMasterToken = false;
      try {
        const ataInfo = await getAccount(conn, treasuryAta);
        hasMasterToken = Number(ataInfo.amount) > 0;
      } catch { hasMasterToken = false; }

      if (!hasMasterToken) {
        await mintV1(umi, {
          mint:          umiPubkey(masterMint),
          tokenOwner:    umi.identity.publicKey,
          amount:        1,
          tokenStandard: TokenStandard.NonFungible,
        }).sendAndConfirm(umi);
      }

      const editionMarker = findEditionMarkerPda(umi, {
        mint:          umiPubkey(masterMint),
        editionMarker: String(Math.floor(editionNumber / 248)),
      });

      await burnV1(umi, {
        mint:               umiPubkey(mintAddress),
        authority:          holderSigner,
        tokenOwner:         holderSigner.publicKey,
        masterEditionMint:  umiPubkey(masterMint),
        masterEditionToken: umiPubkey(treasuryAta.toBase58()),
        editionMarker,
        tokenStandard:      TokenStandard.NonFungible,
      }).sendAndConfirm(umi);
    } else {
      // Fallback: einfacher Burn (Master Edition oder unbekannter Typ)
      await burnV1(umi, {
        mint:          umiPubkey(mintAddress),
        authority:     holderSigner,
        tokenOwner:    holderSigner.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      }).sendAndConfirm(umi);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Burn NFT Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
