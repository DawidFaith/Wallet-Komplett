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
    return NextResponse.redirect(`${appUrl}/home?tab=quest-board`, { status: 302 });
  }

  // Direkt zu /home weiterleiten (geschützte Route → Clerk bewahrt URL bei Login)
  const target = `${appUrl}/home?storyToken=${encodeURIComponent(token)}&tab=quest-board`;
  return NextResponse.redirect(target, { status: 302 });
}
