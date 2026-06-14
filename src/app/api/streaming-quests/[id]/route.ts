/**
 * GET  /api/streaming-quests/[id]          → Quest-Details inkl. Updates
 * POST /api/streaming-quests/[id]?action=join     → Fan tritt bei
 * POST /api/streaming-quests/[id]?action=update   → Artist postet Fortschritt
 * POST /api/streaming-quests/[id]?action=confirm  → Artist schließt ab
 * POST /api/streaming-quests/[id]?action=claim    → Fan holt Reward ab
 * POST /api/streaming-quests/[id]?action=cancel   → Artist storniert + Guthaben-Erstattung
 * DELETE /api/streaming-quests/[id]               → Artist löscht abgeschlossenen Quest
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { addDfaithCredits, addUserReputation } from '../../../lib/questDb';
import { addShard, getCollectiblesShardBonus } from '../../../lib/questDb/collectibles';
import { getUserXp, xpToLevel } from '../../../lib/questDb/profile';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

type QuestRow = { status: string; enrollment_ends_at: string; deadline: string; [key: string]: unknown };

function deriveStatus(row: QuestRow): 'enrollment' | 'active' | 'completed' | 'expired' | 'cancelled' {
  if (row.status === 'completed') return 'completed';
  if (row.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  if (now > new Date(row.deadline).getTime()) return 'expired';
  if (now > new Date(row.enrollment_ends_at).getTime()) return 'active';
  return 'enrollment';
}

async function getQuest(sql: ReturnType<typeof getDb>, id: string): Promise<QuestRow | null> {
  const rows = await sql`SELECT * FROM streaming_quests WHERE id = ${id} LIMIT 1`;
  return (rows[0] as QuestRow) ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sql = getDb();
  const quest = await getQuest(sql, params.id);
  if (!quest) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });

  const [updates, participants] = await Promise.all([
    sql`
      SELECT * FROM streaming_quest_updates
      WHERE quest_id = ${params.id}
      ORDER BY posted_at DESC
    `,
    sql`
      SELECT wallet_address, joined_at, reward_paid
      FROM streaming_quest_participants
      WHERE quest_id = ${params.id}
      ORDER BY joined_at ASC
    `,
  ]);

  return NextResponse.json({
    quest: {
      ...quest,
      status: deriveStatus(quest),
      reward_per_participant: Number(quest.reward_per_participant),
    },
    updates,
    participants,
    participantCount: participants.length,
  });
}

// ─── Aktions-Handler abhängig von ?action= ────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const sql = getDb();

  const quest = await getQuest(sql, params.id);
  if (!quest) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  const status = deriveStatus(quest);

  // ── JOIN ─────────────────────────────────────────────────────────────────────
  if (action === 'join') {
    const wallet = (body.wallet as string)?.toLowerCase().trim();
    if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    if (status !== 'enrollment') {
      return NextResponse.json({ error: 'Anmeldephase bereits abgelaufen' }, { status: 400 });
    }

    // ── Level-Check: Mindest-Level des Quests prüfen ─────────────────────────
    const minLevel = Number(quest.min_level ?? 1);
    if (minLevel > 1) {
      const xp = await getUserXp(wallet);
      const { level } = xpToLevel(xp);
      if (level < minLevel) {
        return NextResponse.json({
          error: `Du brauchst mindestens Level ${minLevel} um teilzunehmen. Dein Level: ${level}`,
        }, { status: 403 });
      }
    }

    // Max-Teilnehmer prüfen
    const countRow = await sql`
      SELECT COUNT(*)::int AS cnt FROM streaming_quest_participants WHERE quest_id = ${params.id}
    `;
    if (Number(countRow[0].cnt) >= Number(quest.max_participants)) {
      return NextResponse.json({ error: 'Maximale Teilnehmerzahl erreicht' }, { status: 400 });
    }
    await sql`
      INSERT INTO streaming_quest_participants (quest_id, wallet_address)
      VALUES (${params.id}, ${wallet})
      ON CONFLICT (quest_id, wallet_address) DO NOTHING
    `;
    return NextResponse.json({ success: true });
  }

  // ── UPDATE (Artist postet Fortschritt) ───────────────────────────────────────
  if (action === 'update') {
    const wallet = (body.wallet as string)?.toLowerCase().trim();
    if (wallet !== (quest.creator_wallet as string).toLowerCase()) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
    }
    const streamsCount  = Math.max(0, Math.round(Number(body.streamsCount ?? 0)));
    const screenshotUrl = (body.screenshotUrl as string) ?? null;
    const note          = (body.note as string) ?? null;

    await sql`
      INSERT INTO streaming_quest_updates (quest_id, streams_count, screenshot_url, note)
      VALUES (${params.id}, ${streamsCount}, ${screenshotUrl}, ${note})
    `;
    // Aktuellen Wert im Haupt-Datensatz updaten
    await sql`
      UPDATE streaming_quests SET current_streams = ${streamsCount} WHERE id = ${params.id}
    `;
    return NextResponse.json({ success: true });
  }

  // ── CONFIRM (Artist bestätigt Ziel erreicht – kein Auto-Payout) ───────────────
  if (action === 'confirm') {
    const wallet = (body.wallet as string)?.toLowerCase().trim();
    if (wallet !== (quest.creator_wallet as string).toLowerCase()) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
    }
    if (status === 'completed') {
      return NextResponse.json({ error: 'Bereits bestätigt' }, { status: 400 });
    }
    if (status === 'expired') {
      return NextResponse.json({ error: 'Quest ist abgelaufen' }, { status: 400 });
    }
    const screenshotUrl  = (body.screenshotUrl as string) ?? null;
    const finalStreams    = Math.max(0, Math.round(Number(body.streamsCount ?? quest.current_streams)));

    // Nur als completed markieren – Fans müssen selbst claimen
    await sql`
      UPDATE streaming_quests
      SET status = 'completed', confirmed_at = NOW(), proof_url = ${screenshotUrl},
          current_streams = ${finalStreams}
      WHERE id = ${params.id}
    `;

    if (screenshotUrl) {
      await sql`
        INSERT INTO streaming_quest_updates (quest_id, streams_count, screenshot_url, note)
        VALUES (${params.id}, ${finalStreams}, ${screenshotUrl}, 'Ziel erreicht ✅')
      `;
    }

    const participantCount = await sql`
      SELECT COUNT(*)::int AS cnt FROM streaming_quest_participants WHERE quest_id = ${params.id}
    `;
    return NextResponse.json({ success: true, participantCount: Number(participantCount[0].cnt) });
  }

  // ── CLAIM (Fan holt seine Belohnung ab) ──────────────────────────────────────
  if (action === 'claim') {
    const wallet = (body.wallet as string)?.toLowerCase().trim();
    if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    if (status !== 'completed') {
      return NextResponse.json({ error: 'Quest noch nicht abgeschlossen' }, { status: 400 });
    }

    // Teilnahme & reward_paid prüfen
    const partRows = await sql`
      SELECT reward_paid FROM streaming_quest_participants
      WHERE quest_id = ${params.id} AND wallet_address = ${wallet} LIMIT 1
    `;
    if (partRows.length === 0) {
      return NextResponse.json({ error: 'Du hast nicht an diesem Quest teilgenommen' }, { status: 400 });
    }
    if (partRows[0].reward_paid) {
      return NextResponse.json({ error: 'Belohnung bereits abgeholt' }, { status: 400 });
    }

    const rewardPerParticipant = Number(quest.reward_per_participant);
    const repReward            = Number(quest.reputation_reward);
    const creatorWallet        = quest.creator_wallet as string;
    const shardDropChance      = Number(quest.shard_drop_chance ?? 20);

    if (rewardPerParticipant > 0) {
      await addDfaithCredits(wallet, rewardPerParticipant);
    }
    if (repReward > 0) {
      await addUserReputation(wallet, creatorWallet, repReward);
    }

    // Shard-Drop (Chance = Quest-Einstellung + Collectibles-Bonus)
    let shardDropped = false;
    try {
      const collectiblesBonus = await getCollectiblesShardBonus(wallet, creatorWallet);
      const totalChance = shardDropChance + collectiblesBonus;
      if (totalChance > 0 && Math.random() * 100 < totalChance) {
        await addShard(wallet, creatorWallet, 1);
        shardDropped = true;
      }
    } catch {
      // Shard-Drop ist optional
    }

    await sql`
      UPDATE streaming_quest_participants
      SET reward_paid = TRUE
      WHERE quest_id = ${params.id} AND wallet_address = ${wallet}
    `;

    return NextResponse.json({ success: true, shardDropped, reward: rewardPerParticipant, rep: repReward });
  }

  // ── CANCEL (Artist storniert – Guthaben-Erstattung) ───────────────────────────
  if (action === 'cancel') {
    const wallet = (body.wallet as string)?.toLowerCase().trim();
    if (wallet !== (quest.creator_wallet as string).toLowerCase()) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
    }
    if (quest.status === 'completed') {
      return NextResponse.json({ error: 'Abgeschlossener Quest kann nicht storniert werden' }, { status: 400 });
    }

    // Nicht-ausgezahlte Budget-Anteil zurückrechnen:
    // Bereits beigetretene Teilnehmer deren Reward noch aussteht
    const paidCount = await sql`
      SELECT COUNT(*)::int AS cnt FROM streaming_quest_participants
      WHERE quest_id = ${params.id} AND reward_paid = TRUE
    `;
    const totalPaid         = Number(paidCount[0].cnt) * Number(quest.reward_per_participant);
    const totalBudget       = Number(quest.max_participants) * Number(quest.reward_per_participant);
    const refundAmount      = Math.max(0, totalBudget - totalPaid);

    // Quest als storniert markieren
    await sql`
      UPDATE streaming_quests SET status = 'cancelled' WHERE id = ${params.id}
    `;

    // Guthaben zurück an Künstler
    if (refundAmount > 0) {
      await addDfaithCredits(wallet, refundAmount);
    }

    return NextResponse.json({ success: true, refundAmount });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}

// ─── DELETE: Künstler löscht abgeschlossenen/stornierten Quest ───────────────────────────
// Darf nur aufgerufen werden wenn Quest completed, cancelled oder expired ist
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase().trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const sql = getDb();
  const quest = await getQuest(sql, params.id);
  if (!quest) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });

  if (wallet !== (quest.creator_wallet as string).toLowerCase()) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }

  const currentStatus = deriveStatus(quest);
  if (!['completed', 'expired', 'cancelled'].includes(currentStatus) && quest.status !== 'cancelled') {
    return NextResponse.json({ error: 'Nur abgeschlossene, abgelaufene oder stornierte Quests können gelöscht werden' }, { status: 400 });
  }

  // Kaskadierende Löschung
  await sql`DELETE FROM streaming_quest_updates     WHERE quest_id = ${params.id}`;
  await sql`DELETE FROM streaming_quest_participants WHERE quest_id = ${params.id}`;
  await sql`DELETE FROM streaming_quests             WHERE id       = ${params.id}`;

  return NextResponse.json({ success: true });
}
