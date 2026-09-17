/**
 * POST /api/admin/resync-nft-owner
 * Body: { mintAddress }
 * Header: x-admin-secret
 *
 * Liest den tatsächlichen on-chain Besitzer eines NFTs (mpl-core oder
 * klassisches Token-Metadata/pNFT) aus und schreibt shop_purchases.buyer_wallet
 * bzw. user_collectibles.wallet_address entsprechend fest.
 *
 * Nötig, weil /api/solana/send-nft vor diesem Fix die interne Besitzer-
 * Zuordnung nach einem manuellen Transfer nicht mitgezogen hat — betroffene
 * NFTs zeigten danach zwar korrekt in der Wallet an (On-Chain-Daten), aber
 * ohne Beschreibung/MP3 (DB-Zusatzdaten, an den alten Besitzer geknüpft).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { publicKey as umiPubkey } from '@metaplex-foundation/umi';
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from '../../../lib/db';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

async function findOnChainOwner(mintAddress: string): Promise<string | null> {
  try {
    const umi = createUmi(RPC_URL, 'confirmed').use(mplCore());
    const asset = await fetchAssetV1(umi, umiPubkey(mintAddress));
    return asset.owner.toString();
  } catch { /* kein mpl-core Asset */ }

  try {
    const conn = new Connection(RPC_URL, 'confirmed');
    const mintPk = new PublicKey(mintAddress);
    const largest = await conn.getTokenLargestAccounts(mintPk);
    const holderAta = largest.value.find(a => Number(a.amount) > 0)?.address;
    if (!holderAta) return null;
    const parsed = await conn.getParsedAccountInfo(holderAta);
    const data = parsed.value?.data;
    if (!data || typeof data !== 'object' || !('parsed' in data)) return null;
    const owner = (data as { parsed?: { info?: { owner?: string } } }).parsed?.info?.owner;
    return owner ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const mintAddress = body?.mintAddress?.trim();
  if (!mintAddress) return NextResponse.json({ error: 'mintAddress fehlt' }, { status: 400 });

  const ownerSolanaAddress = await findOnChainOwner(mintAddress);
  if (!ownerSolanaAddress) {
    return NextResponse.json({ error: 'On-Chain-Besitzer nicht gefunden (falsche Adresse oder verbrannt?)' }, { status: 404 });
  }

  const sql = getDb();
  const walletRows = await sql`
    SELECT wallet_address FROM solana_accounts WHERE solana_address = ${ownerSolanaAddress} LIMIT 1
  `;
  if (!walletRows.length) {
    return NextResponse.json({
      error: 'Der aktuelle On-Chain-Besitzer hat keinen D.FAITH-Account',
      ownerSolanaAddress,
    }, { status: 404 });
  }
  const wallet = walletRows[0].wallet_address as string;

  const shopResult = await sql`
    UPDATE shop_purchases SET buyer_wallet = ${wallet} WHERE nft_mint_address = ${mintAddress} RETURNING id
  `;
  const collResult = await sql`
    UPDATE user_collectibles SET wallet_address = ${wallet} WHERE nft_mint_address = ${mintAddress} RETURNING id
  `;

  return NextResponse.json({
    success: true,
    ownerSolanaAddress,
    newOwnerWallet: wallet,
    shopPurchasesUpdated: shopResult.length,
    collectiblesUpdated: collResult.length,
  });
}
