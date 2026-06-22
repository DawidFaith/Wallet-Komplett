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
import nodemailer from 'nodemailer';

/** Sendet eine Betrugs-Warnung per E-Mail an den Admin. */
async function sendFraudAlert(walletAddress: string, solanaAddress: string): Promise<void> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.error('[claim/fraud] GMAIL_USER/GMAIL_APP_PASSWORD nicht gesetzt – keine E-Mail gesendet');
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    const now = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
    await transporter.sendMail({
      from: `"D.FAITH Security" <${gmailUser}>`,
      to: 'dawid.faith@gmail.com',
      subject: '⚠️ Betrug erkannt: ATA gelöscht & Einlösung versucht',
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:24px;background:#0a0908;color:#fff;border-radius:12px;border:1px solid #7f1d1d">
          <h2 style="margin:0 0 6px;font-size:18px;color:#fca5a5">⚠️ Betrugsversuch erkannt</h2>
          <p style="margin:0 0 20px;color:#a1a1aa;font-size:13px">D.FAITH Ecosystem – ${now}</p>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;width:120px">Account (Clerk ID)</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fca5a5;font-size:13px;font-weight:700;font-family:monospace">${walletAddress}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em">Solana Adresse</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fbbf24;font-size:13px;font-family:monospace">${solanaAddress}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em">Vorfall</td>
              <td style="padding:10px 0;color:#f87171;font-size:13px">ATA (Associated Token Account) wurde vom User gelöscht. Erneuter Einlösungsversuch erkannt und <strong>gesperrt</strong>.</td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#71717a;font-size:12px">Der Account wurde automatisch für weitere Einlösungen gesperrt.</p>
        </div>`,
    });
  } catch (err) {
    console.error('[claim/fraud] E-Mail-Versand fehlgeschlagen:', err);
  }
}

const RPC_URL     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
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

  // Solana-Adresse + ATA-Fraud-Status aus DB holen
  const sql = getDb();
  const rows = await sql`
    SELECT solana_address, ata_first_sent_at, ata_fraud_blocked
    FROM solana_accounts
    WHERE wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Kein Solana-Wallet für diesen Account gefunden. Bitte zuerst ein Solana-Wallet erstellen.' },
      { status: 404 },
    );
  }
  const ataRecord = rows[0];
  const recipientSolana = ataRecord.solana_address as string;

  // ── Betrug-Sperre: Account dauerhaft gesperrt ───────────────────────────────
  if (ataRecord.ata_fraud_blocked) {
    return NextResponse.json(
      { error: 'Das Einlösen wurde aufgrund von Betrug dauerhaft gesperrt. Bitte wende dich an den Support.' },
      { status: 403 },
    );
  }

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

  // ── ATA-Existenz on-chain prüfen (VOR dem Credit-Abzug) ────────────────────
  const treasury = getTreasuryKeypair();
  const mintPk    = new PublicKey(effectiveMint);
  const toPk      = new PublicKey(recipientSolana);
  const connection = new Connection(RPC_URL, 'confirmed');
  const toAta      = await getAssociatedTokenAddress(mintPk, toPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  let ataExists = false;
  try {
    await getAccount(connection, toAta);
    ataExists = true;
  } catch {
    // ATA existiert nicht auf der Chain
    if (ataRecord.ata_first_sent_at !== null) {
      // Wir haben ihm schon mal einen ATA gebaut → er hat ihn danach gelöscht = Betrug
      await sql`
        UPDATE solana_accounts
        SET ata_fraud_blocked = TRUE, ata_fraud_blocked_at = NOW()
        WHERE wallet_address = ${walletAddress.toLowerCase()}
      `;
      // Admin-E-Mail senden (fire & forget – kein await um Response nicht zu verzögern)
      sendFraudAlert(walletAddress, recipientSolana).catch(() => {});
      return NextResponse.json(
        { error: 'Das Einlösen wurde wegen Betrugs gesperrt. Deine Credits bleiben erhalten. Bitte wende dich an den Support.' },
        { status: 403 },
      );
    }
    // Erster Claim: ATA wird gleich erstellt — ataExists bleibt false
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
      const mintInfo = await getMint(connection, mintPk, 'confirmed', TOKEN_PROGRAM_ID);
      const decimals  = mintInfo.decimals;
      const fromAta   = await getAssociatedTokenAddress(mintPk, treasury.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      const tx = new Transaction();

      // Ziel-ATA anlegen wenn noch nicht vorhanden (nur beim ersten Claim)
      if (!ataExists) {
        tx.add(createAssociatedTokenAccountInstruction(
          treasury.publicKey, toAta, toPk, mintPk,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
      }

      const rawAmount = BigInt(Math.round(amount * 10 ** decimals));
      tx.add(createTransferInstruction(fromAta, toAta, treasury.publicKey, rawAmount, [], TOKEN_PROGRAM_ID));

      const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);

      // Nach erstem erfolgreichem ATA-Aufbau: Zeitstempel setzen
      if (!ataExists) {
        await sql`
          UPDATE solana_accounts
          SET ata_first_sent_at = COALESCE(ata_first_sent_at, NOW())
          WHERE wallet_address = ${walletAddress.toLowerCase()}
        `;
      }

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
