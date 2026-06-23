/**
 * POST /api/shop/upload-arweave
 * Lädt Cover-Bilder und MP3s direkt auf Arweave hoch.
 * Gibt die permanente ar://-URL zurück.
 * Body: FormData mit "file" (Blob) + "wallet" + "fileType" ('content' | 'image')
 */
import { NextRequest, NextResponse } from 'next/server';
import { uploadToArweave } from '../../../lib/arweaveUpload';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac'];
const MAX_IMAGE_BYTES = 5  * 1024 * 1024;   // 5 MB
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;  // 100 MB

export async function POST(req: NextRequest) {
  try {
    const form     = await req.formData();
    const file     = form.get('file')     as File | null;
    const wallet   = form.get('wallet')   as string | null;
    const fileType = form.get('fileType') as 'content' | 'image' | null;

    if (!file || !wallet || !fileType) {
      return NextResponse.json({ error: 'file, wallet und fileType sind Pflicht' }, { status: 400 });
    }

    // Artist-Check
    const sql  = getDb();
    const rows = await sql`
      SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
    `;
    if (!rows.length || !rows[0].is_artist) {
      return NextResponse.json({ error: 'Nur Artists dürfen Dateien hochladen' }, { status: 403 });
    }

    const mimeType = file.type || (fileType === 'image' ? 'image/jpeg' : 'audio/mpeg');
    const allowed  = fileType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_AUDIO_TYPES;
    if (!allowed.includes(mimeType)) {
      return NextResponse.json({ error: `Dateityp ${mimeType} nicht erlaubt` }, { status: 400 });
    }

    const maxBytes = fileType === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `Datei zu groß (max. ${maxBytes / 1024 / 1024} MB)` }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const url = await uploadToArweave(buf, mimeType, [
      { name: 'App',      value: 'D.FAITH' },
      { name: 'FileType', value: fileType },
      { name: 'Uploader', value: wallet.toLowerCase() },
    ]);

    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
