import { getDb } from '../db';
import { addDfaithCredits } from './credits';
import { lockQuestBudget } from './quests';

export type GiveawayPlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube';

async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS giveaway_campaigns (
      id TEXT PRIMARY KEY,
      artist_wallet TEXT NOT NULL,
      title TEXT NOT NULL,
      image_url TEXT,
      required_text TEXT NOT NULL DEFAULT 'dfaith',
      credit_reward INTEGER NOT NULL,
      max_winners INTEGER NOT NULL,
      winner_count INTEGER NOT NULL DEFAULT 0,
      credits_locked INTEGER NOT NULL DEFAULT 0,
      credits_refunded BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS giveaway_campaign_platforms (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES giveaway_campaigns(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      post_url TEXT NOT NULL,
      media_id TEXT,
      UNIQUE(campaign_id, platform)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES giveaway_campaigns(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      handle TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      credited_wallet TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      UNIQUE(campaign_id, platform, handle)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS giveaway_entries_handle_idx ON giveaway_entries (platform, handle, status)`;
}

export interface GiveawayCampaign {
  id: string;
  artistWallet: string;
  title: string;
  imageUrl: string | null;
  requiredText: string;
  creditReward: number;
  maxWinners: number;
  winnerCount: number;
  creditsLocked: number;
  creditsRefunded: boolean;
  status: 'active' | 'ended';
  createdAt: string;
  platforms: GiveawayCampaignPlatform[];
}

export interface GiveawayCampaignPlatform {
  platform: GiveawayPlatform;
  postUrl: string;
  mediaId: string | null;
}

export interface GiveawayEntry {
  id: string;
  campaignId: string;
  platform: GiveawayPlatform;
  handle: string;
  email: string;
  code: string;
  status: 'pending' | 'verified' | 'credited';
  creditedWallet: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

function rowToCampaign(r: any, platforms: GiveawayCampaignPlatform[]): GiveawayCampaign {
  return {
    id: r.id as string,
    artistWallet: r.artist_wallet as string,
    title: r.title as string,
    imageUrl: r.image_url as string | null,
    requiredText: r.required_text as string,
    creditReward: Number(r.credit_reward),
    maxWinners: Number(r.max_winners),
    winnerCount: Number(r.winner_count),
    creditsLocked: Number(r.credits_locked),
    creditsRefunded: Boolean(r.credits_refunded),
    status: r.status as 'active' | 'ended',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    platforms,
  };
}

function rowToEntry(r: any): GiveawayEntry {
  return {
    id: r.id as string,
    campaignId: r.campaign_id as string,
    platform: r.platform as GiveawayPlatform,
    handle: r.handle as string,
    email: r.email as string,
    code: r.code as string,
    status: r.status as 'pending' | 'verified' | 'credited',
    creditedWallet: r.credited_wallet as string | null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    verifiedAt: r.verified_at ? (r.verified_at instanceof Date ? r.verified_at.toISOString() : String(r.verified_at)) : null,
  };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `DF-${code}`;
}

/** Kampagne erstellen. Sperrt sofort creditReward * maxWinners vom Künstler-Guthaben (Escrow). */
export async function createGiveawayCampaign(
  artistWallet: string,
  title: string,
  imageUrl: string | null,
  requiredText: string,
  creditReward: number,
  maxWinners: number,
  platforms: { platform: GiveawayPlatform; postUrl: string; mediaId: string | null }[],
): Promise<{ id: string } | { error: string }> {
  await ensureTables();
  if (platforms.length === 0) return { error: 'Mindestens eine Plattform muss konfiguriert werden.' };
  const totalBudget = creditReward * maxWinners;
  const locked = await lockQuestBudget(artistWallet, totalBudget);
  if (!locked) return { error: 'Nicht genug D.FAITH Credits für dieses Budget vorhanden.' };

  const sql = getDb();
  const id = `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await sql`
      INSERT INTO giveaway_campaigns (id, artist_wallet, title, image_url, required_text, credit_reward, max_winners, credits_locked, status)
      VALUES (${id}, ${artistWallet.toLowerCase()}, ${title}, ${imageUrl}, ${requiredText}, ${creditReward}, ${maxWinners}, ${totalBudget}, 'active')
    `;
    for (const p of platforms) {
      const pid = `gwp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await sql`
        INSERT INTO giveaway_campaign_platforms (id, campaign_id, platform, post_url, media_id)
        VALUES (${pid}, ${id}, ${p.platform}, ${p.postUrl}, ${p.mediaId})
      `;
    }
    return { id };
  } catch (e) {
    // Bei Fehler: bereits gesperrtes Budget zurückgeben
    await sql`
      UPDATE dfaith_credits SET balance = balance + ${totalBudget}, updated_at = NOW()
      WHERE wallet_address = ${artistWallet.toLowerCase()}
    `;
    await sql`
      UPDATE creator_balances SET balance = balance + ${totalBudget}, updated_at = NOW()
      WHERE wallet_address = ${artistWallet.toLowerCase()}
    `;
    throw e;
  }
}

export async function getGiveawayCampaignsByArtist(artistWallet: string): Promise<GiveawayCampaign[]> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM giveaway_campaigns WHERE artist_wallet = ${artistWallet.toLowerCase()} ORDER BY created_at DESC
  `;
  const result: GiveawayCampaign[] = [];
  for (const r of rows) {
    const platRows = await sql`SELECT platform, post_url, media_id FROM giveaway_campaign_platforms WHERE campaign_id = ${r.id}`;
    result.push(rowToCampaign(r, platRows.map(p => ({ platform: p.platform as GiveawayPlatform, postUrl: p.post_url as string, mediaId: p.media_id as string | null }))));
  }
  return result;
}

/** Öffentliche Kampagnen-Daten für die Landingpage (keine sensiblen Felder). */
export async function getPublicGiveawayCampaign(campaignId: string): Promise<GiveawayCampaign | null> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM giveaway_campaigns WHERE id = ${campaignId} LIMIT 1`;
  if (rows.length === 0) return null;
  const platRows = await sql`SELECT platform, post_url, media_id FROM giveaway_campaign_platforms WHERE campaign_id = ${campaignId}`;
  return rowToCampaign(rows[0], platRows.map(p => ({ platform: p.platform as GiveawayPlatform, postUrl: p.post_url as string, mediaId: p.media_id as string | null })));
}

/** Kampagne manuell beenden: verhindert neue Teilnahmen, gibt ungenutztes Budget zurück. */
export async function endGiveawayCampaign(campaignId: string, artistWallet: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM giveaway_campaigns
    WHERE id = ${campaignId} AND artist_wallet = ${artistWallet.toLowerCase()} AND status = 'active'
    LIMIT 1
  `;
  if (rows.length === 0) return false;
  const row = rows[0];
  await sql`UPDATE giveaway_campaigns SET status = 'ended' WHERE id = ${campaignId}`;
  if (!row.credits_refunded) {
    const used = Number(row.winner_count) * Number(row.credit_reward);
    const refund = Math.max(0, Number(row.credits_locked) - used);
    if (refund > 0) {
      await sql`
        UPDATE dfaith_credits SET balance = balance + ${refund}, updated_at = NOW()
        WHERE wallet_address = ${artistWallet.toLowerCase()}
      `;
      await sql`
        UPDATE creator_balances SET balance = balance + ${refund}, updated_at = NOW()
        WHERE wallet_address = ${artistWallet.toLowerCase()}
      `;
    }
    await sql`UPDATE giveaway_campaigns SET credits_refunded = TRUE WHERE id = ${campaignId}`;
  }
  return true;
}

/** Startet eine Teilnahme: generiert einen Code, den der Fan als Kommentar posten muss. */
export async function startGiveawayEntry(
  campaignId: string,
  platform: GiveawayPlatform,
  handle: string,
  email: string,
): Promise<{ entry: GiveawayEntry } | { error: string }> {
  await ensureTables();
  const sql = getDb();
  const cleanHandle = handle.trim().replace(/^@/, '').toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanHandle || !cleanEmail) return { error: 'Handle und E-Mail sind erforderlich.' };

  const campaign = await getPublicGiveawayCampaign(campaignId);
  if (!campaign) return { error: 'Gewinnspiel nicht gefunden.' };
  if (campaign.status !== 'active') return { error: 'Dieses Gewinnspiel ist bereits beendet.' };
  if (campaign.winnerCount >= campaign.maxWinners) return { error: 'Alle Plätze sind bereits vergeben.' };
  if (!campaign.platforms.some(p => p.platform === platform)) return { error: 'Diese Plattform ist für dieses Gewinnspiel nicht verfügbar.' };

  const existing = await sql`
    SELECT * FROM giveaway_entries WHERE campaign_id = ${campaignId} AND platform = ${platform} AND handle = ${cleanHandle} LIMIT 1
  `;
  if (existing.length > 0) return { entry: rowToEntry(existing[0]) };

  const id = `gwe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const code = generateCode();
  await sql`
    INSERT INTO giveaway_entries (id, campaign_id, platform, handle, email, code, status)
    VALUES (${id}, ${campaignId}, ${platform}, ${cleanHandle}, ${cleanEmail}, ${code}, 'pending')
  `;
  const rows = await sql`SELECT * FROM giveaway_entries WHERE id = ${id} LIMIT 1`;
  return { entry: rowToEntry(rows[0]) };
}

export async function getGiveawayEntry(entryId: string): Promise<GiveawayEntry | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM giveaway_entries WHERE id = ${entryId} LIMIT 1`;
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

/**
 * Kredit einem Gewinner gutschreiben (atomar gegen das Kampagnenbudget geprüft).
 * Gibt false zurück, wenn keine Plätze mehr frei sind.
 */
async function creditGiveawayWinner(campaignId: string, entryId: string, wallet: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE giveaway_campaigns
    SET winner_count = winner_count + 1
    WHERE id = ${campaignId} AND winner_count < max_winners AND status = 'active'
    RETURNING credit_reward, winner_count, max_winners
  `;
  if (rows.length === 0) return false;
  const reward = Number(rows[0].credit_reward);
  await addDfaithCredits(wallet, reward);
  await sql`
    UPDATE giveaway_entries SET status = 'credited', credited_wallet = ${wallet}, verified_at = NOW()
    WHERE id = ${entryId}
  `;
  if (Number(rows[0].winner_count) >= Number(rows[0].max_winners)) {
    await sql`UPDATE giveaway_campaigns SET status = 'ended', credits_refunded = TRUE WHERE id = ${campaignId}`;
  }
  return true;
}

/**
 * Nach erfolgreicher Kommentar-Verifikation aufgerufen: prüft ob der Handle bereits
 * zu einem verifizierten Nutzer-Profil gehört (sofortige Gutschrift), sonst bleibt
 * der Entry als 'verified' liegen bis der Nutzer sich später registriert/verifiziert.
 */
export async function markGiveawayEntryVerified(entryId: string): Promise<{ status: 'credited' | 'verified'; wallet?: string; amount?: number }> {
  const sql = getDb();
  const entry = await getGiveawayEntry(entryId);
  if (!entry) throw new Error('Entry nicht gefunden');

  let matchedWallet: string | null = null;
  if (entry.platform === 'youtube') {
    const rows = await sql`SELECT wallet_address FROM youtube_bindings WHERE LOWER(channel_id) = ${entry.handle} OR LOWER(channel_name) = ${entry.handle} LIMIT 1`;
    if (rows.length > 0) matchedWallet = rows[0].wallet_address as string;
  } else if (entry.platform === 'instagram') {
    const rows = await sql`SELECT wallet_address FROM user_profiles WHERE LOWER(instagram_handle) = ${entry.handle} AND instagram_verified = TRUE LIMIT 1`;
    if (rows.length > 0) matchedWallet = rows[0].wallet_address as string;
  } else if (entry.platform === 'tiktok') {
    const rows = await sql`SELECT wallet_address FROM user_profiles WHERE LOWER(tiktok_handle) = ${entry.handle} AND tiktok_verified = TRUE LIMIT 1`;
    if (rows.length > 0) matchedWallet = rows[0].wallet_address as string;
  } else if (entry.platform === 'facebook') {
    const rows = await sql`SELECT wallet_address FROM user_profiles WHERE LOWER(facebook_handle) = ${entry.handle} AND facebook_verified = TRUE LIMIT 1`;
    if (rows.length > 0) matchedWallet = rows[0].wallet_address as string;
  }

  if (matchedWallet) {
    const credited = await creditGiveawayWinner(entry.campaignId, entry.id, matchedWallet);
    if (credited) {
      const campaign = await getPublicGiveawayCampaign(entry.campaignId);
      return { status: 'credited', wallet: matchedWallet, amount: campaign?.creditReward };
    }
  }

  await sql`UPDATE giveaway_entries SET status = 'verified', verified_at = NOW() WHERE id = ${entryId}`;
  return { status: 'verified' };
}

/**
 * Wird aufgerufen, wenn ein Nutzer sein Social-Handle verifiziert (oder YouTube verknüpft).
 * Vergibt automatisch Credits für alle offenen Giveaway-Entries mit passendem Handle.
 */
export async function creditPendingGiveawayEntriesForHandle(
  walletAddress: string,
  platform: GiveawayPlatform,
  handle: string,
): Promise<void> {
  await ensureTables();
  const sql = getDb();
  const cleanHandle = handle.trim().replace(/^@/, '').toLowerCase();
  const rows = await sql`
    SELECT * FROM giveaway_entries
    WHERE platform = ${platform} AND handle = ${cleanHandle} AND status = 'verified'
  `;
  for (const r of rows) {
    const entry = rowToEntry(r);
    await creditGiveawayWinner(entry.campaignId, entry.id, walletAddress.toLowerCase());
  }
}
