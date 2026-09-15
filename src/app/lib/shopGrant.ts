/**
 * Kostenlose Vergabe eines Shop-Items an ein bereits bekanntes Wallet — der
 * "unbezahlte" Zwilling zum Kauf-Pfad in /api/shop/purchase (Slot reservieren,
 * NFT minten, shop_purchases-Zeile schreiben), aber ohne Payment-Schritt und
 * mit frei wählbarem Empfänger statt "Käufer = eingeloggter Nutzer".
 *
 * Wird sowohl direkt (sofortige Vergabe an ein bereits registriertes Wallet)
 * als auch verzögert (claimPendingShopGiftsForEmail, sobald sich jemand mit
 * der Geschenk-E-Mail registriert) aufgerufen.
 */
import { getDb } from './db';
import { mintSongPrintEdition } from './songNft';

export interface ShopGrantResult {
  title: string;
  contentUrl: string;
  type: string;
  nftMintAddress: string | null;
  editionNumber: number | null;
}

export async function grantShopItemToWallet(itemId: string, recipientWallet: string): Promise<ShopGrantResult> {
  const sql = getDb();
  const wallet = recipientWallet.toLowerCase();

  const items = await sql`
    SELECT id, artist_wallet, title, content_url, type, is_active,
           master_edition_mint, nft_collection_mint, nft_max_supply, edition_count, is_nft_enabled,
           available_until
    FROM shop_items
    WHERE id = ${itemId}
    LIMIT 1
  `;
  if (!items.length) throw new Error('Item nicht gefunden');
  const item = items[0] as {
    id: string;
    artist_wallet: string;
    title: string;
    content_url: string;
    type: string;
    is_active: boolean;
    master_edition_mint: string | null;
    nft_collection_mint: string | null;
    nft_max_supply: number | null;
    edition_count: number;
    is_nft_enabled: boolean;
    available_until: string | null;
  };
  if (!item.is_active) throw new Error('Item ist nicht mehr aktiv');
  if (item.available_until && new Date(item.available_until).getTime() < Date.now()) {
    throw new Error('Item ist nicht mehr verfügbar');
  }

  const recipientSolRows = await sql`
    SELECT solana_address FROM solana_accounts WHERE wallet_address = ${wallet} LIMIT 1
  `;
  if (!recipientSolRows.length) throw new Error('Kein Solana-Wallet gefunden');
  const recipientSolanaAddress = recipientSolRows[0].solana_address as string;

  // Pre-Release-Videos: kein On-Chain-Mint, reiner Zugriffskauf.
  if (item.type === 'video') {
    await sql`
      INSERT INTO shop_purchases (buyer_wallet, item_id, price_credits_paid, nft_mint_address, edition_number)
      VALUES (${wallet}, ${itemId}, 0, NULL, 0)
    `;
    return { title: item.title, contentUrl: item.content_url, type: item.type, nftMintAddress: null, editionNumber: null };
  }

  if (item.is_nft_enabled && item.nft_max_supply !== null) {
    if (Number(item.edition_count) >= Number(item.nft_max_supply)) {
      throw new Error('Alle NFT-Editionen sind ausverkauft');
    }
  }

  const artistProfileRows = await sql`
    SELECT display_name FROM user_profiles WHERE wallet_address = ${item.artist_wallet} LIMIT 1
  `;
  const artistName = (artistProfileRows[0]?.display_name as string | null)?.trim() || 'D.FAITH Artist';

  const slotRows = await sql`
    UPDATE shop_items
    SET edition_count = COALESCE(edition_count, 0) + 1
    WHERE id = ${item.id}
      AND (nft_max_supply IS NULL OR COALESCE(edition_count, 0) < nft_max_supply)
    RETURNING edition_count
  `;
  if (!slotRows.length) throw new Error('Alle NFT-Editionen sind ausverkauft');
  const editionNumber = Number(slotRows[0].edition_count ?? 1);

  const artistKeyRows = await sql`
    SELECT solana_private_key, solana_address FROM solana_accounts WHERE wallet_address = ${item.artist_wallet} LIMIT 1
  `;
  if (!artistKeyRows.length) {
    await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
    throw new Error('Artist hat kein Solana-Wallet für NFT-Mint');
  }

  const songCollectionMint = item.nft_collection_mint ?? item.master_edition_mint;
  if (!songCollectionMint) {
    await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
    throw new Error('Item hat keine On-Chain-Collection für den NFT-Mint');
  }

  let nftMintAddress: string;
  try {
    const { printMint } = await mintSongPrintEdition({
      itemId: item.id,
      collectionMint: songCollectionMint,
      buyerSolanaAddress: recipientSolanaAddress,
      artistPrivateKey: artistKeyRows[0].solana_private_key as string,
      artistSolanaAddress: artistKeyRows[0].solana_address as string,
      artistName,
      title: item.title,
      maxSupply: item.nft_max_supply !== null ? Number(item.nft_max_supply) : null,
      editionNumber,
    });
    nftMintAddress = printMint;
  } catch (nftErr) {
    await sql`UPDATE shop_items SET edition_count = edition_count - 1 WHERE id = ${item.id}`;
    throw nftErr instanceof Error ? nftErr : new Error(String(nftErr));
  }

  await sql`
    INSERT INTO shop_purchases (buyer_wallet, item_id, price_credits_paid, nft_mint_address, edition_number)
    VALUES (${wallet}, ${itemId}, 0, ${nftMintAddress}, ${editionNumber})
  `;

  return { title: item.title, contentUrl: item.content_url, type: item.type, nftMintAddress, editionNumber };
}
