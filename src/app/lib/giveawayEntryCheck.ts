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
  // Fans sehen nur "Instagram"/"TikTok" (nie die _polska-Variante) — die Kampagne
  // kann aber für beide Plattformen zwei Posts hinterlegt haben (Dawid Faith +
  // Dawid Faith Polska). Beide werden geprüft, ein Treffer auf irgendeinem reicht.
  const variantKeys = entry.platform === 'instagram' ? ['instagram', 'instagram_polska']
    : entry.platform === 'tiktok' ? ['tiktok', 'tiktok_polska']
    : [entry.platform];
  const platformCfgs = campaign.platforms.filter(p => variantKeys.includes(p.platform));
  if (platformCfgs.length === 0) return { found: false };

  if (entry.platform === 'facebook') {
    let pageIdHint: string | null;
    if (campaign.artistWallet.toLowerCase() === DAWID_FAITH_ARTIST_WALLET) {
      pageIdHint = DAWID_FAITH_PAGE_ID;
    } else {
      const sql = getDb();
      const rows = await sql`SELECT facebook_page_id FROM user_profiles WHERE wallet_address = ${campaign.artistWallet.toLowerCase()} LIMIT 1`;
      pageIdHint = (rows[0]?.facebook_page_id as string | null) ?? null;
    }
    return verifyFacebookEntry(platformCfgs[0].postUrl, entry.code, pageIdHint, campaign.id, entry.handle, entry.id, campaign.createdAt);
  }
  if (entry.platform === 'instagram') {
    for (const cfg of platformCfgs) {
      if (!cfg.mediaId) continue;
      if (await verifyInstagramEntry(cfg.mediaId, entry.handle, campaign.requiredText)) return { found: true };
    }
    return { found: false };
  }
  if (entry.platform === 'tiktok') {
    for (const cfg of platformCfgs) {
      if (await verifyTiktokEntry(cfg.mediaId ?? cfg.postUrl, entry.handle, campaign.requiredText)) return { found: true };
    }
    return { found: false };
  }
  if (entry.platform === 'youtube') {
    return { found: await verifyYoutubeEntry(platformCfgs[0].mediaId ?? platformCfgs[0].postUrl, entry.handle, campaign.requiredText, platformCfgs[0].premiereStartsAt) };
  }
  return { found: false };
}
