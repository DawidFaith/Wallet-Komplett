/**
 * POST /api/shop/upload
 * Client-Side Upload via Vercel Blob handleUpload.
 * Der Browser lädt direkt zu Vercel Blob – kein Datei-Payload durch die Serverless Function.
 * clientPayload JSON: { fileType: 'content' | 'image', wallet: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf', 'application/zip',
];

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
];

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload = JSON-String mit { fileType, wallet }
        let fileType: string = 'content';
        let wallet: string   = '';
        try {
          const parsed = JSON.parse(clientPayload ?? '{}');
          fileType = parsed.fileType ?? 'content';
          wallet   = parsed.wallet   ?? '';
        } catch {
          throw new Error('Ungültiger clientPayload');
        }

        if (!wallet) throw new Error('wallet fehlt');

        // Artist-Check
        const sql  = getDb();
        const rows = await sql`
          SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
        `;
        if (!rows.length || !rows[0].is_artist) {
          throw new Error('Nur Artists dürfen Dateien hochladen');
        }

        const isImage   = fileType === 'image';
        const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_CONTENT_TYPES;
        const maxSize      = isImage ? 5 * 1024 * 1024 : 100 * 1024 * 1024;

        return {
          allowedContentTypes: allowedTypes,
          maximumSizeInBytes:  maxSize,
          // tokenPayload wird nach abgeschlossenem Upload an onUploadCompleted übergeben
          tokenPayload: JSON.stringify({ fileType, wallet }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: Blob-URL in DB speichern oder Logging
        console.log('Upload abgeschlossen:', blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
