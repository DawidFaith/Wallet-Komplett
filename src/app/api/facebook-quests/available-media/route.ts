/**
 * GET /api/facebook-quests/available-media?wallet=...
 *   → Posts der Artist-Facebook-Page (via Meta Business Partner)
 * GET /api/facebook-quests/available-media
 *   → D.Faith-Platform Posts (Fallback via Make.com / DB)
 *
 * DELETE /api/facebook-quests/available-media?postId=xxx
 *   → Video aus DB entfernen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getPageTokenByPageId } from '../../../lib/metaApi';

const GRAPH = 'https://graph.facebook.com/v21.0';

interface MakeFacebookVideoItem {
  id?: string;                  // Facebook Graph API Post-/Video-ID
  post_id?: string;
  video_id?: string;
  permalink_url?: string;
  permalink?: string;
  message?: string;             // Posttext
  description?: string;
  caption?: string;
  source?: string;              // direkter Video-URL
  picture?: string;             // Thumbnail
  thumbnail_url?: string;
  full_picture?: string;
  created_time?: string;
  updated_time?: string;
  likes_count?: string | number;
  comments_count?: string | number;
  shares_count?: string | number;
  type?: string;                // 'video' | 'photo' | etc
  media_type?: string;
  status_type?: string;
  is_published?: boolean;
}

// Top-Level-Objekte aus Make.com Aggregator-Format extrahieren
// (gleiches Pattern wie bei Instagram available-media)
function extractTopLevelObjects(text: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = -1;
  let captureDepth = -1;
  let inString = false;
  let escape = false;
  let outerOpened = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      if (!outerOpened) {
        outerOpened = true;
        depth++;
        continue;
      }
      if (start === -1 && ch === '{') {
        start = i;
        captureDepth = depth;
      }
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (start !== -1 && depth === captureDepth) {
        result.push(text.slice(start, i + 1));
        start = -1;
        captureDepth = -1;
      }
    }
  }
  return result;
}

async function fetchFromMake(): Promise<MakeFacebookVideoItem[] | null> {
  const webhookUrl = process.env.MAKE_FACEBOOK_VIDEO_WEBHOOK_URL;
  if (!webhookUrl) return null;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20000),
    });

    const text = await res.text();
    if (!text || !text.trim()) return null;

    // Versuche normales JSON-Parse
    try {
      const data = JSON.parse(text);
      const arr = data?.metrics ?? data?.media ?? data?.data ?? data;
      if (Array.isArray(arr)) return arr;
    } catch { /* weiter zu Regex-Fallback */ }

    // Regex-Fallback für Make.com Array-Aggregator-Format
    const items: MakeFacebookVideoItem[] = [];
    const matches = extractTopLevelObjects(text);
    for (const m of matches) {
      try {
        const parsed = JSON.parse(m);
        if (parsed && (parsed.id || parsed.post_id || parsed.video_id || parsed.permalink_url || parsed.permalink)) {
          items.push(parsed);
        }
      } catch { /* überspringen */ }
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase();

  // ── Artist-spezifisch: Posts der Artist-Facebook-Page ────────────────────
  if (wallet) {
    const sql = getDb();
    try {
      const rows = await sql`
        SELECT facebook_handle, facebook_name FROM user_profiles
        WHERE wallet_address = ${wallet} LIMIT 1
      `;
      const fbName   = (rows[0]?.facebook_name   as string | null)?.toLowerCase().trim();
      const fbHandle = (rows[0]?.facebook_handle as string | null)?.toLowerCase().replace(/^@/, '').trim();

      const token = process.env.META_SYSTEM_USER_TOKEN;
      const bizId = process.env.META_BUSINESS_ID;

      if (token && bizId && (fbName || fbHandle)) {
        const pagesRes = await fetch(
          `${GRAPH}/${bizId}/client_pages?fields=id,name,username&limit=200&access_token=${token}`,
          { cache: 'no-store' },
        );
        const pagesData = await pagesRes.json() as {
          data?: Array<{ id: string; name: string; username?: string }>;
        };
        const matchedPage = pagesData.data?.find((p) => {
          const pName     = p.name?.toLowerCase().trim()     ?? '';
          const pUsername = p.username?.toLowerCase().trim() ?? '';
          return (
            (fbName   && (pName === fbName   || pUsername === fbName))   ||
            (fbHandle && (pName === fbHandle || pUsername === fbHandle))
          );
        });

        if (matchedPage) {
          // Page Access Token über zentrale Funktion holen (alle Künstler sind Business Partner)
          const pageToken = (await getPageTokenByPageId(matchedPage.id)) ?? token;

          const postsRes = await fetch(
            `${GRAPH}/${matchedPage.id}/posts?fields=id,message,permalink_url,created_time,full_picture&limit=20&access_token=${pageToken}`,
            { cache: 'no-store' },
          );
          const postsData = await postsRes.json() as {
            data?: Array<Record<string, unknown>>;
            error?: { message: string };
          };
          if (!postsData.error && postsData.data && postsData.data.length > 0) {
            const media = postsData.data.map((post) => ({
              post_id:        String(post.id             ?? ''),
              video_id:       '',
              permalink:      String(post.permalink_url  ?? ''),
              caption:        String(post.message        ?? ''),
              thumbnail_url:  String(post.full_picture   ?? ''),
              video_url:      '',
              posted_at:      post.created_time ?? null,
              media_type:     'post',
              status_type:    '',
              like_count:     0,
              comments_count: 0,
              shares_count:   0,
            }));
            return NextResponse.json({ media, source: 'artist_meta_api' });
          }
        }
        // Artist hat noch keine Partnerschaft → leere Liste + Hinweis
        return NextResponse.json({
          media: [],
          source: 'no_partner',
          hint: 'Bitte zuerst die Facebook Partnerschaft im Profil aktivieren (Meta Business Partner).',
        });
      }
    } catch { /* Fehler ignorieren, weiter mit D.Faith Fallback */ }
  }

  // ── Fallback: D.Faith-Platform Posts (Make.com / DB) ────────────────────
  const makeItems = await fetchFromMake();

  if (makeItems && makeItems.length > 0) {
    const media = makeItems.map((item) => ({
      post_id: item.id ?? item.post_id ?? item.video_id ?? '',
      video_id: item.video_id ?? '',
      permalink: item.permalink_url ?? item.permalink ?? '',
      caption: item.message ?? item.description ?? item.caption ?? '',
      thumbnail_url: item.thumbnail_url ?? item.full_picture ?? item.picture ?? '',
      video_url: item.source ?? '',
      posted_at: item.created_time ?? null,
      media_type: item.media_type ?? item.type ?? '',
      status_type: item.status_type ?? '',
      like_count: Number(item.likes_count ?? 0),
      comments_count: Number(item.comments_count ?? 0),
      shares_count: Number(item.shares_count ?? 0),
    }));
    return NextResponse.json({ media, source: 'make' });
  }

  // Fallback: DB
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT post_id, video_id, permalink, caption, thumbnail_url, video_url,
             posted_at, saved_at
      FROM facebook_available_media
      ORDER BY saved_at DESC
    `;
    return NextResponse.json({ media: rows, source: 'db' });
  } catch {
    return NextResponse.json({ media: [] });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const postId = searchParams.get('postId') ?? searchParams.get('post_id');

  if (!postId) {
    return NextResponse.json({ error: 'postId Parameter fehlt' }, { status: 400 });
  }

  const sql = getDb();
  try {
    await sql`DELETE FROM facebook_available_media WHERE post_id = ${postId}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
