/**
 * GET /api/admin/list-blobs?secret=...&prefix=shop/images/user3dfvunr7ziaywue8bhzdqw2blsw
 * TEMPORÄR — listet Vercel-Blob-Dateien unter einem Prefix, um verwaiste
 * Uploads (Cover/Audio ohne DB-Zeile mehr) zu finden. Wird danach entfernt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const prefix = searchParams.get('prefix') ?? '';
  const { blobs } = await list({ prefix });
  return NextResponse.json(blobs.map(b => ({
    pathname: b.pathname,
    url: b.url,
    uploadedAt: b.uploadedAt,
    size: b.size,
  })).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
}
