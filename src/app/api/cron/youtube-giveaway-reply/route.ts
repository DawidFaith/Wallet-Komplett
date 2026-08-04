import { NextRequest, NextResponse } from 'next/server';
import { getLatestGiveawayCampaignByArtist, getUserProfile, hasRepliedToYoutubeComment, recordYoutubeBotReply } from '../../../lib/questDb';
import { getYoutubeBotAccessToken, fetchLatestYoutubeComments, postYoutubeCommentReply } from '../../../lib/youtubeBot';
import { slugify } from '../../../utils/slug';

export const maxDuration = 60;

// Bewusst hart hinterlegt statt konfigurierbar: der Auto-Reply-Bot ist explizit
// nur für den Dawid-Faith-Kanal gebaut, nicht als Feature für alle Artists.
const BOT_ARTIST_WALLET = 'user_3dfvunr7ziaywue8bhzdqw2blsw';

// Absolute https://-URL erzwingen (falls die Env-Var ohne Schema gesetzt wurde) —
// YouTube linkifiziert einen Kommentar nur, wenn die URL als vollständige,
// gültige Adresse erkennbar ist.
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

  const campaign = await getLatestGiveawayCampaignByArtist(BOT_ARTIST_WALLET);
  if (!campaign || campaign.status !== 'active') {
    return NextResponse.json({ skipped: 'Kein aktives Gewinnspiel' });
  }
  const ytPlatform = campaign.platforms.find(p => p.platform === 'youtube');
  if (!ytPlatform?.mediaId) {
    return NextResponse.json({ skipped: 'Aktuelles Gewinnspiel hat keine YouTube-Plattform' });
  }

  const accessToken = await getYoutubeBotAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'YouTube-Bot nicht autorisiert (kein Refresh-Token hinterlegt)' }, { status: 500 });
  }

  const profile = await getUserProfile(BOT_ARTIST_WALLET);
  const artistName = profile.displayName ?? profile.clerkName;
  const slug = artistName ? slugify(artistName) : '';
  const permanentLink = `${APP_URL}/win/${slug || BOT_ARTIST_WALLET}`;
  const replyText = `🎁 Thanks for joining! Here's the link to the giveaway: ${permanentLink}`;

  const comments = await fetchLatestYoutubeComments(ytPlatform.mediaId);
  const requiredText = campaign.requiredText.toLowerCase();

  let repliedCount = 0;
  let skippedAlready = 0;

  for (const comment of comments) {
    if (!comment.text.toLowerCase().includes(requiredText)) continue;
    if (await hasRepliedToYoutubeComment(comment.commentId)) { skippedAlready++; continue; }

    const posted = await postYoutubeCommentReply(comment.commentId, replyText, accessToken);
    if (posted) {
      await recordYoutubeBotReply(comment.commentId);
      repliedCount++;
    }
  }

  return NextResponse.json({
    videoId: ytPlatform.mediaId,
    commentsChecked: comments.length,
    repliedCount,
    skippedAlready,
  });
}
