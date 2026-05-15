/**
 * POST /api/shop/upload
 * Lädt eine Content- oder Bild-Datei zu Vercel Blob hoch.
 * FormData: file (Blob), fileType ('content' | 'image'), wallet (Artist-Wallet)
 */
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const MAX_CONTENT_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_SIZE   =   5 * 1024 * 1024; //   5 MB

const ALLOWED_CONTENT_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf', 'application/zip',
];

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const fileType = formData.get('fileType') as string | null; // 'content' | 'image'
    const wallet   = formData.get('wallet') as string | null;

    if (!file || !fileType || !wallet) {
      return NextResponse.json({ error: 'file, fileType und wallet sind erforderlich' }, { status: 400 });
    }
    if (!['content', 'image'].includes(fileType)) {
      return NextResponse.json({ error: 'fileType muss content oder image sein' }, { status: 400 });
    }

    // Artist-Check
    const sql = getDb();
    const rows = await sql`
      SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
    `;
    if (!rows.length || !rows[0].is_artist) {
      return NextResponse.json({ error: 'Nur Artists dürfen Dateien hochladen' }, { status: 403 });
    }

    const mimeType = file.type;
    const isImage  = fileType === 'image';

    // MIME-Typ prüfen
    const allowed = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_CONTENT_TYPES;
    if (!allowed.includes(mimeType)) {
      return NextResponse.json(
        { error: `Dateityp nicht erlaubt: ${mimeType}` },
        { status: 415 },
      );
    }

    // Größe prüfen
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_CONTENT_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / 1024 / 1024;
      return NextResponse.json(
        { error: `Datei zu groß (max. ${maxMB} MB)` },
        { status: 413 },
      );
    }

    // Sicheren Dateinamen erzeugen – Artist-eigener Unterordner
    const ext        = file.name.replace(/.*\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const timestamp  = Date.now();
    const safeWallet = wallet.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
    const blobPath   = `shop/${isImage ? 'images' : 'content'}/${safeWallet}/${timestamp}.${ext}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: mimeType,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
