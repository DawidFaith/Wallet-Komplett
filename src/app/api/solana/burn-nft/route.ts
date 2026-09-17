/**
 * POST /api/solana/burn-nft
 * Body: { walletAddress, mintAddress }
 *
 * Verbrennt eine Print Edition NFT (mpl-token-metadata NonFungible).
 * Holder zahlt Gebühren und ist Authority.
 * Wenn kein DB-Eintrag: master_edition_mint aus On-Chain-Daten lesen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  burnV1,
  mintV1,
  fetchDigitalAsset,
  TokenStandard,
  findEditionMarkerPda,
  findMasterEditionPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { mplCore, burn as coreBurn, fetchAssetV1, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import {
  keypairIdentity,
  publicKey as umiPubkey,
  unwrapOption,
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
import { requireOwnWallet } from '../../../lib/apiAuth';
import { checkRateLimit } from '../../../lib/rateLimit';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const dynamic = 'force-dynamic';

/** Liest master_edition_mint + edition_number aus dem On-Chain Print Edition Account */
async function resolveMasterMintFromChain(
  umi: ReturnType<typeof createUmi>,
  sql: ReturnType<typeof import('../../../lib/db').getDb>,
  printMint: string,
): Promise<{ masterMint: string; editionNumber: number } | null> {
  try {
    // Print Edition PDA (gleiche Ableitung wie Master Edition PDA, aber vom Print Mint)
    const printEditionPda = findMasterEditionPda(umi, { mint: umiPubkey(printMint) });
    const acct = await umi.rpc.getAccount(printEditionPda[0]);
    if (!acct.exists) return null;

    const data = acct.data as Uint8Array;
    if (data.length < 41) return null;

    // Layout: 1 byte key + 32 bytes parent (master edition PDA) + 8 bytes edition number
    const parentPdaBytes = data.slice(1, 33);
    const parentPdaB58   = bs58.encode(parentPdaBytes);
    const editionNumber  = Number(
      new DataView(data.buffer, data.byteOffset + 33, 8).getBigUint64(0, true),
    );

    // Alle shop_items mit master_edition_mint durchgehen und PDA vergleichen
    const items = await sql`SELECT master_edition_mint FROM shop_items WHERE master_edition_mint IS NOT NULL`;
    for (const item of items) {
      const masterPda = findMasterEditionPda(umi, { mint: umiPubkey(item.master_edition_mint as string) });
      if (String(masterPda[0]) === parentPdaB58) {
        return { masterMint: item.master_edition_mint as string, editionNumber };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, mintAddress } = await req.json();
    if (!walletAddress || !mintAddress) {
      return NextResponse.json({ error: 'walletAddress und mintAddress erforderlich' }, { status: 400 });
    }

    const authCheck = requireOwnWallet(walletAddress);
    if (!authCheck.ok) return authCheck.response;

    const rl = await checkRateLimit(`burn-nft:${authCheck.userId}`, 10, 60);
    if (!rl.ok) return rl.response!;

    // Kompressierte NFTs (Bubblegum/Merkle-Tree) haben KEIN eigenes on-chain
    // Konto unter ihrer DAS-"id" — jeder Versuch, sie als mpl-core-Asset oder
    // klassisches SPL-Mint zu lesen, scheitert daher zwangsläufig mit einem
    // irreführenden "Account not found". Das früh erkennen und ehrlich
    // melden, statt beide (garantiert erfolglosen) Burn-Pfade durchzuprobieren.
    const preCheckConn = new Connection(RPC_URL, 'confirmed');
    const mintAccountInfo = await preCheckConn.getAccountInfo(new PublicKey(mintAddress)).catch(() => null);
    if (!mintAccountInfo) {
      return NextResponse.json({
        error: 'Dieses NFT ist vermutlich ein "compressed NFT" (kompaktes Solana-Format ohne eigenes Konto) — das Verbrennen davon wird aktuell nicht unterstützt.',
        code: 'possibly_compressed',
      }, { status: 400 });
    }

    const sql = getDb();

    const rows = await sql`
      SELECT solana_private_key FROM solana_accounts
      WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Kein Solana-Wallet gefunden' }, { status: 404 });
    }
    const secretB58 = decryptKey(rows[0].solana_private_key as string);
    const holderKp  = Keypair.fromSecretKey(bs58.decode(secretB58));

    const holderUmi = createUmi(RPC_URL)
      .use(mplTokenMetadata())
      .use(keypairIdentity(fromWeb3JsKeypair(holderKp)));

    // 0. mpl-core Asset (Song-Editionen seit 13.07.2026, Collectibles, aber
    //    auch fremde mpl-core-NFTs anderer Projekte)? → Core-Burn, Holder
    //    bekommt das Rent-SOL zurück.
    //
    //    Wichtig: Erkennung (fetchAssetV1) und Burn-Ausführung sind bewusst
    //    getrennt. Schlägt NUR die Erkennung fehl, ist es tatsächlich kein
    //    mpl-core-Asset → weiter zum Token-Metadata-Pfad. Schlägt aber der
    //    Burn selbst fehl (z.B. ein Plugin verbietet ihn), darf das NICHT
    //    stillschweigend in den Token-Metadata-Pfad durchfallen — dort gibt
    //    es unter derselben Adresse gar kein SPL-Mint-Konto, was nur zu
    //    einem irreführenden "[Mint] was not found"-Fehler führt statt zum
    //    eigentlichen Burn-Fehler.
    const coreUmi = createUmi(RPC_URL, 'confirmed')
      .use(mplCore())
      .use(keypairIdentity(fromWeb3JsKeypair(holderKp)));
    let coreAsset: Awaited<ReturnType<typeof fetchAssetV1>> | null = null;
    try {
      coreAsset = await fetchAssetV1(coreUmi, umiPubkey(mintAddress));
    } catch {
      coreAsset = null; // tatsächlich kein mpl-core Asset
    }
    if (coreAsset) {
      const collection = coreAsset.updateAuthority.type === 'Collection' && coreAsset.updateAuthority.address
        ? await fetchCollectionV1(coreUmi, coreAsset.updateAuthority.address)
        : undefined;
      await coreBurn(coreUmi, { asset: coreAsset, collection }).sendAndConfirm(coreUmi);
      return NextResponse.json({ success: true });
    }

    // 1. Versuche master_edition_mint aus DB zu holen
    let masterMint: string | null = null;
    let editionNumber = 1;

    const purchaseRows = await sql`
      SELECT sp.edition_number, si.master_edition_mint
      FROM shop_purchases sp
      JOIN shop_items si ON si.id = sp.item_id
      WHERE sp.nft_mint_address = ${mintAddress}
        AND si.master_edition_mint IS NOT NULL
      LIMIT 1
    `;

    if (purchaseRows.length) {
      masterMint    = purchaseRows[0].master_edition_mint as string;
      editionNumber = Number(purchaseRows[0].edition_number ?? 1);
    } else {
      // 2. Fallback: On-Chain Print Edition Account lesen
      const resolved = await resolveMasterMintFromChain(holderUmi, sql, mintAddress);
      if (resolved) {
        masterMint    = resolved.masterMint;
        editionNumber = resolved.editionNumber;
      }
    }

    if (masterMint) {
      const treasury    = getTreasuryKeypair();
      const conn        = new Connection(RPC_URL, 'confirmed');
      const masterMintPk = new PublicKey(masterMint);
      const treasuryPk   = new PublicKey(treasury.publicKey.toBytes());
      const treasuryAta  = await getAssociatedTokenAddress(
        masterMintPk, treasuryPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

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
      // Kein Master gefunden → generischer Burn (z.B. fremde/gekaufte NFTs).
      // Echten Token-Standard on-chain lesen statt NonFungible zu raten —
      // sonst schlägt der Burn bei Programmable NFTs (pNFT, heute bei vielen
      // Marktplatz-Collections Standard) fehl: burnV1 löst das nötige
      // tokenRecord-Konto nur automatisch auf, wenn tokenStandard explizit
      // als ProgrammableNonFungible übergeben wird.
      const digitalAsset  = await fetchDigitalAsset(holderUmi, umiPubkey(mintAddress));
      const tokenStandard = unwrapOption(digitalAsset.metadata.tokenStandard) ?? TokenStandard.NonFungible;
      await burnV1(holderUmi, {
        mint:          umiPubkey(mintAddress),
        authority:     holderUmi.identity,
        tokenOwner:    holderUmi.identity.publicKey,
        tokenStandard,
      }).sendAndConfirm(holderUmi);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Burn NFT Fehler:', msg);
    return NextResponse.json({ error: `NFT konnte nicht verbrannt werden: ${msg}` }, { status: 500 });
  }
}
