import { NextRequest, NextResponse } from 'next/server';
import {
  cancelQuestBundle,
  claimBundleCompletionBonus,
  getBundlesForCreator,
} from '../../../lib/questDb';

export const dynamic = 'force-dynamic';

// ─── DELETE: Bundle stornieren (Creator) ─────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> },
) {
  const { bundleId } = await params;
  let body: { creatorWallet?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 }); }

  const { creatorWallet } = body;
  if (!creatorWallet) return NextResponse.json({ error: 'creatorWallet fehlt' }, { status: 400 });

  try {
    const refund = await cancelQuestBundle(bundleId, creatorWallet.toLowerCase());
    if (refund === -1) {
      return NextResponse.json({ error: 'Bundle nicht gefunden oder keine Berechtigung' }, { status: 403 });
    }
    return NextResponse.json({ success: true, refund });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bundle DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST: Bundle-Abschluss-Bonus einlösen (Fan) ─────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> },
) {
  const { bundleId } = await params;
  let body: { fanWallet?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 }); }

  const { fanWallet } = body;
  if (!fanWallet) return NextResponse.json({ error: 'fanWallet fehlt' }, { status: 400 });

  try {
    const result = await claimBundleCompletionBonus(bundleId, fanWallet.toLowerCase());
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, bonusAmount: result.bonusAmount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bundle claim-bonus]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET: Bundle-Details für Creator ─────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> },
) {
  const { bundleId } = await params;
  const wallet = new URL(req.url).searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  try {
    const bundles = await getBundlesForCreator(wallet.toLowerCase());
    const bundle  = bundles.find((b) => b.id === bundleId);
    if (!bundle) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json({ bundle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
