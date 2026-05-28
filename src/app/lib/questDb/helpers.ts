import { getDb } from '../db';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";

// ─── YouTube Shorts Helpers ───────────────────────────────────────────────────

/** Extrahiert die Video-ID aus einem YouTube Shorts Link */
export function extractShortsVideoId(input: string): string | null {
  const trimmed = input.trim();
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

/** Baut den öffentlichen Shorts-URL aus einer Video-ID */
export function buildShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

/** Deterministischer Verifikationscode aus Wallet-Adresse */
export function getVerificationCode(walletAddress: string): string {
  return `DFAITH-${walletAddress.slice(2, 10).toUpperCase()}`;
}

// ─── Comment-Quest: natürlich klingender Kommentar pro Wallet+Quest ──────────
//
// Da die Facebook Graph API aus Datenschutzgründen für User-Kommentare
// kein `from`-Feld zurückgibt, identifizieren wir den Kommentar des Users
// über einen deterministisch gewählten Text aus einem festen Pool.
// Pro (wallet, questId) wird IMMER derselbe Kommentar generiert, jeder
// User bekommt aber einen anderen → Eindeutigkeit gegeben.

const QUEST_COMMENT_POOL: ReadonlyArray<string> = [
  // Track / Sound (1-40)
  'Mega Track, läuft bei mir auf Repeat! 🔥',
  'Krass produziert, Respekt 🙌',
  'Endlich neuer Sound von dir, was für ein Banger 💯',
  'Hammer, geht direkt in meine Playlist 🎶',
  'Das hier ist auf einem ganz anderen Level 🚀',
  'Boah, dieser Drop! Ich bin geflasht 🤯',
  'Genau die Vibes die ich gebraucht habe ✨',
  'Nice, du legst echt jedes Mal eine Schippe drauf 💪',
  'Banger! Kann nicht aufhören es zu hören 🎧',
  'Sounddesign on point, Hut ab 👏',
  'Das geht direkt rein, einfach stark 🔊',
  'Feinste Arbeit, danke für die Musik 🙏',
  'Was für eine Hook, bleibt sofort hängen 🎵',
  'Mood gesetzt, Track läuft den ganzen Abend 🌙',
  'Richtig richtig gut, weiter so! 🚀',
  'Atmosphäre pur, gänsehaut pur ❄️',
  'Production geht hart, gefällt mir extrem 🔥',
  'Loop läuft seit Stunden, kann nicht aufhören 🔁',
  'Das ist mein neuer Lieblingssong, fett! ❤️',
  'Sound ist ein Träumchen, perfekt für die Late-Night-Vibes 🌌',
  'Das ist Kunst, danke für die Inspiration 🎨',
  'Vibes auf Maximum, top abgeliefert 👌',
  'Diese Energie! Einfach nur stark 💥',
  'Track ist sofort hängen geblieben, Glückwunsch 🎯',
  'Du triffst genau meinen Geschmack, mehr davon 🙏',
  'Sehr starke Nummer, läuft jetzt überall mit 📻',
  'Pure Magie auf den Ohren, Hammer 🪄',
  'Das ist Liebe auf die ersten Beats ❤️‍🔥',
  'Definitiv on repeat heute, weiter so 🔁',
  'Sehr atmosphärisch, du hast es einfach drauf 🎼',
  'Sofort in die Lieblingsliste, top Sound 🌟',
  'Was für eine Stimmung, ich fühl jeden Beat 🥁',
  'Beat slaps, gefällt mir richtig 🤝',
  'Erste Note und schon im Flow, krass 🌊',
  'Mixing ist sauber, Mastering noch sauberer 🎚️',
  'Ich bekomme nicht genug, läuft seit heute morgen 🌅',
  'Track hat Charakter, fühlt sich echt an 🫶',
  'So muss Musik klingen, danke dafür 💎',
  'Sehr smooth, kann ich stundenlang hören 🍃',
  'Klanglich ein Statement, einfach groß ✨',

  // Bass / Drums / Hook (41-70)
  '808s knallen, brauche mehr davon 💣',
  'Snare sitzt perfekt, Mix ist top 🔊',
  'Diese Hook lässt mich nicht los, krass 🎤',
  'Bassline ist heavy, fühlt sich richtig fett an 🔉',
  'Hi-Hats tanzen, einfach geil produziert 🎛️',
  'Kick ist tight, geht direkt in die Brust 💥',
  'Melodie hat Suchtfaktor, weiter so 🌀',
  'Refrain ist sofort drin, große Klasse 🎶',
  'Bridge ist genial, hätte ich nicht erwartet 🔀',
  'Outro hat mich erwischt, wow 🎬',
  'Intro reißt sofort mit, Hammer Einstieg 🚪',
  'Pre-Chorus baut perfekt auf, super gemacht 📈',
  'Verses haben echt Tiefe, da steckt was drin 📚',
  'Drop ist absolute Wucht, Mann 💯',
  'Breakdown lässt einen kurz Luft holen, dann gehts richtig los 🌬️',
  'Build-up war ein Erlebnis, voll cinematic 🎥',
  'Die Layers im Beat sind perfekt verzahnt 🧩',
  'Sub-Bass schiebt, mein Subwoofer dankt 🔊',
  'Vocal Chop ist Gold wert, klasse Detail ✨',
  'Sample-Auswahl ist on point, Geschmack pur 👌',
  'Bridge nach 2 Minuten, einfach perfekt platziert ⏱️',
  'Drum-Pattern ist innovativ, gefällt mir sehr 🥁',
  'Synth-Lead schmilzt einem die Ohren weg 🎹',
  'Pad-Sounds sind cremig, klingt warm 🍯',
  'Stereo-Bild ist breit, fühlt sich riesig an 🌐',
  'Reverb-Tails sind Träume, klanglich top 💫',
  'Sidechain ist sauber, atmet richtig schön 🌬️',
  'Vocal-Mix ist on point, jedes Wort klar 🎙️',
  'Harmonien klingen wie Sahne 🍰',
  'Groove ist unfassbar, Kopfnicker garantiert 🤘',

  // Feeling / Emotion (71-110)
  'Hat mich wirklich berührt, danke für die Musik 🥺',
  'Gänsehaut von Anfang bis Ende ❄️',
  'Tränen in den Augen, so schön 🥹',
  'Habe lange auf so einen Sound gewartet 🕰️',
  'Macht mir den Tag besser, ehrlich 🌞',
  'Stimmung passt einfach perfekt zu meinem Mood 💭',
  'Hör das auf dem Heimweg, immer wieder 🚶',
  'Begleitet mich gerade durch eine harte Zeit, danke 🙏',
  'Bringt mich runter und gleichzeitig hoch, magisch ✨',
  'Erinnert mich an gute alte Zeiten 📼',
  'Macht süchtig, im positiven Sinne 🍫',
  'Werde das beim Sport hören, perfektes Tempo 🏋️',
  'Genau das richtige für die Autofahrt 🚗',
  'Perfekt zum Chillen am Wochenende 🛋️',
  'Lieblings-Track des Tages, easy 🏆',
  'Habe heute schon 10 Mal gehört, kein Ende in Sicht 🔄',
  'Inspiriert mich richtig, mache gleich auch Musik 🎼',
  'Beim ersten Hören schon Suchtgefahr ⚠️',
  'Macht definitiv Lust auf mehr 🍿',
  'Glaube das wird mein Sommer-Track 2026 ☀️',
  'Definitiv Winter-Vibes, perfekt 🥶',
  'Setzt mich in einen ganz anderen Zustand, krass 🌀',
  'Das ist Therapie für die Ohren 🛋️',
  'Fühle mich gerade frei, danke für den Vibe 🕊️',
  'Hör das gleich nochmal, ist zu gut 🔁',
  'Bringt sofort gute Laune 😊',
  'Erinnert mich an meinen ersten Sommerurlaub 🏖️',
  'Werde das auf meiner nächsten Party spielen 🪩',
  'Studio-Sessions mit dem Track im Hintergrund? Yes please 🎙️',
  'Macht alles besser, sogar Montagmorgen 🌅',
  'Schließe die Augen und bin woanders 🌍',
  'Hat Soul, das spürt man sofort 🫶',
  'Trifft genau ins Herz, stark gemacht 💖',
  'Eines dieser Lieder die hängen bleiben 📌',
  'Verbindet sich sofort mit deinem Gefühl 🔗',
  'Hat Tiefe, geht über reines Hören hinaus 🌊',
  'Heilende Wirkung, ehrlich gesagt 🌿',
  'Bringt mich in einen Flow, super Sache 🌪️',
  'Pure Eskalation, ich bin im Loop 🔁',
  'Lässt mich alles um mich herum vergessen 🌌',

  // Künstler-Wertschätzung (111-150)
  'Du bist ein echtes Talent, weiter so 🌟',
  'Einer der wenigen Artists die mich aktuell catchen 🎯',
  'Habe dich erst entdeckt, schon Fan ✨',
  'Bin von Anfang an dabei, immer wieder stark 🚀',
  'Verdienst viel mehr Reichweite, ehrlich 🌍',
  'Hoffe du machst mal eine Tour, wäre dabei 🎤',
  'Folge dir seit Tag eins, glückwunsch 🥂',
  'Karriere geht steil, freu mich für dich 📈',
  'Schreibe schon lange dein Name auf meine Wunschliste 📝',
  'Du machst genau die Musik die fehlt 🧩',
  'Echte Stimme, echte Vision, top 🎙️',
  'Hast Stil, das hört man bei jedem Track 💼',
  'Eine der besten Releases dieses Jahr für mich 🏅',
  'Glaube du wirst gross, das ist erst der Anfang 🌱',
  'Album wäre der Wahnsinn, bitte mach eins 💽',
  'Wäre cool wenn du mal Features machst, hab da Ideen 🤝',
  'Deine Musik fühlt sich ehrlich an, das ist selten 💯',
  'Du gehst deinen eigenen Weg, das respektier ich 🛤️',
  'Charisma im Sound, einfach unique 🎭',
  'Sehe dich bald auf den großen Bühnen 🎪',
  'Du bist underrated, das muss sich ändern 📢',
  'Bin Stolz dich entdeckt zu haben 🔍',
  'Werde dich überall weiterempfehlen 🗣️',
  'Bist gerade mein Lieblingsartist, ehrlich 💎',
  'Habe alle deine Tracks gehört, dieser ist top 🥇',
  'Spielst in einer eigenen Liga, weiter so 🏆',
  'Mehr von dir, immer mehr 🙏',
  'Sound ist erkennbar, das ist Gold wert 🔑',
  'Du hast eine Handschrift, das merkt man 🖋️',
  'Realer Künstler in einer Welt voller Trends 🎨',
  'Brauche dringend Merch von dir, wann? 👕',
  'Wann kommt das Musikvideo? Bin schon gespannt 🎬',
  'Setlist für die Tour, ich bin bereit 📋',
  'Würde dich gerne mal live sehen, halt mich up to date 📅',
  'Bist die Zukunft, glaube fest dran ✨',
  'Hoffe du bleibst dir treu, das ist dein Stärke 💫',
  'Authentisch durch und durch, weiter so 🫡',
  'Mit jedem Release wirst du besser 📊',
  'Bist eine Bereicherung für die Szene 🌍',
  'Wenn du irgendwo auflegst, ich bin da 🪩',

  // Allgemein / Reaction (151-200+)
  'Ok das ist echt richtig gut 👀',
  'Wow, einfach wow 😍',
  'Habe nicht damit gerechnet, krass 😳',
  'Endgegner-Track, lass dir gesagt sein 🐉',
  'Fügt sich perfekt in meine Routine ein 📅',
  'Dieser Sound ist Liebe, klar 💗',
  'Hammerhart, ohne Übertreibung 🔨',
  'Pures Feuer, mehr brauche ich nicht zu sagen 🔥',
  'Vibe-Check bestanden, mit Auszeichnung ✅',
  'Direkt in meine Top 10 dieses Jahr 🔝',
  'Lasse niemanden anders ran, das hört nur mein Player 🎧',
  'Komm gerade nicht über diesen Sound hinweg 🤤',
  'Brauche unbedingt eine instrumentale Version 🎹',
  'Acapella wäre auch goldwert 🎤',
  'Remix-Potential ist riesig, bitte 🎛️',
  'Sicher dass du das selbst gemacht hast? Krass 😂',
  'Spiele das gleich für meine Crew, die werden flippen 👥',
  'Plattenkauf in Planung, falls Vinyl kommt 💿',
  'Schon abgespeichert, läuft gleich nochmal 💾',
  'Mit Sicherheit Track des Monats 🗓️',
  'Habe einen Schauer beim ersten Beat bekommen 🥶',
  'Sound der hängen bleibt, lange 🪝',
  'Diese Melodie verfolgt mich, im besten Sinne 🎶',
  'Genau die Frequenzen die ich liebe 📡',
  'Habe Großes erwartet, du hast geliefert 📦',
  'Niemand macht es gerade so wie du 🥇',
  'Dieser Track ist Therapie, ehrlich 🛋️',
  'Ich fühle mich nach dem Hören wie neugeboren 🌅',
  'So muss neuer Sound klingen, danke 💚',
  'Den hör ich mir 100 Mal an, easy 💯',
  'Soundgewordene Inspiration, top 💡',
  'Habe nichts mehr zu sagen, einfach perfekt 🤐',
  'Ich melde mich jetzt offiziell als Fan an ✍️',
  'Track verdient mehr Aufmerksamkeit, geteilt 🔁',
  'Bookmark gesetzt, kommt definitiv wieder 🔖',
  'Atmet richtig schön, fühlt sich lebendig an 🫁',
  'Sehr cleane Produktion, kann man so lassen 🧼',
  'Energie auf 100, kann nicht still sitzen 🕺',
  'Dancefloor-ready, ich bin bereit 💃',
  'Headphone-Experience erster Klasse 🎧',
  'Speaker-Test mit voller Lautstärke, hält stand 📢',
  'Den lass ich auf Loop in der Bahn, perfekter Soundtrack 🚆',
  'Sound zum Träumen, sehr cinematic 🎞️',
  'Track hat ein Storytelling, gefällt mir extrem 📖',
  'Gute Energie aus den Lautsprechern, danke 🔋',
  'Mit besseren Songs könnte man den Tag nicht starten 🌄',
  'Wenn das nicht trendet, weiß ich auch nicht ⚠️',
  'Sehr cinematic, kommt das in einen Film? 🎬',
  'Würde sofort dazu tanzen, los gehts 💃',
  'Endlich mal wieder Musik mit Charakter 🎭',
];

/**
 * Gibt den Hash-basierten Fallback-Text zurück (nur intern als Seed-Fallback,
 * nicht mehr direkt in der Route verwendet).
 */
export function getQuestCommentText(walletAddress: string, questId: string): string {
  const seed = `${walletAddress.toLowerCase()}::${questId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % QUEST_COMMENT_POOL.length;
  return QUEST_COMMENT_POOL[idx];
}

/**
 * Reserviert einen eindeutigen Kommentarslot für (questId, walletAddress).
 *
 * Strategie:
 *   - Existiert bereits ein Eintrag → gibt denselben Text zurück (idempotent).
 *   - Sonst: findet den nächsten slot_index der für diesen Quest noch nicht
 *     vergeben ist, und speichert ihn atomar per INSERT … ON CONFLICT DO NOTHING
 *     + sofortigem Nachlesen (Retry-Loop für Race Conditions).
 *   - Sind alle 200 Slots belegt → fällt auf Hash-Fallback zurück (kein Fehler).
 */
export async function reserveQuestCommentSlot(
  questId: string,
  walletAddress: string,
): Promise<string> {
  const sql = getDb();
  const normalized = walletAddress.toLowerCase();

  // Bereits reserviert?
  const existing = await sql`
    SELECT comment_text FROM facebook_comment_slots
    WHERE quest_id = ${questId} AND wallet_address = ${normalized}
    LIMIT 1
  `;
  if (existing.length > 0) return existing[0].comment_text as string;

  const poolSize = QUEST_COMMENT_POOL.length;

  // Zufälligen Startpunkt wählen → jede Wallet bekommt beim ersten Aufruf einen zufälligen Kommentar.
  // Bei weiteren Aufrufen wird der gespeicherte Slot aus der DB zurückgegeben (s.o.).
  const preferredStart = Math.floor(Math.random() * poolSize);

  // Alle Slots ab dem Startpunkt (ringförmig) durchprobieren bis ein freier gefunden wird
  for (let offset = 0; offset < poolSize; offset++) {
    const slotIndex = (preferredStart + offset) % poolSize;
    const text = QUEST_COMMENT_POOL[slotIndex];
    try {
      await sql`
        INSERT INTO facebook_comment_slots (quest_id, wallet_address, slot_index, comment_text)
        VALUES (${questId}, ${normalized}, ${slotIndex}, ${text})
      `;
      return text;
    } catch {
      // PRIMARY KEY- oder UNIQUE-Verletzung: entweder unser Wallet hat schon einen Slot
      // (race mit eigenem Request) oder dieser slot_index ist durch ein anderes Wallet belegt
      const raceCheck = await sql`
        SELECT comment_text FROM facebook_comment_slots
        WHERE quest_id = ${questId} AND wallet_address = ${normalized}
        LIMIT 1
      `;
      if (raceCheck.length > 0) return raceCheck[0].comment_text as string;
      // slot_index belegt → nächsten Slot versuchen (offset++ im Loop)
    }
  }

  // Pool komplett belegt → Hash-Fallback (Text wird evtl. doppelt vergeben)
  return getQuestCommentText(normalized, questId);
}

/**
 * Liest den bereits reservierten Kommentartext aus der DB.
 * Gibt null zurück wenn keine Reservierung gefunden.
 */
export async function getReservedQuestCommentSlot(
  questId: string,
  walletAddress: string,
): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT comment_text FROM facebook_comment_slots
    WHERE quest_id = ${questId} AND wallet_address = ${walletAddress.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0 ? (rows[0].comment_text as string) : null;
}

// ─── Device Fingerprint Schutz ────────────────────────────────────────────────

/**
 * Speichert einen Gerät-Fingerprint + Wallet-Kombination.
 * Gibt die Anzahl der verschiedenen Wallets zurück die von diesem Fingerprint verifiziert haben.
 */
export async function recordFingerprintVerification(
  fingerprint: string,
  walletAddress: string
): Promise<number> {
  const sql = getDb();
  await sql`
    INSERT INTO device_fingerprints (fingerprint, wallet_address)
    VALUES (${fingerprint}, ${walletAddress.toLowerCase()})
    ON CONFLICT (fingerprint, wallet_address) DO NOTHING
  `;
  const rows = await sql`
    SELECT COUNT(DISTINCT wallet_address) AS cnt
    FROM device_fingerprints
    WHERE fingerprint = ${fingerprint}
  `;
  return Number(rows[0]?.cnt ?? 0);
}

/** Gibt die Anzahl verschiedener Wallets zurück die von diesem Fingerprint stammen. */
export async function getFingerprintWalletCount(fingerprint: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    SELECT COUNT(DISTINCT wallet_address) AS cnt
    FROM device_fingerprints
    WHERE fingerprint = ${fingerprint}
  `;
  return Number(rows[0]?.cnt ?? 0);
}

