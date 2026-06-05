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
  'profile.claimSentText': {
    de: 'Folgende Menge wurde an deine Wallet gesendet:',
    en: 'The following amount was sent to your wallet:',
    pl: 'Następująca kwota została wysłana na twój portfel:',
  },
  'profile.edit': {
    de: 'Bearbeiten',
    en: 'Edit',
    pl: 'Edytuj',
  },
  'profile.namePlaceholder': {
    de: 'Anzeigename (z.B. D.FAITH, Dawid Faith…)',
    en: 'Display name (e.g. D.FAITH, Dawid Faith…)',
    pl: 'Wyświetlana nazwa (np. D.FAITH, Dawid Faith…)',
  },
  'profile.artistTypePlaceholder': {
    de: 'Künstlertyp (z.B. Musiker, Rapper, DJ…)',
    en: 'Artist type (e.g. Musician, Rapper, DJ…)',
    pl: 'Typ artysty (np. Muzyk, Raper, DJ…)',
  },
  'profile.bioPlaceholder': {
    de: 'Warum solltest du supported werden? (Bio)',
    en: 'Why should you be supported? (Bio)',
    pl: 'Dlaczego powinieneś być wspierany? (Bio)',
  },
  'profile.displayPicLabel': {
    de: 'Angezeigtes Profil-Bild',
    en: 'Displayed profile picture',
    pl: 'Wyświetlane zdjęcie profilowe',
  },
  'profile.editPrompt': {
    de: 'Klicke „Bearbeiten" um dein Künstler-Profil auszufüllen',
    en: 'Click "Edit" to fill out your artist profile',
    pl: 'Kliknij „Edytuj", aby uzupełnić swój profil artysty',
  },
  'profile.publicLabel': {
    de: 'Öffentlich:',
    en: 'Public:',
    pl: 'Publiczne:',
  },
  'profile.notConnectedText': {
    de: 'Nicht verbunden',
    en: 'Not connected',
    pl: 'Niepołączony',
  },
  'profile.igCheck': {
    de: 'Instagram prüfen',
    en: 'Check Instagram',
    pl: 'Sprawdź Instagram',
  },
  'profile.fbCheck': {
    de: 'Facebook prüfen',
    en: 'Check Facebook',
    pl: 'Sprawdź Facebook',
  },
  'profile.igConnect': {
    de: 'Instagram verbinden',
    en: 'Connect Instagram',
    pl: 'Połącz Instagram',
  },
  'profile.fbConnect': {
    de: 'Facebook verbinden',
    en: 'Connect Facebook',
    pl: 'Połącz Facebook',
  },
  'profile.verified': {
    de: 'Verifiziert',
    en: 'Verified',
    pl: 'Zweryfikowano',
  },
  'profile.networkError': {
    de: '❌ Netzwerkfehler',
    en: '❌ Network error',
    pl: '❌ Błąd sieci',
  },
  'profile.metaGuideTitle': {
    de: 'Anleitung',
    en: 'Setup guide',
    pl: 'Instrukcja',
  },
  'profile.metaPrereqTitle': {
    de: '⚠️ Voraussetzungen (einmalig):',
    en: '⚠️ Requirements (one-time):',
    pl: '⚠️ Wymagania (jednorazowo):',
  },
  'profile.metaPrereq1': {
    de: '› Facebook Page erstellen — nur über eine Page bekommst du Zugang zur Meta Business Suite.',
    en: '› Create a Facebook Page — you need a Page to access Meta Business Suite.',
    pl: '› Utwórz stronę na Facebooku — tylko przez stronę uzyskasz dostęp do Meta Business Suite.',
  },
  'profile.metaPrereq2': {
    de: '› Instagram muss ein Business- oder Creator-Konto sein (IG → Einstellungen → Konto → Zu Professional-Konto wechseln)',
    en: '› Instagram must be a Business or Creator account (IG → Settings → Account → Switch to Professional)',
    pl: '› Instagram musi być kontem Business lub Creator (IG → Ustawienia → Konto → Przejdź na konto profesjonalne)',
  },
  'profile.metaPrereq3': {
    de: '› IG und FB werden separat erteilt — du kannst nur Instagram, nur die Page, oder beides freischalten.',
    en: '› IG and FB are granted separately — you can unlock Instagram only, the Page only, or both.',
    pl: '› IG i FB są przyznawane osobno — możesz odblokować tylko Instagram, tylko Stronę lub oba.',
  },
  'profile.metaStep1': {
    de: 'Öffne dein Meta Business Center → Partner hinzufügen',
    en: 'Open your Meta Business Center → Add Partner',
    pl: 'Otwórz Meta Business Center → Dodaj partnera',
  },
  'profile.metaStep2': {
    de: 'Business-ID von D.Faith Ecosystem eingeben',
    en: 'Enter D.Faith Ecosystem Business ID',
    pl: 'Wprowadź identyfikator firmy D.Faith Ecosystem',
  },
  'profile.metaStep3': {
    de: 'Einem Partner Zugriff auf deine Assets gestatten auswählen',
    en: 'Select "Grant a partner access to your assets"',
    pl: 'Wybierz „Przyznaj partnerowi dostęp do swoich zasobów"',
  },
  'profile.metaStep4ig': {
    de: 'Instagram-Konto auswählen → alle Berechtigungen aktivieren (für IG Quests)',
    en: 'Select Instagram account → enable all permissions (for IG quests)',
    pl: 'Wybierz konto Instagram → aktywuj wszystkie uprawnienia (dla questów IG)',
  },
  'profile.metaStep4fb': {
    de: 'Facebook Page auswählen → alle Berechtigungen aktivieren (für FB Quests)',
    en: 'Select Facebook Page → enable all permissions (for FB quests)',
    pl: 'Wybierz stronę Facebook → aktywuj wszystkie uprawnienia (dla questów FB)',
  },
  'profile.metaStep5': {
    de: 'Oben die jeweiligen Buttons klicken — System-Zugriff wird automatisch eingerichtet',
    en: 'Click the respective buttons above — system access will be set up automatically',
    pl: 'Kliknij odpowiednie przyciski powyżej — dostęp zostanie skonfigurowany automatycznie',
  },
  'profile.metaAssetsLabel': {
    de: 'Assets einzeln zuweisen:',
    en: 'Assign assets individually:',
    pl: 'Przydziel zasoby osobno:',
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
  'btn.cancel': {
    de: 'Abbrechen',
    en: 'Cancel',
    pl: 'Anuluj',
  },
  'btn.save': {
    de: 'Speichern',
    en: 'Save',
    pl: 'Zapisz',
  },
  'btn.saving': {
    de: 'Speichern…',
    en: 'Saving…',
    pl: 'Zapisywanie…',
  },
  'btn.change': {
    de: 'Ändern',
    en: 'Change',
    pl: 'Zmień',
  },
  'btn.disconnect': {
    de: 'Trennen',
    en: 'Disconnect',
    pl: 'Odłącz',
  },
  'btn.edit': {
    de: 'Bearbeiten',
    en: 'Edit',
    pl: 'Edytuj',
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
  'shop.descPlaceholder': { de: 'Was erhalten die Käufer?', en: 'What do buyers receive?', pl: 'Co otrzymają kupujący?' },
  'shop.uploading': { de: 'Lädt…', en: 'Uploading…', pl: 'Przesyłanie…' },
  'shop.btnUpload': { de: 'Hochladen', en: 'Upload', pl: 'Prześlij' },
  'shop.btnChange': { de: 'Ändern', en: 'Change', pl: 'Zmień' },
  'shop.btnImage': { de: 'Bild', en: 'Image', pl: 'Obraz' },
  'shop.artistsLabel': { de: 'Künstler', en: 'Artists', pl: 'Artyści' },
  'shop.tapArtistHint': { de: 'Tippe auf einen Künstler um seinen Shop zu öffnen.', en: 'Tap an artist to open their shop.', pl: 'Kliknij artystę, aby otworzyć jego sklep.' },
  'shop.labelType': { de: 'Typ', en: 'Type', pl: 'Typ' },
  'shop.labelPriceCredits': { de: 'Preis Credits', en: 'Price Credits', pl: 'Cena Kredytów' },
  'shop.labelTokenPrice': { de: 'Token-Preis', en: 'Token Price', pl: 'Cena Tokenów' },
  'shop.labelMinLevel': { de: 'Mindest-Level', en: 'Min. Level', pl: 'Min. Poziom' },
  'shop.labelContentFile': { de: 'Content-Datei (nach Kauf sichtbar)', en: 'Content file (visible after purchase)', pl: 'Plik treści (widoczny po zakupie)' },
  'shop.labelContentFileEdit': { de: 'Content-Datei', en: 'Content file', pl: 'Plik treści' },
  'shop.labelPreviewImage': { de: 'Vorschaubild (optional)', en: 'Preview image (optional)', pl: 'Obraz podglądu (opcjonalnie)' },
  'shop.labelPreviewImageEdit': { de: 'Vorschaubild', en: 'Preview image', pl: 'Obraz podglądu' },
  'shop.labelTitle': { de: 'Titel', en: 'Title', pl: 'Tytuł' },
  'shop.labelDesc': { de: 'Beschreibung', en: 'Description', pl: 'Opis' },
  'shop.noLevelRequired': { de: '0 = kein Level erforderlich', en: '0 = no level required', pl: '0 = brak wymaganego poziomu' },
  'shop.tokenPriceOptional': { de: 'leer = keiner', en: 'empty = none', pl: 'puste = brak' },
  'shop.btnCreateItem': { de: 'Item erstellen', en: 'Create item', pl: 'Utwórz produkt' },
  'shop.noItemsCreate': { de: 'Noch keine Items. Erstelle deinen ersten Shop-Eintrag!', en: 'No items yet. Create your first shop entry!', pl: 'Brak produktów. Utwórz swój pierwszy wpis w sklepie!' },
  'shop.editItemTitle': { de: 'Item bearbeiten', en: 'Edit item', pl: 'Edytuj produkt' },
  'shop.urlPlaceholder': { de: 'oder URL einfügen (https://…)', en: 'or paste URL (https://…)', pl: 'lub wklej URL (https://…)' },
  'shop.imagePlaceholder': { de: 'oder Bild-URL', en: 'or image URL', pl: 'lub URL obrazu' },

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
  'rep.leaderboardSubtitle': { de: 'Top Fans nach gesammelter Reputation', en: 'Top fans by collected reputation', pl: 'Najlepsi fani według zebranej reputacji' },
  'rep.noContest': { de: 'Keine aktive Contest', en: 'No active contest', pl: 'Brak aktywnego konkursu' },
  'rep.noContestHint': { de: 'Dieser Künstler hat noch keine Contest gestartet.', en: "This artist hasn't started any contest yet.", pl: 'Ten artysta nie uruchomił jeszcze żadnego konkursu.' },
  'rep.prizesAndBoard': { de: 'Preise & aktuelle Rangliste', en: 'Prizes & current rankings', pl: 'Nagrody i aktualna tabela' },
  'rep.noParticipant': { de: 'Noch kein Teilnehmer', en: 'No participant yet', pl: 'Brak uczestników' },
  'rep.contestSinceStart': { de: 'REP seit Contest-Start', en: 'REP since contest start', pl: 'REP od rozpoczęcia konkursu' },
  'rep.yourBalance': { de: 'Dein Guthaben', en: 'Your balance', pl: 'Twoje saldo' },
  'rep.balanceHint': { de: 'Credits werden beim Speichern von Rewards reserviert', en: 'Credits are reserved when saving rewards', pl: 'Kredyty są rezerwowane podczas zapisywania nagród' },
  'rep.levelConfig': { de: 'Level-Konfiguration', en: 'Level Configuration', pl: 'Konfiguracja Poziomów' },
  'rep.levelEditHint': { de: 'Level-Namen, Mindest-REP, D.FAITH Credits und Rewards anpassen.', en: 'Adjust level names, minimum REP, D.FAITH credits and rewards.', pl: 'Dostosuj nazwy poziomów, minimalną REP, kredyty D.FAITH i nagrody.' },
  'rep.levelDefaultHint': { de: 'Das sind die voreingestellten Level. Klicke auf „Bearbeiten" um sie anzupassen.', en: 'These are the default levels. Click "Edit" to customize them.', pl: 'To są domyślne poziomy. Kliknij „Edytuj", aby je dostosować.' },
  'rep.labelLevelName': { de: 'Level-Name', en: 'Level Name', pl: 'Nazwa Poziomu' },
  'rep.labelMinRep': { de: 'Mindest-REP', en: 'Minimum REP', pl: 'Minimalna REP' },
  'rep.labelCreditsOnLevelUp': { de: 'D.FAITH Credits bei Level-Up', en: 'D.FAITH Credits on Level-Up', pl: 'Kredyty D.FAITH przy awansie' },
  'rep.labelMaxRecipients': { de: 'Wie viele Fans erhalten diesen Reward?', en: 'How many fans receive this reward?', pl: 'Ile fanów otrzyma tę nagrodę?' },
  'rep.labelQuestBonus': { de: 'Quest-Reward Bonus (%)', en: 'Quest Reward Bonus (%)', pl: 'Bonus do Nagród za Questy (%)' },
  'rep.labelQuestBonusHint': { de: 'Prozentualer Bonus auf Quest-Rewards – aus deinem Guthaben', en: 'Percentage bonus on quest rewards – from your balance', pl: 'Procentowy bonus do nagród za questy – z twojego salda' },
  'rep.labelRewardDesc': { de: 'Reward-Beschreibung', en: 'Reward Description', pl: 'Opis Nagrody' },
  'rep.noRewardDefined': { de: 'Kein Reward definiert', en: 'No reward defined', pl: 'Brak nagrody' },
  'rep.totalCosts': { de: 'Gesamtkosten aller Rewards', en: 'Total cost of all rewards', pl: 'Całkowity koszt wszystkich nagród' },
  'rep.yourBalanceLabel': { de: 'Dein Guthaben:', en: 'Your balance:', pl: 'Twoje saldo:' },
  'rep.balanceDiff': { de: '(Differenz zu bisherigen Levels wird abgezogen/erstattet)', en: '(Difference from previous levels will be deducted/refunded)', pl: '(Różnica od poprzednich poziomów zostanie odjęta/zwrócona)' },
  'rep.balanceUnknown': { de: 'Guthaben unbekannt', en: 'Balance unknown', pl: 'Saldo nieznane' },
  'rep.balanceSufficient': { de: '✓ Ausreichend', en: '✓ Sufficient', pl: '✓ Wystarczające' },
  'rep.balanceInsufficient': { de: '⚠ Nicht ausreichend', en: '⚠ Insufficient', pl: '⚠ Niewystarczające' },
  'rep.contestSectionTitle': { de: 'Leaderboard Contest', en: 'Leaderboard Contest', pl: 'Konkurs Rankingowy' },
  'rep.contestSubtitle': { de: 'Belohnungen für die besten Fans', en: 'Rewards for the best fans', pl: 'Nagrody dla najlepszych fanów' },
  'rep.contestConfirmEnd': { de: 'Contest jetzt vorzeitig beenden und alle Rewards sofort ausschütten?', en: 'End the contest early and distribute all rewards immediately?', pl: 'Zakończyć konkurs wcześnie i natychmiast wypłacić wszystkie nagrody?' },
  'rep.distributed': { de: 'Verteilt!', en: 'Distributed!', pl: 'Rozdystrybuowano!' },
  'rep.distributedLabel': { de: 'verteilt', en: 'distributed', pl: 'rozdystrybuowano' },
  'rep.btnDistribute': { de: '🎁 Verteilen', en: '🎁 Distribute', pl: '🎁 Dystrybuuj' },
  'rep.btnEndNow': { de: '⏹ Jetzt beenden', en: '⏹ End now', pl: '⏹ Zakończ teraz' },
  'rep.btnNow': { de: '⏹ Jetzt', en: '⏹ Now', pl: '⏹ Teraz' },
  'rep.btnCreateContest': { de: 'Contest erstellen', en: 'Create contest', pl: 'Utwórz konkurs' },
  'rep.btnNewContest': { de: '+ Neuen Contest erstellen', en: '+ Create new contest', pl: '+ Utwórz nowy konkurs' },
  'rep.btnUpdateContest': { de: 'Contest aktualisieren', en: 'Update contest', pl: 'Zaktualizuj konkurs' },
  'rep.labelEndDate': { de: 'Enddatum & Uhrzeit', en: 'End date & time', pl: 'Data i godzina zakończenia' },
  'rep.labelPrizesPerRank': { de: 'Preise pro Platz', en: 'Prizes per rank', pl: 'Nagrody na pozycję' },
  'rep.totalPrize': { de: 'Gesamtpreisgeld – wird beim Starten sofort reserviert', en: 'Total prize pool – reserved immediately on start', pl: 'Całkowita pula nagród – zarezerwowana natychmiast po uruchomieniu' },
  'rep.btnStartContest': { de: 'Contest starten', en: 'Start contest', pl: 'Uruchom konkurs' },
  'rep.noContestActive': { de: 'Noch keine aktive Contest', en: 'No active contest yet', pl: 'Brak aktywnego konkursu' },
  'rep.noContestActiveHint': { de: 'Starte eine Contest mit Preisen für deine Top-Fans.', en: 'Start a contest with prizes for your top fans.', pl: 'Uruchom konkurs z nagrodami dla swoich najlepszych fanów.' },
  'rep.fanLeaderboardSubtitle': { de: 'Top Fans nach Reputation', en: 'Top fans by reputation', pl: 'Najlepsi fani według reputacji' },
  'rep.noFansHint': { de: 'Erstelle Quests, damit Fans Reputation verdienen können.', en: 'Create quests so fans can earn reputation.', pl: 'Utwórz questy, aby fani mogli zdobywać reputację.' },
  'rep.quarterlyRewards': { de: 'Quartals-Rewards', en: 'Quarterly Rewards', pl: 'Nagrody Kwartalne' },
  'rep.quarterConfirmEnd': { de: 'Quartal jetzt vorzeitig abschließen und Rewards ausschütten?', en: 'Close the quarter early and distribute rewards?', pl: 'Zamknąć kwartał wcześnie i wypłacić nagrody?' },
  'rep.quarterlyDesc': { de: 'Preise gelten jeden Quartal. Am Ende des Quartals wird automatisch die aktuelle Rangliste verwendet.', en: 'Prizes apply each quarter. At the end of the quarter, the current ranking is used automatically.', pl: 'Nagrody obowiązują co kwartał. Na koniec kwartału automatycznie używana jest aktualna tabela.' },
  'rep.addAnotherSlot': { de: 'Weiteren Platz', en: 'Add another', pl: 'Dodaj kolejny' },
  'rep.prizePerQuarter': { de: 'Preisgeld pro Quartal', en: 'Prize pool per quarter', pl: 'Pula nagród na kwartał' },
  'rep.noQuarterlyConfig': { de: 'Noch keine Quartals-Rewards konfiguriert', en: 'No quarterly rewards configured yet', pl: 'Brak skonfigurowanych nagród kwartalnych' },
  'rep.noQuarterlyConfigHint': { de: 'Jedes Quartal werden Rewards automatisch an die Top-Fans ausgezahlt.', en: 'Every quarter, rewards are automatically paid out to the top fans.', pl: 'Co kwartał nagrody są automatycznie wypłacane najlepszym fanom.' },
  'rep.pastQuarters': { de: 'Vergangene Quartale', en: 'Past quarters', pl: 'Poprzednie kwartały' },
  'rep.artistsLabel': { de: 'Künstler', en: 'Artists', pl: 'Artyści' },
  'rep.tapArtistHint': { de: 'Tippe auf einen Künstler um deine Reputation zu sehen.', en: 'Tap an artist to see your reputation.', pl: 'Kliknij artystę, aby zobaczyć swoją reputację.' },
  'rep.reputationSystem': { de: 'Dein Reputation-System', en: 'Your Reputation System', pl: 'Twój System Reputacji' },
  'rep.repRewards': { de: 'Reputation · Rewards', en: 'Reputation · Rewards', pl: 'Reputacja · Nagrody' },
  'rep.btnLoadDefault': { de: 'Standard (10)', en: 'Default (10)', pl: 'Domyślne (10)' },
  'rep.btnSaveConfig': { de: 'Konfiguration speichern', en: 'Save configuration', pl: 'Zapisz konfigurację' },
  'rep.btnSetup': { de: 'Einrichten', en: 'Set up', pl: 'Skonfiguruj' },
  'rep.levelCosts': { de: 'Kosten: {n} D.FAITH Credits (wird beim Speichern abgezogen)', en: 'Cost: {n} D.FAITH credits (deducted on save)', pl: 'Koszt: {n} kredytów D.FAITH (odliczany przy zapisie)' },

  // ── Solana Wallet ────────────────────────────────────────────────────────────

  'sol.mintingActive': { de: 'Minting aktiv — weitere Token können erstellt werden', en: 'Minting active — more tokens can be created', pl: 'Minting aktywny — można tworzyć więcej tokenów' },
  'sol.mintingDisabled': { de: 'Minting dauerhaft deaktiviert — feste Gesamtmenge', en: 'Minting permanently disabled — fixed total supply', pl: 'Minting trwale wyłączony — stała podaż' },
  'sol.invalidRecipient': { de: 'Empfänger-Adresse eingeben', en: 'Enter recipient address', pl: 'Podaj adres odbiorcy' },
  'sol.invalidAmount': { de: 'Ungültiger Betrag', en: 'Invalid amount', pl: 'Nieprawidłowa kwota' },
  'sol.send': { de: 'Senden', en: 'Send', pl: 'Wyślij' },
  'sol.recipient': { de: 'Empfänger', en: 'Recipient', pl: 'Odbiorca' },
  'sol.balance': { de: 'Guthaben', en: 'Balance', pl: 'Saldo' },
  'sol.wallet': { de: 'Wallet', en: 'Wallet', pl: 'Portfel' },
  'sol.walletAutoCreated': { de: 'Dein Solana Wallet wird automatisch erstellt — kein Wallet-App nötig.', en: 'Your Solana wallet is created automatically — no wallet app needed.', pl: 'Twój portfel Solana jest tworzony automatycznie — żadna aplikacja portfela nie jest potrzebna.' },
  'sol.loginBtn': { de: 'Anmelden', en: 'Sign in', pl: 'Zaloguj się' },
  'sol.loginPrompt': { de: 'Anmelden um fortzufahren', en: 'Sign in to continue', pl: 'Zaloguj się, aby kontynuować' },
  'sol.totalAssets': { de: 'Gesamtvermögen', en: 'Total Assets', pl: 'Całkowity Majątek' },
  'sol.assets': { de: 'Vermögenswerte', en: 'Assets', pl: 'Aktywa' },
  'sol.artistTokens': { de: 'Künstler Tokens', en: 'Artist Tokens', pl: 'Tokeny Artysty' },
  'sol.noArtistTokens': { de: 'Noch keine Künstler Tokens', en: 'No artist tokens yet', pl: 'Brak tokenów artysty' },
  'sol.noArtistTokensHint': { de: 'Schließe Quests ab, um Künstler Tokens zu verdienen.', en: 'Complete quests to earn artist tokens.', pl: 'Ukończ questy, aby zdobyć tokeny artysty.' },
  'sol.privateKeyWarning': { de: '⚠ Diesen Key sicher speichern und nie teilen! BS58-Format für Phantom / Solflare.', en: '⚠ Save this key securely and never share it! BS58 format for Phantom / Solflare.', pl: '⚠ Zapisz ten klucz bezpiecznie i nigdy go nie udostępniaj! Format BS58 dla Phantom / Solflare.' },
  'sol.labelRecipient': { de: 'Empfänger (Solana-Adresse)', en: 'Recipient (Solana address)', pl: 'Odbiorca (adres Solana)' },
  'sol.fullBalanceMinusFee': { de: 'Gesamte Balance (abzgl. Fee)', en: 'Full balance (minus fee)', pl: 'Pełne saldo (minus opłata)' },
  'sol.sending': { de: 'Wird gesendet…', en: 'Sending…', pl: 'Wysyłanie…' },
  'sol.onChainHint': { de: 'On-Chain · Kein Wallet-App nötig', en: 'On-Chain · No wallet app needed', pl: 'On-Chain · Bez aplikacji portfela' },
  'sol.modalSend': { de: '{label} senden', en: 'Send {label}', pl: 'Wyślij {label}' },
  'sol.modalReceive': { de: 'SOL empfangen', en: 'Receive SOL', pl: 'Odbierz SOL' },
  'sol.modalBuy': { de: 'SOL kaufen', en: 'Buy SOL', pl: 'Kup SOL' },

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

  // ── Common buttons (extended) ───────────────────────────────────────────────

  'btn.close': { de: 'Schließen', en: 'Close', pl: 'Zamknij' },
  'btn.back': { de: 'Zurück', en: 'Back', pl: 'Wstecz' },
  'btn.copy': { de: 'Kopieren', en: 'Copy', pl: 'Kopiuj' },
  'btn.copied': { de: 'Kopiert!', en: 'Copied!', pl: 'Skopiowano!' },
  'btn.check': { de: 'Prüfen', en: 'Check', pl: 'Sprawdź' },
  'btn.restart': { de: 'Neu starten', en: 'Restart', pl: 'Uruchom ponownie' },
  'btn.verifying': { de: 'Verifiziere…', en: 'Verifying…', pl: 'Weryfikacja…' },

  // ── Deposit Modal ───────────────────────────────────────────────────────────

  'deposit.title': { de: 'Quest-Pool aufladen', en: 'Top Up Quest Pool', pl: 'Doładuj pulę questów' },
  'deposit.header': { de: 'D.FAITH aufladen', en: 'Top Up D.FAITH', pl: 'Doładuj D.FAITH' },
  'deposit.desc': { de: 'Betrag eingeben — die Tokens werden automatisch aus deinem Wallet in den Quest-Pool gesendet.', en: 'Enter amount — tokens are automatically sent from your wallet to the quest pool.', pl: 'Podaj kwotę — tokeny zostaną automatycznie wysłane z twojego portfela do puli questów.' },
  'deposit.amountLabel': { de: 'Betrag (D.FAITH)', en: 'Amount (D.FAITH)', pl: 'Kwota (D.FAITH)' },
  'deposit.placeholder': { de: 'z.B. 500', en: 'e.g. 500', pl: 'np. 500' },
  'deposit.sendBtn': { de: '{amount} D.FAITH senden', en: 'Send {amount} D.FAITH', pl: 'Wyślij {amount} D.FAITH' },
  'deposit.enterAmount': { de: 'Betrag eingeben', en: 'Enter amount', pl: 'Wprowadź kwotę' },
  'deposit.sending': { de: 'Transaktion wird gesendet…', en: 'Sending transaction…', pl: 'Wysyłanie transakcji…' },
  'deposit.sendingDesc': { de: 'Token werden aus deinem Wallet übertragen', en: 'Tokens are being transferred from your wallet', pl: 'Tokeny są przenoszone z twojego portfela' },
  'deposit.successTitle': { de: 'Erfolgreich aufgeladen!', en: 'Successfully topped up!', pl: 'Pomyślnie doładowano!' },
  'deposit.viewTx': { de: 'Transaktion ansehen', en: 'View transaction', pl: 'Zobacz transakcję' },

  // ── Create Quest Modal ──────────────────────────────────────────────────────

  'cq.title': { de: 'Neuen Quest erstellen', en: 'Create New Quest', pl: 'Utwórz nowy quest' },
  'cq.successTitle': { de: 'Quest erfolgreich erstellt!', en: 'Quest created successfully!', pl: 'Quest utworzony pomyślnie!' },
  'cq.successDesc': { de: 'Fans können jetzt deinen Quest sehen und abschließen.', en: 'Fans can now see and complete your quest.', pl: 'Fani mogą teraz zobaczyć i ukończyć twój quest.' },
  'cq.storyActive': { de: 'Story Quest aktiv — dein Link DM ist bereits eingerichtet.', en: 'Story Quest active — your Link DM is already set up.', pl: 'Story Quest aktywny — twój Link DM jest już skonfigurowany.' },
  'cq.commentYT': { de: '💬 Kommentar', en: '💬 Comment', pl: '💬 Komentarz' },
  'cq.commentHintYT': { de: 'Die API prüft anhand des Kanalnamens ob der Fan kommentiert hat.', en: 'The API checks by channel name whether the fan has commented.', pl: 'API sprawdza po nazwie kanału czy fan skomentował.' },
  'cq.likeHintYT': { de: 'Verifizierung über Like-Anzahl-Delta: Fan entfernt Like → 5 Min Zeit um erneut zu liken.', en: 'Verification via like count delta: fan removes like → 5 min to like again.', pl: 'Weryfikacja przez deltę polubień: fan usuwa polubienie → 5 min na ponowne polubienie.' },
  'cq.secretHintYT': { de: 'Der Fan gibt einen Code ein der im Video versteckt ist. Kein YouTube API-Aufruf nötig.', en: 'The fan enters a code hidden in the video. No YouTube API call needed.', pl: 'Fan wpisuje kod ukryty w filmie. Nie potrzeba wywołania API YouTube.' },
  'cq.engagementHintTT': { de: 'Fan muss liken, teilen und speichern. Jede Aktion = 1/3 des Rewards. Teilbelohnung möglich.', en: 'Fan must like, share and save. Each action = 1/3 of reward. Partial reward possible.', pl: 'Fan musi polubić, udostępnić i zapisać. Każda akcja = 1/3 nagrody. Częściowa nagroda możliwa.' },
  'cq.secretHintTT': { de: 'Fan gibt einen Code ein, der im TikTok-Video versteckt ist. Kein API-Aufruf nötig.', en: 'Fan enters a code hidden in the TikTok video. No API call needed.', pl: 'Fan wpisuje kod ukryty w filmie TikTok. Nie potrzeba wywołania API.' },
  'cq.shareHintTT': { de: 'Doppel-Verifizierung: Share-Count steigt + Originalton im Fan-Profil nachweisbar.', en: 'Double verification: share count rises + original sound provable in fan profile.', pl: 'Podwójna weryfikacja: liczba udostępnień rośnie + oryginalny dźwięk widoczny w profilu fana.' },
  'cq.commentHintTT': { de: 'API prüft via Kommentare ob der Fan kommentiert hat.', en: 'API checks via comments whether the fan has commented.', pl: 'API sprawdza via komentarze czy fan skomentował.' },
  'cq.engagementHintIG': { de: 'Fan muss liken und speichern. Jede Aktion = 1/2 des Rewards. Teilbelohnung möglich.', en: 'Fan must like and save. Each action = 1/2 of reward. Partial reward possible.', pl: 'Fan musi polubić i zapisać. Każda akcja = 1/2 nagrody. Częściowa nagroda możliwa.' },
  'cq.repostHintIG': { de: 'Fan muss das Reel auf seinen Kanal reposten. Delta aus total_interactions wird gemessen.', en: 'Fan must repost the reel to their channel. Delta from total_interactions is measured.', pl: 'Fan musi udostępnić Reela na swój kanał. Mierzy się deltę total_interactions.' },
  'cq.dmShareHintIG': { de: 'Fan teilt das Reel in seiner Story und markiert den Künstler. Du schickst ihm den Link per Instagram DM.', en: 'Fan shares the reel in their story and tags the artist. You send the link via Instagram DM.', pl: 'Fan udostępnia Reela w swojej story i oznacza artystę. Wysyłasz link przez Instagram DM.' },
  'cq.commentHintIG': { de: 'Make.com prüft via Instagram Graph API ob der Fan kommentiert hat.', en: 'Make.com checks via Instagram Graph API whether the fan commented.', pl: 'Make.com sprawdza przez Instagram Graph API czy fan skomentował.' },
  'cq.likeAndSave': { de: '❤️🔖 Like & Speichern', en: '❤️🔖 Like & Save', pl: '❤️🔖 Polub & Zapisz' },
  'cq.storyQuest': { de: '📩 Story Quest', en: '📩 Story Quest', pl: '📩 Story Quest' },
  'cq.repost': { de: '🔁 Repost', en: '🔁 Repost', pl: '🔁 Repost' },
  'cq.share': { de: '🔁 Teilen', en: '🔁 Share', pl: '🔁 Udostępnij' },

  // ── Creator Board ───────────────────────────────────────────────────────────

  'cb.myQuests': { de: 'Meine Quests', en: 'My Quests', pl: 'Moje Questy' },
  'cb.noQuests': { de: 'Noch keine Quests erstellt.', en: 'No quests created yet.', pl: 'Nie utworzono jeszcze questów.' },
  'cb.noQuestsHint': { de: 'Erstelle deinen ersten Quest!', en: 'Create your first quest!', pl: 'Utwórz swój pierwszy quest!' },
  'cb.myBundles': { de: 'Meine Quest Reihen', en: 'My Quest Series', pl: 'Moje serie questów' },
  'cb.available': { de: 'Verfügbar für Quest-Auszahlungen an Fans', en: 'Available for quest payouts to fans', pl: 'Dostępne do wypłat questów dla fanów' },
  'cb.topUp': { de: 'Lade {token} auf um Quests zu finanzieren', en: 'Top up {token} to fund quests', pl: 'Doładuj {token} aby sfinansować questy' },
  'cb.cancelError': { de: 'Fehler beim Stornieren', en: 'Error cancelling', pl: 'Błąd anulowania' },
  'cb.networkError': { de: 'Netzwerkfehler', en: 'Network error', pl: 'Błąd sieci' },
  'cb.networkErrorCancel': { de: 'Netzwerkfehler beim Stornieren', en: 'Network error while cancelling', pl: 'Błąd sieci podczas anulowania' },
  'cb.topUpBtn': { de: 'Aufladen', en: 'Top Up', pl: 'Doładuj' },

  // ── Bundle Card ─────────────────────────────────────────────────────────────

  'bc.secretBadge': { de: 'Geheimcode', en: 'Secret Code', pl: 'Tajny kod' },
  'bc.storyBadge': { de: 'Story teilen', en: 'Share story', pl: 'Udostępnij story' },
  'bc.likeBadge': { de: 'Liken', en: 'Like', pl: 'Polub' },
  'bc.commentBadge': { de: 'Kommentieren', en: 'Comment', pl: 'Skomentuj' },
  'bc.saveBadge': { de: 'Speichern', en: 'Save', pl: 'Zapisz' },
  'bc.repostBadge': { de: 'Reposten', en: 'Repost', pl: 'Repostuj' },
  'bc.engagementBadge': { de: 'Engagement', en: 'Engagement', pl: 'Zaangażowanie' },
  'bc.questBadge': { de: 'Quest', en: 'Quest', pl: 'Quest' },
  'bc.secretDesc': { de: 'Finde den geheimen Code und gib ihn ein!', en: 'Find the secret code and enter it!', pl: 'Znajdź tajny kod i wpisz go!' },
  'bc.storyDesc': { de: 'Teile dieses Video als Instagram Story und schick sie an unseren Account!', en: 'Share this video as an Instagram Story and send it to our account!', pl: 'Udostępnij ten film jako Instagram Story i wyślij go na nasze konto!' },
  'bc.likeDesc': { de: 'Like dieses Video!', en: 'Like this video!', pl: 'Polub ten film!' },
  'bc.commentDesc': { de: 'Kommentiere dieses Video!', en: 'Comment on this video!', pl: 'Skomentuj ten film!' },
  'bc.saveDesc': { de: 'Speichere dieses Video!', en: 'Save this video!', pl: 'Zapisz ten film!' },
  'bc.repostDesc': { de: 'Reposte dieses Video!', en: 'Repost this video!', pl: 'Repostuj ten film!' },
  'bc.engagementDesc': { de: 'Führe das Engagement-Paket aus!', en: 'Complete the engagement package!', pl: 'Wykonaj pakiet zaangażowania!' },
  'bc.repostTiktokDesc': { de: 'Reposte dieses Video auf TikTok!', en: 'Repost this video on TikTok!', pl: 'Repostuj ten film na TikTok!' },
  'bc.questDefault': { de: 'Schließe diese Quest ab!', en: 'Complete this quest!', pl: 'Ukończ ten quest!' },
  'bc.lockYT': { de: 'YouTube verknüpfen', en: 'Connect YouTube', pl: 'Połącz YouTube' },
  'bc.lockIG': { de: 'Instagram verknüpfen', en: 'Connect Instagram', pl: 'Połącz Instagram' },
  'bc.lockTT': { de: 'TikTok verknüpfen', en: 'Connect TikTok', pl: 'Połącz TikTok' },
  'bc.lockFB': { de: 'Facebook verknüpfen', en: 'Connect Facebook', pl: 'Połącz Facebook' },
  'bc.detected': { de: '✓ Erkannt', en: '✓ Detected', pl: '✓ Wykryto' },
  'bc.notDetected': { de: '– Nicht erkannt', en: '– Not detected', pl: '– Nie wykryto' },

  // ── YouTube Link Channel ────────────────────────────────────────────────────

  'yt.title': { de: 'YouTube Kanal verknüpfen', en: 'Connect YouTube Channel', pl: 'Połącz kanał YouTube' },
  'yt.subtitle': { de: 'Einmalig – keine OAuth erforderlich', en: 'One-time – no OAuth required', pl: 'Jednorazowo – bez OAuth' },
  'yt.howTitle': { de: 'So funktioniert es:', en: 'How it works:', pl: 'Jak to działa:' },
  'yt.step1': { de: 'Gib deinen YouTube-Kanal-Handle ein', en: 'Enter your YouTube channel handle', pl: 'Podaj swój uchwyt kanału YouTube' },
  'yt.step2': { de: 'Du bekommst einen einzigartigen Code', en: "You'll receive a unique code", pl: 'Otrzymasz unikalny kod' },
  'yt.step3': { de: 'Füge den Code in deine Kanal-Beschreibung ein', en: 'Add the code to your channel description', pl: 'Dodaj kod do opisu kanału' },
  'yt.step4': { de: 'Wir verifizieren – fertig!', en: 'We verify – done!', pl: 'Weryfikujemy – gotowe!' },
  'yt.placeholder': { de: '@DeinHandle oder youtube.com/@Handle', en: '@YourHandle or youtube.com/@Handle', pl: '@TwójUchwyt lub youtube.com/@Uchwyt' },
  'yt.searchLoading': { de: 'Suche Kanal…', en: 'Searching channel…', pl: 'Szukam kanału…' },
  'yt.loadBtn': { de: 'Kanal laden', en: 'Load channel', pl: 'Załaduj kanał' },
  'yt.codeTitle': { de: 'Dein Verifikationscode:', en: 'Your verification code:', pl: 'Twój kod weryfikacyjny:' },
  'yt.instr1': { de: 'YouTube Studio → Kanal-Beschreibung öffnen', en: 'Open YouTube Studio → Channel description', pl: 'Otwórz YouTube Studio → Opis kanału' },
  'yt.instr2': { de: 'Füge den Code an beliebiger Stelle ein', en: 'Paste the code anywhere', pl: 'Wklej kod gdziekolwiek' },
  'yt.instr3': { de: 'Klicke „Speichern" in YouTube Studio', en: 'Click "Save" in YouTube Studio', pl: 'Kliknij „Zapisz" w YouTube Studio' },
  'yt.instr4': { de: 'Komm zurück und klicke „Verifizieren"', en: 'Come back and click "Verify"', pl: 'Wróć i kliknij „Weryfikuj"' },

  // ── Verify Modal – common strings ──────────────────────────────────────────

  'verify.rewardLabel': { de: 'Belohnung', en: 'Reward', pl: 'Nagroda' },
  'verify.timeLeft': { de: 'Verbleibende Zeit', en: 'Time remaining', pl: 'Pozostały czas' },
  'verify.preparing': { de: 'Wird vorbereitet…', en: 'Preparing…', pl: 'Przygotowywanie…' },
  'verify.baselineLoading': { de: 'Baseline wird geladen…', en: 'Loading baseline…', pl: 'Ładowanie podstawy…' },
  'verify.expiredWindow': { de: 'Das 5-Minuten-Fenster ist abgelaufen.', en: 'The 5-minute window has expired.', pl: 'Okno 5-minutowe wygasło.' },
  'verify.expiredRestart': { de: 'Starte die Verifizierung neu.', en: 'Restart the verification.', pl: 'Uruchom weryfikację ponownie.' },
  'verify.expiredTitle': { de: '⏰ Zeit abgelaufen', en: '⏰ Time expired', pl: '⏰ Czas minął' },
  'verify.errorTitle': { de: '❌ Fehler', en: '❌ Error', pl: '❌ Błąd' },
  'verify.notYetFb': { de: 'Noch nicht erkannt. Warte kurz und versuche es erneut.', en: 'Not detected yet. Wait briefly and try again.', pl: 'Jeszcze nie wykryto. Poczekaj chwilę i spróbuj ponownie.' },
  'verify.toShort': { de: 'Zum Short (Liken)', en: 'Go to Short (Like)', pl: 'Przejdź do Short (Polub)' },
  'verify.likeSuccess': { de: 'Like erfolgreich verifiziert!', en: 'Like successfully verified!', pl: 'Like zweryfikowany pomyślnie!' },
  'verify.secretCorrect': { de: '🎉 Code korrekt!', en: '🎉 Code correct!', pl: '🎉 Kod poprawny!' },
  'verify.secretTitle': { de: '🔑 Secret-Quest', en: '🔑 Secret Quest', pl: '🔑 Secret Quest' },
  'verify.secretCodeRight': { de: 'Code richtig!', en: 'Code correct!', pl: 'Kod poprawny!' },
  'verify.secretWrong': { de: 'Falscher Code. Versuche es erneut.', en: 'Wrong code. Try again.', pl: 'Zły kod. Spróbuj ponownie.' },
  'verify.creditsAdded': { de: 'Zu deinem D.FAITH Credits Guthaben hinzugefügt', en: 'Added to your D.FAITH Credits balance', pl: 'Dodano do salda D.FAITH Credits' },
  'verify.repBonus': { de: 'Inklusive +{x} D.FAITH Reputation-Level-Bonus', en: 'Including +{x} D.FAITH Reputation Level Bonus', pl: 'W tym +{x} D.FAITH bonus poziomu reputacji' },
  'verify.shareDetected': { de: 'Share erkannt', en: 'Share detected', pl: 'Udostępnienie wykryte' },
  'verify.shareNotDetected': { de: 'Share noch nicht erkannt. Teile das Video und warte kurz.', en: 'Share not detected yet. Share the video and wait briefly.', pl: 'Udostępnienie nie wykryte. Udostępnij film i poczekaj chwilę.' },
  'verify.shareConfirmed': { de: '🎉 Share bestätigt!', en: '🎉 Share confirmed!', pl: '🎉 Udostępnienie potwierdzone!' },
  'verify.shareTitle': { de: '🔁 Video teilen', en: '🔁 Share video', pl: '🔁 Udostępnij film' },
  'verify.secretInstruction': { de: 'Suche die versteckten Buchstaben im {platform} und führe sie in der richtigen Reihenfolge zusammen. Sie ergeben ein Wort, das du als Geheimcode einreichst.', en: 'Find the hidden letters in the {platform} and combine them in the right order. They form a word you submit as the secret code.', pl: 'Znajdź ukryte litery w {platform} i ułóż je w odpowiedniej kolejności. Tworzą słowo, które przesyłasz jako tajny kod.' },
  'verify.secretInputPlaceholder': { de: 'Geheimcode eingeben…', en: 'Enter secret code…', pl: 'Wpisz tajny kod…' },
  'verify.saveConfirmed': { de: '🎉 Speichern bestätigt!', en: '🎉 Save confirmed!', pl: '🎉 Zapisanie potwierdzone!' },
  'verify.saveTitle': { de: '🔖 Speichern verifizieren', en: '🔖 Verify save', pl: '🔖 Weryfikuj zapisanie' },
  'verify.inclBonus': { de: 'inkl. +{x}% Bonus', en: 'incl. +{x}% bonus', pl: 'w tym +{x}% bonusu' },
  'verify.reputation': { de: 'Reputation', en: 'Reputation', pl: 'Reputacja' },
  'verify.perAction': { de: 'pro Aktion:', en: 'per action:', pl: 'za akcję:' },
  'verify.fbHowTitle': { de: 'So funktioniert es:', en: "Here's how:", pl: 'Jak to działa:' },
  'verify.fbStep1': { de: 'Kopiere den unten stehenden Kommentar', en: 'Copy the comment below', pl: 'Skopiuj poniższy komentarz' },
  'verify.fbStep2': { de: 'Öffne den Post über den Link oben', en: 'Open the post via the link above', pl: 'Otwórz post przez link powyżej' },
  'verify.fbStep3': { de: 'Füge den Kommentar dort exakt so ein und poste ihn', en: 'Paste the comment exactly as shown and post it', pl: 'Wklej komentarz dokładnie tak samo i opublikuj go' },
  'verify.fbStep4': { de: 'Komm zurück und klicke „Verifizieren"', en: 'Come back and click "Verify"', pl: 'Wróć i kliknij „Weryfikuj"' },
  'verify.yourComment': { de: 'Dein Kommentar', en: 'Your comment', pl: 'Twój komentarz' },
  'verify.individualComment': { de: 'individuell für dich generiert', en: 'individually generated for you', pl: 'wygenerowany indywidualnie dla ciebie' },
  'verify.shareVerifyTitle': { de: 'So verifizierst du den Share:', en: 'How to verify the share:', pl: 'Jak zweryfikować udostępnienie:' },
  'verify.shareStep1': { de: 'Öffne das Video auf TikTok und tippe auf Teilen', en: 'Open the video on TikTok and tap Share', pl: 'Otwórz film na TikTok i naciśnij Udostępnij' },
  'verify.shareDetectedStatus': { de: 'Share erkannt! Verifizierung läuft…', en: 'Share detected! Verifying…', pl: 'Udostępnienie wykryte! Weryfikacja…' },
  'verify.dmStep1': { de: 'Öffne den Beitrag und teile ihn als Instagram Story', en: 'Open the post and share it as an Instagram Story', pl: 'Otwórz post i udostępnij go jako Instagram Story' },
  'verify.dmStep2': { de: 'Markiere @{handle} in deiner Story', en: 'Tag @{handle} in your story', pl: 'Oznacz @{handle} w swojej story' },
  'verify.dmStep3claim': { de: 'Kehre zurück zur App und klicke auf „Belohnung einlösen"', en: "Return to the app and click 'Claim reward'", pl: "Wróć do aplikacji i kliknij 'Odbierz nagrodę'" },
  'verify.dmStep3wait': { de: 'Warte — der Künstler schickt dir den Bestätigungs-Link per Instagram DM', en: 'Wait — the artist will send you the confirmation link via Instagram DM', pl: 'Poczekaj — artysta wyśle ci link potwierdzający przez Instagram DM' },
  'verify.dmStep4': { de: 'Klicke den Link in der DM → erhalte deine Belohnung', en: 'Click the link in the DM → receive your reward', pl: 'Kliknij link w DM → odbierz nagrodę' },
  'verify.dmHowTitle': { de: 'So schließt du die Quest ab:', en: 'How to complete the quest:', pl: 'Jak ukończyć quest:' },
  'verify.dmStepsTitle': { de: 'Führe jetzt diese Schritte durch:', en: 'Now follow these steps:', pl: 'Teraz wykonaj te kroki:' },
  'verify.questStart': { de: 'Quest starten', en: 'Start quest', pl: 'Rozpocznij quest' },
  'verify.fbLikeStep1': { de: 'Öffne den Post unten', en: 'Open the post below', pl: 'Otwórz post poniżej' },
  'verify.fbLikeStep2': { de: 'Klicke auf „Gefällt mir" um den Post zu liken', en: 'Click "Like" to like the post', pl: 'Kliknij „Lubię to" aby polubić post' },
  'verify.fbLikeStep3': { de: 'Komm zurück und klicke auf „Prüfen"', en: 'Come back and click "Check"', pl: 'Wróć i kliknij „Sprawdź"' },

  // ── New keys added for verify modals ──────────────────────────────────────
  'verify.likeVerifyTitle': { de: '👍 Like verifizieren', en: '👍 Verify Like', pl: '👍 Zweryfikuj Like' },
  'verify.fbLikeTitle': { de: '👍 Like verifizieren', en: '👍 Verify Like', pl: '👍 Zweryfikuj Like' },
  'verify.fbCommentTitle': { de: 'Facebook Comment Quest', en: 'Facebook Comment Quest', pl: 'Facebook Comment Quest' },
  'verify.engagementVerifyTitle': { de: '❤️🔖 Engagement verifizieren', en: '❤️🔖 Verify Engagement', pl: '❤️🔖 Zweryfikuj Engagement' },
  'verify.repostVerifyTitle': { de: '🔁 Repost verifizieren', en: '🔁 Verify Repost', pl: '🔁 Zweryfikuj Repost' },
  'verify.ttEngagementTitle': { de: '📲 Engagement verifizieren', en: '📲 Verify Engagement', pl: '📲 Zweryfikuj Engagement' },
  'verify.questDone': { de: '🎉 Quest abgeschlossen!', en: '🎉 Quest completed!', pl: '🎉 Quest ukończony!' },
  'verify.storyShared': { de: 'Du hast den Beitrag als Story geteilt und den Künstler markiert.', en: 'You shared the post as a story and tagged the artist.', pl: 'Udostępniłeś post jako story i oznaczyłeś artystę.' },
  'verify.storyClaimDone': { de: 'Du hast den DM-Button geklickt!', en: 'You clicked the DM button!', pl: 'Kliknąłeś przycisk DM!' },
  'verify.dmStep1claim': { de: 'Öffne den Beitrag und teile ihn als <span class="text-pink-400 font-semibold">Instagram Story</span>', en: 'Open the post and share it as an <span class="text-pink-400 font-semibold">Instagram Story</span>', pl: 'Otwórz post i udostępnij go jako <span class="text-pink-400 font-semibold">Instagram Story</span>' },
  'verify.dmStep2claim': { de: 'Markiere <span class="text-pink-400 font-semibold">{handle}</span> in deiner Story', en: 'Tag <span class="text-pink-400 font-semibold">{handle}</span> in your story', pl: 'Oznacz <span class="text-pink-400 font-semibold">{handle}</span> w swojej story' },
  'verify.dmStep4wait': { de: 'Klicke den Link in der DM → erhalte deine <span class="text-green-400 font-semibold">Belohnung</span>', en: 'Click the link in the DM → receive your <span class="text-green-400 font-semibold">reward</span>', pl: 'Kliknij link w DM → odbierz swoją <span class="text-green-400 font-semibold">nagrodę</span>' },
  'verify.secretInputLabel': { de: 'Geheimer Code', en: 'Secret Code', pl: 'Tajny Kod' },
  'verify.secretSubmit': { de: 'Code einreichen', en: 'Submit Code', pl: 'Wyślij Kod' },
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
