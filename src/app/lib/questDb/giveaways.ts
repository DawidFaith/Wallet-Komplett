import { getDb } from '../db';
import { addDfaithCredits } from './credits';
import { lockQuestBudget } from './quests';
import { slugify } from '../../utils/slug';

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
  await sql`ALTER TABLE giveaway_campaigns ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'`;
  await sql`ALTER TABLE giveaway_campaigns ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ`;
  await sql`ALTER TABLE giveaway_campaigns ADD COLUMN IF NOT EXISTS presave_url TEXT`;
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
  mediaType: 'image' | 'video';
  requiredText: string;
  creditReward: number;
  maxWinners: number;
  winnerCount: number;
  creditsLocked: number;
  creditsRefunded: boolean;
  status: 'active' | 'ended';
  createdAt: string;
  releaseAt: string | null;
  presaveUrl: string | null;
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
  status: 'pending' | 'verified' | 'credited' | 'rejected';
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
    mediaType: (r.media_type as 'image' | 'video') ?? 'image',
    requiredText: r.required_text as string,
    creditReward: Number(r.credit_reward),
    maxWinners: Number(r.max_winners),
    winnerCount: Number(r.winner_count),
    creditsLocked: Number(r.credits_locked),
    creditsRefunded: Boolean(r.credits_refunded),
    status: r.status as 'active' | 'ended',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    releaseAt: r.release_at ? (r.release_at instanceof Date ? r.release_at.toISOString() : String(r.release_at)) : null,
    presaveUrl: r.presave_url as string | null,
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
    status: r.status as 'pending' | 'verified' | 'credited' | 'rejected',
    creditedWallet: r.credited_wallet as string | null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    verifiedAt: r.verified_at ? (r.verified_at instanceof Date ? r.verified_at.toISOString() : String(r.verified_at)) : null,
  };
}

/**
 * Generiert einen einmaligen Kommentar-Code (Kommentar-Wort + zufälliges Suffix).
 * Wird nur für Facebook tatsächlich gebraucht, da dort die Autor:in eines
 * Kommentars nicht zuverlässig zurückgegeben wird und daher nur über einen
 * eindeutigen Code pro Teilnahme geprüft werden kann. Instagram/TikTok/YouTube
 * reicht der direkte Abgleich von Handle + Kommentar-Wort der Kampagne (siehe
 * checkGiveawayEntryComment in giveawayEntryCheck.ts) — der Code wird dort mit
 * abgespeichert, aber nicht zur Prüfung verwendet. Der Abgleich erfolgt überall
 * case-insensitive (siehe giveawayVerify.ts), Groß-/Kleinschreibung spielt
 * beim Kommentieren also keine Rolle.
 */
function generateCode(requiredText: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  const prefix = requiredText.trim().replace(/[^a-zA-Z0-9]+/g, '').slice(0, 20) || 'dfaith';
  return `${prefix}-${suffix}`;
}

/**
 * Prüft ob ein Artist bereits ein aktives Gewinnspiel hat — es darf immer nur
 * eines gleichzeitig laufen, damit der öffentliche Link stabil bleibt (siehe
 * getLatestGiveawayCampaignByArtist).
 */
export async function hasActiveGiveawayCampaign(artistWallet: string): Promise<boolean> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`SELECT 1 FROM giveaway_campaigns WHERE artist_wallet = ${artistWallet.toLowerCase()} AND status = 'active' LIMIT 1`;
  return rows.length > 0;
}

/** Kampagne erstellen. Sperrt sofort creditReward * maxWinners vom Künstler-Guthaben (Escrow). */
export async function createGiveawayCampaign(
  artistWallet: string,
  title: string,
  imageUrl: string | null,
  mediaType: 'image' | 'video',
  requiredText: string,
  creditReward: number,
  maxWinners: number,
  platforms: { platform: GiveawayPlatform; postUrl: string; mediaId: string | null }[],
  releaseAt: string | null = null,
  presaveUrl: string | null = null,
): Promise<{ id: string } | { error: string }> {
  await ensureTables();
  if (platforms.length === 0) return { error: 'Mindestens eine Plattform muss konfiguriert werden.' };
  if (await hasActiveGiveawayCampaign(artistWallet)) {
    return { error: 'Du hast bereits ein aktives Gewinnspiel. Beende es zuerst, bevor du ein neues startest.' };
  }
  const totalBudget = creditReward * maxWinners;
  const locked = await lockQuestBudget(artistWallet, totalBudget);
  if (!locked) return { error: 'Nicht genug D.FAITH Credits für dieses Budget vorhanden.' };

  const sql = getDb();
  const id = `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await sql`
      INSERT INTO giveaway_campaigns (id, artist_wallet, title, image_url, media_type, required_text, credit_reward, max_winners, credits_locked, status, release_at, presave_url)
      VALUES (${id}, ${artistWallet.toLowerCase()}, ${title}, ${imageUrl}, ${mediaType}, ${requiredText}, ${creditReward}, ${maxWinners}, ${totalBudget}, 'active', ${releaseAt}, ${presaveUrl})
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

/**
 * Löst einen URL-Slug (z.B. "dawid-faith", abgeleitet vom Anzeigenamen des Artists)
 * zur passenden Wallet-Adresse auf — damit der permanente Fan-Link lesbar ist statt
 * einer rohen Wallet-/Clerk-ID. Bei Namenskollisionen zwischen zwei Artists gewinnt
 * schlicht der erste Treffer (in der Praxis vernachlässigbar bei der Artist-Anzahl).
 */
export async function getArtistWalletBySlug(slug: string): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT wallet_address, display_name, clerk_name FROM user_profiles WHERE is_artist = TRUE
  `;
  for (const r of rows) {
    const name = (r.display_name as string | null) ?? (r.clerk_name as string | null);
    if (name && slugify(name) === slug) return r.wallet_address as string;
  }
  return null;
}

/**
 * Neuestes Gewinnspiel eines Artists (unabhängig vom Status) — Grundlage für den
 * stabilen, permanenten Fan-Link "/win/{artistWallet}". Da pro Artist immer nur
 * ein Gewinnspiel gleichzeitig aktiv sein darf, zeigt dieser Link nach Ende einer
 * Kampagne automatisch die nächste an, sobald sie erstellt wird — die Adresse
 * selbst ändert sich nie, wichtig z.B. für automatisierte TikTok-Kommentar-/
 * DM-Antworten, die sonst pro Kampagne erneut durch den App-Review müssten.
 */
export async function getLatestGiveawayCampaignByArtist(artistWallet: string): Promise<GiveawayCampaign | null> {
  await ensureTables();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM giveaway_campaigns WHERE artist_wallet = ${artistWallet.toLowerCase()}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  const platRows = await sql`SELECT platform, post_url, media_id FROM giveaway_campaign_platforms WHERE campaign_id = ${rows[0].id}`;
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

/**
 * Beendete Kampagne endgültig löschen (inkl. Plattformen + Teilnahmen via ON DELETE CASCADE).
 * Nur eigene, bereits beendete Kampagnen — aktive müssen zuerst beendet werden.
 */
export async function deleteGiveawayCampaign(campaignId: string, artistWallet: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM giveaway_campaigns
    WHERE id = ${campaignId} AND artist_wallet = ${artistWallet.toLowerCase()} AND status != 'active'
    RETURNING id
  `;
  return rows.length > 0;
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

  // Ein und dieselbe E-Mail-Adresse darf pro Kampagne nur einmal belohnt werden —
  // verhindert, dass eine Person über mehrere Plattformen/Handles mehrfach gewinnt.
  // (Die eigentliche, race-sichere Durchsetzung passiert atomar in creditGiveawayWinner;
  // dieser Check hier gibt nur direkt Feedback statt die Person durch die ganze
  // Kommentar-Verifikation laufen zu lassen, nur um am Ende doch nichts zu bekommen.)
  const alreadyWon = await sql`
    SELECT 1 FROM giveaway_entries
    WHERE campaign_id = ${campaignId} AND email = ${cleanEmail} AND status IN ('verified', 'credited')
    LIMIT 1
  `;
  if (alreadyWon.length > 0) {
    return { error: 'Mit dieser E-Mail-Adresse wurde bereits an diesem Gewinnspiel teilgenommen.' };
  }

  const id = `gwe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const code = generateCode(campaign.requiredText);
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

/** Prüft ob für diese E-Mail-Adresse in dieser Kampagne bereits eine Belohnung vergeben wurde. */
async function emailAlreadyWonCampaign(sql: ReturnType<typeof getDb>, campaignId: string, email: string, excludeEntryId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM giveaway_entries
    WHERE campaign_id = ${campaignId} AND email = ${email} AND status = 'credited' AND id != ${excludeEntryId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Kredit einem Gewinner gutschreiben (atomar gegen Kampagnenbudget UND Mehrfach-Gewinn
 * derselben E-Mail-Adresse geprüft — die NOT EXISTS-Bedingung läuft in derselben
 * Query wie das Budget-Update und ist damit race-sicher, auch wenn zwei Plattformen
 * derselben Person nahezu gleichzeitig verifiziert werden).
 * Gibt false zurück, wenn keine Plätze mehr frei sind oder die E-Mail bereits gewonnen hat.
 */
async function creditGiveawayWinner(campaignId: string, entryId: string, email: string, wallet: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE giveaway_campaigns
    SET winner_count = winner_count + 1
    WHERE id = ${campaignId} AND winner_count < max_winners AND status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM giveaway_entries
        WHERE campaign_id = ${campaignId} AND email = ${email} AND status = 'credited' AND id != ${entryId}
      )
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
 * Hat diese E-Mail-Adresse in dieser Kampagne bereits über eine andere Plattform
 * gewonnen, wird die Teilnahme abgelehnt (verhindert Mehrfach-Gewinn einer Person).
 */
export async function markGiveawayEntryVerified(entryId: string): Promise<{ status: 'credited' | 'verified' | 'duplicate_email'; wallet?: string; amount?: number }> {
  const sql = getDb();
  const entry = await getGiveawayEntry(entryId);
  if (!entry) throw new Error('Entry nicht gefunden');

  if (await emailAlreadyWonCampaign(sql, entry.campaignId, entry.email, entry.id)) {
    await sql`UPDATE giveaway_entries SET status = 'rejected', verified_at = NOW() WHERE id = ${entryId}`;
    return { status: 'duplicate_email' };
  }

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
    const credited = await creditGiveawayWinner(entry.campaignId, entry.id, entry.email, matchedWallet);
    if (credited) {
      const campaign = await getPublicGiveawayCampaign(entry.campaignId);
      return { status: 'credited', wallet: matchedWallet, amount: campaign?.creditReward };
    }
    // Budget in der Zwischenzeit ausgeschöpft oder E-Mail parallel andernorts gewonnen
    if (await emailAlreadyWonCampaign(sql, entry.campaignId, entry.email, entry.id)) {
      await sql`UPDATE giveaway_entries SET status = 'rejected', verified_at = NOW() WHERE id = ${entryId}`;
      return { status: 'duplicate_email' };
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
    const credited = await creditGiveawayWinner(entry.campaignId, entry.id, entry.email, walletAddress.toLowerCase());
    if (!credited && await emailAlreadyWonCampaign(sql, entry.campaignId, entry.email, entry.id)) {
      await sql`UPDATE giveaway_entries SET status = 'rejected', verified_at = NOW() WHERE id = ${entry.id}`;
    }
  }
}
