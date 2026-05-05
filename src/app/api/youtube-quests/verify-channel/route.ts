import { NextRequest, NextResponse } from 'next/server';
import {
  loadBindingByWallet,
  loadBindingByChannel,
  saveYouTubeBinding,
  deleteYouTubeBinding,
  getVerificationCode,
} from '../../../lib/questDb';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

/** YouTube Channel-Handle oder URL in API-Parameter umwandeln */
function extractChannelQuery(input: string): { param: string; value: string } | null {
  const trimmed = input.trim();
  const handleFromUrl = trimmed.match(/youtube\.com\/@([^/?&\s]+)/);
  if (handleFromUrl) return { param: 'forHandle', value: handleFromUrl[1] };
  const channelFromUrl = trimmed.match(/youtube\.com\/channel\/(UC[^/?&\s]+)/);
  if (channelFromUrl) return { param: 'id', value: channelFromUrl[1] };
  if (trimmed.startsWith('@')) return { param: 'forHandle', value: trimmed.slice(1) };
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) return { param: 'id', value: trimmed };
  if (trimmed.length > 0) return { param: 'forHandle', value: trimmed };
  return null;
}

// GET: Binding für eine Wallet laden
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get('wallet');
  if (!walletAddress) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }
  try {
    const binding = await loadBindingByWallet(walletAddress);
    return NextResponse.json({ binding });
  } catch (dbErr) {
    console.error('Datenbankfehler beim Laden des Bindings:', dbErr);
    return NextResponse.json({ error: 'Datenbankfehler. Bitte Seite neu laden.' }, { status: 500 });
  }
}

// DELETE: YouTube-Kanal-Verknüpfung trennen
export async function DELETE(req: NextRequest) {
  let body: { walletAddress?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }
  const { walletAddress } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });
  }
  try {
    await deleteYouTubeBinding(walletAddress);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Kanal-Vorschau (action=preview) oder Verifizierung (action=verify)
export async function POST(req: NextRequest) {
  if (!YT_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API key nicht konfiguriert (YOUTUBE_DATA_API_KEY)' },
      { status: 500 }
    );
  }

  let body: { walletAddress?: string; channelInput?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { walletAddress, channelInput, action } = body;
  if (!walletAddress || !channelInput || !action) {
    return NextResponse.json(
      { error: 'walletAddress, channelInput und action sind erforderlich' },
      { status: 400 }
    );
  }

  const normalized = walletAddress.toLowerCase();
  const verificationCode = getVerificationCode(walletAddress);

  const channelQuery = extractChannelQuery(channelInput);
  if (!channelQuery) {
    return NextResponse.json({ error: 'Ungültige YouTube-Kanal-Eingabe' }, { status: 400 });
  }

  // YouTube API: Kanal-Info abrufen
  const ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&${channelQuery.param}=${encodeURIComponent(channelQuery.value)}&key=${YT_API_KEY}`;
  let ytData: {
    items?: {
      id: string;
      snippet: {
        title: string;
        description: string;
        thumbnails?: { default?: { url: string } };
      };
    }[];
    error?: { message: string };
  };

  try {
    const ytRes = await fetch(ytUrl);
    ytData = await ytRes.json();
  } catch {
    return NextResponse.json({ error: 'YouTube API nicht erreichbar' }, { status: 502 });
  }

  if (ytData.error) {
    return NextResponse.json({ error: `YouTube API Fehler: ${ytData.error.message}` }, { status: 502 });
  }

  if (!ytData.items || ytData.items.length === 0) {
    return NextResponse.json(
      { error: 'YouTube-Kanal nicht gefunden. Prüfe URL oder Handle.' },
      { status: 404 }
    );
  }

  const channel = ytData.items[0];
  const channelId = channel.id;
  const channelName = channel.snippet.title;
  const channelThumbnail = channel.snippet.thumbnails?.default?.url ?? '';
  const description = channel.snippet.description ?? '';

  if (action === 'preview') {
    return NextResponse.json({ channelId, channelName, channelThumbnail, verificationCode });
  }

  if (action === 'verify') {
    if (!description.includes(verificationCode)) {
      return NextResponse.json(
        {
          error: `Code "${verificationCode}" nicht in der Kanal-Beschreibung gefunden. Speichere die Beschreibung und versuche es erneut.`,
          channelId,
          channelName,
        },
        { status: 400 }
      );
    }

    try {
      // Duplikat-Checks: Kanal bereits einer anderen Wallet zugeordnet?
      const existingChannelBinding = await loadBindingByChannel(channelId);
      if (existingChannelBinding && existingChannelBinding.walletAddress !== normalized) {
        return NextResponse.json(
          { error: 'Dieser YouTube-Kanal ist bereits mit einer anderen Wallet verknüpft.' },
          { status: 409 }
        );
      }

      // Wallet bereits einem anderen Kanal zugeordnet?
      const existingWalletBinding = await loadBindingByWallet(normalized);
      if (existingWalletBinding && existingWalletBinding.channelId !== channelId) {
        return NextResponse.json(
          { error: 'Diese Wallet ist bereits mit einem anderen YouTube-Kanal verknüpft.' },
          { status: 409 }
        );
      }

      const binding = {
        walletAddress: normalized,
        channelId,
        channelName,
        channelThumbnail,
        verificationCode,
        verifiedAt: new Date().toISOString(),
      };

      await saveYouTubeBinding(binding);
      return NextResponse.json({ success: true, binding });
    } catch (dbErr) {
      console.error('Datenbankfehler beim Verifizieren:', dbErr);
      return NextResponse.json(
        { error: 'Datenbankfehler beim Speichern der Verknüpfung. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Ungültige action. Erlaubt: preview, verify' }, { status: 400 });
}
