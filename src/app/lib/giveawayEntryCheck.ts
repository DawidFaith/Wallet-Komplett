import { getDb } from './db';
import type { GiveawayCampaign, GiveawayEntry } from './questDb/giveaways';
import { verifyInstagramEntry, verifyTiktokEntry, verifyYoutubeEntry, verifyFacebookEntry, DAWID_FAITH_PAGE_ID } from './giveawayVerify';

// Bewusst hart hinterlegt statt aus user_profiles.facebook_page_id gelesen: das
// Feld wird nur an einer Stelle im Code automatisch befüllt (Artist-Post-Abruf
// fürs Quest-System) und war deshalb nicht zuverlässig gesetzt.
const DAWID_FAITH_ARTIST_WALLET = 'user_3dfvunr7ziaywue8bhzdqw2blsw';

/**
 * Prüft ob der Kommentar für eine Giveaway-Teilnahme gefunden wird.
 *
 * Instagram/TikTok/YouTube liefern die Kommentar-Autor:innen zuverlässig zurück,
 * daher reicht dort der Abgleich von Handle + dem Kommentar-Wort der Kampagne
 * (z.B. "dfaith") — ein zusätzlicher, pro Teilnahme generierter Code ist nicht nötig.
 *
 * Facebook liefert die Autor:innen von Post-Kommentaren nicht zuverlässig zurück
 * (kein "from"-Feld auf Page-Ebene), daher wird dort stattdessen der pro Teilnahme
 * einmalige Code aus entry.code geprüft (gleiches Verfahren wie im bestehenden
 * Facebook-Quest-System).
 */
export async function checkGiveawayEntryComment(campaign: GiveawayCampaign, entry: GiveawayEntry): Promise<{ found: boolean; verifiedName?: string }> {
  const platformCfg = campaign.platforms.find(p => p.platform === entry.platform);
  if (!platformCfg) return { found: false };

  if (entry.platform === 'facebook') {
    let pageIdHint: string | null;
    if (campaign.artistWallet.toLowerCase() === DAWID_FAITH_ARTIST_WALLET) {
      pageIdHint = DAWID_FAITH_PAGE_ID;
    } else {
      const sql = getDb();
      const rows = await sql`SELECT facebook_page_id FROM user_profiles WHERE wallet_address = ${campaign.artistWallet.toLowerCase()} LIMIT 1`;
      pageIdHint = (rows[0]?.facebook_page_id as string | null) ?? null;
    }
    return verifyFacebookEntry(platformCfg.postUrl, entry.code, pageIdHint, campaign.id, entry.handle, entry.id, campaign.createdAt);
  }
  if (entry.platform === 'instagram' || entry.platform === 'instagram_polska') {
    if (!platformCfg.mediaId) return { found: false };
    return { found: await verifyInstagramEntry(platformCfg.mediaId, entry.handle, campaign.requiredText) };
  }
  if (entry.platform === 'tiktok' || entry.platform === 'tiktok_polska') {
    return { found: await verifyTiktokEntry(platformCfg.mediaId ?? platformCfg.postUrl, entry.handle, campaign.requiredText) };
  }
  if (entry.platform === 'youtube') {
    return { found: await verifyYoutubeEntry(platformCfg.mediaId ?? platformCfg.postUrl, entry.handle, campaign.requiredText) };
  }
  return { found: false };
}
