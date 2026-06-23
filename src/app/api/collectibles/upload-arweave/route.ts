/**
 * POST /api/collectibles/upload-arweave
 * Lädt Collectible-Kollektionsbilder direkt auf Arweave hoch.
 * Body: FormData mit "file" (Blob) + "wallet"
 */
import { NextRequest, NextResponse } from 'next/server';
import { uploadToArweave } from '../../../lib/arweaveUpload';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const form   = await req.formData();
    const file   = form.get('file')   as File | null;
    const wallet = form.get('wallet') as string | null;

    if (!file || !wallet) {
      return NextResponse.json({ error: 'file und wallet sind Pflicht' }, { status: 400 });
    }

    const sql  = getDb();
    const rows = await sql`
      SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
    `;
    if (!rows.length || !rows[0].is_artist) {
      return NextResponse.json({ error: 'Nur Artists dürfen Bilder hochladen' }, { status: 403 });
    }

    const mimeType = file.type || 'image/jpeg';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: `Dateityp ${mimeType} nicht erlaubt` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const url = await uploadToArweave(buf, mimeType, [
      { name: 'App',      value: 'D.FAITH' },
      { name: 'Type',     value: 'Collectible Image' },
      { name: 'Uploader', value: wallet.toLowerCase() },
    ]);

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
