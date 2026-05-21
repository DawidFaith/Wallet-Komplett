/**
 * GET  /api/artist/meta-partner-check?wallet=...
 *   → DB-Status für IG + FB + Business-ID
 *
 * POST /api/artist/meta-partner-check?wallet=...&type=instagram
 *   → prüft IG-Partner-Verknüpfung via /{business_id}/instagram_accounts
 *
 * POST /api/artist/meta-partner-check?wallet=...&type=facebook
 *   → prüft FB-Page-Partner-Verknüpfung via /{business_id}/pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** D.Faith Ecosystem Business Manager ID – direkt aus Env oder via Page-API */
let cachedBusinessId: string | null = null;
async function getBusinessId(): Promise<string | null> {
  // Priorität 1: direkt aus Env (zuverlässig, keine Permission nötig)
  if (process.env.META_BUSINESS_ID) return process.env.META_BUSINESS_ID;

  if (cachedBusinessId) return cachedBusinessId;
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
    const id = data.business?.id ?? null;
    if (id) cachedBusinessId = id;
    return id;
  } catch {
    return null;
  }
}

/** System-User-ID aus dem Business ermitteln (erster aktiver System-User) */
let cachedSystemUserId: string | null = null;
async function getSystemUserId(businessId: string): Promise<string | null> {
  if (cachedSystemUserId) return cachedSystemUserId;
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `${GRAPH}/${businessId}/system_users?fields=id,name&access_token=${token}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json() as { data?: Array<{ id: string; name: string }> };
    const id = data.data?.[0]?.id ?? null;
    if (id) cachedSystemUserId = id;
    return id;
  } catch {
    return null;
  }
}

/**
 * Weist ein Instagram-Konto automatisch dem System-User zu,
 * damit der System-User-Token die Posts/Comments des Artists lesen kann.
 */
async function assignIgToSystemUser(
  businessId: string,
  igAccountId: string,
): Promise<{ ok: boolean; info: string }> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return { ok: false, info: 'Kein Token' };

  const systemUserId = await getSystemUserId(businessId);
  if (!systemUserId) return { ok: false, info: 'System-User-ID nicht gefunden' };

  try {
    const res = await fetch(
      `${GRAPH}/${systemUserId}/assigned_instagram_accounts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_account_id: igAccountId,
          access: 'MANAGE',
          access_token: token,
        }),
      },
    );
    const data = await res.json() as { success?: boolean; error?: { message: string } };
    if (data.error) return { ok: false, info: data.error.message };
    return { ok: data.success === true, info: data.success ? 'Automatisch zugewiesen' : 'Zuweisung unbekannt' };
  } catch (e) {
    return { ok: false, info: String(e) };
  }
}

/**
 * Weist eine Facebook Page automatisch dem System-User zu.
 */
async function assignPageToSystemUser(
  businessId: string,
  pageId: string,
): Promise<{ ok: boolean; info: string }> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return { ok: false, info: 'Kein Token' };

  const systemUserId = await getSystemUserId(businessId);
  if (!systemUserId) return { ok: false, info: 'System-User-ID nicht gefunden' };

  try {
    const res = await fetch(
      `${GRAPH}/${systemUserId}/assigned_pages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          access: 'MODERATE',
          access_token: token,
        }),
      },
    );
    const data = await res.json() as { success?: boolean; error?: { message: string } };
    if (data.error) return { ok: false, info: data.error.message };
    return { ok: data.success === true, info: data.success ? 'Automatisch zugewiesen' : 'Zuweisung unbekannt' };
  } catch (e) {
    return { ok: false, info: String(e) };
  }
}

async function ensureColumns() {
  const sql = getDb();
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS meta_ig_partner_verified BOOLEAN DEFAULT FALSE`.catch(() => {});
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS meta_fb_partner_verified BOOLEAN DEFAULT FALSE`.catch(() => {});
  // Rückwärtskompatibilität: alte Spalte → neue IG-Spalte synchronisieren
  await sql`
    UPDATE user_profiles
    SET meta_ig_partner_verified = meta_partner_verified
    WHERE meta_partner_verified = TRUE AND meta_ig_partner_verified = FALSE
  `.catch(() => {});
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  await ensureColumns();
  const sql = getDb();

  const rows = await sql`
    SELECT
      meta_ig_partner_verified,
      meta_fb_partner_verified,
      instagram_handle,
      facebook_name,
      facebook_handle
    FROM user_profiles
    WHERE wallet_address = ${wallet.toLowerCase()}
    LIMIT 1
  `;

  const businessId = await getBusinessId();

  return NextResponse.json({
    igVerified:      rows[0]?.meta_ig_partner_verified ?? false,
    fbVerified:      rows[0]?.meta_fb_partner_verified ?? false,
    instagramHandle: rows[0]?.instagram_handle ?? null,
    facebookName:    rows[0]?.facebook_name ?? rows[0]?.facebook_handle ?? null,
    businessId,
  });
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  const type   = (req.nextUrl.searchParams.get('type') ?? 'instagram') as 'instagram' | 'facebook';
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  await ensureColumns();
  const sql = getDb();

  const rows = await sql`
    SELECT instagram_handle, facebook_name, facebook_handle
    FROM user_profiles
    WHERE wallet_address = ${wallet.toLowerCase()}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Kein Profil gefunden', verified: false }, { status: 404 });

  const token  = process.env.META_SYSTEM_USER_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) {
    return NextResponse.json({ error: 'Meta API nicht konfiguriert', verified: false }, { status: 500 });
  }

  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return NextResponse.json({
        error: 'D.Faith Ecosystem Business-ID konnte nicht ermittelt werden. Bitte sicherstellen, dass die Facebook Page einem Business Manager zugeordnet ist.',
        verified: false,
      }, { status: 500 });
    }

    // ── Instagram-Prüfung ─────────────────────────────────────────────────
    if (type === 'instagram') {
      const handle = (rows[0].instagram_handle as string | null)?.toLowerCase().replace(/^@/, '');
      if (!handle) {
        return NextResponse.json({ error: 'Kein Instagram-Konto verknüpft', verified: false }, { status: 400 });
      }

      const res = await fetch(
        `${GRAPH}/${businessId}/instagram_accounts?fields=id,username&limit=200&access_token=${token}`,
        { cache: 'no-store' },
      );
      const data = await res.json() as {
        data?: Array<{ id: string; username: string }>;
        error?: { message: string };
      };
      if (data.error) {
        return NextResponse.json({ error: `Meta API: ${data.error.message}`, verified: false }, { status: 400 });
      }

      const accounts = data.data ?? [];
      const match = accounts.find((a) => a.username.toLowerCase() === handle);
      const isLinked = !!match;

      let autoAssignInfo = '';
      if (isLinked && match) {
        // Automatisch dem System-User zuweisen – kein manueller Schritt nötig
        const assign = await assignIgToSystemUser(businessId, match.id);
        autoAssignInfo = assign.ok
          ? ' System-User-Zugriff automatisch eingerichtet.'
          : ` (System-User-Zuweisung: ${assign.info})`;
        await sql`
          UPDATE user_profiles
          SET meta_ig_partner_verified = TRUE, updated_at = NOW()
          WHERE wallet_address = ${wallet.toLowerCase()}
        `;
      }

      return NextResponse.json({
        verified: isLinked,
        businessId,
        accessibleAccounts: accounts.length,
        hint: isLinked
          ? `✅ Instagram "@${handle}" verknüpft!${autoAssignInfo}`
          : `❌ "@${handle}" nicht gefunden (${accounts.length} erreichbare Konten). Bitte die Partnerschaft im Meta Business Center prüfen.`,
      });
    }

    // ── Facebook-Page-Prüfung ─────────────────────────────────────────────
    if (type === 'facebook') {
      const fbName   = (rows[0].facebook_name   as string | null)?.toLowerCase().trim();
      const fbHandle = (rows[0].facebook_handle as string | null)?.toLowerCase().replace(/^@/, '').trim();

      if (!fbName && !fbHandle) {
        return NextResponse.json({ error: 'Kein Facebook-Konto verknüpft', verified: false }, { status: 400 });
      }

      const res = await fetch(
        `${GRAPH}/${businessId}/pages?fields=id,name,username&limit=200&access_token=${token}`,
        { cache: 'no-store' },
      );
      const data = await res.json() as {
        data?: Array<{ id: string; name: string; username?: string }>;
        error?: { message: string };
      };
      if (data.error) {
        return NextResponse.json({ error: `Meta API: ${data.error.message}`, verified: false }, { status: 400 });
      }

      const pages = data.data ?? [];
      const matchedPage = pages.find((p) => {
        const pName     = p.name?.toLowerCase().trim()     ?? '';
        const pUsername = p.username?.toLowerCase().trim() ?? '';
        return (
          (fbName   && (pName === fbName   || pUsername === fbName))   ||
          (fbHandle && (pName === fbHandle || pUsername === fbHandle))
        );
      });
      const isLinked = !!matchedPage;

      let autoAssignInfo = '';
      if (isLinked && matchedPage) {
        // Automatisch dem System-User zuweisen
        const assign = await assignPageToSystemUser(businessId, matchedPage.id);
        autoAssignInfo = assign.ok
          ? ' System-User-Zugriff automatisch eingerichtet.'
          : ` (System-User-Zuweisung: ${assign.info})`;
        await sql`
          UPDATE user_profiles
          SET meta_fb_partner_verified = TRUE, updated_at = NOW()
          WHERE wallet_address = ${wallet.toLowerCase()}
        `;
      }

      const displayName = fbName ?? fbHandle ?? '';
      return NextResponse.json({
        verified: isLinked,
        businessId,
        accessiblePages: pages.length,
        hint: isLinked
          ? `✅ Facebook-Page "${displayName}" verknüpft!${autoAssignInfo}`
          : `❌ "${displayName}" nicht gefunden (${pages.length} erreichbare Pages). Bitte die Partnerschaft im Meta Business Center prüfen.`,
      });
    }

    return NextResponse.json({ error: 'Unbekannter type-Parameter', verified: false }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err), verified: false }, { status: 500 });
  }
}
