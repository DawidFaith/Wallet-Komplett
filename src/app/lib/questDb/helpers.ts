import { getDb } from '../db';
import type {
  Platform, QuestType, QuestIndexEntry, ReputationLevel, ReputationContest,
  UserArtistReputation, ReputationLeaderboardEntry, QuestDetail, YouTubeBinding,
  QuestCompletion, QuestsByWalletEntry, PendingReward,
  QuestBundle, QuestBundleItem, QuestBundleWithItems,
} from "./types";
import type { Lang } from '../../utils/i18n';

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

const QUEST_COMMENT_POOL_DE: ReadonlyArray<string> = [
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

const QUEST_COMMENT_POOL_EN: ReadonlyArray<string> = [
  'This track is insane, on repeat all day 🔥',
  'Incredible production, so much respect 🙌',
  'Finally new music from you, what a banger 💯',
  'Straight into my playlist, love it 🎶',
  'This is next level, seriously 🚀',
  "That drop though, I'm speechless 🤯",
  'Exactly the vibes I needed ✨',
  'You keep leveling up every time 💪',
  "Banger, can't stop listening 🎧",
  'Sound design is on point, hats off 👏',
  'This hits different, so good 🔊',
  'Beautiful work, thank you for the music 🙏',
  "That hook is stuck in my head already 🎵",
  'Setting the mood, playing this all night 🌙',
  'Really really good, keep it up 🚀',
  'Pure atmosphere, gave me chills ❄️',
  'Production goes hard, love it 🔥',
  "Been on loop for hours, can't stop 🔁",
  'New favorite song, love this ❤️',
  'Perfect for late night vibes 🌌',
  'This is art, thanks for the inspiration 🎨',
  'Vibes on max, well delivered 👌',
  'That energy! So strong 💥',
  'This track got stuck immediately, congrats 🎯',
  'You nailed my taste exactly, more please 🙏',
  'Really strong tune, playing it everywhere now 📻',
  'Pure magic for the ears, amazing 🪄',
  'Love at first beat ❤️‍🔥',
  'Definitely on repeat today 🔁',
  "So atmospheric, you've got the talent 🎼",
  'Straight to favorites, top sound 🌟',
  'What a mood, feeling every beat 🥁',
  'Beat slaps, love it 🤝',
  "First note and I'm hooked already 🌊",
  'Mixing is clean, mastering even cleaner 🎚️',
  "Can't get enough, playing since this morning 🌅",
  'This track has character, feels real 🫶',
  'This is how music should sound, thank you 💎',
  'Really smooth, could listen for hours 🍃',
  'A statement sound, just huge ✨',
  "You're a real talent, keep going 🌟",
  'One of the few artists that catch me right now 🎯',
  'Just discovered you, already a fan ✨',
  "Been here since day one, always strong 🚀",
  'You deserve so much more reach, honestly 🌍',
  "Hope you tour someday, I'd be there 🎤",
  'Following since day one, congrats 🥂',
  "Your career is taking off, happy for you 📈",
  "You make exactly the music that's missing 🧩",
  'Real voice, real vision, top tier 🎙️',
  'You have style, you can hear it in every track 💼',
  'One of the best releases this year for me 🏅',
  "You're going to blow up, this is just the start 🌱",
  'Wow, just wow 😍',
  "Didn't expect that, wild 😳",
  'Fits perfectly into my routine 📅',
  'This sound is pure love, honestly 💗',
  'Hard hitting, no exaggeration 🔨',
  'Pure fire, nothing more to say 🔥',
  'Vibe check passed, with honors ✅',
  'Straight into my top 10 this year 🔝',
  "Can't get over this sound 🤤",
  'Definitely track of the month 🗓️',
  'Got chills on the first beat 🥶',
  "Nobody's doing it like you right now 🥇",
  'This track deserves more attention, shared it 🔁',
];

const QUEST_COMMENT_POOL_PL: ReadonlyArray<string> = [
  'Ten kawałek jest szalony, lecę na repeat cały dzień 🔥',
  'Niesamowita produkcja, wielki szacunek 🙌',
  'Nareszcie nowy kawałek od ciebie, co za bomba 💯',
  'Od razu ląduje w mojej playliście 🎶',
  'To jest poziom wyżej, serio 🚀',
  'Ten drop, nie mam słów 🤯',
  'Dokładnie ten klimat, którego potrzebowałem/am ✨',
  'Za każdym razem podnosisz poprzeczkę 💪',
  'Bomba, nie mogę przestać słuchać 🎧',
  'Sound design jest na miejscu, szacun 👏',
  'To wchodzi mocno, po prostu super 🔊',
  'Piękna robota, dzięki za muzykę 🙏',
  'Ten hook siedzi mi w głowie już teraz 🎵',
  'Klimat ustawiony, gram cały wieczór 🌙',
  'Naprawdę bardzo dobre, tak trzymaj! 🚀',
  'Czysta atmosfera, gęsia skórka ❄️',
  'Produkcja mocno wchodzi, bardzo mi się podoba 🔥',
  'Loop leci od godzin, nie mogę przestać 🔁',
  'To mój nowy ulubiony kawałek ❤️',
  'Idealne na nocne klimaty 🌌',
  'To jest sztuka, dzięki za inspirację 🎨',
  'Klimat na maksa, świetnie dowieziony 👌',
  'Ta energia! Po prostu mocna 💥',
  'Kawałek od razu wpadł w ucho, gratulacje 🎯',
  'Trafiasz dokładnie w mój gust, chcę więcej 🙏',
  'Bardzo mocny numer, teraz leci wszędzie 📻',
  'Czysta magia dla uszu, super 🪄',
  'To jest miłość od pierwszego beatu ❤️‍🔥',
  'Dziś zdecydowanie na repeat, tak dalej 🔁',
  'Bardzo klimatyczne, masz to po prostu 🎼',
  'Od razu do ulubionych, super brzmienie 🌟',
  'Co za nastrój, czuję każdy beat 🥁',
  'Beat wali, bardzo mi się podoba 🤝',
  'Pierwsza nuta i już w to wchodzę 🌊',
  'Miks jest czysty, mastering jeszcze czystszy 🎚️',
  'Nie mogę się nasłuchać, leci od rana 🌅',
  'Ten kawałek ma charakter, brzmi autentycznie 🫶',
  'Tak powinna brzmieć muzyka, dzięki za to 💎',
  'Bardzo smooth, mogę słuchać godzinami 🍃',
  'Brzmieniowo to jest stwierdzenie, po prostu wielkie ✨',
  'Masz prawdziwy talent, tak trzymaj 🌟',
  'Jeden z niewielu artystów, którzy teraz mnie łapią 🎯',
  'Dopiero cię odkryłem/am, już jestem fanem ✨',
  'Jestem od pierwszego dnia, zawsze mocno 🚀',
  'Zasługujesz na dużo większy zasięg, szczerze 🌍',
  'Mam nadzieję na trasę kiedyś, byłbym/byłabym tam 🎤',
  'Śledzę cię od dnia pierwszego, gratulacje 🥂',
  'Kariera idzie ostro w górę, cieszę się 📈',
  'Robisz dokładnie tę muzykę, której brakuje 🧩',
  'Prawdziwy głos, prawdziwa wizja, super 🎙️',
  'Masz styl, słychać to w każdym kawałku 💼',
  'Jeden z najlepszych wydań tego roku dla mnie 🏅',
  'Będziesz wielki/wielka, to dopiero początek 🌱',
  'Wow, po prostu wow 😍',
  'Nie spodziewałem/am się tego, szał 😳',
  'Idealnie pasuje do mojej rutyny 📅',
  'To brzmienie to czysta miłość, szczerze 💗',
  'Mocno uderza, bez przesady 🔨',
  'Czysty ogień, nic więcej nie muszę dodać 🔥',
  'Test klimatu zaliczony, z wyróżnieniem ✅',
  'Od razu w moim TOP 10 tego roku 🔝',
  'Nie mogę przestać myśleć o tym brzmieniu 🤤',
  'Zdecydowanie utwór miesiąca 🗓️',
  'Gęsia skórka już przy pierwszym beacie 🥶',
  'Nikt nie robi tego teraz tak jak ty 🥇',
  'Ten kawałek zasługuje na więcej uwagi, udostępnione 🔁',
];

/**
 * Kombinierter Pool aus allen Sprachen — jede Sprache belegt einen festen,
 * nicht überlappenden Indexbereich (siehe LANG_RANGES). So bleibt die
 * bestehende UNIQUE(quest_id, slot_index)-Spalte gültig, ohne dass sich
 * Slots zwischen Sprachen überschneiden können.
 */
const QUEST_COMMENT_POOL: ReadonlyArray<string> = [
  ...QUEST_COMMENT_POOL_DE,
  ...QUEST_COMMENT_POOL_EN,
  ...QUEST_COMMENT_POOL_PL,
];

const LANG_RANGES: Record<Lang, { start: number; end: number }> = {
  de: { start: 0, end: QUEST_COMMENT_POOL_DE.length },
  en: {
    start: QUEST_COMMENT_POOL_DE.length,
    end: QUEST_COMMENT_POOL_DE.length + QUEST_COMMENT_POOL_EN.length,
  },
  pl: {
    start: QUEST_COMMENT_POOL_DE.length + QUEST_COMMENT_POOL_EN.length,
    end: QUEST_COMMENT_POOL.length,
  },
};

/**
 * Gibt den Hash-basierten Fallback-Text zurück (nur intern als Seed-Fallback,
 * nicht mehr direkt in der Route verwendet).
 */
export function getQuestCommentText(walletAddress: string, questId: string, lang: Lang = 'de'): string {
  const range = LANG_RANGES[lang] ?? LANG_RANGES.de;
  const rangeSize = range.end - range.start;
  const seed = `${walletAddress.toLowerCase()}::${questId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = range.start + (Math.abs(hash) % rangeSize);
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
  lang: Lang = 'de',
): Promise<string> {
  const sql = getDb();
  const normalized = walletAddress.toLowerCase();

  // Bereits reserviert? (unabhängig von der aktuell übergebenen Sprache — der
  // beim ersten Aufruf zugeteilte Text bleibt für diese Wallet+Quest fix)
  const existing = await sql`
    SELECT comment_text FROM facebook_comment_slots
    WHERE quest_id = ${questId} AND wallet_address = ${normalized}
    LIMIT 1
  `;
  if (existing.length > 0) return existing[0].comment_text as string;

  const range = LANG_RANGES[lang] ?? LANG_RANGES.de;
  const rangeSize = range.end - range.start;

  // Zufälligen Startpunkt innerhalb des Sprachbereichs wählen → jede Wallet
  // bekommt beim ersten Aufruf einen zufälligen Kommentar in ihrer Sprache.
  const preferredStart = Math.floor(Math.random() * rangeSize);

  // Alle Slots im Sprachbereich (ringförmig) durchprobieren bis ein freier gefunden wird
  for (let offset = 0; offset < rangeSize; offset++) {
    const slotIndex = range.start + ((preferredStart + offset) % rangeSize);
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

  // Sprachbereich komplett belegt → Hash-Fallback (Text wird evtl. doppelt vergeben)
  return getQuestCommentText(normalized, questId, lang);
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

