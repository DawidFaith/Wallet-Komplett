/**
 * GET  /api/artist/meta-partner-check?wallet=...
 *   → gibt aktuellen DB-Status + D.Faith Ecosystem Business-ID zurück
 *
 * POST /api/artist/meta-partner-check?wallet=...
 *   → prüft ob Artist-IG-Konto über Meta Business Manager als Partner verknüpft ist
 *      und setzt meta_partner_verified = true falls ja
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function getBusinessId(): Promise<string | null> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) return null;
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}?fields=business{id,name}&access_token=${token}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { business?: { id?: string } };
    return data.business?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const sql = getDb();
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS meta_partner_verified BOOLEAN DEFAULT FALSE`.catch(() => {});

  const rows = await sql`
    SELECT meta_partner_verified, instagram_handle
    FROM user_profiles
    WHERE wallet_address = ${wallet.toLowerCase()}
    LIMIT 1
  `;

  const businessId = await getBusinessId();

  return NextResponse.json({
    verified: rows[0]?.meta_partner_verified ?? false,
    instagramHandle: rows[0]?.instagram_handle ?? null,
    businessId,
  });
}

export async function POST(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  const sql = getDb();
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS meta_partner_verified BOOLEAN DEFAULT FALSE`.catch(() => {});

  const rows = await sql`
    SELECT instagram_handle FROM user_profiles
    WHERE wallet_address = ${wallet.toLowerCase()}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Kein Profil gefunden', verified: false }, { status: 404 });

  const artistHandle = (rows[0].instagram_handle as string | null)?.toLowerCase().replace(/^@/, '');
  if (!artistHandle) {
    return NextResponse.json({ error: 'Kein Instagram-Konto verknüpft', verified: false }, { status: 400 });
  }

  const token = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) {
    return NextResponse.json({ error: 'Meta API nicht konfiguriert', verified: false }, { status: 500 });
  }

  try {
    // Schritt 1: Business Manager ID ermitteln
    const businessId = await getBusinessId();
    if (!businessId) {
      return NextResponse.json({
        error: 'D.Faith Ecosystem Business-ID konnte nicht ermittelt werden',
        verified: false,
      }, { status: 500 });
    }

    // Schritt 2: Alle IG-Konten abrufen, auf die unser Business Zugriff hat (eigene + Partner)
    const igListRes = await fetch(
      `${GRAPH}/${businessId}/instagram_accounts?fields=id,username&limit=200&access_token=${token}`,
      { cache: 'no-store' },
    );
    const igListData = await igListRes.json() as {
      data?: Array<{ id: string; username: string }>;
      error?: { message: string; code?: number };
    };

    if (igListData.error) {
      return NextResponse.json({
        error: `Meta API Fehler: ${igListData.error.message}`,
        verified: false,
      }, { status: 400 });
    }

    // Schritt 3: Prüfen ob Artist-Handle in der Liste ist
    const accessibleAccounts = igListData.data ?? [];
    const isLinked = accessibleAccounts.some(
      (acc) => acc.username.toLowerCase() === artistHandle,
    );

    if (isLinked) {
      await sql`
        UPDATE user_profiles
        SET meta_partner_verified = TRUE, updated_at = NOW()
        WHERE wallet_address = ${wallet.toLowerCase()}
      `;
    }

    return NextResponse.json({
      verified: isLinked,
      businessId,
      accessibleAccounts: accessibleAccounts.length,
      hint: isLinked
        ? 'Instagram & Facebook Quests freigeschaltet!'
        : `Konto "@${artistHandle}" nicht in den Partner-Konten gefunden. Bitte verknüpfe dein Konto im Meta Business Center und versuche es erneut.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), verified: false }, { status: 500 });
  }
}
