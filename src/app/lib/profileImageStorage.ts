/**
 * Dauerhafte Speicherung von Profilbildern auf Vercel Blob
 * 
 * Lädt Profilbilder von Social Media Plattformen herunter und speichert
 * sie dauerhaft auf Vercel Blob, um Ablauf von temporären URLs zu vermeiden.
 */

import { put } from '@vercel/blob';

/**
 * Lädt ein Bild herunter und speichert es auf Vercel Blob
 * @param imageUrl - Original-Bild-URL (kann ablaufen)
 * @param platform - Plattform-Name (youtube, instagram, tiktok, facebook)
 * @param identifier - User Handle oder Channel ID
 * @returns Dauerhafte Blob-URL oder null bei Fehler
 */
export async function uploadProfileImageToBlob(
  imageUrl: string,
  platform: string,
  identifier: string
): Promise<string | null> {
  // Prüfe ob Vercel Blob verfügbar ist
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured, skipping image upload');
    return null;
  }

  try {
    // Überspringe bereits gespeicherte Blob-URLs
    if (imageUrl.includes('vercel-storage.com') || imageUrl.includes('blob.vercel-storage.com')) {
      return imageUrl;
    }

    // Überspringe /api/avatar Proxy-URLs (keine dauerhafte Quelle)
    if (imageUrl.startsWith('/api/avatar')) {
      return null;
    }

    // Lade Bild herunter
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DFaith/1.0)',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch image from ${imageUrl}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Nur Bilder verarbeiten
    if (!contentType.startsWith('image/')) {
      console.warn(`⚠️ Invalid content type for image: ${contentType}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dateierweiterung bestimmen
    const ext = contentType.includes('png') ? 'png' 
              : contentType.includes('gif') ? 'gif'
              : contentType.includes('webp') ? 'webp'
              : 'jpg';

    // Eindeutiger Dateiname: platform/identifier-timestamp.ext
    const timestamp = Date.now();
    const sanitizedId = identifier.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const filename = `profile-images/${platform}/${sanitizedId}-${timestamp}.${ext}`;

    // Upload zu Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });

    console.log(`✅ Uploaded profile image to blob: ${blob.url}`);
    return blob.url;

  } catch (error) {
    console.error(`❌ Error uploading profile image to blob:`, error);
    return null;
  }
}

/**
 * Extrahiert Original-Bild-URL aus /api/avatar Proxy-URL
 */
export function extractOriginalImageUrl(proxyUrl: string): string | null {
  try {
    const url = new URL(proxyUrl, 'https://example.com');
    const urlParam = url.searchParams.get('url');
    return urlParam ? decodeURIComponent(urlParam) : null;
  } catch {
    return null;
  }
}

/**
 * Holt Profilbild von unavatar.io und speichert es auf Blob
 */
export async function fetchAndUploadFromUnavatar(
  platform: string,
  handle: string
): Promise<string | null> {
  try {
    const unavatarUrl = `https://unavatar.io/${platform}/${encodeURIComponent(handle)}`;
    return await uploadProfileImageToBlob(unavatarUrl, platform, handle);
  } catch (error) {
    console.error(`❌ Error fetching from unavatar:`, error);
    return null;
  }
}
