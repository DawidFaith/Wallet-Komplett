/**
 * GET /api/admin/blob-usage
 * Header: x-admin-secret
 *
 * Listet den aktuellen Vercel-Blob-Speicherverbrauch, gruppiert nach oberstem
 * Pfad-Segment (z.B. "shop/", "profile-images/", "collectibles/", …), damit
 * man sieht, was tatsächlich wie viel belegt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const groups = new Map<string, { count: number; size: number }>();
  let totalCount = 0;
  let totalSize = 0;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await list({ cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const topLevel = blob.pathname.includes('/') ? blob.pathname.split('/')[0] + '/' : '(root)';
      const g = groups.get(topLevel) ?? { count: 0, size: 0 };
      g.count += 1;
      g.size += blob.size;
      groups.set(topLevel, g);
      totalCount += 1;
      totalSize += blob.size;
    }
    hasMore = page.hasMore;
    cursor = page.cursor;
  }

  const formatMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  const breakdown = [...groups.entries()]
    .map(([prefix, g]) => ({ prefix, count: g.count, sizeMB: formatMB(g.size) }))
    .sort((a, b) => b.sizeMB - a.sizeMB);

  return NextResponse.json({
    success: true,
    totalFiles: totalCount,
    totalSizeMB: formatMB(totalSize),
    breakdown,
  });
}
