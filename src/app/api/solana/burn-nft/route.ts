/**
 * POST /api/solana/burn-nft
 * Body: { walletAddress, mintAddress }
 *
 * Verbrennt eine Print Edition NFT (mpl-token-metadata NonFungible).
 * Verwendet den gespeicherten Keypair des Nutzers.
 * Rückerstattung: Rent-SOL aus Mint + Metadata + Edition + ATA Accounts.
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
import { getDb } from '../../../lib/db';
import { decryptKey } from '../../../lib/solanaCrypto';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, mintAddress } = await req.json();
    if (!walletAddress || !mintAddress) {
      return NextResponse.json({ error: 'walletAddress und mintAddress erforderlich' }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT solana_address, solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet gefunden' }, { status: 404 });
    }

    const secretB58 = decryptKey(rows[0].solana_private_key as string);
    const holderKp  = Keypair.fromSecretKey(bs58.decode(secretB58));

    const umi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(holderKp)));

    await burnV1(umi, {
      mint:          umiPubkey(mintAddress),
      authority:     umi.identity,
      tokenOwner:    umi.identity.publicKey,
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(umi);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Burn NFT Fehler:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
