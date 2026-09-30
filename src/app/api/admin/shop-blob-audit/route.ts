/**
 * GET /api/admin/shop-blob-audit
 * Header: x-admin-secret
 *
 * Vergleicht alle Dateien unter shop/ im Blob-Speicher mit den aktuell in
 * shop_items referenzierten URLs (image_url, content_url,
 * audio_download_url — über ALLE Items, auch inaktive, da deren Inhalt für
 * Käufer weiter erreichbar bleiben muss). Rein lesend, löscht nichts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { getDb } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`SELECT image_url, content_url, audio_download_url FROM shop_items`;
  const referenced = new Set<string>();
  for (const r of rows) {
    for (const url of [r.image_url, r.content_url, r.audio_download_url]) {
      if (typeof url === 'string' && url) referenced.add(url);
    }
  }

  const allBlobs: { url: string; pathname: string; size: number; uploadedAt: string }[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const page = await list({ prefix: 'shop/', cursor, limit: 1000 });
    for (const b of page.blobs) {
      allBlobs.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt as unknown as string });
    }
    hasMore = page.hasMore;
    cursor = page.cursor;
  }

  const orphaned = allBlobs.filter(b => !referenced.has(b.url));
  const orphanedSizeMB = Math.round((orphaned.reduce((s, b) => s + b.size, 0) / 1024 / 1024) * 100) / 100;
  const totalSizeMB = Math.round((allBlobs.reduce((s, b) => s + b.size, 0) / 1024 / 1024) * 100) / 100;

  return NextResponse.json({
    success: true,
    totalFiles: allBlobs.length,
    totalSizeMB,
    referencedInDb: referenced.size,
    orphanedCount: orphaned.length,
    orphanedSizeMB,
    orphanedFiles: orphaned
      .sort((a, b) => b.size - a.size)
      .map(b => ({ pathname: b.pathname, sizeMB: Math.round((b.size / 1024 / 1024) * 100) / 100, uploadedAt: b.uploadedAt })),
  });
}
