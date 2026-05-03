import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  getQuestSecretCode,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  addUserXp,
} from '../../../lib/questDb';

export async function POST(req: NextRequest) {
  let body: { questId?: string; walletAddress?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { questId, walletAddress, code } = body;

  if (!questId || !walletAddress || !code) {
    return NextResponse.json(
      { error: 'questId, walletAddress und code sind erforderlich' },
      { status: 400 }
    );
  }

  try {
    const quest = await loadQuestDetail(questId);
    if (!quest) {
      return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
    }
    if (quest.type !== 'secret') {
      return NextResponse.json({ error: 'Dies ist kein Secret-Quest' }, { status: 400 });
    }
    if (!quest.isActive) {
      return NextResponse.json({ error: 'Quest ist nicht mehr aktiv' }, { status: 400 });
    }
    if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Quest ist abgelaufen' }, { status: 400 });
    }
    if (quest.completions >= quest.maxCompletions) {
      return NextResponse.json({ error: 'Alle Plätze sind vergeben' }, { status: 400 });
    }

    const alreadyDone = await hasWalletCompletedQuest(walletAddress, questId);
    if (alreadyDone) {
      return NextResponse.json(
        { error: 'Du hast diesen Quest bereits abgeschlossen' },
        { status: 400 }
      );
    }

    // Gespeicherten Code laden (niemals an den Client senden)
    const storedCode = await getQuestSecretCode(questId);
    if (!storedCode) {
      return NextResponse.json(
        { error: 'Kein Code für diesen Quest hinterlegt' },
        { status: 500 }
      );
    }

    // Vergleich: case-insensitiv, getrimmt
    const inputNormalized = code.trim().toUpperCase();
    const storedNormalized = storedCode.trim().toUpperCase();

    if (inputNormalized !== storedNormalized) {
      return NextResponse.json({ notYet: true, message: 'Falscher Code – schau nochmal ins Video!' });
    }

    // ── Erfolg: Completion speichern + Credits gutschreiben ──────────────────
    const now = new Date().toISOString();

    await saveCompletion({
      questId,
      walletAddress: walletAddress.toLowerCase(),
      // wallet als channel-Proxy (kein YouTube-Kanal benötigt für Secret-Quests)
      channelId: walletAddress.toLowerCase(),
      channelName: 'Secret Quest',
      platform: 'youtube',
      commentId: '',
      commentText: '',
      rewardAmount: quest.rewardAmount,
      rewardPaid: false,
      completedAt: now,
    });

    await addDfaithCredits(walletAddress, quest.rewardAmount);
    await addUserXp(walletAddress, quest.rewardAmount * 10);

    return NextResponse.json({ success: true, rewardAmount: quest.rewardAmount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[secret-verify]', message);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
}
