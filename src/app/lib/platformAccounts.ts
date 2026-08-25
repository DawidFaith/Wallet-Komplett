/**
 * Konfiguration der "Platform-Accounts" — virtuelle Artist-Wallets ohne echten
 * Clerk-Login, die von Admins verwaltet werden (Setup + Quest-Erstellung).
 * Neue Accounts hier ergänzen, alles andere (Routen, Admin-UI) ist generisch.
 */
export interface PlatformAccountConfig {
  key: string;
  wallet: string;
  displayName: string;
  handle: string;
  facebookPageId: string;
  tiktokHandle: string | null;
  /** Erscheint dieser Account öffentlich in "Verfügbare Künstler" (mit eigenem Freunde-einladen-Programm)? */
  publiclyListed: boolean;
}

export const PLATFORM_ACCOUNTS: Record<string, PlatformAccountConfig> = {
  ecosystem: {
    key: 'ecosystem',
    wallet: 'platform_dfaith_ecosystem',
    displayName: 'D.Faith Ecosystem',
    handle: 'dfaith_ecosystem',
    facebookPageId: process.env.FACEBOOK_PAGE_ID ?? '',
    tiktokHandle: null,
    publiclyListed: true,
  },
  polska: {
    key: 'polska',
    wallet: 'platform_dawid_faith_polska',
    displayName: 'Dawid Faith Polska',
    handle: 'dawidfaith_polska',
    facebookPageId: '528116477058109', // "Dawid Faith Polska"
    tiktokHandle: 'dawidfaith_polska',
    // Gehört inhaltlich zu Dawid Faith — kein eigener, separat auffindbarer
    // Künstler mit eigenem Referral-Programm, nur intern für Quest-Erstellung.
    publiclyListed: false,
  },
};

export function getPlatformAccount(key: string | null | undefined): PlatformAccountConfig {
  return PLATFORM_ACCOUNTS[key ?? 'ecosystem'] ?? PLATFORM_ACCOUNTS.ecosystem;
}
