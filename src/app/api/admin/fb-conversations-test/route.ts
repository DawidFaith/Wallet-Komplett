/**
 * GET /api/admin/fb-conversations-test
 * Header: x-admin-secret
 *
 * Diagnose-Route: zeigt die rohen Conversations-Daten der Dawid-Faith-Page,
 * um zu prüfen, wie Button-Template-Nachrichten (Giveaway-Bot-DM) tatsächlich
 * über die Read-API zurückkommen (message-Feld leer? andere Struktur?).
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GRAPH = 'https://graph.facebook.com/v21.0';
const DAWID_FAITH_PAGE_ID = '528116477058109';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const pageToken = process.env.META_DAWID_FAITH_PAGE_TOKEN;
  if (!pageToken) {
    return NextResponse.json({ error: 'META_DAWID_FAITH_PAGE_TOKEN nicht gesetzt' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${GRAPH}/${DAWID_FAITH_PAGE_ID}/conversations?fields=participants,messages.limit(10){message,from,created_time,attachments}&limit=10&access_token=${pageToken}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
