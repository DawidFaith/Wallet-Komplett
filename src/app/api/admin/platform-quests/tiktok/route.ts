/**
 * POST /api/admin/platform-quests/tiktok?account=polska
 *
 * Erstellt einen TikTok-Quest für einen Platform-Account aus einem manuell
 * eingefügten Video-Link (kein Auto-Fetch für TikTok verfügbar, anders als
 * bei Instagram). Ruft intern dieselbe Erstellungs-Logik wie die normale
 * Creator-Quest-Erstellung auf (Video-Autor wird gegen den verknüpften
 * TikTok-Handle des Platform-Accounts geprüft).
 *
 * Body: { videoUrl: string, description?: string, rewardAmount?: number, maxCompletions?: number, durationHours?: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAccount } from '../../../../lib/platformAccounts';

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
  if (!account.tiktokHandle) {
    return NextResponse.json({ error: `Kein TikTok-Handle für Account "${account.key}" konfiguriert` }, { status: 400 });
  }

  let body: {
    videoUrl?: string;
    description?: string;
    rewardAmount?: number;
    maxCompletions?: number;
    durationHours?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }
  if (!body.videoUrl) {
    return NextResponse.json({ error: 'videoUrl ist erforderlich' }, { status: 400 });
  }

  // Interner Aufruf der bestehenden TikTok-Quest-Erstellung — prüft dort
  // automatisch, dass das Video zum verknüpften tiktok_handle des
  // Platform-Accounts gehört.
  const res = await fetch(new URL('/api/tiktok-quests/quests', req.nextUrl.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creatorWallet: account.wallet,
      videoUrl: body.videoUrl,
      description: body.description,
      rewardAmount: body.rewardAmount ?? 150,
      maxCompletions: body.maxCompletions ?? 50,
      durationHours: body.durationHours,
    }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
