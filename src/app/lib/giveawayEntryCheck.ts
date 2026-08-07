import { getDb } from './db';
import type { GiveawayCampaign, GiveawayEntry } from './questDb/giveaways';
import { verifyInstagramEntry, verifyTiktokEntry, verifyYoutubeEntry, verifyFacebookEntry } from './giveawayVerify';

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
    const sql = getDb();
    const rows = await sql`SELECT facebook_page_id FROM user_profiles WHERE wallet_address = ${campaign.artistWallet.toLowerCase()} LIMIT 1`;
    const pageIdHint = (rows[0]?.facebook_page_id as string | null) ?? null;
    return verifyFacebookEntry(platformCfg.postUrl, entry.code, pageIdHint);
  }
  if (entry.platform === 'instagram') {
    if (!platformCfg.mediaId) return { found: false };
    return { found: await verifyInstagramEntry(platformCfg.mediaId, entry.handle, campaign.requiredText) };
  }
  if (entry.platform === 'tiktok') {
    return { found: await verifyTiktokEntry(platformCfg.mediaId ?? platformCfg.postUrl, entry.handle, campaign.requiredText) };
  }
  if (entry.platform === 'youtube') {
    return { found: await verifyYoutubeEntry(platformCfg.mediaId ?? platformCfg.postUrl, entry.handle, campaign.requiredText) };
  }
  return { found: false };
}
