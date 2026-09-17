/**
 * POST /api/solana/send-nft
 * Body: { walletAddress: string, toAddress: string, mintAddress: string }
 *
 * Überträgt ein mpl-core NFT (Song-Edition oder Collectible) aus dem
 * custodial User-Wallet an eine andere Solana-Adresse.
 *
 * Wichtig: mpl-core-Assets sind KEINE SPL-Token — sie haben keine Decimals,
 * keine Associated Token Accounts und laufen nicht über den Token Program.
 * /api/solana/send-token (getMint/ATA/TOKEN_PROGRAM_ID) funktioniert daher
 * für sie nicht und bricht mit einem ungefangenen Fehler ab (leere Antwort
 * → "Unexpected end of JSON input" beim Client). Dieser Endpoint nutzt
 * stattdessen den generischen mpl-core transfer() (wie transferSongPrintEdition,
 * die Collection wird automatisch aus der Update Authority des Assets
 * abgeleitet — funktioniert unabhängig davon, ob es ein Song- oder
 * Collectible-Asset ist).
 */
import { NextResponse } from 'next/server';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '@/app/lib/db';
import { decryptKey } from '@/app/lib/solanaCrypto';
import { requireOwnWallet } from '@/app/lib/apiAuth';
import { checkRateLimit } from '@/app/lib/rateLimit';
import { transferSongPrintEdition } from '@/app/lib/songNft';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { walletAddress, toAddress, mintAddress } = body as {
      walletAddress?: string; toAddress?: string; mintAddress?: string;
    };

    if (!walletAddress || !toAddress || !mintAddress) {
      return NextResponse.json({ error: 'walletAddress, toAddress und mintAddress benötigt' }, { status: 400 });
    }

    const authCheck = requireOwnWallet(walletAddress);
    if (!authCheck.ok) return authCheck.response;

    const rl = await checkRateLimit(`send-nft:${authCheck.userId}`, 10, 60);
    if (!rl.ok) return rl.response!;

    try { new PublicKey(toAddress); } catch {
      return NextResponse.json({ error: 'Ungültige Ziel-Adresse' }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT solana_private_key FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Kein Solana-Account gefunden' }, { status: 404 });

    const ownerKeypair = Keypair.fromSecretKey(bs58.decode(decryptKey(rows[0].solana_private_key as string)));

    await transferSongPrintEdition({
      mintAddress,
      ownerKeypair,
      recipientAddress: toAddress,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('send-nft Fehler:', msg);
    return NextResponse.json({ error: `NFT-Transfer fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
