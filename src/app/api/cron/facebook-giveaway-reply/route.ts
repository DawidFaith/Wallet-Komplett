import { NextRequest, NextResponse } from 'next/server';
import { getLatestGiveawayCampaignByArtist } from '../../../lib/questDb';
import { getDb } from '../../../lib/db';
import {
  fetchAllFacebookComments,
  sendFacebookPrivateReply,
  getMostRecentFacebookConversationName,
  resolvePostIdFromUrl,
  extractFacebookPostId,
} from '../../../lib/metaApi';
import { DAWID_FAITH_PAGE_ID } from '../../../lib/giveawayVerify';

export const maxDuration = 60;

// Bewusst hart hinterlegt statt konfigurierbar: der Auto-Reply-Bot ist explizit
// nur für den Dawid-Faith-Kanal gebaut (einziger direkt ausgestellter,
// Messaging-fähiger Page-Token), nicht als Feature für alle Artists.
const BOT_ARTIST_WALLET = 'user_3dfvunr7ziaywue8bhzdqw2blsw';
const DAWID_FAITH_PAGE_TOKEN = process.env.META_DAWID_FAITH_PAGE_TOKEN;

function resolveAppUrl(): string {
  let url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/$/, '');
}
const APP_URL = resolveAppUrl();

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = req.nextUrl.searchParams.get('secret');
  return !!secret && secret === process.env.MIGRATION_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  if (!DAWID_FAITH_PAGE_TOKEN) {
    return NextResponse.json({ skipped: 'META_DAWID_FAITH_PAGE_TOKEN nicht gesetzt' });
  }

  const campaign = await getLatestGiveawayCampaignByArtist(BOT_ARTIST_WALLET);
  if (!campaign || campaign.status !== 'active') {
    return NextResponse.json({ skipped: 'Kein aktives Gewinnspiel' });
  }
  const fbPlatform = campaign.platforms.find(p => p.platform === 'facebook');
  if (!fbPlatform) {
    return NextResponse.json({ skipped: 'Aktuelles Gewinnspiel hat keine Facebook-Plattform' });
  }

  let postId = fbPlatform.postUrl;
  if (postId.startsWith('http')) {
    postId = (await resolvePostIdFromUrl(postId)) ?? (extractFacebookPostId(postId) ?? postId);
  }
  if (!postId.includes('_') && /^\d+$/.test(postId)) {
    postId = `${DAWID_FAITH_PAGE_ID}_${postId}`;
  }

  const comments = await fetchAllFacebookComments(postId, DAWID_FAITH_PAGE_TOKEN);
  const requiredText = campaign.requiredText.toLowerCase();
  const sql = getDb();

  const link = `${APP_URL}/win/${campaign.id}`;
  const replyText = `Dziękujemy za komentarz! 🎁 Odbierz swoją nagrodę tutaj: ${link}`;

  let repliedCount = 0;
  let skippedAlready = 0;
  let nameResolveFailed = 0;

  for (const comment of comments) {
    if (!comment.message.toLowerCase().includes(requiredText)) continue;

    const already = await sql`SELECT 1 FROM giveaway_facebook_replies WHERE comment_id = ${comment.id} LIMIT 1`;
    if (already.length > 0) { skippedAlready++; continue; }

    const sent = await sendFacebookPrivateReply(comment.id, replyText, DAWID_FAITH_PAGE_TOKEN);
    if (!sent) continue;

    const name = await getMostRecentFacebookConversationName(DAWID_FAITH_PAGE_ID, DAWID_FAITH_PAGE_TOKEN);
    if (!name) nameResolveFailed++;

    await sql`
      INSERT INTO giveaway_facebook_replies (comment_id, campaign_id, resolved_name)
      VALUES (${comment.id}, ${campaign.id}, ${name})
      ON CONFLICT (comment_id) DO NOTHING
    `;
    repliedCount++;
  }

  return NextResponse.json({
    postId,
    commentsChecked: comments.length,
    repliedCount,
    skippedAlready,
    nameResolveFailed,
  });
}
