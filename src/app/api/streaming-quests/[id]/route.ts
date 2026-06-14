/**
 * GET  /api/streaming-quests/[id]          → Quest-Details inkl. Updates
 * POST /api/streaming-quests/[id]/join     → Fan tritt bei (enrollment-Phase)
 * POST /api/streaming-quests/[id]/update   → Artist postet Fortschritt + Screenshot
 * POST /api/streaming-quests/[id]/confirm  → Artist bestätigt Ziel erreicht → Rewards auszahlen
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { addDfaithCredits, addUserReputation } from '../../../lib/questDb';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

type QuestRow = { status: string; enrollment_ends_at: string; deadline: string; [key: string]: unknown };

function deriveStatus(row: QuestRow) {
  if (row.status === 'completed') return 'completed';
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

  // ── CONFIRM (Artist bestätigt Ziel erreicht) ──────────────────────────────────
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

    // Als completed markieren
    await sql`
      UPDATE streaming_quests
      SET status = 'completed', confirmed_at = NOW(), proof_url = ${screenshotUrl},
          current_streams = ${finalStreams}
      WHERE id = ${params.id}
    `;

    // Letztes Update einfügen falls screenshot mitgegeben
    if (screenshotUrl) {
      await sql`
        INSERT INTO streaming_quest_updates (quest_id, streams_count, screenshot_url, note)
        VALUES (${params.id}, ${finalStreams}, ${screenshotUrl}, 'Ziel erreicht ✅')
      `;
    }

    // Alle Teilnehmer laden und Rewards auszahlen
    const participants = await sql`
      SELECT wallet_address FROM streaming_quest_participants
      WHERE quest_id = ${params.id} AND reward_paid = FALSE
    `;

    const rewardPerParticipant = Number(quest.reward_per_participant);
    const repReward            = Number(quest.reputation_reward);
    const creatorWallet        = quest.creator_wallet as string;

    let paidCount = 0;
    for (const p of participants) {
      const fanWallet = p.wallet_address as string;
      try {
        if (rewardPerParticipant > 0) {
          await addDfaithCredits(fanWallet, rewardPerParticipant);
        }
        if (repReward > 0) {
          await addUserReputation(fanWallet, creatorWallet, repReward);
        }
        await sql`
          UPDATE streaming_quest_participants
          SET reward_paid = TRUE
          WHERE quest_id = ${params.id} AND wallet_address = ${fanWallet}
        `;
        paidCount++;
      } catch {
        // einzelner Fehler überspringen
      }
    }

    return NextResponse.json({ success: true, paidCount });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
