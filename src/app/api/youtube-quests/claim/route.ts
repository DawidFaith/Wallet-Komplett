import { NextRequest, NextResponse } from 'next/server';
import {
  Connection, PublicKey, Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferInstruction, getAccount, getMint,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  getDfaithCredits,
  redeemDfaithCredits,
  addDfaithCredits,
  startClaimLock,
  endClaimLock,
} from '@/app/lib/questDb';
import { getTreasuryKeypair } from '@/app/lib/solanaOperator';
import { getDb } from '@/app/lib/db';

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DFAITH_MINT = process.env.NEXT_PUBLIC_SOLANA_DFAITH_TOKEN ?? '';

// POST: Credits einlösen → echte SPL-Token senden (Solana)
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; amount?: number; creatorWallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { walletAddress, amount, creatorWallet } = body;
  if (!walletAddress || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'walletAddress und amount sind erforderlich' },
      { status: 400 },
    );
  }

  // Solana-Adresse des Nutzers aus custodial Wallet-DB holen
  const sql = getDb();
  const rows = await sql`
    SELECT solana_address FROM solana_accounts WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Kein Solana-Wallet für diesen Account gefunden. Bitte zuerst ein Solana-Wallet erstellen.' },
      { status: 404 },
    );
  }
  const recipientSolana = rows[0].solana_address as string;

  // Token-Mint bestimmen: Artist-spezifischer Token oder Standard D.FAITH
  let effectiveMint = DFAITH_MINT;
  if (creatorWallet) {
    const mintRows = await sql`
      SELECT token_mint_address FROM user_profiles WHERE wallet_address = ${creatorWallet.toLowerCase()} LIMIT 1
    `;
    if (mintRows.length > 0 && mintRows[0].token_mint_address) {
      effectiveMint = mintRows[0].token_mint_address as string;
    }
  }
  if (!effectiveMint) {
    return NextResponse.json(
      { error: 'Token nicht konfiguriert für diese Auszahlung' },
      { status: 500 },
    );
  }

  // Schnelle Guthaben-Prüfung (vor dem Lock)
  const currentBalance = await getDfaithCredits(walletAddress);
  if (currentBalance < amount) {
    return NextResponse.json(
      { error: `Nicht genug D.FAITH Credits. Verfügbar: ${currentBalance}` },
      { status: 400 },
    );
  }

  // Claim-Sperre setzen – verhindert Doppeleinlösungen
  const locked = await startClaimLock(walletAddress);
  if (!locked) {
    return NextResponse.json(
      { error: 'Eine Einlösung für diesen Account läuft bereits. Bitte warte kurz.' },
      { status: 409 },
    );
  }

  try {
    // Credits atomisch abziehen
    try {
      await redeemDfaithCredits(walletAddress, amount);
    } catch {
      return NextResponse.json(
        { error: 'Nicht genug D.FAITH Credits.' },
        { status: 400 },
      );
    }

    // Echten Token-Transfer via Treasury Wallet senden
    try {
      const treasury = getTreasuryKeypair();
      const mintPk   = new PublicKey(effectiveMint);
      const toPk     = new PublicKey(recipientSolana);
      const connection = new Connection(RPC_URL, 'confirmed');

      const mintInfo = await getMint(connection, mintPk, 'confirmed', TOKEN_PROGRAM_ID);
      const decimals = mintInfo.decimals;

      const fromAta = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const toAta   = await getAssociatedTokenAddress(mintPk, toPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      const tx = new Transaction();

      // Ziel-ATA anlegen wenn noch nicht vorhanden
      try {
        await getAccount(connection, toAta);
      } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          treasury.publicKey, toAta, toPk, mintPk,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
      }

      const rawAmount = BigInt(Math.round(amount * 10 ** decimals));
      tx.add(createTransferInstruction(fromAta, toAta, treasury.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

      const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
      return NextResponse.json({
        success: true,
        signature: sig,
        sentAmount: amount,
        explorerUrl: `https://solscan.io/tx/${sig}`,
      });
    } catch (e: unknown) {
      // Credits wiederherstellen wenn Transfer fehlschlägt
      await addDfaithCredits(walletAddress, amount);
      console.error('[claim POST] Transfer fehlgeschlagen:', e);
      return NextResponse.json(
        { error: 'Token-Transfer fehlgeschlagen. Deine Credits wurden zurückgegeben.' },
        { status: 500 },
      );
    }
  } finally {
    await endClaimLock(walletAddress);
  }
}
