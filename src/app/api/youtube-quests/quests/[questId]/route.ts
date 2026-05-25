import { NextRequest, NextResponse } from 'next/server';
import { cancelQuest } from '../../../../lib/questDb';

// DELETE: Quest des Creators stornieren – nicht genutztes Budget wird zurückerstattet
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ questId: string }> }
) {
  const { questId } = await params;

  let body: { creatorWallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { creatorWallet } = body;

  if (!creatorWallet) {
    return NextResponse.json({ error: 'creatorWallet ist erforderlich' }, { status: 400 });
  }

  try {
    const refund = await cancelQuest(questId, creatorWallet.toLowerCase());
    if (refund === -1) {
      return NextResponse.json(
        { error: 'Quest nicht gefunden oder keine Berechtigung' },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, refund });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quest DELETE]', err);
    return NextResponse.json({ error: `Datenbankfehler: ${message}` }, { status: 500 });
  }
}
