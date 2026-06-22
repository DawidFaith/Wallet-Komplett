/**
 * GET /api/admin/arweave-keygen?secret=MIGRATION_SECRET
 *
 * Nicht mehr aktiv – NFT-Medien werden über Vercel Blob gespeichert.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  return NextResponse.json({
    message: 'NFT-Medien werden über Vercel Blob gespeichert. Kein Arweave-Wallet nötig.',
    storage: 'Vercel Blob (BLOB_READ_WRITE_TOKEN)',
  });
}
