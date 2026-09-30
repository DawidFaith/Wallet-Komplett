/**
 * GET  /api/admin/shop-blob-audit          — nur anzeigen, löscht nichts
 * POST /api/admin/shop-blob-audit          — anzeigen UND die verwaisten Dateien löschen
 * Header: x-admin-secret
 *
 * Vergleicht alle Dateien unter shop/ im Blob-Speicher mit den aktuell in
 * shop_items referenzierten URLs (image_url, content_url,
 * audio_download_url — über ALLE Items, auch inaktive, da deren Inhalt für
 * Käufer weiter erreichbar bleiben muss). Referenziert nirgends ⇒ kann von
 * keiner Funktion der App mehr angezeigt werden ⇒ gefahrlos löschbar
 * (typischerweise abgebrochene/ersetzte Uploads im Erstellen/Bearbeiten-
 * Formular, die schon beim Datei-Auswählen hochgeladen werden, bevor
 * überhaupt gespeichert wird).
 */
import { NextRequest, NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';
import { getDb } from '../../../lib/db';

async function findOrphanedShopBlobs() {
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
  return { allBlobs, referenced, orphaned };
}

const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { allBlobs, referenced, orphaned } = await findOrphanedShopBlobs();

  return NextResponse.json({
    success: true,
    totalFiles: allBlobs.length,
    totalSizeMB: toMB(allBlobs.reduce((s, b) => s + b.size, 0)),
    referencedInDb: referenced.size,
    orphanedCount: orphaned.length,
    orphanedSizeMB: toMB(orphaned.reduce((s, b) => s + b.size, 0)),
    orphanedFiles: orphaned
      .sort((a, b) => b.size - a.size)
      .map(b => ({ pathname: b.pathname, sizeMB: toMB(b.size), uploadedAt: b.uploadedAt })),
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { orphaned } = await findOrphanedShopBlobs();
  const urls = orphaned.map(b => b.url);

  for (let i = 0; i < urls.length; i += 100) {
    await del(urls.slice(i, i + 100));
  }

  return NextResponse.json({
    success: true,
    deleted: urls.length,
    deletedSizeMB: toMB(orphaned.reduce((s, b) => s + b.size, 0)),
  });
}
