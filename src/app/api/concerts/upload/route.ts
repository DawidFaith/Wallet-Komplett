import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

/** POST /api/concerts/upload — Vercel Blob client-side upload für Konzert-Bilder */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let wallet = '';
        try { const parsed = JSON.parse(clientPayload ?? '{}'); wallet = parsed.wallet ?? ''; } catch { throw new Error('Ungültiger clientPayload'); }
        if (!wallet) throw new Error('wallet fehlt');
        const sql = getDb();
        const rows = await sql`SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1`;
        if (!rows.length || !rows[0].is_artist) throw new Error('Nur Artists dürfen Konzert-Bilder hochladen');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          tokenPayload: JSON.stringify({ wallet }),
          maximumSizeInBytes: 8 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
