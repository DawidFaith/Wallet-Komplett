/**
 * POST /api/collectibles/upload
 * Client-Side Upload via Vercel Blob für Collectible-Kollektionsbilder.
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let wallet = '';
        try {
          const parsed = JSON.parse(clientPayload ?? '{}');
          wallet = parsed.wallet ?? '';
        } catch {
          throw new Error('Ungültiger clientPayload');
        }
        if (!wallet) throw new Error('wallet fehlt');

        // Artist-Check
        const sql = getDb();
        const rows = await sql`
          SELECT is_artist FROM user_profiles WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
        `;
        if (!rows.length || !rows[0].is_artist) {
          throw new Error('Nur Artists dürfen Bilder hochladen');
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          tokenPayload: JSON.stringify({ wallet }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Collectible-Bild hochgeladen:', blob.url);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
