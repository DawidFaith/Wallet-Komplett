/**
 * POST /api/admin/platform-setup?account=ecosystem|polska
 *
 * Richtet einen Platform-Account ein (siehe lib/platformAccounts.ts):
 *   - Legt user_profiles-Eintrag mit der virtuellen Wallet des Accounts an
 *   - Setzt is_artist = true, instagram_verified = true, facebook_verified = true,
 *     (bei Accounts mit TikTok-Handle) tiktok_verified = true
 *   - Testet META_SYSTEM_USER_TOKEN gegen die jeweilige Facebook-Page
 *
 * PATCH /api/admin/platform-setup?account=ecosystem|polska
 *   - Aktualisiert das Profilbild des Platform-Kontos
 *   - Body: multipart/form-data mit Feld "image" (Datei)
 *
 * Ohne ?account= wird weiterhin 'ecosystem' angenommen (Rückwärtskompatibilität).
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getDb } from '../../../lib/db';
import { getIgAccountId, getPageTokenByPageId } from '../../../lib/metaApi';
import { getPlatformAccount } from '../../../lib/platformAccounts';

const GRAPH = 'https://graph.facebook.com/v21.0';

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  return !!expected && secret === expected;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const account = getPlatformAccount(req.nextUrl.searchParams.get('account'));
  if (!account.facebookPageId) {
    return NextResponse.json({ error: `Keine Facebook-Page-ID für Account "${account.key}" konfiguriert` }, { status: 500 });
  }

  try {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    const pageId = account.facebookPageId;

    // ── Meta API testen ────────────────────────────────────────────────────────
    let metaStatus: Record<string, unknown> = { ok: false };
    if (token && pageId) {
      try {
        const pageToken = await getPageTokenByPageId(pageId);
        const res = await fetch(
          `${GRAPH}/${pageId}?fields=name,instagram_business_account{id,username}&access_token=${pageToken ?? token}`,
          { cache: 'no-store' },
        );
        const data = await res.json() as Record<string, unknown>;
        metaStatus = { ok: res.ok, page: data };
      } catch (e) {
        metaStatus = { ok: false, error: String(e) };
      }
    } else {
      metaStatus = { ok: false, error: 'META_SYSTEM_USER_TOKEN oder Facebook-Page-ID fehlt' };
    }

    // ── IG-Account-ID ermitteln ────────────────────────────────────────────────
    const igAccountId = await getIgAccountId(pageId);

    // ── user_profiles upsert ───────────────────────────────────────────────────
    const sql = getDb();
    try {
      await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT`;
      await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_platform_user BOOLEAN DEFAULT FALSE`;
    } catch { /* ignorieren falls Spalten schon existieren */ }

    const hasTiktok = !!account.tiktokHandle;

    await sql`
      INSERT INTO user_profiles (
        wallet_address,
        is_artist,
        is_platform_user,
        display_name,
        instagram_handle,
        instagram_verified,
        instagram_name,
        facebook_handle,
        facebook_verified,
        facebook_name,
        tiktok_handle,
        tiktok_verified,
        tiktok_name,
        reward_token,
        updated_at
      ) VALUES (
        ${account.wallet},
        TRUE,
        TRUE,
        ${account.displayName},
        ${account.handle},
        TRUE,
        ${account.displayName},
        ${account.handle},
        TRUE,
        ${account.displayName},
        ${hasTiktok ? account.tiktokHandle : null},
        ${hasTiktok},
        ${hasTiktok ? account.displayName : null},
        'D.FAITH',
        NOW()
      )
      ON CONFLICT (wallet_address) DO UPDATE SET
        is_artist          = TRUE,
        is_platform_user   = TRUE,
        display_name       = ${account.displayName},
        instagram_handle   = ${account.handle},
        instagram_verified = TRUE,
        instagram_name     = ${account.displayName},
        facebook_handle    = ${account.handle},
        facebook_verified  = TRUE,
        facebook_name      = ${account.displayName},
        tiktok_handle      = ${hasTiktok ? account.tiktokHandle : null},
        tiktok_verified    = ${hasTiktok},
        tiktok_name        = ${hasTiktok ? account.displayName : null},
        reward_token       = 'D.FAITH',
        updated_at         = NOW()
    `;

    // ── Profil laden zur Bestätigung ───────────────────────────────────────────
    const rows = await sql`SELECT * FROM user_profiles WHERE wallet_address = ${account.wallet} LIMIT 1`;

    return NextResponse.json({
      success: true,
      account: account.key,
      platformWallet: account.wallet,
      igAccountId,
      metaStatus,
      profile: rows[0] ?? null,
    });
  } catch (err) {
    console.error('[platform-setup POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: Aktuellen Status des Platform-Users abfragen
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const account = getPlatformAccount(req.nextUrl.searchParams.get('account'));

  const sql = getDb();
  const rows = await sql`SELECT * FROM user_profiles WHERE wallet_address = ${account.wallet} LIMIT 1`;

  const igAccountId = account.facebookPageId ? await getIgAccountId(account.facebookPageId) : null;

  // Meta API Token-Status
  let tokenOk = false;
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (token && account.facebookPageId) {
    try {
      const pageToken = await getPageTokenByPageId(account.facebookPageId);
      const res = await fetch(`${GRAPH}/${account.facebookPageId}?fields=name&access_token=${pageToken ?? token}`, { cache: 'no-store' });
      tokenOk = res.ok;
    } catch { tokenOk = false; }
  }

  return NextResponse.json({
    account: account.key,
    exists: rows.length > 0,
    profile: rows[0] ?? null,
    igAccountId,
    metaTokenOk: tokenOk,
  });
}

// PATCH: Profilbild des Platform-Kontos hochladen
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const account = getPlatformAccount(req.nextUrl.searchParams.get('account'));

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Kein Bild übermittelt' }, { status: 400 });
    }

    const mimeType = file.type || 'image/png';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
      return NextResponse.json({ error: 'Ungültiges Bildformat (nur JPEG, PNG, WebP, GIF)' }, { status: 400 });
    }

    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `platform/${account.key}-avatar.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mimeType,
    });

    const sql = getDb();
    await sql`
      UPDATE user_profiles
      SET
        instagram_picture = ${blob.url},
        clerk_image_url   = ${blob.url},
        updated_at        = NOW()
      WHERE wallet_address = ${account.wallet}
    `;

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error('[platform-setup PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
