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

  // ── Common UI ────────────────────────────────────────────────────────────────

  'common.back': { de: 'Zurück', en: 'Back', pl: 'Wróć' },
  'common.close': { de: 'Schließen', en: 'Close', pl: 'Zamknij' },
  'common.cancel': { de: 'Abbrechen', en: 'Cancel', pl: 'Anuluj' },
  'common.save': { de: 'Speichern', en: 'Save', pl: 'Zapisz' },
  'common.edit': { de: 'Bearbeiten', en: 'Edit', pl: 'Edytuj' },
  'common.delete': { de: 'Löschen', en: 'Delete', pl: 'Usuń' },
  'common.confirm': { de: 'Bestätigen', en: 'Confirm', pl: 'Potwierdź' },
  'common.loading': { de: 'Lädt…', en: 'Loading…', pl: 'Ładowanie…' },
  'common.error': { de: 'Fehler', en: 'Error', pl: 'Błąd' },
  'common.success': { de: 'Erfolgreich', en: 'Successful', pl: 'Sukces' },
  'common.noData': { de: 'Keine Daten', en: 'No data', pl: 'Brak danych' },
  'common.allArtists': { de: 'Alle Künstler', en: 'All Artists', pl: 'Wszyscy Artyści' },
  'common.open': { de: 'Öffnen', en: 'Open', pl: 'Otwórz' },
  'common.next': { de: 'Weiter', en: 'Next', pl: 'Dalej' },
  'common.prev': { de: 'Zurück', en: 'Previous', pl: 'Poprzedni' },
  'common.refresh': { de: 'Aktualisieren', en: 'Refresh', pl: 'Odśwież' },
  'common.add': { de: 'Hinzufügen', en: 'Add', pl: 'Dodaj' },
  'common.create': { de: 'Erstellen', en: 'Create', pl: 'Utwórz' },
  'common.apply': { de: 'Anwenden', en: 'Apply', pl: 'Zastosuj' },
  'common.send': { de: 'Senden', en: 'Send', pl: 'Wyślij' },
  'common.copy': { de: 'Kopieren', en: 'Copy', pl: 'Kopiuj' },
  'common.copied': { de: 'Kopiert!', en: 'Copied!', pl: 'Skopiowano!' },
  'common.or': { de: 'oder', en: 'or', pl: 'lub' },
  'common.and': { de: 'und', en: 'and', pl: 'i' },
  'common.yes': { de: 'Ja', en: 'Yes', pl: 'Tak' },
  'common.no': { de: 'Nein', en: 'No', pl: 'Nie' },
  'common.pleaseWait': { de: 'Bitte warten…', en: 'Please wait…', pl: 'Proszę czekać…' },
  'common.loginRequired': { de: 'Bitte einloggen', en: 'Please log in', pl: 'Zaloguj się' },
  'common.notAvailable': { de: 'Nicht verfügbar', en: 'Not available', pl: 'Niedostępne' },
  'common.unknown': { de: 'Unbekannt', en: 'Unknown', pl: 'Nieznany' },
  'common.minutes': { de: 'Minuten', en: 'Minutes', pl: 'Minut' },
  'common.hours': { de: 'Stunden', en: 'Hours', pl: 'Godzin' },

  // ── Shop ─────────────────────────────────────────────────────────────────────

  'shop.title': { de: 'Shop', en: 'Shop', pl: 'Sklep' },
  'shop.noItems': { de: 'Dieser Künstler hat noch keine Items im Shop.', en: 'This artist has no items in the shop yet.', pl: 'Ten artysta nie ma jeszcze produktów w sklepie.' },
  'shop.noArtists': { de: 'Noch keine Künstler haben Items im Shop.', en: 'No artists have items in the shop yet.', pl: 'Żaden artysta nie ma jeszcze produktów w sklepie.' },
  'shop.openDirect': { de: 'Direkt öffnen', en: 'Open directly', pl: 'Otwórz bezpośrednio' },
  'shop.openContent': { de: 'Inhalt öffnen', en: 'Open content', pl: 'Otwórz treść' },
  'shop.loginRequired': { de: 'Bitte einloggen um den Shop zu nutzen.', en: 'Please log in to use the shop.', pl: 'Zaloguj się, aby korzystać ze sklepu.' },
  'shop.levelRequired': { de: 'Nur Fans ab Level {n} können dieses Item kaufen.', en: 'Only fans from level {n} can buy this item.', pl: 'Tylko fani od poziomu {n} mogą kupić ten produkt.' },
  'shop.invalidPrice': { de: 'Ungültiger Preis', en: 'Invalid price', pl: 'Nieprawidłowa cena' },
  'shop.invalidTokenPrice': { de: 'Ungültiger Token-Preis', en: 'Invalid token price', pl: 'Nieprawidłowa cena tokenów' },
  'shop.exclusive': { de: 'Exklusiv', en: 'Exclusive', pl: 'Ekskluzywne' },
  'shop.buy': { de: 'Kaufen', en: 'Buy', pl: 'Kup' },
  'shop.bought': { de: 'Gekauft', en: 'Purchased', pl: 'Zakupiono' },
  'shop.price': { de: 'Preis', en: 'Price', pl: 'Cena' },
  'shop.addItem': { de: 'Item hinzufügen', en: 'Add item', pl: 'Dodaj produkt' },
  'shop.editItem': { de: 'Item bearbeiten', en: 'Edit item', pl: 'Edytuj produkt' },
  'shop.deleteItem': { de: 'Item löschen', en: 'Delete item', pl: 'Usuń produkt' },
  'shop.confirmDelete': { de: 'Item wirklich löschen?', en: 'Really delete item?', pl: 'Na pewno usunąć produkt?' },
  'shop.customDuration': { de: 'Eigene Dauer…', en: 'Custom duration…', pl: 'Własny czas…' },

  // ── Reputation ──────────────────────────────────────────────────────────────

  'rep.title': { de: 'Reputation', en: 'Reputation', pl: 'Reputacja' },
  'rep.noArtists': { de: 'Noch sind keine Künstler registriert.', en: 'No artists registered yet.', pl: 'Brak zarejestrowanych artystów.' },
  'rep.nextReward': { de: 'Nächster Reward', en: 'Next Reward', pl: 'Następna Nagroda' },
  'rep.nextRewardAt': { de: 'Nächster Reward bei Lv.{n} – {name}', en: 'Next reward at Lv.{n} – {name}', pl: 'Następna nagroda na Poz.{n} – {name}' },
  'rep.claimCredits': { de: '{n} Credits abholen!', en: 'Claim {n} credits!', pl: 'Odbierz {n} kredytów!' },
  'rep.claiming': { de: 'Wird eingelöst…', en: 'Claiming…', pl: 'Odbieranie…' },
  'rep.contestRunning': { de: '🟢 Contest läuft', en: '🟢 Contest running', pl: '🟢 Konkurs trwa' },
  'rep.contestExpired': { de: '⏰ Contest abgelaufen', en: '⏰ Contest expired', pl: '⏰ Konkurs wygasł' },
  'rep.contestEnded': { de: '✅ Contest beendet', en: '✅ Contest ended', pl: '✅ Konkurs zakończony' },
  'rep.contestExpiring': { de: '⏰ Contest läuft aus', en: '⏰ Contest expiring', pl: '⏰ Konkurs wygasa' },
  'rep.addLevel': { de: 'Level hinzufügen', en: 'Add level', pl: 'Dodaj poziom' },
  'rep.addSlot': { de: 'Weiteren Platz hinzufügen', en: 'Add another slot', pl: 'Dodaj kolejne miejsce' },
  'rep.quarterDistributed': { de: '✅ {q} verteilt', en: '✅ {q} distributed', pl: '✅ {q} rozdystrybuowano' },
  'rep.quarterExpired': { de: '⏰ {q} abgelaufen', en: '⏰ {q} expired', pl: '⏰ {q} wygasło' },
  'rep.quarterRunning': { de: '🟢 {q} läuft', en: '🟢 {q} running', pl: '🟢 {q} trwa' },
  'rep.questBonus': { de: '+{n}% Quest-Bonus', en: '+{n}% Quest Bonus', pl: '+{n}% Bonus Questów' },
  'rep.repAt': { de: '{n} REP bei diesem Künstler', en: '{n} REP with this artist', pl: '{n} REP u tego artysty' },

  // ── Solana Wallet ────────────────────────────────────────────────────────────

  'sol.mintingActive': { de: 'Minting aktiv — weitere Token können erstellt werden', en: 'Minting active — more tokens can be created', pl: 'Minting aktywny — można tworzyć więcej tokenów' },
  'sol.mintingDisabled': { de: 'Minting dauerhaft deaktiviert — feste Gesamtmenge', en: 'Minting permanently disabled — fixed total supply', pl: 'Minting trwale wyłączony — stała podaż' },
  'sol.invalidRecipient': { de: 'Empfänger-Adresse eingeben', en: 'Enter recipient address', pl: 'Podaj adres odbiorcy' },
  'sol.invalidAmount': { de: 'Ungültiger Betrag', en: 'Invalid amount', pl: 'Nieprawidłowa kwota' },
  'sol.send': { de: 'Senden', en: 'Send', pl: 'Wyślij' },
  'sol.recipient': { de: 'Empfänger', en: 'Recipient', pl: 'Odbiorca' },
  'sol.balance': { de: 'Guthaben', en: 'Balance', pl: 'Saldo' },
  'sol.wallet': { de: 'Wallet', en: 'Wallet', pl: 'Portfel' },

  // ── Verify Modals ────────────────────────────────────────────────────────────

  'verify.openPlatform': { de: 'Öffne das {platform} oben', en: 'Open {platform} above', pl: 'Otwórz {platform} powyżej' },
  'verify.openReel': { de: 'Öffne das Reel oben', en: 'Open the Reel above', pl: 'Otwórz Reela powyżej' },
  'verify.openReelBelow': { de: 'Öffne das Reel unten', en: 'Open the Reel below', pl: 'Otwórz Reela poniżej' },
  'verify.clickVerify': { de: 'Klicke auf „Prüfen"', en: 'Click "Verify"', pl: 'Kliknij „Sprawdź"' },
  'verify.likeConfirmed': { de: '🎉 Like bestätigt!', en: '🎉 Like confirmed!', pl: '🎉 Like potwierdzony!' },
  'verify.engagementConfirmed': { de: '🎉 Engagement bestätigt!', en: '🎉 Engagement confirmed!', pl: '🎉 Zaangażowanie potwierdzone!' },
  'verify.repostConfirmed': { de: '🎉 Repost bestätigt!', en: '🎉 Repost confirmed!', pl: '🎉 Repost potwierdzony!' },
  'verify.likeNotFound': { de: 'Like noch nicht erkannt. YouTube braucht manchmal einen Moment – kurz warten und erneut prüfen.', en: 'Like not detected yet. YouTube sometimes needs a moment – wait briefly and try again.', pl: 'Polubienie nie zostało jeszcze wykryte. YouTube czasami potrzebuje chwili – poczekaj chwilę i spróbuj ponownie.' },
  'verify.igNotFound': { de: 'Aktionen noch nicht erkannt. Instagram braucht manchmal kurz – warte etwas und prüfe erneut.', en: 'Actions not detected yet. Instagram sometimes needs a moment – wait and try again.', pl: 'Akcje nie zostały jeszcze wykryte. Instagram czasami potrzebuje chwili – poczekaj i spróbuj ponownie.' },
  'verify.likeHint': { de: 'Hast du das Video bereits geliked? Dann entferne den Like zuerst, kehre hierher zurück, starte den Quest neu und like es dann erneut.', en: 'Have you already liked the video? Remove the like first, come back here, restart the quest and like it again.', pl: 'Czy już polubiłeś film? Usuń polubienie, wróć tutaj, uruchom quest ponownie i polub ponownie.' },
  'verify.igHint': { de: 'Falls du das Reel bereits geliked oder gespeichert hast: entferne die Aktion zuerst, kehre hierher zurück, starte den Quest neu und führe die Aktion dann erneut durch.', en: 'If you already liked or saved the reel: remove the action first, come back here, restart the quest and redo it.', pl: 'Jeśli już polubiłeś lub zapisałeś Reela: najpierw usuń akcję, wróć tutaj, uruchom quest ponownie i powtórz.' },
  'verify.repostHint': { de: 'Falls du das Reel bereits repostet hast: entferne den Repost zuerst, kehre hierher zurück, starte den Quest neu und reposte es dann erneut.', en: 'If you already reposted the reel: remove the repost first, come back here, restart the quest and repost.', pl: 'Jeśli już udostępniłeś Reela: najpierw usuń repost, wróć tutaj, uruchom quest ponownie i udostępnij ponownie.' },
  'verify.likeVideo': { de: 'Like das Video und klicke dann auf „Geliked – Prüfen"', en: 'Like the video and click "Liked – Verify"', pl: 'Polub film i kliknij „Polubiono – Sprawdź"' },
  'verify.likedCheck': { de: 'Geliked – Prüfen', en: 'Liked – Verify', pl: 'Polubiono – Sprawdź' },
  'verify.checkBtn': { de: 'Prüfen', en: 'Verify', pl: 'Sprawdź' },
  'verify.commentsChecking': { de: 'Kommentare werden geprüft…', en: 'Checking comments…', pl: 'Sprawdzanie komentarzy…' },
  'verify.openPost': { de: 'Beitrag öffnen & Quest starten', en: 'Open post & start quest', pl: 'Otwórz post i rozpocznij quest' },
  'verify.openPostShare': { de: 'Beitrag öffnen & als Story teilen', en: 'Open post & share as story', pl: 'Otwórz post i udostępnij jako story' },
  'verify.sendToArtist': { de: 'Schicke sie an {artist}', en: 'Send it to {artist}', pl: 'Wyślij do {artist}' },
  'verify.artistChecks': { de: 'Der Künstler überprüft deine Story und schickt dir dann den Link.', en: 'The artist will review your story and then send you the link.', pl: 'Artysta sprawdzi Twoją story i wyśle Ci link.' },
  'verify.storyFound': { de: 'Deine Story wurde erkannt. Klicke unten, um deine Belohnung einzulösen.', en: 'Your story was detected. Click below to claim your reward.', pl: 'Twoja story została wykryta. Kliknij poniżej, aby odebrać nagrodę.' },
  'verify.repostTiktok': { de: 'Wähle Repost – falls du bereits repostet hast: entferne den Repost zuerst, kehre hierher zurück, starte den Quest neu und reposte dann erneut', en: 'Select Repost – if you already reposted: remove the repost first, come back, restart the quest and repost', pl: 'Wybierz Repost – jeśli już udostępniłeś: najpierw usuń repost, wróć tutaj, uruchom quest i udostępnij ponownie' },
  'verify.comeTapCheck': { de: 'Komm zurück und tippe auf Prüfen', en: 'Come back and tap Verify', pl: 'Wróć i naciśnij Sprawdź' },
  'verify.likedSaved': { de: 'geliked', en: 'liked', pl: 'polubiono' },
  'verify.reposted': { de: 'repostet', en: 'reposted', pl: 'udostępniono' },
  'verify.saved': { de: 'gespeichert', en: 'saved', pl: 'zapisano' },
  'verify.checkAction': { de: '{action}? – Prüfen', en: '{action}? – Verify', pl: '{action}? – Sprawdź' },
  'verify.claimReward': { de: 'Belohnung einlösen', en: 'Claim reward', pl: 'Odbierz nagrodę' },
  'verify.back': { de: 'Zurück', en: 'Back', pl: 'Wróć' },

  // ── Creator Board & Modals ──────────────────────────────────────────────────

  'creator.createQuest': { de: 'Quest erstellen', en: 'Create quest', pl: 'Utwórz quest' },
  'creator.createBundle': { de: 'Bundle erstellen', en: 'Create bundle', pl: 'Utwórz pakiet' },
  'creator.deposit': { de: 'Aufladen', en: 'Deposit', pl: 'Doładuj' },
  'creator.questTitle': { de: 'Quest-Titel', en: 'Quest title', pl: 'Tytuł questa' },
  'creator.platform': { de: 'Plattform', en: 'Platform', pl: 'Platforma' },
  'creator.questType': { de: 'Quest-Typ', en: 'Quest type', pl: 'Typ questa' },
  'creator.reward': { de: 'Belohnung', en: 'Reward', pl: 'Nagroda' },
  'creator.maxSlots': { de: 'Max. Plätze', en: 'Max. slots', pl: 'Maks. miejsc' },
  'creator.duration': { de: 'Dauer', en: 'Duration', pl: 'Czas trwania' },
  'creator.customDuration': { de: '⚙️ Eigene Dauer…', en: '⚙️ Custom duration…', pl: '⚙️ Własny czas…' },
  'creator.publish': { de: 'Veröffentlichen', en: 'Publish', pl: 'Opublikuj' },
  'creator.publishing': { de: 'Wird veröffentlicht…', en: 'Publishing…', pl: 'Publikowanie…' },
  'creator.deleteConfirm': { de: 'Quest wirklich löschen?', en: 'Really delete quest?', pl: 'Na pewno usunąć quest?' },
  'creator.loadMedia': { de: 'Medien laden', en: 'Load media', pl: 'Załaduj media' },
  'creator.loadingMedia': { de: 'Lädt…', en: 'Loading…', pl: 'Ładowanie…' },
  'creator.noMediaFound': { de: 'Keine Medien gefunden', en: 'No media found', pl: 'Nie znaleziono mediów' },
  'creator.secretCode': { de: 'Geheimcode', en: 'Secret code', pl: 'Tajny kod' },
  'creator.description': { de: 'Beschreibung', en: 'Description', pl: 'Opis' },
  'creator.repReward': { de: 'Reputation-Reward', en: 'Reputation reward', pl: 'Nagroda reputacyjna' },
  'creator.balance': { de: 'Guthaben', en: 'Balance', pl: 'Saldo' },
  'creator.insufficientBalance': { de: 'Nicht genug Guthaben', en: 'Insufficient balance', pl: 'Niewystarczające saldo' },
  'creator.bundleBonus': { de: 'Bundle-Bonus', en: 'Bundle bonus', pl: 'Bonus pakietu' },
  'creator.addStep': { de: 'Schritt hinzufügen', en: 'Add step', pl: 'Dodaj krok' },
  'creator.removeStep': { de: 'Schritt entfernen', en: 'Remove step', pl: 'Usuń krok' },

  // ── QuestBoard Index ─────────────────────────────────────────────────────────

  'qb.selectArtist': { de: 'Wähle einen Künstler', en: 'Select an artist', pl: 'Wybierz artystę' },
  'qb.noArtists': { de: 'Keine Künstler verfügbar', en: 'No artists available', pl: 'Brak dostępnych artystów' },
  'qb.connectWallet': { de: 'Bitte Wallet verbinden', en: 'Please connect wallet', pl: 'Połącz portfel' },
  'qb.verifyFirst': { de: 'Verknüpfe zuerst dein Social-Konto im Profil', en: 'Link your social account in Profile first', pl: 'Najpierw połącz konto społecznościowe w Profilu' },
  'qb.loading': { de: 'Lädt…', en: 'Loading…', pl: 'Ładowanie…' },
  'qb.questsFor': { de: 'Quests für {name}', en: 'Quests for {name}', pl: 'Questy dla {name}' },
  'qb.allQuests': { de: 'Quest Board', en: 'Quest Board', pl: 'Quest Board' },

  // ── FanBoard ─────────────────────────────────────────────────────────────────

  'fan.credits': { de: 'Bereit zum Einlösen als echte {token}-Token', en: 'Ready to redeem as real {token} tokens', pl: 'Gotowe do wymiany na prawdziwe tokeny {token}' },
  'fan.noCredits': { de: 'Schließe Quests ab, um Credits zu verdienen', en: 'Complete quests to earn credits', pl: 'Ukończ questy, aby zdobyć kredyty' },
  'fan.redeem': { de: 'Einlösen', en: 'Redeem', pl: 'Odbierz' },
  'fan.claimBlocked': { de: '⛔ Einlösen gesperrt', en: '⛔ Redemption blocked', pl: '⛔ Odbiór zablokowany' },
  'fan.txView': { de: 'Transaktion ansehen →', en: 'View transaction →', pl: 'Zobacz transakcję →' },
  'fan.celebration': { de: 'Glückwunsch!', en: 'Congratulations!', pl: 'Gratulacje!' },
};

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
