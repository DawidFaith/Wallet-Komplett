/**
 * POST /api/streaming-quests        → Quest erstellen (Artist)
 * GET  /api/streaming-quests?creatorWallet=xxx  → Quests eines Artists
 * GET  /api/streaming-quests?fanWallet=xxx       → Alle aktiven Quests für Fan-Board
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { getDfaithCredits, lockQuestBudget } from '../../lib/questDb';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

async function ensureTables(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS streaming_quests (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_wallet        TEXT          NOT NULL,
      title                 TEXT          NOT NULL,
      description           TEXT,
      platform              TEXT          NOT NULL DEFAULT 'spotify',
      target_streams        INT           NOT NULL DEFAULT 1000,
      current_streams       INT           NOT NULL DEFAULT 0,
      reward_per_participant DECIMAL(10,2) NOT NULL DEFAULT 0,
      max_participants      INT           NOT NULL DEFAULT 100,
      reputation_reward     INT           NOT NULL DEFAULT 0,
      enrollment_ends_at    TIMESTAMPTZ   NOT NULL,
      deadline              TIMESTAMPTZ   NOT NULL,
      status                TEXT          NOT NULL DEFAULT 'enrollment',
      confirmed_at          TIMESTAMPTZ,
      proof_url             TEXT,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS streaming_quest_participants (
      id             SERIAL      PRIMARY KEY,
      quest_id       UUID        NOT NULL,
      wallet_address TEXT        NOT NULL,
      joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reward_paid    BOOLEAN     NOT NULL DEFAULT FALSE,
      UNIQUE(quest_id, wallet_address)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS streaming_quest_updates (
      id             SERIAL      PRIMARY KEY,
      quest_id       UUID        NOT NULL,
      streams_count  INT         NOT NULL,
      screenshot_url TEXT,
      note           TEXT,
      posted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Neue Spalte nachträglich hinzufügen (idempotent)
  await sql`ALTER TABLE streaming_quests ADD COLUMN IF NOT EXISTS shard_drop_chance INT NOT NULL DEFAULT 20`;
}

/** Status aus Zeitstempeln ableiten (Serverless hat keinen Background-Job) */
function deriveStatus(row: {
  status: string;
  enrollment_ends_at: string;
  deadline: string;
}): 'enrollment' | 'active' | 'completed' | 'expired' | 'cancelled' {
  if (row.status === 'completed') return 'completed';
  if (row.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  const enrollEnd = new Date(row.enrollment_ends_at).getTime();
  const deadline  = new Date(row.deadline).getTime();
  if (now > deadline) return 'expired';
  if (now > enrollEnd) return 'active';
  return 'enrollment';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const creatorWallet = searchParams.get('creatorWallet')?.toLowerCase().trim();
  const fanWallet     = searchParams.get('fanWallet')?.toLowerCase().trim();

  const sql = getDb();
  await ensureTables(sql);

  let rows;
  if (creatorWallet) {
    rows = await sql`
      SELECT sq.*,
        (SELECT COUNT(*)::int FROM streaming_quest_participants sqp WHERE sqp.quest_id = sq.id) AS participant_count,
        (SELECT COUNT(*)::int FROM streaming_quest_participants sqp WHERE sqp.quest_id = sq.id AND sqp.reward_paid = TRUE) AS paid_count
      FROM streaming_quests sq
      WHERE sq.creator_wallet = ${creatorWallet}
      ORDER BY sq.created_at DESC
    `;
  } else {
    // Fan-Board: cancelled + expired ausblenden, mit Teilnahmestatus des Fans
    rows = await sql`
      SELECT sq.*,
        (SELECT COUNT(*)::int FROM streaming_quest_participants sqp WHERE sqp.quest_id = sq.id) AS participant_count,
        ${fanWallet ? sql`
          EXISTS(
            SELECT 1 FROM streaming_quest_participants sqp2
            WHERE sqp2.quest_id = sq.id AND sqp2.wallet_address = ${fanWallet}
          ) AS has_joined,
          COALESCE((SELECT reward_paid FROM streaming_quest_participants sqp3
            WHERE sqp3.quest_id = sq.id AND sqp3.wallet_address = ${fanWallet} LIMIT 1
          ), FALSE) AS reward_paid
        ` : sql`FALSE AS has_joined, FALSE AS reward_paid`}
      FROM streaming_quests sq
      WHERE sq.status != 'cancelled'
        AND (sq.deadline > NOW() OR sq.status = 'completed')
      ORDER BY sq.created_at DESC
    `;
  }

  // Status live ableiten
  const quests = rows.map((r: any) => ({
    ...r,
    status: deriveStatus(r),
    reward_per_participant: Number(r.reward_per_participant),
    target_streams: Number(r.target_streams),
    current_streams: Number(r.current_streams),
    participant_count: Number(r.participant_count ?? 0),
    paid_count: Number(r.paid_count ?? 0),
    has_joined: Boolean(r.has_joined),
    reward_paid: Boolean(r.reward_paid),
    shard_drop_chance: Number(r.shard_drop_chance ?? 20),
  }));

  return NextResponse.json({ quests });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    creatorWallet?: string;
    title?: string;
    description?: string;
    platform?: string;
    targetStreams?: number;
    rewardPerParticipant?: number;
    maxParticipants?: number;
    reputationReward?: number;
    enrollmentHours?: number;  // wie viele Stunden Anmeldefenster
    deadlineHours?: number;    // wie viele Stunden bis Deadline (ab jetzt)
    shardDropChance?: number;  // Shard-Drop-Wahrscheinlichkeit 0-100
  };

  const creatorWallet = body.creatorWallet?.toLowerCase().trim();
  if (!creatorWallet) return NextResponse.json({ error: 'creatorWallet required' }, { status: 400 });
  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const platform            = body.platform ?? 'spotify';
  const targetStreams        = Math.max(1, Math.round(Number(body.targetStreams ?? 1000)));
  const rewardPerParticipant = Math.max(0, Number(body.rewardPerParticipant ?? 0));
  const maxParticipants      = Math.max(1, Math.round(Number(body.maxParticipants ?? 100)));
  const reputationReward     = Math.max(0, Math.round(Number(body.reputationReward ?? 0)));
  const enrollmentHours      = Math.max(1, Math.min(168, Number(body.enrollmentHours ?? 24)));
  const deadlineHours        = Math.max(enrollmentHours + 1, Math.min(720, Number(body.deadlineHours ?? 168)));
  const shardDropChance      = Math.max(0, Math.min(100, Math.round(Number(body.shardDropChance ?? 20))));

  const totalBudget = rewardPerParticipant * maxParticipants;

  // Guthaben prüfen & reservieren
  if (totalBudget > 0) {
    const ok = await lockQuestBudget(creatorWallet, totalBudget);
    if (!ok) {
      const balance = await getDfaithCredits(creatorWallet);
      return NextResponse.json({
        error: `Nicht genug D.FAITH Credits. Benötigt: ${totalBudget.toFixed(2)}, Verfügbar: ${balance.toFixed(2)}`,
      }, { status: 400 });
    }
  }

  const now = new Date();
  const enrollmentEndsAt = new Date(now.getTime() + enrollmentHours * 3_600_000).toISOString();
  const deadlineAt       = new Date(now.getTime() + deadlineHours  * 3_600_000).toISOString();

  const sql = getDb();
  await ensureTables(sql);

  const rows = await sql`
    INSERT INTO streaming_quests (
      creator_wallet, title, description, platform,
      target_streams, reward_per_participant, max_participants,
      reputation_reward, enrollment_ends_at, deadline, status, shard_drop_chance
    ) VALUES (
      ${creatorWallet}, ${body.title.trim()}, ${body.description?.trim() ?? null}, ${platform},
      ${targetStreams}, ${rewardPerParticipant}, ${maxParticipants},
      ${reputationReward}, ${enrollmentEndsAt}, ${deadlineAt}, 'enrollment', ${shardDropChance}
    )
    RETURNING id
  `;

  return NextResponse.json({ success: true, id: rows[0].id });
}
