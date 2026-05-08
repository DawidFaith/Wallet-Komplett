/**
 * POST /api/facebook-quests/secret-verify
 *
 * Verifiziert einen Facebook Secret-Quest (Code-Eingabe).
 * Analog zu /api/tiktok-quests/secret-verify.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQuestDetail,
  getQuestSecretCode,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  savePendingReward,
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

  const normalized = walletAddress.toLowerCase();

  try {
    const quest = await loadQuestDetail(questId);
    if (!quest) return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
    if (quest.platform !== 'facebook') {
      return NextResponse.json({ error: 'Dies ist kein Facebook-Quest' }, { status: 400 });
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

    const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
    if (alreadyDone) {
      return NextResponse.json(
        { error: 'Du hast diesen Quest bereits abgeschlossen' },
        { status: 400 }
      );
    }

    const storedCode = await getQuestSecretCode(questId);
    if (!storedCode) {
      return NextResponse.json(
        { error: 'Kein Code für diesen Quest hinterlegt' },
        { status: 500 }
      );
    }

    if (code.trim().toUpperCase() !== storedCode.trim().toUpperCase()) {
      return NextResponse.json({ notYet: true, message: 'Falscher Code – schau nochmal in den Post!' });
    }

    const now = new Date().toISOString();
    await saveCompletion({
      questId,
      walletAddress: normalized,
      channelId: normalized,
      channelName: 'Facebook Secret Quest',
      platform: 'facebook',
      commentId: '',
      commentText: '',
      rewardAmount: quest.rewardAmount,
      rewardPaid: false,
      completedAt: now,
    });
    await addDfaithCredits(normalized, quest.rewardAmount);
    await savePendingReward({
      walletAddress: normalized,
      amount: quest.rewardAmount,
      reason: `Facebook Secret Quest: ${quest.videoTitle}`,
      questId,
      createdAt: now,
    });
    await addUserXp(normalized, quest.rewardAmount * 10);

    return NextResponse.json({ success: true, rewardAmount: quest.rewardAmount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[facebook-secret-verify]', message);
    return NextResponse.json({ error: `Serverfehler: ${message}` }, { status: 500 });
  }
}
