import { getDb } from '../db';
import { addDfaithCredits, savePendingReward } from './credits';
import { addShard } from './collectibles';

async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS concert_events (
      id TEXT PRIMARY KEY,
      artist_wallet TEXT NOT NULL,
      title TEXT NOT NULL,
      event_date TEXT,
      venue TEXT,
      image_url TEXT,
      credit_reward INTEGER DEFAULT 0,
      shard_reward INTEGER DEFAULT 0,
      rep_reward INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE concert_events ADD COLUMN IF NOT EXISTS image_url TEXT`;
  await sql`ALTER TABLE concert_events ADD COLUMN IF NOT EXISTS address TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS concert_checkins (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      checked_in_at TIMESTAMPTZ DEFAULT NOW(),
      confirmed BOOLEAN DEFAULT FALSE,
      rewarded BOOLEAN DEFAULT FALSE,
      UNIQUE(event_id, wallet_address)
    )
  `;
}

export interface ConcertEvent {
  id: string;
  artistWallet: string;
  title: string;
  eventDate: string | null;
  venue: string | null;
  address: string | null;
  imageUrl: string | null;
  creditReward: number;
  shardReward: number;
  repReward: number;
  status: 'active' | 'done';
  createdAt: string;
  checkinCount?: number;
}

export interface ConcertCheckin {
  id: string;
  eventId: string;
  walletAddress: string;
  checkedInAt: string;
  confirmed: boolean;
  rewarded: boolean;
  displayName?: string | null;
}

/** Alle Events eines Artists laden (inkl. Checkin-Anzahl) */
export async function getConcertEvents(artistWallet: string): Promise<ConcertEvent[]> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`
    SELECT e.*,
      COUNT(c.id) AS checkin_count
    FROM concert_events e
    LEFT JOIN concert_checkins c ON c.event_id = e.id
    WHERE e.artist_wallet = ${artistWallet.toLowerCase()}
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;
  return rows.map(r => ({
    id: r.id as string,
    artistWallet: r.artist_wallet as string,
    title: r.title as string,
    eventDate: r.event_date as string | null,
    venue: r.venue as string | null,
    address: r.address as string | null,
    imageUrl: r.image_url as string | null,
    creditReward: Number(r.credit_reward),
    shardReward: Number(r.shard_reward),
    repReward: Number(r.rep_reward),
    status: r.status as 'active' | 'done',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    checkinCount: Number(r.checkin_count),
  }));
}

/** Aktive Events für Fan-View (nur active) */
export async function getActiveConcertEvents(artistWallet: string): Promise<ConcertEvent[]> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM concert_events
    WHERE artist_wallet = ${artistWallet.toLowerCase()} AND status = 'active'
    ORDER BY created_at DESC
  `;
  return rows.map(r => ({
    id: r.id as string,
    artistWallet: r.artist_wallet as string,
    title: r.title as string,
    eventDate: r.event_date as string | null,
    venue: r.venue as string | null,
    address: r.address as string | null,
    imageUrl: r.image_url as string | null,
    creditReward: Number(r.credit_reward),
    shardReward: Number(r.shard_reward),
    repReward: Number(r.rep_reward),
    status: r.status as 'active' | 'done',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

/** Checkins für ein Event laden */
export async function getConcertCheckins(eventId: string): Promise<ConcertCheckin[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM concert_checkins
    WHERE event_id = ${eventId}
    ORDER BY checked_in_at ASC
  `;
  return rows.map(r => ({
    id: r.id as string,
    eventId: r.event_id as string,
    walletAddress: r.wallet_address as string,
    checkedInAt: r.checked_in_at instanceof Date ? r.checked_in_at.toISOString() : String(r.checked_in_at),
    confirmed: Boolean(r.confirmed),
    rewarded: Boolean(r.rewarded),
  }));
}

/** Event erstellen */
export async function createConcertEvent(
  artistWallet: string,
  title: string,
  eventDate: string | null,
  venue: string | null,
  address: string | null,
  creditReward: number,
  shardReward: number,
  repReward: number,
  imageUrl: string | null = null,
): Promise<string> {
  await ensureTables();
  const sql = getDb();
  const id = `ce_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO concert_events (id, artist_wallet, title, event_date, venue, address, image_url, credit_reward, shard_reward, rep_reward, status)
    VALUES (${id}, ${artistWallet.toLowerCase()}, ${title}, ${eventDate || null}, ${venue || null}, ${address || null}, ${imageUrl}, ${creditReward}, ${shardReward}, ${repReward}, 'active')
  `;
  return id;
}

/** Event-Status aktualisieren */
export async function updateConcertEventStatus(eventId: string, artistWallet: string, status: 'active' | 'done'): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE concert_events SET status = ${status}
    WHERE id = ${eventId} AND artist_wallet = ${artistWallet.toLowerCase()}
  `;
}

/** Beendetes Event endgültig löschen (inkl. Checkins). Nur eigene, bereits beendete Events. */
export async function deleteConcertEvent(eventId: string, artistWallet: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM concert_events
    WHERE id = ${eventId} AND artist_wallet = ${artistWallet.toLowerCase()} AND status != 'active'
    RETURNING id
  `;
  if (rows.length === 0) return false;
  await sql`DELETE FROM concert_checkins WHERE event_id = ${eventId}`;
  return true;
}

/** Fan checkt sich ein */
export async function checkinConcert(eventId: string, walletAddress: string): Promise<{ alreadyCheckedIn: boolean }> {
  await ensureTables();
  const sql = getDb();
  const existing = await sql`
    SELECT id FROM concert_checkins WHERE event_id = ${eventId} AND wallet_address = ${walletAddress.toLowerCase()}
  `;
  if (existing.length > 0) return { alreadyCheckedIn: true };
  const id = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO concert_checkins (id, event_id, wallet_address) VALUES (${id}, ${eventId}, ${walletAddress.toLowerCase()})
  `;
  return { alreadyCheckedIn: false };
}

/** Artist bestätigt Teilnehmer und verteilt Rewards */
export async function confirmConcertAttendees(
  eventId: string,
  artistWallet: string,
  walletAddresses: string[],
): Promise<{ confirmed: number; rewarded: { walletAddress: string }[] }> {
  const sql = getDb();
  const artist = artistWallet.toLowerCase();

  const event = await sql`
    SELECT * FROM concert_events WHERE id = ${eventId} AND artist_wallet = ${artist} LIMIT 1
  `;
  if (event.length === 0) throw new Error('Event nicht gefunden');
  const ev = event[0];
  const creditReward = Number(ev.credit_reward);
  const shardReward = Number(ev.shard_reward);
  const repReward = Number(ev.rep_reward);

  const rewarded: { walletAddress: string }[] = [];

  for (const wa of walletAddresses) {
    const wallet = wa.toLowerCase();
    const existing = await sql`
      SELECT id, rewarded FROM concert_checkins WHERE event_id = ${eventId} AND wallet_address = ${wallet} LIMIT 1
    `;
    if (existing.length === 0 || existing[0].rewarded) continue;

    await sql`
      UPDATE concert_checkins SET confirmed = TRUE, rewarded = TRUE
      WHERE event_id = ${eventId} AND wallet_address = ${wallet}
    `;

    if (creditReward > 0) {
      await savePendingReward({
        walletAddress: wallet,
        amount: creditReward,
        reason: `concert_checkin:${artist}:${eventId}:${shardReward}`,
        questId: null,
        createdAt: new Date().toISOString(),
      });
    }
    if (shardReward > 0) {
      await addShard(wallet, artist, shardReward).catch(() => {});
    }
    if (repReward > 0) {
      await sql`
        INSERT INTO user_reputation (wallet_address, artist_wallet, reputation)
        VALUES (${wallet}, ${artist}, ${repReward})
        ON CONFLICT (wallet_address, artist_wallet)
        DO UPDATE SET reputation = user_reputation.reputation + ${repReward}
      `;
    }
    rewarded.push({ walletAddress: wallet });
  }

  return { confirmed: rewarded.length, rewarded };
}
