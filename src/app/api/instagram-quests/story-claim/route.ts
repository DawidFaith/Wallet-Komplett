/**
 * POST /api/instagram-quests/story-claim
 *
 * Fan beansprucht Belohnung für einen Story-Quest.
 * Voraussetzung: Fan hat den Story-Link des Artists geklickt (liefert storyToken).
 *
 * Body: { token: string, walletAddress: string }
 *
 * Ablauf:
 *  1. Quest anhand story_token laden
 *  2. Prüfen ob Quest aktiv + nicht abgelaufen + completions < maxCompletions
 *  3. Prüfen ob diese Wallet die Quest schon abgeschlossen hat
 *  4. DFAITH Credits gutschreiben + Completion speichern
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQuestByStoryToken,
  hasWalletCompletedQuest,
  saveCompletion,
  addDfaithCredits,
  addUserReputation,
  payLevelBonus,
  type QuestCompletion,
} from '../../../lib/questDb';
import { getDb } from '../../../lib/db';

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  let token: string | undefined;
  let walletAddress: string | undefined;

  try {
    const body = await req.json();
    token = body.token;
    walletAddress = body.walletAddress;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  if (!token || typeof token !== 'string' || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Story-Token' }, { status: 400 });
  }
  if (!walletAddress || typeof walletAddress !== 'string') {
    return NextResponse.json({ error: 'walletAddress fehlt' }, { status: 400 });
  }

  const wallet = walletAddress.toLowerCase().trim();

  const quest = await getQuestByStoryToken(token);

  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }

  if (!quest.isActive) {
    return NextResponse.json({ error: 'Quest ist nicht mehr aktiv' }, { status: 400 });
  }

  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Quest ist abgelaufen' }, { status: 400 });
  }

  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json({ error: 'Quest ist bereits voll' }, { status: 400 });
  }

  const alreadyDone = await hasWalletCompletedQuest(wallet, quest.id);
  if (alreadyDone) {
    return NextResponse.json({ error: 'Du hast diese Quest bereits abgeschlossen' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const completion: QuestCompletion = {
    walletAddress: wallet,
    channelId: wallet,
    channelName: wallet,
    questId: quest.id,
    platform: 'instagram',
    commentId: `story-claim-${Date.now()}`,
    commentText: 'story_link_claim',
    rewardAmount: quest.rewardAmount,
    rewardPaid: true,
    completedAt: now,
  };

  try {
    await saveCompletion(completion);
    await addDfaithCredits(wallet, quest.rewardAmount);
    const levelBonus = await payLevelBonus(wallet, quest.creatorWallet, quest.rewardAmount);
    if ((quest.reputationReward ?? 0) > 0) {
      await addUserReputation(wallet, quest.creatorWallet, quest.reputationReward!);
    }

    // Completions-Zähler ist bereits durch saveCompletion (ON CONFLICT DO NOTHING + trigger) erhöht.
    // Falls kein DB-Trigger: manuell erhöhen
    const sql = getDb();
    await sql`UPDATE quests SET completions = completions + 1 WHERE id = ${quest.id} AND completions < max_completions`;

    return NextResponse.json({
      success: true,
      rewardAmount: quest.rewardAmount + levelBonus,
      levelBonus: levelBonus > 0 ? levelBonus : undefined,
      message: `+${quest.rewardAmount + levelBonus} DFAITH Credits gutgeschrieben!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Du hast diese Quest bereits abgeschlossen' }, { status: 409 });
    }
    return NextResponse.json({ error: `Fehler beim Speichern: ${msg}` }, { status: 500 });
  }
}
