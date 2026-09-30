/**
 * POST /api/admin/cleanup-orphaned-blobs?dryRun=1
 * Header: x-admin-secret
 *
 * Einmalig aufräumen, was vor dem profileImageStorage-Fix angehäuft wurde:
 * jeder Profilbild-Sync erzeugte eine neue Datei mit Zeitstempel im Namen
 * ("<id>-<timestamp>.<ext>") statt dieselbe zu überschreiben. Die DB kennt
 * immer nur die zuletzt gespeicherte URL — alle älteren Versionen derselben
 * Gruppe sind damit unzweifelhaft verwaist. Mit ?dryRun=1 nur zählen, ohne
 * zu löschen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  const groups = new Map<string, { url: string; uploadedAt: Date }[]>();
  let cursor: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const page = await list({ prefix: 'profile-images/', cursor, limit: 1000 });
    for (const blob of page.blobs) {
      // "<...>-<13-stelliger Timestamp>.<ext>" → Gruppenschlüssel ohne Zeitstempel
      const match = blob.pathname.match(/^(.*)-\d{13}(\.[a-zA-Z0-9]+)$/);
      const groupKey = match ? `${match[1]}${match[2]}` : blob.pathname;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push({ url: blob.url, uploadedAt: new Date(blob.uploadedAt) });
    }
    hasMore = page.hasMore;
    cursor = page.cursor;
  }

  const toDelete: string[] = [];
  for (const versions of groups.values()) {
    if (versions.length <= 1) continue;
    versions.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    toDelete.push(...versions.slice(1).map(v => v.url));
  }

  let deleted = 0;
  if (!dryRun && toDelete.length) {
    for (let i = 0; i < toDelete.length; i += 100) {
      await del(toDelete.slice(i, i + 100));
    }
    deleted = toDelete.length;
  }

  return NextResponse.json({
    success: true,
    dryRun,
    groupsScanned: groups.size,
    orphanedFound: toDelete.length,
    deleted,
  });
}
