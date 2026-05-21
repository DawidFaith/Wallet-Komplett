/**
 * GET    /api/instagram-quests/available-media?wallet=...  → Posts des Artists (via Meta Business Partner)
 *        /api/instagram-quests/available-media             → D.Faith-Platform Posts (Fallback)
 * POST   /api/instagram-quests/available-media  → Erzwingt DB-Aktualisierung aus Meta API
 * DELETE /api/instagram-quests/available-media?shortcode=xxx → Video aus DB entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { fetchPlatformIgMedia } from '../../../lib/metaApi';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase();

  // ── Artist-spezifisch: IG-Posts über Meta Business Partner laden ──────────
  if (wallet) {
    const sql = getDb();
    try {
      const rows = await sql`
        SELECT instagram_handle FROM user_profiles
        WHERE wallet_address = ${wallet} LIMIT 1
      `;
      const handle = (rows[0]?.instagram_handle as string | null)?.toLowerCase().replace(/^@/, '');

      const token = process.env.META_SYSTEM_USER_TOKEN;
      const bizId = process.env.META_BUSINESS_ID;

      if (handle && token && bizId) {
        // Artist's IG-Konto via client_pages finden
        const pagesRes = await fetch(
          `${GRAPH}/${bizId}/client_pages?fields=id,name,instagram_business_account{id,username}&limit=200&access_token=${token}`,
          { cache: 'no-store' },
        );
        const pagesData = await pagesRes.json() as {
          data?: Array<{ id: string; name: string; instagram_business_account?: { id: string; username: string } }>;
        };
        const page = pagesData.data?.find(
          (p) => p.instagram_business_account?.username?.toLowerCase() === handle,
        );

        if (page?.instagram_business_account?.id) {
          const igId = page.instagram_business_account.id;
          const mediaRes = await fetch(
            `${GRAPH}/${igId}/media?fields=id,shortcode,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,media_type,media_product_type&limit=20&access_token=${token}`,
            { cache: 'no-store' },
          );
          const mediaData = await mediaRes.json() as { data?: Array<Record<string, unknown>>; error?: { message: string } };
          if (!mediaData.error && mediaData.data && mediaData.data.length > 0) {
            const media = mediaData.data.map((item) => ({
              shortcode: String(item.shortcode ?? item.id ?? ''),
              graph_media_id: String(item.id ?? ''),
              caption: String(item.caption ?? ''),
              media_url: String(item.media_url ?? ''),
              thumbnail_url: String(item.thumbnail_url ?? item.media_url ?? ''),
              permalink: String(item.permalink ?? ''),
              posted_at: item.timestamp ?? null,
              media_type: String(item.media_type ?? ''),
              media_product_type: String(item.media_product_type ?? ''),
              like_count: Number(item.like_count ?? 0),
              comments_count: Number(item.comments_count ?? 0),
            }));
            return NextResponse.json({ media, source: 'artist_meta_api' });
          }
          // IG-Konto gefunden aber noch keine Posts oder Fehler
          if (page?.instagram_business_account?.id) {
            return NextResponse.json({ media: [], source: 'artist_meta_api', hint: 'Kein Inhalt auf dem Artist-Konto gefunden.' });
          }
        }
        // Artist hat noch keine Partnerschaft → leere Liste + Hinweis
        return NextResponse.json({
          media: [],
          source: 'no_partner',
          hint: 'Bitte zuerst die Instagram Partnerschaft im Profil aktivieren (Meta Business Partner).',
        });
      }
    } catch { /* Fehler ignorieren, weiter mit D.Faith Fallback */ }
  }

  // ── Fallback: D.Faith-Platform Posts ─────────────────────────────────────
  const sql = getDb();

  // Live-Daten direkt von Meta Graph API holen
  const liveItems = await fetchPlatformIgMedia(20);

  if (liveItems.length > 0) {
    // DB-Einträge aktualisieren (upsert)
    try {
      for (const item of liveItems) {
        await sql`
          INSERT INTO instagram_available_media
            (shortcode, graph_media_id, caption, thumbnail_url, media_url, permalink, posted_at, saved_at, media_type, like_count, comments_count)
          VALUES (
            ${item.shortcode},
            ${item.id},
            ${item.caption},
            ${item.thumbnail_url || item.media_url},
            ${item.media_url},
            ${item.permalink},
            ${item.timestamp || null},
            NOW(),
            ${item.media_type},
            ${item.like_count},
            ${item.comments_count}
          )
          ON CONFLICT (shortcode) DO UPDATE SET
            graph_media_id   = EXCLUDED.graph_media_id,
            caption          = EXCLUDED.caption,
            thumbnail_url    = EXCLUDED.thumbnail_url,
            media_url        = EXCLUDED.media_url,
            permalink        = EXCLUDED.permalink,
            posted_at        = EXCLUDED.posted_at,
            saved_at         = NOW(),
            media_type       = EXCLUDED.media_type,
            like_count       = EXCLUDED.like_count,
            comments_count   = EXCLUDED.comments_count
        `;
      }
    } catch { /* DB-Fehler ignorieren – Live-Daten trotzdem zurückgeben */ }

    const media = liveItems.map((item) => ({
      shortcode: item.shortcode,
      graph_media_id: item.id,
      caption: item.caption,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url || item.media_url,
      permalink: item.permalink,
      posted_at: item.timestamp,
      media_type: item.media_type,
      media_product_type: item.media_product_type,
      like_count: item.like_count,
      comments_count: item.comments_count,
    }));
    return NextResponse.json({ media, source: 'meta_api' });
  }

  // Fallback: DB
  try {
    const rows = await sql`
      SELECT shortcode, graph_media_id, caption, thumbnail_url, media_url, permalink, posted_at, saved_at, media_type, like_count, comments_count
      FROM instagram_available_media
      ORDER BY posted_at DESC NULLS LAST, saved_at DESC
    `;
    return NextResponse.json({ media: rows, source: 'db' });
  } catch {
    return NextResponse.json({ media: [], source: 'empty' });
  }
}

// Erzwingt Aktualisierung der DB aus Meta API
export async function POST() {
  const liveItems = await fetchPlatformIgMedia(20);
  if (liveItems.length === 0) {
    return NextResponse.json({ error: 'Meta API lieferte keine Daten' }, { status: 502 });
  }

  const sql = getDb();
  for (const item of liveItems) {
    await sql`
      INSERT INTO instagram_available_media
        (shortcode, graph_media_id, caption, thumbnail_url, media_url, permalink, posted_at, saved_at, media_type, like_count, comments_count)
      VALUES (
        ${item.shortcode},
        ${item.id},
        ${item.caption},
        ${item.thumbnail_url || item.media_url},
        ${item.media_url},
        ${item.permalink},
        ${item.timestamp || null},
        NOW(),
        ${item.media_type},
        ${item.like_count},
        ${item.comments_count}
      )
      ON CONFLICT (shortcode) DO UPDATE SET
        graph_media_id   = EXCLUDED.graph_media_id,
        caption          = EXCLUDED.caption,
        thumbnail_url    = EXCLUDED.thumbnail_url,
        media_url        = EXCLUDED.media_url,
        permalink        = EXCLUDED.permalink,
        posted_at        = EXCLUDED.posted_at,
        saved_at         = NOW(),
        media_type       = EXCLUDED.media_type,
        like_count       = EXCLUDED.like_count,
        comments_count   = EXCLUDED.comments_count
    `;
  }

  return NextResponse.json({ success: true, count: liveItems.length });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shortcode = searchParams.get('shortcode');

  if (!shortcode) {
    return NextResponse.json({ error: 'shortcode Parameter fehlt' }, { status: 400 });
  }

  const sql = getDb();
  try {
    await sql`DELETE FROM instagram_available_media WHERE shortcode = ${shortcode}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

