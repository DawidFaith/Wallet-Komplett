/**
 * GET /api/instagram-quests/story-click?token=STORY_TOKEN
 *
 * Wird aufgerufen wenn ein Fan den Story-Link klickt (Instagram Story Link-Sticker).
 * Leitet direkt zur App weiter – dort kann der Fan (eingeloggt) die Quest abschließen.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dawidfaith.de').replace(/\/$/, '');

  if (!token || token.length < 10) {
    return NextResponse.redirect(`${appUrl}/?tab=quests`, { status: 302 });
  }

  // Redirect to app with storyToken in URL – app handles the claim flow
  const target = `${appUrl}/?storyToken=${encodeURIComponent(token)}&tab=quests`;
  return NextResponse.redirect(target, { status: 302 });
}
