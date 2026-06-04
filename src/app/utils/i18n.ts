import type { SupportedLanguage } from './deepLTranslation';

export type Lang = SupportedLanguage; // 'de' | 'en' | 'pl'

type Translations = Record<string, Record<Lang, string>>;

const dict: Translations = {

  // ── Landing page ────────────────────────────────────────────────────────────

  'landing.login': {
    de: 'Login',
    en: 'Login',
    pl: 'Logowanie',
  },
  'landing.tagline': {
    de: 'Solana · Musik · Community',
    en: 'Solana · Music · Community',
    pl: 'Solana · Muzyka · Społeczność',
  },
  'landing.movement': {
    de: 'Werde Teil der\nBewegung.',
    en: 'Be part of the\nMovement.',
    pl: 'Dołącz do\nRuchu.',
  },
  'landing.headline1': {
    de: 'Sei dabei.',
    en: 'Be part of it.',
    pl: 'Bądź częścią.',
  },
  'landing.headline2': {
    de: 'Supporte deine',
    en: 'Support your',
    pl: 'Wspieraj swoich',
  },
  'landing.headline3': {
    de: 'Künstler.',
    en: 'Artists.',
    pl: 'Artystów.',
  },
  'landing.headline4': {
    de: 'Werde belohnt.',
    en: 'Get rewarded.',
    pl: 'Zdobywaj nagrody.',
  },
  'landing.sub': {
    de: 'Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.',
    en: 'The D.FAITH Ecosystem connects artists and fans — with real rewards and a real community.',
    pl: 'Ekosystem D.FAITH łączy artystów i fanów — z prawdziwymi nagrodami i prawdziwą społecznością.',
  },
  'landing.activeArtists': {
    de: 'Aktive Künstler',
    en: 'Active Artists',
    pl: 'Aktywni Artyści',
  },
  'landing.open': {
    de: 'offen',
    en: 'open',
    pl: 'otwarte',
  },
  'landing.questsAvailable_one': {
    de: 'Quest verfügbar',
    en: 'Quest available',
    pl: 'Quest dostępny',
  },
  'landing.questsAvailable_other': {
    de: 'Quests verfügbar',
    en: 'Quests available',
    pl: 'Questy dostępne',
  },
  'landing.forFans': {
    de: 'Für Fans',
    en: 'For Fans',
    pl: 'Dla Fanów',
  },
  'landing.forArtists': {
    de: 'Für Künstler',
    en: 'For Artists',
    pl: 'Dla Artystów',
  },
  'landing.cta.signup': {
    de: 'Jetzt Supporter werden',
    en: 'Become a Supporter Now',
    pl: 'Zostań Supporterem',
  },
  'landing.cta.login': {
    de: 'Bereits registriert? Einloggen',
    en: 'Already registered? Log in',
    pl: 'Masz konto? Zaloguj się',
  },

  // Fan features
  'landing.fan.1.title': {
    de: 'Verdiene D.FAITH Token',
    en: 'Earn D.FAITH Tokens',
    pl: 'Zdobywaj D.FAITH Tokeny',
  },
  'landing.fan.1.desc': {
    de: 'Like, teile, kommentiere — und erhalte echte D.FAITH Token für jeden Support. Dein Einsatz hat ab sofort echten Wert.',
    en: 'Like, share, comment — and receive real D.FAITH tokens for every support. Your effort has real value from now on.',
    pl: 'Lajkuj, udostępniaj, komentuj — i otrzymuj prawdziwe tokeny D.FAITH za każde wsparcie. Twój wkład ma teraz realną wartość.',
  },
  'landing.fan.2.title': {
    de: 'Werde zum echten Insider',
    en: 'Become a True Insider',
    pl: 'Zostań prawdziwym Insiderem',
  },
  'landing.fan.2.desc': {
    de: 'Tausche deine Token gegen exklusive Tracks, limitierte Drops und Frühzugänge — nur für aktive Supporter.',
    en: 'Exchange your tokens for exclusive tracks, limited drops and early access — only for active supporters.',
    pl: 'Wymieniaj tokeny na ekskluzywne utwory, limitowane premiery i wczesny dostęp — tylko dla aktywnych wspierających.',
  },
  'landing.fan.3.title': {
    de: 'Zeig, wie loyal du bist',
    en: 'Show Your Loyalty',
    pl: 'Pokaż swoją lojalność',
  },
  'landing.fan.3.desc': {
    de: 'Kletter im Leaderboard nach oben und lass dich von deinen Lieblingskünstlern entdecken.',
    en: 'Climb the leaderboard and get noticed by your favorite artists.',
    pl: 'Wspinaj się na szczyt rankingu i daj się odkryć swoim ulubionym artystom.',
  },

  // Artist features
  'landing.artist.1.title': {
    de: 'Deine Fans promoten dich',
    en: 'Your Fans Promote You',
    pl: 'Twoi fani promują Cię',
  },
  'landing.artist.1.desc': {
    de: 'Erstelle Aufgaben auf Instagram, TikTok, YouTube & Facebook — deine Fans werden aktiv und deine Reichweite wächst.',
    en: 'Create quests on Instagram, TikTok, YouTube & Facebook — your fans become active and your reach grows.',
    pl: 'Twórz zadania na Instagramie, TikToku, YouTube i Facebooku — Twoi fani stają się aktywni, a Twój zasięg rośnie.',
  },
  'landing.artist.2.title': {
    de: 'Dein eigener Artist-Token',
    en: 'Your Own Artist Token',
    pl: 'Twój własny token artysty',
  },
  'landing.artist.2.desc': {
    de: 'Starte mit D.FAITH Token oder erstelle deinen eigenen Token — und baue deine Community auf ein echtes Fundament.',
    en: 'Start with D.FAITH tokens or create your own token — and build your community on a solid foundation.',
    pl: 'Zacznij od tokenów D.FAITH lub stwórz własny token — i zbuduj swoją społeczność na solidnym fundamencie.',
  },
  'landing.artist.3.title': {
    de: 'Alles in einer Plattform',
    en: 'Everything in One Platform',
    pl: 'Wszystko w jednej platformie',
  },
  'landing.artist.3.desc': {
    de: 'Quests, Bundles und Kampagnen für alle Plattformen — übersichtlich in einem Dashboard.',
    en: 'Quests, bundles and campaigns for all platforms — clearly organized in one dashboard.',
    pl: 'Questy, bundle i kampanie dla wszystkich platform — przejrzyście w jednym dashboardzie.',
  },
  'landing.artist.4.title': {
    de: 'Exklusivität als Währung',
    en: 'Exclusivity as Currency',
    pl: 'Ekskluzywność jako waluta',
  },
  'landing.artist.4.desc': {
    de: 'Nur deine treuesten Fans bekommen Zugang zum Shop — das schafft echten Anreiz, aktiv zu bleiben.',
    en: 'Only your most loyal fans get access to the shop — creating real incentive to stay active.',
    pl: 'Tylko Twoi najbardziej lojalni fani mają dostęp do sklepu — to stwarza prawdziwą motywację do aktywności.',
  },

  // Artist apply form
  'landing.form.nameLabel': {
    de: 'Künstlername *',
    en: 'Artist Name *',
    pl: 'Nazwa Artysty *',
  },
  'landing.form.namePlaceholder': {
    de: 'Dein Name',
    en: 'Your Name',
    pl: 'Twoja nazwa',
  },
  'landing.form.socialLabel': {
    de: 'Social Link',
    en: 'Social Link',
    pl: 'Link społecznościowy',
  },
  'landing.form.socialPlaceholder': {
    de: 'instagram.com/…',
    en: 'instagram.com/…',
    pl: 'instagram.com/…',
  },
  'landing.form.submit': {
    de: 'Interesse anmelden',
    en: 'Register Interest',
    pl: 'Zgłoś zainteresowanie',
  },
  'landing.form.submitting': {
    de: 'Sende…',
    en: 'Sending…',
    pl: 'Wysyłanie…',
  },
  'landing.form.successSub': {
    de: 'Wir melden uns so schnell wie möglich.',
    en: "We'll get back to you as soon as possible.",
    pl: 'Skontaktujemy się z Tobą jak najszybciej.',
  },
  // ── Profile Tab ─────────────────────────────────────────────────────────────

  'profile.title': {
    de: 'Dein Profil',
    en: 'Your Profile',
    pl: 'Twój Profil',
  },
  'profile.connectWallet': {
    de: 'Verbinde deine Wallet um dein Profil, Level und Quests zu sehen.',
    en: 'Connect your wallet to see your profile, level and quests.',
    pl: 'Połącz swój portfel, aby zobaczyć profil, poziom i questy.',
  },
  'profile.ecosystem': {
    de: 'D.FAITH Ecosystem',
    en: 'D.FAITH Ecosystem',
    pl: 'D.FAITH Ecosystem',
  },
  'profile.subtitle': {
    de: 'Unterstütze Künstler · Verdiene Rewards',
    en: 'Support Artists · Earn Rewards',
    pl: 'Wspieraj Artystów · Zdobywaj Nagrody',
  },
  'profile.supporter': {
    de: 'Supporter',
    en: 'Supporter',
    pl: 'Wspierający',
  },
  'profile.artistProfile': {
    de: 'Künstler-Profil',
    en: 'Artist Profile',
    pl: 'Profil Artysty',
  },
  'profile.connectedPlatforms': {
    de: 'Verbundene Plattformen',
    en: 'Connected Platforms',
    pl: 'Połączone Platformy',
  },
  'profile.availableArtists': {
    de: 'Verfügbare Künstler',
    en: 'Available Artists',
    pl: 'Dostępni Artyści',
  },
  'profile.rewardToken': {
    de: 'Reward Token',
    en: 'Reward Token',
    pl: 'Token Nagród',
  },
  'profile.redeem': {
    de: 'Einlösen',
    en: 'Redeem',
    pl: 'Odbierz',
  },
  'profile.shopAvailable': {
    de: 'Shop verfügbar',
    en: 'Shop available',
    pl: 'Sklep dostępny',
  },
  'profile.items_one': {
    de: 'Artikel erhältlich',
    en: 'item available',
    pl: 'artykuł dostępny',
  },
  'profile.items_other': {
    de: 'Artikel erhältlich',
    en: 'items available',
    pl: 'artykuły dostępne',
  },
  'profile.open': {
    de: 'Öffnen →',
    en: 'Open →',
    pl: 'Otwórz →',
  },
  'profile.details': {
    de: 'Details →',
    en: 'Details →',
    pl: 'Szczegóły →',
  },
  'profile.reputation': {
    de: 'Reputation',
    en: 'Reputation',
    pl: 'Reputacja',
  },
  'profile.quests': {
    de: 'Quests',
    en: 'Quests',
    pl: 'Questy',
  },
  'profile.shop': {
    de: 'Shop',
    en: 'Shop',
    pl: 'Sklep',
  },
  'profile.repAt': {
    de: 'REP bei diesem Künstler',
    en: 'REP with this artist',
    pl: 'REP u tego artysty',
  },
  'profile.questBonus': {
    de: 'Quest-Bonus',
    en: 'Quest Bonus',
    pl: 'Bonus Questów',
  },
  'profile.noBio': {
    de: 'Noch keine Bio eingetragen',
    en: 'No bio added yet',
    pl: 'Brak opisu',
  },
  'profile.notConnected': {
    de: 'Nicht verbunden',
    en: 'Not connected',
    pl: 'Niepołączony',
  },
  'profile.claimSuccess': {
    de: 'Erfolgreich eingelöst!',
    en: 'Successfully redeemed!',
    pl: 'Pomyślnie odebrano!',
  },
  // ── Navigation ──────────────────────────────────────────────────────────────

  'nav.questBoard': {
    de: 'Quest Board',
    en: 'Quest Board',
    pl: 'Quest Board',
  },
  'nav.reputation': {
    de: 'Reputation',
    en: 'Reputation',
    pl: 'Reputacja',
  },
  'nav.shop': {
    de: 'Shop',
    en: 'Shop',
    pl: 'Sklep',
  },

  // ── Common buttons ──────────────────────────────────────────────────────────

  'btn.start': {
    de: 'Starten',
    en: 'Start',
    pl: 'Zacznij',
  },
  'btn.done': {
    de: 'Erledigt',
    en: 'Done',
    pl: 'Ukończono',
  },
  'btn.full': {
    de: 'Voll',
    en: 'Full',
    pl: 'Pełne',
  },
  'btn.unavailable': {
    de: 'Nicht mehr verfügbar',
    en: 'No longer available',
    pl: 'Niedostępne',
  },
  'btn.verify': {
    de: 'Verifizieren',
    en: 'Verify',
    pl: 'Zweryfikuj',
  },
  'btn.refresh': {
    de: 'Aktualisieren',
    en: 'Refresh',
    pl: 'Odśwież',
  },
  'btn.claimBonus': {
    de: 'Bonus einlösen',
    en: 'Claim Bonus',
    pl: 'Odbierz Bonus',
  },
  'btn.bonusClaimed': {
    de: 'Bundle-Bonus eingelöst',
    en: 'Bundle bonus claimed',
    pl: 'Bonus bundle odebrany',
  },
  'btn.claiming': {
    de: 'Einlösen…',
    en: 'Claiming…',
    pl: 'Odbieranie…',
  },

  // ── Quest Board / FanBoard ──────────────────────────────────────────────────

  'quest.loading': {
    de: 'Lade Quests…',
    en: 'Loading quests…',
    pl: 'Ładowanie questów…',
  },
  'quest.none': {
    de: 'Keine Quests verfügbar',
    en: 'No quests available',
    pl: 'Brak dostępnych questów',
  },
  'quest.available': {
    de: 'Verfügbare Quests',
    en: 'Available Quests',
    pl: 'Dostępne Questy',
  },
  'quest.bundles': {
    de: 'Quest-Bundles',
    en: 'Quest Bundles',
    pl: 'Pakiety Questów',
  },
  'quest.seriesLabel': {
    de: 'Quest-Reihe',
    en: 'Quest Series',
    pl: 'Seria Questów',
  },
  'quest.slots': {
    de: 'Plätze',
    en: 'slots',
    pl: 'miejsc',
  },
  'quest.slotsOf': {
    de: 'von',
    en: 'of',
    pl: 'z',
  },
  'quest.tasks': {
    de: 'Aufgaben',
    en: 'tasks',
    pl: 'zadań',
  },
  'quest.task': {
    de: 'Aufgabe',
    en: 'Task',
    pl: 'Zadanie',
  },
  'quest.connectPlatform': {
    de: 'Verifiziere dein Konto im Profil',
    en: 'Verify your account in Profile',
    pl: 'Zweryfikuj konto w Profilu',
  },
  'quest.allCompleteDesc': {
    de: 'Alle {n} Quests abschließen → Abschluss-Bonus!',
    en: 'Complete all {n} quests → Completion Bonus!',
    pl: 'Ukończ wszystkie {n} questy → Bonus Ukończenia!',
  },
  'quest.levelBonus': {
    de: 'inkl. +{n}% Level-Bonus',
    en: 'incl. +{n}% level bonus',
    pl: 'w tym +{n}% bonus poziomowy',
  },
  'quest.progressLabel': {
    de: '{done} von {total} Plätzen belegt',
    en: '{done} of {total} slots filled',
    pl: '{done} z {total} miejsc zajętych',
  },
  'quest.tasksProgress': {
    de: '{done} von {total} Aufgaben erledigt',
    en: '{done} of {total} tasks done',
    pl: '{done} z {total} zadań ukończono',
  },
  'quest.lockConnect': {
    de: 'verknüpfen',
    en: 'connect',
    pl: 'połącz',
  },
  'quest.creditsBalance': {
    de: 'Guthaben',
    en: 'Balance',
    pl: 'Saldo',
  },

  // Platform lock texts
  'quest.lock.youtube': {
    de: 'YouTube verknüpfen',
    en: 'Connect YouTube',
    pl: 'Połącz YouTube',
  },
  'quest.lock.instagram': {
    de: 'Instagram verknüpfen',
    en: 'Connect Instagram',
    pl: 'Połącz Instagram',
  },
  'quest.lock.tiktok': {
    de: 'TikTok verknüpfen',
    en: 'Connect TikTok',
    pl: 'Połącz TikTok',
  },
  'quest.lock.facebook': {
    de: 'Facebook verknüpfen',
    en: 'Connect Facebook',
    pl: 'Połącz Facebook',
  },
};

/** Gibt den übersetzten String für `key` in `lang` zurück. Fallback: Deutsch */
export function t(key: string, lang: Lang): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] ?? entry['de'] ?? key;
}

/** Gibt `count` zurück und wählt automatisch Singular/Plural-Key */
export function tPlural(singularKey: string, pluralKey: string, count: number, lang: Lang): string {
  return count === 1 ? t(singularKey, lang) : t(pluralKey, lang);
}

/** Ersetzt {placeholder} in einem übersetzten String */
export function tFmt(key: string, lang: Lang, vars: Record<string, string | number>): string {
  let str = t(key, lang);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, String(v));
  }
  return str;
}
