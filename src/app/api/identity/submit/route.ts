/**
 * POST /api/identity/submit
 * Body: { walletAddress, idType, idNumber, docImageBase64, selfieImageBase64 }
 * Reicht Ausweis + Selfie zur manuellen Prüfung ein (siehe lib/identityVerification.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOwnWallet } from '@/app/lib/apiAuth';
import { checkRateLimit } from '@/app/lib/rateLimit';
import { submitVerification } from '@/app/lib/identityVerification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Kein Body' }, { status: 400 });

    const { walletAddress, idType, idNumber, docImageBase64, selfieImageBase64 } = body as {
      walletAddress?: string;
      idType?: string;
      idNumber?: string;
      docImageBase64?: string;
      selfieImageBase64?: string;
    };

    const authCheck = requireOwnWallet(walletAddress);
    if (!authCheck.ok) return authCheck.response;

    const rl = await checkRateLimit(`identity-submit:${authCheck.userId}`, 3, 3600);
    if (!rl.ok) return rl.response!;

    if (!idType || !idNumber?.trim() || !docImageBase64 || !selfieImageBase64) {
      return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 });
    }

    await submitVerification({
      walletAddress: walletAddress!,
      idType,
      idNumber,
      docImageBase64,
      selfieImageBase64,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[identity/submit]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Einreichung fehlgeschlagen. Bitte versuche es erneut.' }, { status: 500 });
  }
}
