/**
 * POST /api/clerk-webhook
 *
 * Clerk sendet Events hierhin (user.created, user.deleted, …).
 * Bei user.created wird sofort ein Solana-Wallet in der DB angelegt.
 *
 * Setup:
 * 1. Clerk Dashboard → Webhooks → Endpoint: https://<deine-domain>/api/clerk-webhook
 * 2. Events aktivieren: user.created
 * 3. Signing Secret in .env.local als CLERK_WEBHOOK_SECRET eintragen
 */
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getDb } from '../../lib/db';
import { encryptKey } from '../../lib/solanaCrypto';
import { upsertUserProfile } from '../../lib/questDb';

export const dynamic = 'force-dynamic';

type ClerkUserCreatedEvent = {
  type: 'user.created';
  data: {
    id: string; // Clerk User-ID — wird als wallet_address verwendet
  };
};

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Kein Secret konfiguriert → 200 zurückgeben damit Clerk nicht erneut versucht
    console.warn('[clerk-webhook] CLERK_WEBHOOK_SECRET nicht gesetzt');
    return NextResponse.json({ ok: false, reason: 'not configured' });
  }

  // Svix-Signatur verifizieren
  const svixId        = req.headers.get('svix-id')        ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp')  ?? '';
  const svixSignature = req.headers.get('svix-signature')  ?? '';

  const body = await req.text();

  let event: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json({ error: 'Ungültige Signatur' }, { status: 400 });
  }

  if (event.type !== 'user.created') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const walletAddress = event.data.id.toLowerCase();

  try {
    const sql = getDb();

    // Idempotent: schon vorhanden → nichts tun
    const existing = await sql`
      SELECT solana_address FROM solana_accounts WHERE wallet_address = ${walletAddress}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, existed: true });
    }

    // Neues Keypair generieren
    const newKp      = Keypair.generate();
    const newAddress = newKp.publicKey.toBase58();
    const secretB58  = bs58.encode(newKp.secretKey);
    const encrypted  = encryptKey(secretB58);

    await sql`
      INSERT INTO solana_accounts (wallet_address, solana_address, solana_private_key)
      VALUES (${walletAddress}, ${newAddress}, ${encrypted})
      ON CONFLICT (wallet_address) DO NOTHING
    `;

    // User-Profil anlegen
    await upsertUserProfile(walletAddress, {});

    console.log(`[clerk-webhook] Solana-Wallet erstellt für ${walletAddress}: ${newAddress}`);
    return NextResponse.json({ ok: true, solanaAddress: newAddress });
  } catch (e) {
    console.error('[clerk-webhook] Fehler:', e);
    // 500 → Clerk versucht erneut (Retry-Logik)
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
