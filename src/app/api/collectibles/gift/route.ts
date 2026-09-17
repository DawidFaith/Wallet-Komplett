/**
 * POST /api/collectibles/gift  – Artist verschenkt ein Collectible aus einer
 *                                eigenen Kollektion kostenlos an eine E-Mail
 *                                (Body: { wallet, collectionId, rarity, email })
 * GET  /api/collectibles/gift  – Liste der bisher verschenkten Collectibles
 *                                für eine eigene Kollektion
 *                                (Query: wallet, collectionId)
 *
 * Gehört die E-Mail bereits einer registrierten Person mit Solana-Wallet,
 * wird sofort gemintet und zugestellt. Sonst bleibt der Eintrag als
 * 'pending' liegen, bis sich die Person mit genau dieser (von Clerk
 * verifizierten) E-Mail registriert oder einloggt — dann greift
 * claimPendingCollectibleGiftsForEmail über /api/collectibles/claim-gifts
 * beim Login, analog zum Shop-Gifting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { createCollectibleGift, listCollectibleGifts, cancelCollectibleGift, tryDeliverCollectibleGiftNow } from '../../../lib/questDb';
import type { CollectibleRarity } from '../../../lib/questDb/collectibles';
import { requireOwnWallet } from '../../../lib/apiAuth';
import { checkRateLimit } from '../../../lib/rateLimit';
import { resolveRegisteredWalletByEmail } from '../../../lib/resolveWalletByEmail';

export const dynamic = 'force-dynamic';

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

async function loadOwnedCollection(collectionId: string, artistWallet: string) {
  const sql = getDb();
  const rows = await sql`SELECT id, artist_wallet FROM collectible_collections WHERE id = ${collectionId} LIMIT 1`;
  if (!rows.length) return null;
  if ((rows[0].artist_wallet as string) !== artistWallet.toLowerCase()) return null;
  return rows[0];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, collectionId, rarity, email } = body as {
    wallet?: string; collectionId?: string; rarity?: string; email?: string;
  };
  if (!wallet || !collectionId || !rarity || !email) {
    return NextResponse.json({ error: 'wallet, collectionId, rarity und email erforderlich' }, { status: 400 });
  }
  if (!VALID_RARITIES.includes(rarity)) {
    return NextResponse.json({ error: 'Ungültige rarity' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
  }

  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

  const rl = await checkRateLimit(`collectible-gift:${authCheck.userId}`, 30, 60);
  if (!rl.ok) return rl.response!;

  const collection = await loadOwnedCollection(collectionId, wallet);
  if (!collection) return NextResponse.json({ error: 'Kollektion nicht gefunden oder nicht deine Kollektion' }, { status: 404 });

  const cleanEmail = email.trim().toLowerCase();
  let gift = await createCollectibleGift(collectionId, rarity as CollectibleRarity, cleanEmail);

  // Ist die Person bereits registriert (und hat ein Solana-Wallet), direkt
  // zustellen statt auf den nächsten Login zu warten.
  const existingWallet = await resolveRegisteredWalletByEmail(cleanEmail);
  if (existingWallet) {
    gift = await tryDeliverCollectibleGiftNow(gift.id, existingWallet);
  }

  return NextResponse.json({ success: true, status: gift.status, giftId: gift.id, error: gift.error ?? undefined });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  const collectionId = searchParams.get('collectionId') ?? undefined;
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

  const gifts = await listCollectibleGifts({ artistWallet: wallet.toLowerCase(), collectionId });
  return NextResponse.json(gifts);
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

  const { wallet, giftId } = body as { wallet?: string; giftId?: string };
  if (!wallet || !giftId) return NextResponse.json({ error: 'wallet und giftId erforderlich' }, { status: 400 });

  const authCheck = requireOwnWallet(wallet);
  if (!authCheck.ok) return authCheck.response;

  const cancelled = await cancelCollectibleGift(giftId, wallet.toLowerCase());
  if (!cancelled) return NextResponse.json({ error: 'Geschenk nicht gefunden oder bereits zugestellt' }, { status: 404 });
  return NextResponse.json({ success: true });
}
